package de.fuelanalytics.backend.tankerkoenig;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StationSearchService {
    private final TankerkoenigClient client;
    private final TankerkoenigMapper mapper;
    private final SearchResultStore store;

    public StationSearchService(TankerkoenigClient client, TankerkoenigMapper mapper, SearchResultStore store) {
        this.client = client;
        this.mapper = mapper;
        this.store = store;
    }

    public StationSearchResult search(double latitude, double longitude, double radiusKm) {
        var result = mapper.map(client.search(latitude, longitude, radiusKm));
        if (result.stations().isEmpty() && result.rejectedStations() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Keine gültigen Tankstellendaten erhalten");
        }
        store.save(result);
        return result;
    }
}
