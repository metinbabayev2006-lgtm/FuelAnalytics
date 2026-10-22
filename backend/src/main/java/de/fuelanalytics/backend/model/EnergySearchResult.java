package de.fuelanalytics.backend.model;

import java.time.Instant;
import java.util.List;

/** OSM locations only: no live prices or charger occupancy. */
public record EnergySearchResult(Instant fetchedAt, String kind, List<Site> stations, boolean truncated) {
    public record Site(String id, String name, double latitude, double longitude, double distanceKm,
                       String address, List<String> services, String openingHours, String access,
                       List<String> connectors) { }
}
