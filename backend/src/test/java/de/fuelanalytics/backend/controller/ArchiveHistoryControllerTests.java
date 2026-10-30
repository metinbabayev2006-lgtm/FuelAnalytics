package de.fuelanalytics.backend.controller;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class ArchiveHistoryControllerTests {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    final HttpClient http=HttpClient.newHttpClient();
    final ObjectMapper json=new ObjectMapper();
    UUID id;
    @BeforeEach void seed() {
        id=UUID.randomUUID();
        jdbc.update("INSERT INTO archive_import (id,period_start,period_end,source_url,license_url,manifest_sha256,downloaded_days,cities) VALUES (1,'2026-03-28','2026-03-30','https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data','https://creativecommons.org/licenses/by-nc-sa/4.0/',?,3,'Detmold')","a".repeat(64));
        jdbc.update("INSERT INTO archive_station VALUES (?,?,?,?)",id,"Synthetic archive station","Detmold","Example 1");
        jdbc.update("INSERT INTO archive_daily_price VALUES (?,'2026-03-28','e10',129600,86400,86400)",id);
        jdbc.update("INSERT INTO archive_daily_price VALUES (?,'2026-03-29','e10',207000,82800,82800)",id);
    }
    @AfterEach void cleanup() { jdbc.update("DELETE FROM archive_daily_price"); jdbc.update("DELETE FROM archive_station"); jdbc.update("DELETE FROM archive_import"); }
    @Test void statusAndStationsAreLocalAndSourceLabelled() throws Exception {
        var status=json.readTree(get("/status").body());
        assertTrue(status.path("available").asBoolean()); assertEquals("2026-03-28",status.path("periodStart").asText());
        var stations=json.readTree(get("/stations?city=detmold&fuelType=e10").body());
        assertEquals(id.toString(),stations.path("entries").get(0).path("id").asText());
        assertEquals(1,stations.path("entries").get(0).path("monthCount").asInt());
        assertEquals(0,json.readTree(get("/stations?city=Berlin&fuelType=e10").body()).path("entries").size());
    }
    @Test void monthlyMeansUseSecondsAndBerlinDaylightSavingNotEqualDayWeights() throws Exception {
        var response=get("/series?fuelType=e10&stationIds="+id); assertEquals(200,response.statusCode());
        var data=json.readTree(response.body()); var point=data.path("series").get(0).path("points").get(0);
        assertEquals("time_weighted_known_intervals",data.path("aggregation").asText());
        assertEquals(169200,point.path("totalSeconds").asLong()); assertEquals(169200,point.path("knownSeconds").asLong());
        assertEquals(1.989362,point.path("meanPrice").asDouble(),0.000001);
    }
    @Test void missingIntervalsRemainVisibleAndNeverBecomeZeros() throws Exception {
        jdbc.update("DELETE FROM archive_daily_price WHERE reference_day='2026-03-29'");
        var data=json.readTree(get("/series?fuelType=e10&stationIds="+id).body());
        var point=data.path("series").get(0).path("points").get(0);
        assertEquals(86400,point.path("knownSeconds").asLong()); assertEquals(169200,point.path("totalSeconds").asLong());
        assertEquals(1.5,point.path("meanPrice").asDouble());
    }
    @Test void validatesIdsFuelPaginationAndReportsAbsentImport() throws Exception {
        assertEquals(400,get("/series?fuelType=e10&stationIds="+id+","+id).statusCode());
        assertEquals(400,get("/series?fuelType=e10&stationIds=bad").statusCode());
        assertEquals(400,get("/stations?city=Detmold&fuelType=lpg").statusCode());
        assertEquals(400,get("/stations?city=Detmold&fuelType=e10&offset=-1").statusCode());
        assertEquals(404,get("/series?fuelType=e10&stationIds="+UUID.randomUUID()).statusCode());
        jdbc.update("DELETE FROM archive_daily_price"); jdbc.update("DELETE FROM archive_import");
        assertFalse(json.readTree(get("/status").body()).path("available").asBoolean());
        assertEquals(404,get("/stations?city=Detmold&fuelType=e10").statusCode());
    }
    private HttpResponse<String> get(String path) throws Exception { return http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/history/archive"+path)).GET().build(),HttpResponse.BodyHandlers.ofString()); }
}
