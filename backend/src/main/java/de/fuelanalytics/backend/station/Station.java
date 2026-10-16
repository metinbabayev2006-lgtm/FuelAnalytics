package de.fuelanalytics.backend.station;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Station metadata; changing fuel prices are stored separately. */
public record Station(
        UUID id,
        String name,
        String brand,
        String street,
        String houseNumber,
        String postalCode,
        String place,
        BigDecimal latitude,
        BigDecimal longitude,
        Instant updatedAt) {
}
