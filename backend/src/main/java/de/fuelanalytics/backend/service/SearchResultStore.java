package de.fuelanalytics.backend.service;

import de.fuelanalytics.backend.model.PriceObservation;
import de.fuelanalytics.backend.model.StationSearchResult;
import de.fuelanalytics.backend.repository.PriceObservationRepository;
import de.fuelanalytics.backend.repository.StationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchResultStore {
    private final StationRepository stations;
    private final PriceObservationRepository prices;

    public SearchResultStore(StationRepository stations, PriceObservationRepository prices) {
        this.stations = stations;
        this.prices = prices;
    }

    /** Entire validated result is committed together, after the external request has finished. */
    @Transactional
    public void save(StationSearchResult result) {
        for (var entry : result.stations()) {
            if (!stations.update(entry.station())) stations.save(entry.station());
            entry.prices().forEach((fuel, price) -> prices.save(new PriceObservation(
                    entry.station().id(), fuel, price, result.observedAt())));
        }
    }
}
