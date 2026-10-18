package de.fuelanalytics.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Reports application availability; does not check database or external APIs. */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public HealthResponse health() {
        return new HealthResponse("UP", "FuelAnalytics");
    }

    public record HealthResponse(String status, String application) {
    }
}
