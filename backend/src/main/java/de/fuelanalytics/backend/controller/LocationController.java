package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.client.LocationClient;
import de.fuelanalytics.backend.client.AddressClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import de.fuelanalytics.backend.model.Location;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LocationController {
    private final LocationClient client;

    private final AddressClient addresses;
    public LocationController(LocationClient client, AddressClient addresses) { this.client = client; this.addresses = addresses; }

    @GetMapping("/api/locations")
    public LocationResponse search(@RequestParam String query, @RequestParam(defaultValue = "place") String mode) {
        if ("address".equals(mode)) return new LocationResponse(addresses.search(query), "OpenStreetMap / Nominatim", "https://www.openstreetmap.org/copyright");
        if (!"place".equals(mode)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unbekannter Suchmodus");
        boolean postal = LocationClient.isPostalQuery(query);
        return new LocationResponse(client.search(query), postal ? "Zippopotam.us / GeoNames" : "Open-Meteo / GeoNames",
                postal ? "https://zippopotam.us/" : "https://open-meteo.com/en/docs/geocoding-api");
    }

    public record LocationResponse(List<Location> locations, String source, String sourceUrl) { }
}
