package de.fuelanalytics.backend.tankerkoenig;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class StationSearchController {
    private final StationSearchService service;

    public StationSearchController(StationSearchService service) { this.service = service; }

    @PostMapping("/api/search")
    public StationSearchResult search(@RequestBody SearchRequest request) {
        if (request.latitude() == null || request.longitude() == null || request.radiusKm() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "latitude, longitude und radiusKm sind erforderlich");
        }
        return service.search(request.latitude(), request.longitude(), request.radiusKm());
    }

    public record SearchRequest(Double latitude, Double longitude, Double radiusKm) { }
}
