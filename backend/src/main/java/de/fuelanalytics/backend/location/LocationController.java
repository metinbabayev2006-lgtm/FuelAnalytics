package de.fuelanalytics.backend.location;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LocationController {
    private final LocationClient client;

    public LocationController(LocationClient client) { this.client = client; }

    @GetMapping("/api/locations")
    public LocationResponse search(@RequestParam String query) {
        boolean postal = LocationClient.isPostalQuery(query);
        return new LocationResponse(client.search(query), postal ? "Zippopotam.us / GeoNames" : "Open-Meteo / GeoNames",
                postal ? "https://zippopotam.us/" : "https://open-meteo.com/en/docs/geocoding-api");
    }

    public record LocationResponse(List<Location> locations, String source, String sourceUrl) { }
}
