package de.fuelanalytics.backend.station;

import de.fuelanalytics.backend.price.FuelType;
import de.fuelanalytics.backend.price.PriceObservation;
import de.fuelanalytics.backend.price.PriceObservationRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/stations")
public class StationController {
    private final StationRepository stations;
    private final PriceObservationRepository prices;

    public StationController(StationRepository stations, PriceObservationRepository prices) {
        this.stations = stations;
        this.prices = prices;
    }

    @GetMapping("/{id}")
    public Station findStation(@PathVariable UUID id) {
        return stations.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Tankstelle nicht gefunden"));
    }

    @GetMapping("/{id}/prices")
    public List<PriceObservation> history(@PathVariable UUID id,
                                          @RequestParam FuelType fuelType,
                                          @RequestParam Instant from,
                                          @RequestParam Instant to) {
        if (!from.isBefore(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "from muss vor to liegen");
        }
        findStation(id);
        return prices.findHistory(id, fuelType, from, to);
    }
}
