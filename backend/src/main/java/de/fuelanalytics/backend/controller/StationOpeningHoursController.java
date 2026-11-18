package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.client.TankerkoenigClient;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StationOpeningHoursController {
    private final TankerkoenigClient client;

    public StationOpeningHoursController(TankerkoenigClient client) {
        this.client = client;
    }

    @GetMapping("/api/stations/{id}/opening-hours")
    public TankerkoenigClient.OpeningHours openingHours(@PathVariable UUID id) {
        return client.openingHours(id);
    }
}
