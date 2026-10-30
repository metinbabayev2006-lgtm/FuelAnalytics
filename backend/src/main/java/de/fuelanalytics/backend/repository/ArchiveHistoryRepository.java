package de.fuelanalytics.backend.repository;

import de.fuelanalytics.backend.model.ArchiveHistory;
import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.MonthlyHistory;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class ArchiveHistoryRepository {
    private final JdbcTemplate jdbc;
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");
    public ArchiveHistoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public ArchiveHistory.Status status() {
        var rows = jdbc.query("SELECT * FROM archive_import WHERE id=1", (row,n) -> new ArchiveHistory.Status(true,
                row.getDate("period_start").toLocalDate(), row.getDate("period_end").toLocalDate(), row.getString("source_url"),
                row.getString("license_url"), row.getTimestamp("imported_at").toInstant(), row.getInt("downloaded_days"),
                Arrays.stream(row.getString("cities").split(",")).map(String::strip).toList()));
        return rows.isEmpty() ? new ArchiveHistory.Status(false,null,null,null,null,null,0,List.of()) : rows.getFirst();
    }
    public MonthlyHistory.StationPage stations(String city, FuelType fuel, int offset) {
        var metadata = requireImport();
        var rows = jdbc.query("""
                SELECT s.id,s.name,s.city,s.address,COUNT(DISTINCT (EXTRACT(YEAR FROM p.reference_day)*12+EXTRACT(MONTH FROM p.reference_day))) AS months
                FROM archive_station s JOIN archive_daily_price p ON p.station_id=s.id
                WHERE LOWER(s.city)=LOWER(?) AND p.fuel_type=? AND p.known_seconds>0 AND p.reference_day>=? AND p.reference_day<?
                GROUP BY s.id,s.name,s.city,s.address ORDER BY s.name,s.id LIMIT 101 OFFSET ?
                """, (row,n) -> new MonthlyHistory.StationOption(row.getObject("id",UUID.class),row.getString("name"),row.getString("city"),row.getString("address"),row.getInt("months")),
                city,fuel.name(),metadata.periodStart(),metadata.periodEnd(),offset);
        return new MonthlyHistory.StationPage(rows.stream().limit(100).toList(),rows.size()>100);
    }
    private ArchiveHistory.Status requireImport() {
        var metadata=status();
        if (!metadata.available()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Tankerkönig-Archiv noch nicht importiert");
        return metadata;
    }
    public ArchiveHistory history(FuelType fuel, List<UUID> ids) {
        var metadata=requireImport();
        return new ArchiveHistory(metadata,fuel,"time_weighted_known_intervals",ids.stream().map(id -> series(metadata,fuel,id)).toList());
    }
    private ArchiveHistory.Series series(ArchiveHistory.Status metadata,FuelType fuel,UUID id) {
        record Day(LocalDate date,BigDecimal integral,long known) { }
        var days=jdbc.query("SELECT reference_day,price_seconds,known_seconds FROM archive_daily_price WHERE station_id=? AND fuel_type=? AND reference_day>=? AND reference_day<? ORDER BY reference_day",
                (row,n)->new Day(row.getDate(1).toLocalDate(),row.getBigDecimal(2),row.getLong(3)),id,fuel.name(),metadata.periodStart(),metadata.periodEnd());
        var stations=jdbc.query("SELECT * FROM archive_station WHERE id=?",(row,n)->new MonthlyHistory.StationOption(id,row.getString("name"),row.getString("city"),row.getString("address"),0),id);
        if(stations.isEmpty() || days.stream().noneMatch(day->day.known()>0)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Kein Archivverlauf für diese Tankstelle und diesen Kraftstoff");
        var integrals=new HashMap<YearMonth,BigDecimal>(); var seconds=new HashMap<YearMonth,Long>();
        for(var day:days) { var month=YearMonth.from(day.date()); integrals.merge(month,day.integral(),BigDecimal::add); seconds.merge(month,day.known(),Long::sum); }
        var points=new java.util.ArrayList<ArchiveHistory.Point>();
        for(var month=YearMonth.from(metadata.periodStart());month.atDay(1).isBefore(metadata.periodEnd());month=month.plusMonths(1)) {
            var start=month.atDay(1).isBefore(metadata.periodStart())?metadata.periodStart():month.atDay(1);
            var end=month.plusMonths(1).atDay(1).isAfter(metadata.periodEnd())?metadata.periodEnd():month.plusMonths(1).atDay(1);
            long total=Duration.between(start.atStartOfDay(BERLIN).toInstant(),end.atStartOfDay(BERLIN).toInstant()).getSeconds();
            long known=seconds.getOrDefault(month,0L);
            var mean=known>0?integrals.get(month).divide(BigDecimal.valueOf(known),6,RoundingMode.HALF_UP):null;
            points.add(new ArchiveHistory.Point(month.atDay(1),mean,known,total));
        }
        var station=stations.getFirst();
        return new ArchiveHistory.Series(new MonthlyHistory.StationOption(id,station.name(),station.city(),station.address(),(int)points.stream().filter(p->p.knownSeconds()>0).count()),points);
    }
}
