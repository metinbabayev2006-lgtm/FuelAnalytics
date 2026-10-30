package de.fuelanalytics.backend.client;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class AddressClientTests {
    HttpServer server;
    AddressClient client;
    AtomicLong tick = new AtomicLong();
    int requests;
    int status = 200;
    String query;
    String agent;
    String body = """
        [{"place_id":12,"display_name":"Teststraße 4, Testort, Deutschland","lat":"52.0","lon":"8.9",
          "address":{"country_code":"de"}}]
        """;
    @BeforeEach void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/search", exchange -> {
            requests++; query = exchange.getRequestURI().getRawQuery(); agent = exchange.getRequestHeaders().getFirst("User-Agent");
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
        });
        server.start();
        client = new AddressClient(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/search"),
                HttpClient.newHttpClient(), Clock.systemUTC(), tick::get);
    }
    @AfterEach void stop() { server.stop(0); }
    @Test void encodesAddressRestrictsCountryAndCaches() {
        var result = client.search(" Teststraße 4, Testort ");
        assertEquals(52.0, result.getFirst().latitude());
        assertTrue(result.getFirst().id() < -100_000_000_000L);
        assertTrue(query.contains("countrycodes=de"));
        assertTrue(query.contains("Teststra%C3%9Fe+4%2C+Testort"));
        assertTrue(agent.contains("FuelAnalytics"));
        assertEquals(result, client.search("teststraße 4, testort"));
        assertEquals(1, requests);
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> client.search("Andere Straße")).getStatusCode().value());
        tick.addAndGet(Duration.ofSeconds(1).toNanos());
        client.search("Andere Straße");
        assertEquals(2, requests);
    }
    @Test void rejectsInvalidQueriesWithoutNetwork() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search("x")).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> client.search("x".repeat(101))).getStatusCode().value());
        assertEquals(0, requests);
    }
    @Test void rejectsForeignCoordinatesAndMalformedPayloads() {
        body = body.replace("\"de\"", "\"fr\"");
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("Teststraße")).getStatusCode().value());
        tick.addAndGet(Duration.ofSeconds(1).toNanos()); body = "{}";
        assertEquals(502, assertThrows(ResponseStatusException.class, () -> client.search("Teststraße")).getStatusCode().value());
    }
    @Test void cachesEmptyMatchesAndDoesNotRetryProviderFailures() {
        body = "[]"; assertTrue(client.search("Kein Treffer").isEmpty());
        assertTrue(client.search("Kein Treffer").isEmpty()); assertEquals(1, requests);
        tick.addAndGet(Duration.ofSeconds(1).toNanos()); status = 429;
        assertEquals(429, assertThrows(ResponseStatusException.class, () -> client.search("Andere Straße")).getStatusCode().value());
        assertEquals(2, requests);
    }
}
