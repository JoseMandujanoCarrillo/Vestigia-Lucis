CREATE TABLE IF NOT EXISTS admins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saints (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_description TEXT NOT NULL,
    biography TEXT,
    origin_place TEXT NOT NULL,
    country TEXT,
    birth_date DATE,
    death_date DATE,
    feast_day TEXT,
    patronages TEXT,
    image_1_url TEXT,
    image_2_url TEXT,
    image_3_url TEXT,
    youtube_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT saints_dates_ordered CHECK (birth_date IS NULL OR death_date IS NULL OR birth_date <= death_date),
    CONSTRAINT saints_youtube_url_valid CHECK (
        youtube_url IS NULL OR youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'
    ),
    CONSTRAINT published_saints_have_three_images CHECK (
        NOT is_published OR (
            image_1_url IS NOT NULL AND image_1_url <> '' AND
            image_2_url IS NOT NULL AND image_2_url <> '' AND
            image_3_url IS NOT NULL AND image_3_url <> ''
        )
    )
);

CREATE TABLE IF NOT EXISTS miracles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    saint_id BIGINT NOT NULL REFERENCES saints(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS saint_tags (
    saint_id BIGINT NOT NULL REFERENCES saints(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (saint_id, tag_id)
);

CREATE INDEX IF NOT EXISTS saints_published_idx ON saints (is_published);
CREATE INDEX IF NOT EXISTS saints_name_idx ON saints (LOWER(name));
CREATE INDEX IF NOT EXISTS saints_origin_idx ON saints (LOWER(origin_place));
CREATE INDEX IF NOT EXISTS miracles_saint_id_idx ON miracles (saint_id);
CREATE INDEX IF NOT EXISTS tags_category_name_idx ON tags (category, name);
CREATE INDEX IF NOT EXISTS saint_tags_tag_id_idx ON saint_tags (tag_id);
