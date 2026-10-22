package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.client.EnergyLocationClient;
import de.fuelanalytics.backend.model.EnergySearchResult;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EnergySearchControllerTests {
    @Value("${local.server.port}") int port;
    @MockitoBean EnergyLocationClient locations;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test void servesLocationContractWithoutPriceOrOpenStatus() throws Exception {
        when(locations.search(52, 9, 5, "electric")).thenReturn(new EnergySearchResult(Instant.parse("2026-10-22T12:00:00Z"),
                "electric", List.of(new EnergySearchResult.Site("osm:node:1", "Synthetic charger", 52, 9, 0,
                "", List.of("Elektro"), null, null, List.of("CCS"))), false));
        var response = post("{\"latitude\":52,\"longitude\":9,\"radiusKm\":5,\"kind\":\"electric\"}");
        assertEquals(200, response.statusCode());
        var data = new ObjectMapper().readTree(response.body());
        assertEquals("electric", data.path("kind").asText());
        assertEquals("osm:node:1", data.path("stations").get(0).path("id").asText());
        assertFalse(data.path("stations").get(0).has("prices"));
        assertFalse(data.path("stations").get(0).has("open"));
    }
    @Test void rejectsMissingCoordinatesBeforeCallingProvider() throws Exception {
        assertEquals(400, post("{\"kind\":\"gas\"}").statusCode());
        verifyNoInteractions(locations);
    }
    @Test void rejectsMalformedJson() throws Exception {
        assertEquals(400, post("not json").statusCode());
        verifyNoInteractions(locations);
    }
    private HttpResponse<String> post(String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/energy/search"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
