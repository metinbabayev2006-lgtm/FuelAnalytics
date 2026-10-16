package de.fuelanalytics.backend;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
class PriceObservationSchemaTests {
    @Autowired
    JdbcTemplate jdbc;

    private UUID stationId;
    private final OffsetDateTime observedAt = OffsetDateTime.parse("2026-10-15T18:00:00Z");

    @BeforeEach
    void createSyntheticStation() {
        stationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO station (id, name, latitude, longitude, updated_at)
                VALUES (?, 'Synthetic test station', 52.0, 8.9, ?)
                """, stationId, observedAt);
    }

    @Test
    void preservesThreeDecimalPlaces() {
        insert(stationId, "e10", "1.759");
        assertEquals(new BigDecimal("1.759"), jdbc.queryForObject(
                "SELECT price FROM price_observation WHERE station_id = ?",
                BigDecimal.class, stationId));
    }

    @Test
    void rejectsDuplicateObservation() {
        insert(stationId, "e10", "1.759");
        assertThrows(DataIntegrityViolationException.class,
                () -> insert(stationId, "e10", "1.759"));
    }

    @Test
    void rejectsUnknownStation() {
        assertThrows(DataIntegrityViolationException.class,
                () -> insert(UUID.randomUUID(), "diesel", "1.659"));
    }

    @Test
    void rejectsUnsupportedFuel() {
        assertThrows(DataIntegrityViolationException.class,
                () -> insert(stationId, "lpg", "1.000"));
    }

    @Test
    void rejectsZeroPrice() {
        assertThrows(DataIntegrityViolationException.class,
                () -> insert(stationId, "e5", "0.000"));
    }

    private void insert(UUID id, String fuel, String price) {
        jdbc.update("""
                INSERT INTO price_observation (station_id, fuel_type, price, observed_at)
                VALUES (?, ?, ?, ?)
                """, id, fuel, new BigDecimal(price), observedAt);
    }
}
