package de.fuelanalytics.backend.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ArchiveHistory(Status metadata, FuelType fuelType, String aggregation, List<Series> series) {
    public record Status(boolean available, LocalDate periodStart, LocalDate periodEnd, String sourceUrl,
                         String licenseUrl, Instant importedAt, int downloadedDays, List<String> cities) { }
    public record Point(LocalDate month, BigDecimal meanPrice, long knownSeconds, long totalSeconds) { }
    public record Series(MonthlyHistory.StationOption station, List<Point> points) { }
}
