package de.fuelanalytics.backend.controller;
import de.fuelanalytics.backend.client.OpenVanLpgClient;
import de.fuelanalytics.backend.model.OpenVanLpg;
import de.fuelanalytics.backend.repository.NationalLpgRepository;
import de.fuelanalytics.backend.service.LpgHistory;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lpg")
public class NationalLpgController {
    private final LpgHistory history;
    private final OpenVanLpgClient client;
    private final NationalLpgRepository snapshots;
    public NationalLpgController(LpgHistory history, OpenVanLpgClient client, NationalLpgRepository snapshots) {
        this.history = history; this.client = client; this.snapshots = snapshots;
    }
    /** Reads the bundled official history; never contacts a provider. */
    @GetMapping("/national") public LpgHistory.Series history() { return history.series(); }
    @GetMapping("/openvan/saved") public List<OpenVanLpg> saved() { return snapshots.saved(); }
    /** Explicit user request; adapter caches six hours, stored independently from station prices. */
    @PostMapping("/openvan") public OpenVanLpg fetch() {
        var value = client.fetch(); snapshots.save(value); return value;
    }
}
