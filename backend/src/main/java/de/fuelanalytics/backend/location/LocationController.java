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
        return new LocationResponse(client.search(query), "Open-Meteo / GeoNames",
                "https://open-meteo.com/en/docs/geocoding-api");
    }

    public record LocationResponse(List<Location> locations, String source, String sourceUrl) { }
}
