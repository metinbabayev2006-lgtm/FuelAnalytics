package de.fuelanalytics.backend.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A collected price, in EUR/litre, at our observation time. */
public record PriceObservation(
        UUID stationId,
        FuelType fuelType,
        BigDecimal price,
        Instant observedAt) {
}
