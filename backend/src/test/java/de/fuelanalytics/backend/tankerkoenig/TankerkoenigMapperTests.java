package de.fuelanalytics.backend.tankerkoenig;

import de.fuelanalytics.backend.price.FuelType;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;

class TankerkoenigMapperTests {
    private final ObjectMapper json = new ObjectMapper();
    static final String ROW = """
            {"id":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "name":"Synthetic station",
             "lat":52.1234567,"lng":8.9,"dist":1.2,"isOpen":true,
             "postCode":1234,"e10":1.759,"e5":false,"diesel":null}
            """;

    private StationSearchResult map(String rows) {
        return new TankerkoenigMapper().map(new TankerkoenigClient.SearchResponse(
                Instant.parse("2026-10-16T12:00:00Z"), json.readTree(rows)));
    }

    @Test
    void convertsMetadataAndOnlyAvailablePrices() {
        var result = map("[" + ROW + "]");
        assertEquals(0, result.rejectedStations());
        var entry = result.stations().getFirst();
        assertEquals("01234", entry.station().postalCode());
        assertEquals(new BigDecimal("52.123457"), entry.station().latitude());
        assertEquals(1, entry.prices().size());
        assertEquals(new BigDecimal("1.759"), entry.prices().get(FuelType.e10));
    }

    @Test
    void retainsClosedStationWithoutPrices() {
        var entry = map("[" + ROW.replace("true", "false") + "]").stations().getFirst();
        assertFalse(entry.open());
        assertTrue(entry.prices().isEmpty());
    }

    @Test
    void reportsInvalidAndDuplicateStations() {
        var result = map("[" + ROW + "," + ROW + "," + ROW.replace("52.1234567", "95") + "]");
        assertEquals(1, result.stations().size());
        assertEquals(2, result.rejectedStations());
    }

    @Test
    void rejectsInvalidPricesInsteadOfRoundingOrStoringZero() {
        assertEquals(1, map("[" + ROW.replace("1.759", "1.7591") + "]").rejectedStations());
        assertEquals(1, map("[" + ROW.replace("1.759", "0") + "]").rejectedStations());
    }
}
