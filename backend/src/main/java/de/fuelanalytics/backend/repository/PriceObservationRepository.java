package de.fuelanalytics.backend.repository;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.PriceObservation;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PriceObservationRepository {
    private final JdbcTemplate jdbc;

    public PriceObservationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void save(PriceObservation observation) {
        jdbc.update("""
                INSERT INTO price_observation (station_id, fuel_type, price, observed_at)
                VALUES (?, ?, ?, ?)
                """, observation.stationId(), observation.fuelType().name(),
                observation.price(), Timestamp.from(observation.observedAt()));
    }

    /** Reads a chronological history for the half-open interval [from, to). */
    public List<PriceObservation> findHistory(UUID stationId, FuelType fuelType,
                                             Instant from, Instant to) {
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("from must be before to");
        }
        return jdbc.query("""
                SELECT station_id, fuel_type, price, observed_at FROM price_observation
                WHERE station_id = ? AND fuel_type = ? AND observed_at >= ? AND observed_at < ?
                ORDER BY observed_at ASC
                """, (row, number) -> new PriceObservation(
                row.getObject("station_id", UUID.class),
                FuelType.valueOf(row.getString("fuel_type")), row.getBigDecimal("price"),
                row.getTimestamp("observed_at").toInstant()),
                stationId, fuelType.name(), Timestamp.from(from), Timestamp.from(to));
    }
}
