package de.fuelanalytics.backend.client;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class EnergyLocationClientTests {
    private HttpServer server;
    private EnergyLocationClient client;
    private String body;
    private String query;
    private int status = 200;
    private int calls;
    private final AtomicLong nanos = new AtomicLong();
    private final Instant now = Instant.parse("2026-10-22T12:00:00Z");
    @BeforeEach void setup() throws Exception {
        body = """
                {"elements":[{"type":"node","id":1,"lat":52.0,"lon":9.0,"tags":{
                "amenity":"charging_station","name":"Test <script>","socket:type2":"2",
                "socket:type2:output":"22 kW","opening_hours":"24/7"}}]}
                """;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/query", exchange -> {
            calls++;
            query = URLDecoder.decode(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8), StandardCharsets.UTF_8);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        client = new EnergyLocationClient(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/query"),
                HttpClient.newHttpClient(), Clock.fixed(now, ZoneOffset.UTC), nanos::get);
    }
    @AfterEach void cleanup() { server.stop(0); }

    @Test void mapsElectricLocationsAndCachesWithoutRequest() {
        var result = client.search(52, 9, 5, "electric");
        assertEquals(now, result.fetchedAt());
        var site = result.stations().getFirst();
        assertEquals("osm:node:1", site.id());
        assertEquals("Test <script>", site.name());
        assertEquals(0, site.distanceKm(), 0.001);
        assertEquals("Typ 2 · 22 kW", site.connectors().getFirst());
        assertEquals("24/7", site.openingHours());
        assertTrue(query.contains("nwr[amenity=charging_station]"));
        assertTrue(query.contains("out center 501"));
        assertEquals(result, client.search(52, 9, 5, "electric"));
        assertEquals(1, calls);
    }
    @Test void mapsGasWaysWithBothGasTypesAndRejectsUntaggedFuel() {
        body = """
                {"elements":[{"type":"way","id":2,"center":{"lat":52.001,"lon":9},
                "tags":{"amenity":"fuel","fuel:lpg":"yes","fuel:cng":"yes","brand":"Testgas"}},
                {"type":"node","id":3,"lat":52,"lon":9,"tags":{"amenity":"fuel"}}]}
                """;
        var result = client.search(52, 9, 5, "gas");
        assertEquals(1, result.stations().size());
        assertEquals("Testgas", result.stations().getFirst().name());
        assertEquals(java.util.List.of("LPG", "CNG"), result.stations().getFirst().services());
        assertTrue(query.contains("\"fuel:lpg\"=yes"));
        assertTrue(query.contains("\"fuel:cng\"=yes"));
    }
    @Test void rejectsPrivateNonCarInvalidAndOutsideRadius() {
        body = """
                {"elements":[
                {"type":"node","id":1,"lat":52,"lon":9,"tags":{"amenity":"charging_station","access":"private"}},
                {"type":"node","id":2,"lat":52,"lon":9,"tags":{"amenity":"charging_station","motorcar":"no"}},
                {"type":"node","id":3,"lat":200,"lon":9,"tags":{"amenity":"charging_station"}},
                {"type":"node","id":4,"lat":53,"lon":9,"tags":{"amenity":"charging_station"}},
                {"type":"way","id":5,"tags":{"amenity":"charging_station"}}]}
                """;
        assertTrue(client.search(52, 9, 5, "electric").stations().isEmpty());
    }
    @Test void validatesBeforeRequest() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 26, "electric")).getStatusCode().value());
        assertThrows(ResponseStatusException.class, () -> client.search(Double.NaN, 9, 5, "gas"));
        assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5, "e10"));
        assertEquals(0, calls);
    }
    @Test void throttlesUncachedSearchButNotCachedResult() {
        client.search(52, 9, 5, "electric");
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5, "gas")).getStatusCode().value());
        nanos.addAndGet(Duration.ofSeconds(5).toNanos());
        body = "{\"elements\":[]}";
        assertTrue(client.search(52, 9, 5, "gas").stations().isEmpty());
        assertEquals(2, calls);
    }
    @Test void rejectsPartialProviderResponseAndDoesNotCacheIt() {
        body = "{\"elements\":[],\"remark\":\"runtime error: timeout\"}";
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5, "gas")).getStatusCode().value());
        nanos.addAndGet(Duration.ofSeconds(5).toNanos());
        body = "{\"elements\":[]}";
        assertTrue(client.search(52, 9, 5, "gas").stations().isEmpty());
        assertEquals(2, calls);
    }
    @Test void preservesProviderRateLimit() {
        status = 429;
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5, "gas")).getStatusCode().value());
    }
    @Test void reportsUnavailableProviderWithoutRetry() {
        status = 503;
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search(52, 9, 5, "electric")).getStatusCode().value());
        assertEquals(1, calls);
    }
}
