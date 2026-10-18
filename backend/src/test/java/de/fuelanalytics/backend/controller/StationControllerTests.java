package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.PriceObservation;
import de.fuelanalytics.backend.model.Station;
import de.fuelanalytics.backend.repository.PriceObservationRepository;
import de.fuelanalytics.backend.repository.StationRepository;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StationControllerTests {
    @Value("${local.server.port}") int port;
    @Autowired StationRepository stations;
    @Autowired PriceObservationRepository prices;
    @Autowired JdbcTemplate jdbc;
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private UUID stationId;
    private final Instant start = Instant.parse("2026-10-16T10:00:00Z");

    @BeforeEach
    void seedSyntheticStation() {
        stationId = UUID.randomUUID();
        stations.save(new Station(stationId, "Synthetic API station", null, null, null,
                "01234", "Test place", new BigDecimal("52.000000"),
                new BigDecimal("8.900000"), start));
    }

    @AfterEach
    void removeTestData() {
        jdbc.update("DELETE FROM price_observation WHERE station_id = ?", stationId);
        jdbc.update("DELETE FROM station WHERE id = ?", stationId);
    }

    @Test
    void returnsStationAsJson() throws Exception {
        var response = get("/api/stations/" + stationId);
        assertEquals(200, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElseThrow().contains("application/json"));
        JsonNode body = json.readTree(response.body());
        assertEquals(stationId.toString(), body.get("id").asText());
        assertEquals("01234", body.get("postalCode").asText());
    }

    @Test
    void returnsFilteredChronologicalPrices() throws Exception {
        prices.save(new PriceObservation(stationId, FuelType.e10, new BigDecimal("1.799"), start.plusSeconds(60)));
        prices.save(new PriceObservation(stationId, FuelType.e10, new BigDecimal("1.759"), start));
        prices.save(new PriceObservation(stationId, FuelType.diesel, new BigDecimal("1.659"), start));
        var response = get(historyPath("e10", "2026-10-16T10:00:00Z", "2026-10-16T11:00:00Z"));
        assertEquals(200, response.statusCode());
        JsonNode body = json.readTree(response.body());
        assertEquals(2, body.size());
        assertEquals(0, new BigDecimal("1.759").compareTo(body.get(0).get("price").decimalValue()));
        assertEquals("2026-10-16T10:00:00Z", body.get(0).get("observedAt").asText());
    }

    @Test
    void emptyHistoryReturnsJsonArray() throws Exception {
        var response = get(historyPath("e5", "2026-10-16T10:00:00Z", "2026-10-16T11:00:00Z"));
        assertEquals(200, response.statusCode());
        assertEquals("[]", response.body());
    }

    @Test
    void unknownStationReturns404() throws Exception {
        assertEquals(404, get("/api/stations/" + UUID.randomUUID()).statusCode());
        assertEquals(404, get("/api/stations/" + UUID.randomUUID()
                + "/prices?fuelType=e10&from=2026-10-16T10:00:00Z&to=2026-10-16T11:00:00Z").statusCode());
    }

    @Test
    void malformedInputsReturn400() throws Exception {
        assertEquals(400, get("/api/stations/not-a-uuid").statusCode());
        assertEquals(400, get(historyPath("lpg", "2026-10-16T10:00:00Z", "2026-10-16T11:00:00Z")).statusCode());
        assertEquals(400, get(historyPath("e10", "invalid", "2026-10-16T11:00:00Z")).statusCode());
        assertEquals(400, get("/api/stations/" + stationId + "/prices").statusCode());
        assertEquals(400, get(historyPath("e10", "2026-10-16T11:00:00Z", "2026-10-16T10:00:00Z")).statusCode());
    }

    private String historyPath(String fuel, String from, String to) {
        return "/api/stations/" + stationId + "/prices?fuelType=" + fuel + "&from=" + from + "&to=" + to;
    }

    @Test
    void searchRejectsMissingCoordinatesAndExcessiveRadiusWithoutProviderRequest() throws Exception {
        for (String body : new String[]{"{}", "{\"latitude\":52,\"longitude\":8.9,\"radiusKm\":26}"}) {
            var response = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/search"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(400, response.statusCode());
        }
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
