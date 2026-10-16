package de.fuelanalytics.backend.tankerkoenig;

import de.fuelanalytics.backend.price.FuelType;
import de.fuelanalytics.backend.station.Station;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record StationSearchResult(Instant observedAt, List<Entry> stations, int rejectedStations) {
    public record Entry(Station station, boolean open, BigDecimal distanceKm,
                        Map<FuelType, BigDecimal> prices) { }
}
