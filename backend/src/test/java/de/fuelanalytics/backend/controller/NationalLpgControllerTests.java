package de.fuelanalytics.backend.controller;
import de.fuelanalytics.backend.client.OpenVanLpgClient;
import de.fuelanalytics.backend.model.OpenVanLpg;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class NationalLpgControllerTests {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean OpenVanLpgClient provider;
    final HttpClient http = HttpClient.newHttpClient();
    final ObjectMapper json = new ObjectMapper();
    final Instant sample = Instant.parse("2011-03-14T12:34:56Z");
    HttpResponse<String> call(String method, String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .method(method, HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
    }
    @AfterEach void clean() { jdbc.update("DELETE FROM national_lpg_snapshot WHERE source_fetched_at = ?", java.sql.Timestamp.from(sample)); }
    @Test void servesOfficialHistoryWithCorrectUnitsChronologyAndKnownConversionsWithoutProvider() throws Exception {
        var response = call("GET", "/api/lpg/national"); assertEquals(200, response.statusCode());
        var data = json.readTree(response.body()); assertEquals("EUR/l", data.get("unit").asText()); assertTrue(data.get("taxesIncluded").asBoolean());
        var points = data.get("points"); assertTrue(points.size() >= 1000);
        assertEquals("2005-01-03", points.get(0).get("date").asText());
        assertEquals(0, new BigDecimal("0.5228").compareTo(points.get(0).get("price").decimalValue()));
        String previous = "";
        for (var point : points) { String date = point.get("date").asText(); assertTrue(date.compareTo(previous) > 0); previous = date; }
        verifyNoInteractions(provider);
    }
    @Test void persistsNationalSnapshotOnceWithoutInventingStationObservations() throws Exception {
        int before = jdbc.queryForObject("SELECT count(*) FROM price_observation", Integer.class);
        when(provider.fetch()).thenReturn(new OpenVanLpg(new BigDecimal("1.095"), "EUR", "liter", sample, Instant.now()));
        assertEquals(200, call("POST", "/api/lpg/openvan").statusCode());
        assertEquals(200, call("POST", "/api/lpg/openvan").statusCode());
        var saved = json.readTree(call("GET", "/api/lpg/openvan/saved").body());
        assertEquals(1, saved.size()); assertEquals(sample.toString(), saved.get(0).get("sourceFetchedAt").asText());
        assertEquals(0, new BigDecimal("1.095").compareTo(saved.get(0).get("price").decimalValue()));
        assertEquals(before, jdbc.queryForObject("SELECT count(*) FROM price_observation", Integer.class));
    }
}
