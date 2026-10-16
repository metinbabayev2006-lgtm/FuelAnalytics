package de.fuelanalytics.backend.location;

/** GeoNames ID and a German location supplied by Open-Meteo geocoding. */
public record Location(long id, String name, String region, String district,
                       double latitude, double longitude) { }
