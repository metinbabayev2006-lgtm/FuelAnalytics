package de.fuelanalytics.backend.location;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class LocationClientTests {
    private HttpServer server;
    private LocationClient client;
    private final AtomicInteger requests = new AtomicInteger();
    private final AtomicLong nanos = new AtomicLong();
    private String requestQuery;
    private String requestPath;
    private String body = """
            {"results":[{"id":123,"name":"Testort","country_code":"DE","admin1":"Testregion",
            "latitude":52.0,"longitude":8.9}]}
            """;
    private int status = 200;

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search", exchange -> {
            requests.incrementAndGet();
            requestQuery = exchange.getRequestURI().getRawQuery();
            byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.createContext("/postal/", exchange -> {
            requests.incrementAndGet();
            requestPath = exchange.getRequestURI().getPath();
            byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        client = new LocationClient(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/search"),
                URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/postal/"),
                HttpClient.newHttpClient(), Clock.fixed(Instant.parse("2026-10-16T12:00:00Z"), ZoneOffset.UTC), nanos::get);
    }

    @AfterEach void tearDown() { server.stop(0); }

    @Test
    void mapsCoordinatesAndCachesNormalizedQuery() {
        var result = client.search("  Testort  ");
        assertEquals(52.0, result.getFirst().latitude());
        assertEquals("Testregion", result.getFirst().region());
        assertEquals(result, client.search("testort"));
        assertEquals(1, requests.get());
        assertTrue(requestQuery.contains("countryCode=DE"));
    }

    @Test
    void encodesSearchTextAndRateLimitsUncachedRequests() {
        client.search("München & Umgebung");
        assertTrue(requestQuery.contains("M%C3%BCnchen+%26+Umgebung"));
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> client.search("Berlin")).getStatusCode().value());
        nanos.addAndGet(Duration.ofSeconds(1).toNanos());
        client.search("Berlin");
        assertEquals(2, requests.get());
    }

    @Test
    void returnsAndCachesNoMatches() {
        body = "{\"generationtime_ms\":0.1}";
        assertTrue(client.search("No matches").isEmpty());
        assertTrue(client.search("No matches").isEmpty());
        assertEquals(1, requests.get());
    }

    @Test
    void rejectsInvalidInputBeforeHttp() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search(" ")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search("x".repeat(101))).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search("1234")).getStatusCode().value());
        assertEquals(0, requests.get());
    }

    @Test
    void rejectsForeignOrMalformedResults() {
        body = body.replace("\"DE\"", "\"FR\"");
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("Paris")).getStatusCode().value());
    }

    @Test
    void reportsProviderFailureWithoutRetry() {
        status = 503;
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("Testort")).getStatusCode().value());
        assertEquals(1, requests.get());
    }

    private String postalBody(String postal) {
        return """
                {"post code":"%s","country abbreviation":"DE","places":[
                  {"place name":"Synthetischer Ort","state":"Testregion","latitude":"52.0","longitude":"8.9"},
                  {"place name":"Synthetischer Ortsteil","latitude":"52.1","longitude":"8.8"}]}
                """.formatted(postal);
    }

    @Test void resolvesPostalCodesWithLeadingZeroAndCachesWithoutCityRequest() {
        body = postalBody("01067");
        var locations = client.search(" 01067 ");
        assertEquals(2, locations.size());
        assertEquals("01067 Synthetischer Ort", locations.getFirst().name());
        assertEquals("Testregion", locations.getFirst().region());
        assertEquals(52.0, locations.getFirst().latitude());
        assertTrue(locations.getFirst().id() < -1_000_000);
        assertNotEquals(locations.getFirst().id(), locations.get(1).id());
        assertEquals("/postal/01067", requestPath);
        assertEquals(locations, client.search("01067"));
        assertEquals(1, requests.get());
        assertNull(requestQuery);
    }

    @Test void cachesUnknownPostalCodeAndReportsProviderFailure() {
        status = 404; body = "{}";
        assertTrue(client.search("99999").isEmpty());
        assertTrue(client.search("99999").isEmpty());
        assertEquals(1, requests.get());
        nanos.addAndGet(Duration.ofSeconds(1).toNanos()); status = 503;
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("01067")).getStatusCode().value());
        assertEquals(2, requests.get());
    }

    @Test void rejectsForeignMismatchedAndMalformedPostalData() {
        String good = postalBody("01067");
        for (String invalid : new String[]{good.replace("\"DE\"", "\"FR\""),
                good.replace("01067", "99999"), good.replace("\"52.0\"", "\"NaN\"").replace("\"52.1\"", "\"91\""),
                "{\"post code\":\"01067\",\"country abbreviation\":\"DE\",\"places\":{}}"}) {
            body = invalid;
            assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("01067")).getStatusCode().value());
            nanos.addAndGet(Duration.ofSeconds(1).toNanos());
        }
    }
}
