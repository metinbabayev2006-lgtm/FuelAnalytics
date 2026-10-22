package de.fuelanalytics.backend.model;

import java.time.Instant;
import java.util.List;

/** Locations only: no live prices or charger occupancy. Source date differs from request time. */
public record EnergySearchResult(Instant fetchedAt, String kind, List<Site> stations, boolean truncated,
                                 String source, String sourceDate) {
    public EnergySearchResult(Instant fetchedAt, String kind, List<Site> stations, boolean truncated) {
        this(fetchedAt, kind, stations, truncated, "osm", null);
    }
    public record Site(String id, String name, double latitude, double longitude, double distanceKm,
                       String address, List<String> services, String openingHours, String access,
                       List<String> connectors) { }
}
