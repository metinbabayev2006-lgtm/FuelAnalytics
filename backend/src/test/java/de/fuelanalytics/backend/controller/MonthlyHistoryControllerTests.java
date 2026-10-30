package de.fuelanalytics.backend.controller;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MonthlyHistoryControllerTests {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private UUID id;
    private final java.util.ArrayList<UUID> ids = new java.util.ArrayList<>();
    @BeforeEach void seed() {
        id = UUID.randomUUID(); ids.add(id);
        jdbc.update("INSERT INTO historical_monthly_import (import_year,source_url,dataset_version,license_url,prices_sha256,stations_sha256,excluded_values,unmatched_rows,outside_year_rows) VALUES (2040,?,2,?,?,?,0,0,0)",
                "https://www.kaggle.com/datasets/oles04/petrol-station-germany", "https://creativecommons.org/licenses/by-nc-sa/4.0/", "a".repeat(64), "b".repeat(64));
        jdbc.update("INSERT INTO historical_station VALUES (?,?,?,?)", id, "Synthetic monthly station", "Synthetic City", "Example 1");
        point(id,"2040-03-01","e10","1.8"); point(id,"2040-01-01","e10","1.5"); point(id,"2040-01-01","diesel","1.4");
    }
    @AfterEach void cleanup() {
        for (UUID value : ids) { jdbc.update("DELETE FROM historical_monthly_price WHERE station_id=?",value); jdbc.update("DELETE FROM historical_station WHERE id=?",value); }
        jdbc.update("DELETE FROM historical_monthly_import WHERE import_year=2040"); ids.clear();
    }
    @Test void listsOnlyImportedYearsAndStationMonthCounts() throws Exception {
        assertTrue(json.readTree(get("/years").body()).toString().contains("2040"));
        var response=get("/stations?year=2040&fuelType=e10&city=synthetic%20city");
        assertEquals(200,response.statusCode()); var data=json.readTree(response.body());
        assertEquals(2,data.path("entries").get(0).path("monthCount").asInt());
        assertFalse(data.path("hasMore").asBoolean());
    }
    @Test void returnsSourceMonthlyMeansInOrderWithoutInventingMissingMonth() throws Exception {
        var response=get("/series?year=2040&fuelType=e10&stationIds="+id);
        assertEquals(200,response.statusCode()); var data=json.readTree(response.body());
        assertEquals("monthly_source_mean",data.path("aggregation").asText());
        assertEquals("EUR/l",data.path("unit").asText());
        assertEquals(2,data.path("datasetVersion").asInt());
        var points=data.path("series").get(0).path("points");
        assertEquals(2,points.size()); assertEquals("2040-01-01",points.get(0).path("month").asText());
        assertEquals(new BigDecimal("1.5"),points.get(0).path("meanPrice").decimalValue().stripTrailingZeros());
        assertEquals("2040-03-01",points.get(1).path("month").asText());
        assertFalse(points.get(0).has("observedAt"));
    }
    @Test void filtersCityFuelAndMissingYears() throws Exception {
        assertEquals(0,json.readTree(get("/stations?year=2040&fuelType=e10&city=Other").body()).path("entries").size());
        var diesel=json.readTree(get("/series?year=2040&fuelType=diesel&stationIds="+id).body());
        assertEquals(1,diesel.path("series").get(0).path("points").size());
        assertEquals(404,get("/series?year=2039&fuelType=e10&stationIds="+id).statusCode());
        assertEquals(404,get("/series?year=2040&fuelType=e10&stationIds="+UUID.randomUUID()).statusCode());
    }
    @Test void rejectsInvalidYearFuelIdentifiersAndDuplicateOrExcessiveSelection() throws Exception {
        assertEquals(400,get("/stations?year=1&fuelType=e10&city=Test").statusCode());
        assertEquals(400,get("/stations?year=2040&fuelType=gas&city=Test").statusCode());
        assertEquals(400,get("/stations?year=2040&fuelType=e10&city=Test&offset=-1").statusCode());
        assertEquals(400,get("/series?year=2040&fuelType=e10&stationIds=invalid").statusCode());
        assertEquals(400,get("/series?year=2040&fuelType=e10&stationIds="+id+","+id).statusCode());
        assertEquals(400,get("/series?year=2040&fuelType=e10&stationIds="+String.join(",",List.of(id.toString(),UUID.randomUUID().toString(),UUID.randomUUID().toString(),UUID.randomUUID().toString()))).statusCode());
    }
    @Test void monthlySchemaRejectsDuplicatesZeroPricesAndWrongPeriods() {
        assertThrows(DataIntegrityViolationException.class,()->point(id,"2040-01-01","e10","2"));
        assertThrows(DataIntegrityViolationException.class,()->point(id,"2040-02-01","e10","0"));
        assertThrows(DataIntegrityViolationException.class,()->point(id,"2040-02-03","e10","1.5"));
        assertThrows(DataIntegrityViolationException.class,()->point(id,"2039-02-01","e10","1.5"));
    }
    @Test void paginatesWithoutRepeatingStations() throws Exception {
        for(int n=0;n<101;n++) { UUID value=UUID.randomUUID(); ids.add(value);
            jdbc.update("INSERT INTO historical_station VALUES (?,?,?,?)",value,"Station "+String.format("%03d",n),"Synthetic City",""); point(value,"2040-01-01","e10","1.6"); }
        var first=json.readTree(get("/stations?year=2040&fuelType=e10&city=Synthetic%20City").body());
        var second=json.readTree(get("/stations?year=2040&fuelType=e10&city=Synthetic%20City&offset=100").body());
        assertEquals(100,first.path("entries").size()); assertTrue(first.path("hasMore").asBoolean());
        assertEquals(2,second.path("entries").size()); assertFalse(second.path("hasMore").asBoolean());
        assertNotEquals(first.path("entries").get(99).path("id").asText(),second.path("entries").get(0).path("id").asText());
    }
    private void point(UUID value,String month,String fuel,String price) {
        jdbc.update("INSERT INTO historical_monthly_price VALUES (?,?,?,?,2040)",value,Date.valueOf(month),fuel,new BigDecimal(price));
    }
    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:"+port+"/api/history/monthly"+path)).GET().build(),HttpResponse.BodyHandlers.ofString());
    }
}
