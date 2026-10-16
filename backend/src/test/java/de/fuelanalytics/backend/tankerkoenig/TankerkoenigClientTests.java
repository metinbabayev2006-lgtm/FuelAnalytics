package de.fuelanalytics.backend.tankerkoenig;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class TankerkoenigClientTests {
    private HttpServer server;
    private URI endpoint;
    private final AtomicInteger requests = new AtomicInteger();
    private final AtomicLong clock = new AtomicLong();
    private String response = "{\"ok\":true,\"stations\":[]}";
    private int status = 200;
    // Synthetic token for the local fake server; never a provider or demo key.
    private final String token = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    @BeforeEach
    void startFakeProvider() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/list.php", exchange -> {
            requests.incrementAndGet();
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/list.php");
    }

    @AfterEach
    void stopFakeProvider() { server.stop(0); }

    private TankerkoenigClient client(String key) {
        return new TankerkoenigClient(key, endpoint, HttpClient.newHttpClient(), clock::get);
    }

    @Test
    void acceptsEmptyResultAndPreservesUnavailablePrices() {
        response = "{\"ok\":true,\"stations\":[{\"e10\":false}]}";
        var result = client(token).search(52, 8.9, 5);
        assertNotNull(result.observedAt());
        assertTrue(result.stations().get(0).get("e10").isBoolean());
    }

    @Test
    void limitsActualRequestsWithoutSleeping() {
        var client = client(token);
        assertTrue(client.search(52, 8.9, 5).stations().isEmpty());
        assertEquals(429, assertThrows(ResponseStatusException.class,
                () -> client.search(52, 8.9, 5)).getStatusCode().value());
        assertEquals(1, requests.get());
        clock.addAndGet(Duration.ofSeconds(61).toNanos());
        client.search(52, 8.9, 5);
        assertEquals(2, requests.get());
    }

    @Test
    void rejectsInvalidInputsBeforeRequest() {
        var client = client(token);
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> client.search(Double.NaN, 8.9, 5)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class,
                () -> client.search(52, 8.9, 26)).getStatusCode().value());
        assertEquals(503, assertThrows(ResponseStatusException.class,
                () -> client("").search(52, 8.9, 5)).getStatusCode().value());
        assertEquals(0, requests.get());
    }

    @Test
    void sanitizesProviderErrorsAndDoesNotRetry() {
        response = "{\"ok\":false,\"message\":\"" + token + "\"}";
        var error = assertThrows(ResponseStatusException.class,
                () -> client(token).search(52, 8.9, 5));
        assertEquals(502, error.getStatusCode().value());
        assertFalse(error.toString().contains(token));
        assertNull(error.getCause());
        assertEquals(1, requests.get());
    }

    @Test
    void rejectsHttpFailureAndMalformedJson() {
        status = 503;
        assertEquals(502, assertThrows(ResponseStatusException.class,
                () -> client(token).search(52, 8.9, 5)).getStatusCode().value());
        status = 200;
        response = "not JSON";
        assertEquals(502, assertThrows(ResponseStatusException.class,
                () -> client(token).search(52, 8.9, 5)).getStatusCode().value());
    }
}
