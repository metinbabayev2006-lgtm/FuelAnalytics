package de.fuelanalytics.backend.controller;

import de.fuelanalytics.backend.model.ArchiveHistory;
import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.MonthlyHistory;
import de.fuelanalytics.backend.repository.ArchiveHistoryRepository;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/history/archive")
public class ArchiveHistoryController {
    private final ArchiveHistoryRepository repository;
    public ArchiveHistoryController(ArchiveHistoryRepository repository) { this.repository=repository; }
    @GetMapping("/status") public ArchiveHistory.Status status() { return repository.status(); }
    @GetMapping("/stations") public MonthlyHistory.StationPage stations(@RequestParam String city,@RequestParam FuelType fuelType,@RequestParam(defaultValue="0") int offset) {
        if(city.isBlank() || city.length()>120 || city.chars().anyMatch(Character::isISOControl) || offset<0 || offset>1_000_000) throw badRequest();
        return repository.stations(city.strip(),fuelType,offset);
    }
    @GetMapping("/series") public ArchiveHistory series(@RequestParam FuelType fuelType,@RequestParam List<UUID> stationIds) {
        if(stationIds.isEmpty() || stationIds.size()>3 || new HashSet<>(stationIds).size()!=stationIds.size()) throw badRequest();
        return repository.history(fuelType,stationIds);
    }
    private ResponseStatusException badRequest() { return new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ungültige Archiv-Auswahl (höchstens drei verschiedene Tankstellen)"); }
}
