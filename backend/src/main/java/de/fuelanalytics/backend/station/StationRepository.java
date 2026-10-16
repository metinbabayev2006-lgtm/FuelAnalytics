package de.fuelanalytics.backend.station;

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

    private static Station mapStation(ResultSet row) throws SQLException {
        return new Station(row.getObject("id", UUID.class), row.getString("name"),
                row.getString("brand"), row.getString("street"), row.getString("house_number"),
                row.getString("postal_code"), row.getString("place"),
                row.getBigDecimal("latitude"), row.getBigDecimal("longitude"),
                row.getTimestamp("updated_at").toInstant());
    }
}
