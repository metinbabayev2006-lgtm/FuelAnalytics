package de.fuelanalytics.backend.model;
import java.math.BigDecimal;
import java.time.Instant;

/** Source timestamp denotes retrieval by OpenVan, not a verified pump-price date. */
public record OpenVanLpg(BigDecimal price, String currency, String unit, Instant sourceFetchedAt, Instant retrievedAt) { }
