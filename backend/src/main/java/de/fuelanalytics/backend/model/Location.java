package de.fuelanalytics.backend.model;

/** German search center; positive GeoNames ID or negative namespaced postal-result ID. */
public record Location(long id, String name, String region, String district,
                       double latitude, double longitude) { }
