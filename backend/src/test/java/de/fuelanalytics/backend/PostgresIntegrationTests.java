package de.fuelanalytics.backend;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.PriceObservation;
import de.fuelanalytics.backend.model.Station;
import de.fuelanalytics.backend.model.StationSearchResult;
import de.fuelanalytics.backend.repository.PriceObservationRepository;
import de.fuelanalytics.backend.repository.StationRepository;
import de.fuelanalytics.backend.service.SearchResultStore;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;

/** Explicit opt-in; fixed isolated test DB, never the application's configured datasource. */
@EnabledIfSystemProperty(named = "fuelanalytics.postgres.tests", matches = "true")
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:55433/fuelanalytics_test",
    "spring.datasource.username=fuelanalytics_test", "spring.datasource.password=synthetic_test_only"
})
class PostgresIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired StationRepository stations;
    @Autowired PriceObservationRepository prices;
    @Autowired SearchResultStore store;
    @Autowired TransactionTemplate transaction;
    private static final Instant TIME = Instant.parse("2026-10-17T12:00:00.123456Z");

    private Station station(UUID id, String name) {
        return new Station(id, name, null, "Synthetische Straße", "1", "00000", "Fiktiv",
            new BigDecimal("51.938500"), new BigDecimal("8.873200"), TIME);
    }

    @Test void migratesRealPostgresAndReadsExactDecimalsAndUtcBoundaries() {
        assertEquals("PostgreSQL", jdbc.execute((java.sql.Connection connection) -> connection.getMetaData().getDatabaseProductName()));
        assertEquals(2L, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Long.class));
        transaction.executeWithoutResult(status -> {
            status.setRollbackOnly();
            UUID id = UUID.randomUUID(); stations.save(station(id, "SYNTHETISCH"));
            prices.save(new PriceObservation(id, FuelType.e10, new BigDecimal("1.759"), TIME));
            prices.save(new PriceObservation(id, FuelType.e10, new BigDecimal("1.799"), TIME.plusSeconds(1)));
            var history = prices.findHistory(id, FuelType.e10, TIME, TIME.plusSeconds(1));
            assertEquals(1, history.size());
            assertEquals(new BigDecimal("1.759"), history.getFirst().price());
            assertEquals(TIME, history.getFirst().observedAt());
            assertTrue(prices.findHistory(id, FuelType.diesel, TIME, TIME.plusSeconds(2)).isEmpty());
            assertEquals(new BigDecimal("51.938500"), stations.findById(id).orElseThrow().latitude());
        });
    }

    @Test void rejectsDuplicateStationFuelInstantInPostgres() {
        assertThrows(DataIntegrityViolationException.class, () -> transaction.executeWithoutResult(status -> {
            UUID id = UUID.randomUUID(); stations.save(station(id, "SYNTHETISCH"));
            var price = new PriceObservation(id, FuelType.e10, new BigDecimal("1.759"), TIME);
            prices.save(price); prices.save(price);
        }));
    }

    @Test void rejectsOrphanObservationInPostgres() {
        assertThrows(DataIntegrityViolationException.class, () -> transaction.executeWithoutResult(status ->
            prices.save(new PriceObservation(UUID.randomUUID(), FuelType.e10, new BigDecimal("1.759"), TIME))));
    }

    @Test void rollsBackWholeSearchOnInvalidPriceInPostgres() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        var good = new StationSearchResult.Entry(station(first, "SYNTHETISCH gültig"), true, BigDecimal.ONE,
            Map.of(FuelType.e10, new BigDecimal("1.759")));
        var bad = new StationSearchResult.Entry(station(second, "SYNTHETISCH ungültig"), true, BigDecimal.ONE,
            Map.of(FuelType.e10, BigDecimal.ZERO));
        assertThrows(DataIntegrityViolationException.class, () -> store.save(new StationSearchResult(TIME, List.of(good, bad), 0)));
        assertTrue(stations.findById(first).isEmpty());
        assertTrue(stations.findById(second).isEmpty());
    }
}
