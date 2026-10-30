-- Archive integrals are distinct from user-triggered observations and Kaggle source means.
CREATE TABLE archive_import (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL CHECK (period_end > period_start),
    source_url VARCHAR(500) NOT NULL,
    license_url VARCHAR(300) NOT NULL,
    manifest_sha256 VARCHAR(64) NOT NULL,
    downloaded_days INTEGER NOT NULL CHECK (downloaded_days > 0),
    cities VARCHAR(500) NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE archive_station (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    city VARCHAR(300) NOT NULL,
    address VARCHAR(1000) NOT NULL
);
CREATE INDEX archive_station_city_idx ON archive_station(city);
CREATE TABLE archive_daily_price (
    station_id UUID NOT NULL REFERENCES archive_station(id),
    reference_day DATE NOT NULL,
    fuel_type VARCHAR(6) NOT NULL CHECK (fuel_type IN ('diesel','e5','e10')),
    price_seconds NUMERIC(24,6) NOT NULL CHECK (price_seconds >= 0),
    known_seconds INTEGER NOT NULL CHECK (known_seconds >= 0),
    total_seconds INTEGER NOT NULL CHECK (total_seconds IN (82800,86400,90000)),
    PRIMARY KEY (station_id, reference_day, fuel_type),
    CHECK (known_seconds <= total_seconds),
    CHECK ((known_seconds = 0 AND price_seconds = 0) OR (known_seconds > 0 AND price_seconds > 0 AND price_seconds < 20 * known_seconds))
);
CREATE INDEX archive_daily_fuel_idx ON archive_daily_price(fuel_type, station_id, reference_day);
