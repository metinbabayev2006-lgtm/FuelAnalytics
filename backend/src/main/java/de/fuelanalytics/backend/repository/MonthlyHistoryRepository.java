package de.fuelanalytics.backend.repository;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.MonthlyHistory;
import de.fuelanalytics.backend.model.MonthlyHistory.*;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class MonthlyHistoryRepository {
    private final JdbcTemplate jdbc;
    public MonthlyHistoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Integer> years() {
        return jdbc.queryForList("SELECT import_year FROM historical_monthly_import ORDER BY import_year DESC", Integer.class);
    }
    public StationPage stations(int year, FuelType fuel, String city, int offset) {
        var entries = jdbc.query("""
                SELECT s.id, s.name, s.city, s.address, COUNT(*) AS month_count
                FROM historical_station s JOIN historical_monthly_price p ON p.station_id = s.id
                WHERE p.import_year = ? AND p.fuel_type = ? AND LOWER(s.city) = LOWER(?)
                GROUP BY s.id, s.name, s.city, s.address ORDER BY s.name, s.id LIMIT 101 OFFSET ?
                """, (row, n) -> new StationOption(row.getObject("id", UUID.class), row.getString("name"),
                        row.getString("city"), row.getString("address"), row.getInt("month_count")), year, fuel.name(), city, offset);
        return new StationPage(entries.stream().limit(100).toList(), entries.size() > 100);
    }
    public MonthlyHistory history(int year, FuelType fuel, List<UUID> ids) {
        var imports = jdbc.query("SELECT * FROM historical_monthly_import WHERE import_year = ?", (row, n) ->
                new MonthlyHistory(year, fuel, "monthly_source_mean", "EUR/l", row.getString("source_url"), row.getInt("dataset_version"),
                        row.getString("license_url"), row.getTimestamp("imported_at").toInstant(), List.<Series>of()), year);
        if (imports.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Für dieses Jahr wurden keine historischen Daten importiert");
        var series = ids.stream().map(id -> {
            var points = jdbc.query("""
                    SELECT reference_month, mean_price FROM historical_monthly_price
                    WHERE station_id = ? AND import_year = ? AND fuel_type = ? ORDER BY reference_month
                    """, (row, n) -> new Point(row.getDate("reference_month").toLocalDate(), row.getBigDecimal("mean_price")), id, year, fuel.name());
            var stations = jdbc.query("SELECT * FROM historical_station WHERE id = ?", (row, n) ->
                    new StationOption(id, row.getString("name"), row.getString("city"), row.getString("address"), points.size()), id);
            if (stations.isEmpty() || points.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Kein Monatsverlauf für diese Tankstelle und Auswahl");
            return new Series(stations.getFirst(), points);
        }).toList();
        var metadata = imports.getFirst();
        return new MonthlyHistory(year, fuel, metadata.aggregation(), metadata.unit(), metadata.sourceUrl(), metadata.datasetVersion(),
                metadata.licenseUrl(), metadata.importedAt(), series);
    }
}
