package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.MonthlyHistory;
import de.fuelanalytics.backend.repository.MonthlyHistoryRepository;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/history/monthly")
public class MonthlyHistoryController {
    private final MonthlyHistoryRepository repository;
    public MonthlyHistoryController(MonthlyHistoryRepository repository) { this.repository = repository; }
    @GetMapping("/years") public List<Integer> years() { return repository.years(); }
    @GetMapping("/stations") public MonthlyHistory.StationPage stations(@RequestParam int year, @RequestParam FuelType fuelType,
            @RequestParam String city, @RequestParam(defaultValue = "0") int offset) {
        validateYear(year);
        if (city.isBlank() || city.length() > 120 || city.chars().anyMatch(Character::isISOControl) || offset < 0 || offset > 1_000_000) throw badRequest();
        return repository.stations(year, fuelType, city.strip(), offset);
    }
    @GetMapping("/series") public MonthlyHistory history(@RequestParam int year, @RequestParam FuelType fuelType,
            @RequestParam List<UUID> stationIds) {
        validateYear(year);
        if (stationIds.isEmpty() || stationIds.size() > 3 || new HashSet<>(stationIds).size() != stationIds.size()) throw badRequest();
        return repository.history(year, fuelType, stationIds);
    }
    private void validateYear(int year) { if (year < 2000 || year > 2100) throw badRequest(); }
    private ResponseStatusException badRequest() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültige Jahres-, Stadt- oder Tankstellenauswahl (maximal drei)"); }
}
