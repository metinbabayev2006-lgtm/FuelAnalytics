package de.fuelanalytics.backend.service;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.Station;
import de.fuelanalytics.backend.model.StationSearchResult;
import de.fuelanalytics.backend.repository.PriceObservationRepository;
import de.fuelanalytics.backend.repository.StationRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class SearchResultStoreTests {
    @Autowired SearchResultStore store;
    @Autowired StationRepository stations;
    @Autowired PriceObservationRepository prices;
    @Autowired JdbcTemplate jdbc;

    private Station station(UUID id, String name, Instant time) {
        return new Station(id, name, null, null, null, null, null,
                new BigDecimal("52.000000"), new BigDecimal("8.900000"), time);
    }

    @Test
    void storesPricesAndUpdatesStationOnNextObservation() {
        UUID id = UUID.randomUUID();
        Instant time = Instant.parse("2026-10-16T12:00:00Z");
        try {
            for (int i = 0; i < 2; i++) {
                var entry = new StationSearchResult.Entry(station(id, "Synthetic " + i, time.plusSeconds(i)),
                        true, BigDecimal.ONE, Map.of(FuelType.e10, new BigDecimal("1.759")));
                store.save(new StationSearchResult(time.plusSeconds(i), List.of(entry), 0));
            }
            assertEquals("Synthetic 1", stations.findById(id).orElseThrow().name());
            assertEquals(2, prices.findHistory(id, FuelType.e10, time, time.plusSeconds(2)).size());
        } finally {
            jdbc.update("DELETE FROM price_observation WHERE station_id = ?", id);
            jdbc.update("DELETE FROM station WHERE id = ?", id);
        }
    }

    @Test
    void rollsBackAllWritesWhenOnePriceFails() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        Instant time = Instant.parse("2026-10-16T12:00:00Z");
        var good = new StationSearchResult.Entry(station(first, "Synthetic good", time), true,
                BigDecimal.ONE, Map.of(FuelType.e10, new BigDecimal("1.759")));
        var bad = new StationSearchResult.Entry(station(second, "Synthetic bad", time), true,
                BigDecimal.ONE, Map.of(FuelType.e10, BigDecimal.ZERO));
        assertThrows(DataIntegrityViolationException.class,
                () -> store.save(new StationSearchResult(time, List.of(good, bad), 0)));
        assertTrue(stations.findById(first).isEmpty());
        assertTrue(stations.findById(second).isEmpty());
    }
}
