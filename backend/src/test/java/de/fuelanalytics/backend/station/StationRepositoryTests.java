package de.fuelanalytics.backend.station;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class StationRepositoryTests {
    @Autowired
    StationRepository repository;

    @Test
    void savesAndReadsAllFieldsIncludingLeadingZeroInPostalCode() {
        Station station = sample(UUID.randomUUID(), "Synthetic station", "01234");
        repository.save(station);
        assertEquals(station, repository.findById(station.id()).orElseThrow());
    }

    @Test
    void readsNullableMetadata() {
        Station station = new Station(UUID.randomUUID(), "Synthetic minimal station",
                null, null, null, null, null, new BigDecimal("52.000000"),
                new BigDecimal("8.900000"), Instant.parse("2026-10-16T12:00:00Z"));
        repository.save(station);
        assertEquals(station, repository.findById(station.id()).orElseThrow());
    }

    @Test
    void missingStationReturnsEmpty() {
        assertTrue(repository.findById(UUID.randomUUID()).isEmpty());
    }

    @Test
    void updatesMetadataWithoutCreatingAnotherStation() {
        Station original = sample(UUID.randomUUID(), "Synthetic original", "01234");
        repository.save(original);
        Station changed = new Station(original.id(), "Synthetic updated", null,
                "New test street", "2b", "56789", "Test town",
                new BigDecimal("51.123456"), new BigDecimal("9.123456"),
                original.updatedAt().plusSeconds(60));
        assertTrue(repository.update(changed));
        assertEquals(changed, repository.findById(original.id()).orElseThrow());
    }

    @Test
    void updateDoesNotInsertMissingStation() {
        Station station = sample(UUID.randomUUID(), "Synthetic missing", "01234");
        assertFalse(repository.update(station));
        assertTrue(repository.findById(station.id()).isEmpty());
    }

    @Test
    void duplicateIdIsRejected() {
        Station station = sample(UUID.randomUUID(), "Synthetic duplicate", "01234");
        repository.save(station);
        assertThrows(DuplicateKeyException.class, () -> repository.save(station));
    }

    private Station sample(UUID id, String name, String postalCode) {
        return new Station(id, name, "Test brand", "Test street", "1a", postalCode,
                "Test place", new BigDecimal("52.123456"), new BigDecimal("8.123456"),
                Instant.parse("2026-10-16T12:00:00Z"));
    }
}
