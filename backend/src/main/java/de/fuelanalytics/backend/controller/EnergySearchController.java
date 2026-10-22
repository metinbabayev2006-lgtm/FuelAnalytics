package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.client.EnergyLocationClient;
import de.fuelanalytics.backend.model.EnergySearchResult;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class EnergySearchController {
    private final EnergyLocationClient client;
    public EnergySearchController(EnergyLocationClient client) { this.client = client; }

    @PostMapping("/api/energy/search")
    public EnergySearchResult search(@RequestBody SearchRequest request) {
        if (request.latitude() == null || request.longitude() == null || request.radiusKm() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Suchmittelpunkt und Radius sind erforderlich");
        }
        return client.search(request.latitude(), request.longitude(), request.radiusKm(), request.kind());
    }
    public record SearchRequest(Double latitude, Double longitude, Double radiusKm, String kind) { }
}
