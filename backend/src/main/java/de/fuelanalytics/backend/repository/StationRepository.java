package de.fuelanalytics.backend.repository;

import de.fuelanalytics.backend.model.Station;
import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.StoredHistory;
import java.util.List;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Parameterized SQL keeps incoming values separate from SQL commands. */
@Repository
public class StationRepository {
    private final JdbcTemplate jdbc;

    public StationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Inserts a new station; an existing ID is rejected by the database. */
    public void save(Station station) {
        jdbc.update("""
                INSERT INTO station
                    (id, name, brand, street, house_number, postal_code, place,
                     latitude, longitude, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, station.id(), station.name(), station.brand(), station.street(),
                station.houseNumber(), station.postalCode(), station.place(),
                station.latitude(), station.longitude(), Timestamp.from(station.updatedAt()));
    }

    public Optional<Station> findById(UUID id) {
        return jdbc.query("SELECT * FROM station WHERE id = ?",
                (row, rowNumber) -> mapStation(row), id).stream().findFirst();
    }

    /** Returns false when no station with this ID exists. */
    public boolean update(Station station) {
        return jdbc.update("""
                UPDATE station SET name = ?, brand = ?, street = ?, house_number = ?,
                    postal_code = ?, place = ?, latitude = ?, longitude = ?, updated_at = ?
                WHERE id = ?
                """, station.name(), station.brand(), station.street(), station.houseNumber(),
                station.postalCode(), station.place(), station.latitude(), station.longitude(),
                Timestamp.from(station.updatedAt()), station.id()) == 1;
    }

    /** Includes only stations with stored prices for the requested fuel; never calls a provider. */
    public List<StoredHistory> archive(FuelType fuel, int offset) {
        return jdbc.query("""
                SELECT s.*, h.sample_count, h.first_observed, h.last_observed
                FROM station s JOIN (
                    SELECT station_id, COUNT(*) AS sample_count, MIN(observed_at) AS first_observed,
                           MAX(observed_at) AS last_observed
                    FROM price_observation WHERE fuel_type = ? GROUP BY station_id
                ) h ON s.id = h.station_id
                ORDER BY s.name, s.id LIMIT 101 OFFSET ?
                """, (row, number) -> new StoredHistory(mapStation(row), row.getLong("sample_count"),
                row.getTimestamp("first_observed").toInstant(), row.getTimestamp("last_observed").toInstant()), fuel.name(), offset);
    }

    private static Station mapStation(ResultSet row) throws SQLException {
        return new Station(row.getObject("id", UUID.class), row.getString("name"),
                row.getString("brand"), row.getString("street"), row.getString("house_number"),
                row.getString("postal_code"), row.getString("place"),
                row.getBigDecimal("latitude"), row.getBigDecimal("longitude"),
                row.getTimestamp("updated_at").toInstant());
    }
}
