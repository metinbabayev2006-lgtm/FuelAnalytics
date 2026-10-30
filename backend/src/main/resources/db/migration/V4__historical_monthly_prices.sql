-- Monthly source aggregates are independent of live price observations.
CREATE TABLE historical_monthly_import (
    import_year INTEGER PRIMARY KEY CHECK (import_year BETWEEN 2000 AND 2100),
    source_url VARCHAR(500) NOT NULL,
    dataset_version INTEGER NOT NULL,
    license_url VARCHAR(300) NOT NULL,
    prices_sha256 VARCHAR(64) NOT NULL,
    stations_sha256 VARCHAR(64) NOT NULL,
    excluded_values INTEGER NOT NULL,
    unmatched_rows INTEGER NOT NULL,
    outside_year_rows INTEGER NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE historical_station (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    city VARCHAR(300) NOT NULL,
    address VARCHAR(1000) NOT NULL
);
CREATE INDEX historical_station_city_idx ON historical_station(city);
CREATE TABLE historical_monthly_price (
    station_id UUID NOT NULL REFERENCES historical_station(id),
    reference_month DATE NOT NULL,
    fuel_type VARCHAR(6) NOT NULL CHECK (fuel_type IN ('diesel', 'e5', 'e10')),
    mean_price NUMERIC(10,6) NOT NULL CHECK (mean_price > 0 AND mean_price < 20),
    import_year INTEGER NOT NULL REFERENCES historical_monthly_import(import_year),
    PRIMARY KEY (station_id, reference_month, fuel_type),
    CHECK (EXTRACT(DAY FROM reference_month) = 1),
    CHECK (EXTRACT(YEAR FROM reference_month) = import_year)
);
CREATE INDEX historical_monthly_year_idx ON historical_monthly_price(import_year, fuel_type, station_id);
