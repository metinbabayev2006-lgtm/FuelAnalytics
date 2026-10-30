package de.fuelanalytics.backend.client;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class OpenVanLpgClientTests {
    HttpServer server;
    int calls;
    int status = 200;
    String body = """
        {"success":true,"data":{"DE":{"country_code":"DE","currency":"USD","unit":"gallon",
        "currencies":{"lpg":"EUR"},"units":{"lpg":"liter"},"prices":{"lpg":1.095,"cng":null},
        "fetched_at":"2026-10-26T04:04:22+01:00"}}}
        """;
    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/prices", exchange -> {
            calls++; byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
        }); server.start();
    }
    OpenVanLpgClient client() { return new OpenVanLpgClient(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/prices"),
            HttpClient.newHttpClient(), Clock.fixed(Instant.parse("2026-10-30T12:00:00Z"), ZoneOffset.UTC)); }
    @AfterEach void stop() { server.stop(0); }
    @Test void respectsFuelSpecificUnitsAndCachesRepeatedClicks() {
        var client = client(); var result = client.fetch();
        assertEquals("1.095", result.price().toPlainString());
        assertEquals("EUR", result.currency()); assertEquals("liter", result.unit());
        assertEquals(Instant.parse("2026-10-26T03:04:22Z"), result.sourceFetchedAt());
        assertEquals(result, client.fetch()); assertEquals(1, calls);
    }
    @Test void neverTreatsMissingGasPricesOrWrongUnitsAsEuroPerLitre() {
        String valid = body;
        for (String invalid : new String[]{valid.replace("1.095", "null"), valid.replace("1.095", "0"),
                valid.replace("\"lpg\":\"liter\"", "\"lpg\":\"kg\""),
                valid.replace("\"lpg\":\"EUR\"", "\"lpg\":\"USD\""), valid.replace("2026-10-26", "2027-10-26")}) {
            body = invalid; assertEquals(502, assertThrows(ResponseStatusException.class, () -> client().fetch()).getStatusCode().value());
        }
    }
    @Test void providerFailureHasTenMinuteCooldownWithoutAutomaticRetry() {
        status = 503; var client = client();
        assertEquals(502, assertThrows(ResponseStatusException.class, client::fetch).getStatusCode().value());
        assertEquals(429, assertThrows(ResponseStatusException.class, client::fetch).getStatusCode().value());
        assertEquals(1, calls);
    }
}
