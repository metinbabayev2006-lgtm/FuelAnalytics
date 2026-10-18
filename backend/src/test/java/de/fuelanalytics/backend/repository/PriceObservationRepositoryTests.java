package de.fuelanalytics.backend.repository;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.model.PriceObservation;
import de.fuelanalytics.backend.model.Station;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PriceObservationRepositoryTests {
    @Autowired PriceObservationRepository prices;
    @Autowired StationRepository stations;
    private UUID stationId;
    private final Instant start = Instant.parse("2026-10-16T10:00:00Z");

    @BeforeEach
    void setUp() {
        stationId = createStation();
    }

    @Test
    void readsChronologicallyAndKeepsRepeatedPricesAtDifferentTimes() {
        PriceObservation later = observation(stationId, FuelType.e10, 60);
        PriceObservation earlier = observation(stationId, FuelType.e10, 0);
        prices.save(later);
        prices.save(earlier);
        assertEquals(List.of(earlier, later), history());
    }

    @Test
    void filtersByStationAndFuel() {
        PriceObservation expected = observation(stationId, FuelType.e10, 0);
        prices.save(expected);
        prices.save(observation(stationId, FuelType.diesel, 0));
        prices.save(observation(createStation(), FuelType.e10, 0));
        assertEquals(List.of(expected), history());
    }

    @Test
    void includesStartAndExcludesEndOfInterval() {
        prices.save(observation(stationId, FuelType.e10, -1));
        PriceObservation expected = observation(stationId, FuelType.e10, 0);
        prices.save(expected);
        prices.save(observation(stationId, FuelType.e10, 120));
        assertEquals(List.of(expected), history());
    }

    @Test
    void emptyHistoryReturnsEmptyList() {
        assertTrue(history().isEmpty());
    }

    @Test
    void rejectsDuplicateObservation() {
        PriceObservation observation = observation(stationId, FuelType.e10, 0);
        prices.save(observation);
        assertThrows(DataIntegrityViolationException.class, () -> prices.save(observation));
    }

    @Test
    void rejectsMissingStation() {
        assertThrows(DataIntegrityViolationException.class,
                () -> prices.save(observation(UUID.randomUUID(), FuelType.e10, 0)));
    }

    @Test
    void rejectsEmptyOrReversedInterval() {
        assertThrows(IllegalArgumentException.class,
                () -> prices.findHistory(stationId, FuelType.e10, start, start));
        assertThrows(IllegalArgumentException.class,
                () -> prices.findHistory(stationId, FuelType.e10, start.plusSeconds(1), start));
    }

    private List<PriceObservation> history() {
        return prices.findHistory(stationId, FuelType.e10, start, start.plusSeconds(120));
    }

    private PriceObservation observation(UUID id, FuelType fuel, long seconds) {
        return new PriceObservation(id, fuel, new BigDecimal("1.759"), start.plusSeconds(seconds));
    }

    private UUID createStation() {
        UUID id = UUID.randomUUID();
        stations.save(new Station(id, "Synthetic price test station", null, null, null,
                null, null, new BigDecimal("52.000000"), new BigDecimal("8.900000"), start));
        return id;
    }
}
