package de.fuelanalytics.backend.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Imported source monthly means, never individual price observations. */
public record MonthlyHistory(int year, FuelType fuelType, String aggregation, String unit,
                             String sourceUrl, int datasetVersion, String licenseUrl, Instant importedAt,
                             List<Series> series) {
    public record Point(LocalDate month, BigDecimal meanPrice) { }
    public record StationOption(UUID id, String name, String city, String address, int monthCount) { }
    public record StationPage(List<StationOption> entries, boolean hasMore) { }
    public record Series(StationOption station, List<Point> points) { }
}
