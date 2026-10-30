package de.fuelanalytics.backend.model;
import java.time.Instant;

public record StoredHistory(Station station, long count, Instant firstObservedAt, Instant lastObservedAt) { }
