package de.fuelanalytics.backend.repository;
import de.fuelanalytics.backend.model.OpenVanLpg;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NationalLpgRepository {
    private final JdbcTemplate jdbc;
    public NationalLpgRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void save(OpenVanLpg value) {
        // Atomic deduplication; repeated provider timestamps are not new measurements.
        jdbc.update("INSERT INTO national_lpg_snapshot (source_fetched_at, price, retrieved_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                Timestamp.from(value.sourceFetchedAt()), value.price(), Timestamp.from(value.retrievedAt()));
    }
    public List<OpenVanLpg> saved() {
        return jdbc.query("SELECT * FROM national_lpg_snapshot ORDER BY source_fetched_at DESC LIMIT 1000",
                (row, number) -> new OpenVanLpg(row.getBigDecimal("price"), "EUR", "liter",
                        row.getTimestamp("source_fetched_at").toInstant(), row.getTimestamp("retrieved_at").toInstant()));
    }
}
