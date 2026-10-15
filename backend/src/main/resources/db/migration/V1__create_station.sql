CREATE TABLE station (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    street VARCHAR(255),
    house_number VARCHAR(50),
    postal_code VARCHAR(10),
    place VARCHAR(255),
    latitude NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_station_place ON station (place);
