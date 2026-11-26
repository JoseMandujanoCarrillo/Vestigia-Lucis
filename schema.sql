CREATE TABLE IF NOT EXISTS admins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE admins SET name = email WHERE name IS NULL OR BTRIM(name) = '';
CREATE UNIQUE INDEX IF NOT EXISTS admins_single_superadmin_idx
    ON admins (is_superadmin) WHERE is_superadmin = TRUE;

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
    CONSTRAINT published_saints_have_one_to_three_images CHECK (
        NOT is_published OR (
            num_nonnulls(
                NULLIF(BTRIM(image_1_url), ''),
                NULLIF(BTRIM(image_2_url), ''),
                NULLIF(BTRIM(image_3_url), '')
            ) BETWEEN 1 AND 3
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

CREATE TABLE IF NOT EXISTS saint_contributions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    saint_id BIGINT NOT NULL REFERENCES saints(id) ON DELETE CASCADE,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    contributor_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO saint_contributions (saint_id, admin_id, contributor_name, action, created_at)
SELECT s.id, s.created_by, COALESCE(NULLIF(a.name, ''), a.email), 'created', s.created_at
FROM saints s
JOIN admins a ON a.id = s.created_by
WHERE NOT EXISTS (
    SELECT 1 FROM saint_contributions c
    WHERE c.saint_id = s.id AND c.admin_id = s.created_by AND c.action = 'created'
);

CREATE INDEX IF NOT EXISTS saints_published_idx ON saints (is_published);
CREATE INDEX IF NOT EXISTS saints_name_idx ON saints (LOWER(name));
CREATE INDEX IF NOT EXISTS saints_origin_idx ON saints (LOWER(origin_place));
CREATE INDEX IF NOT EXISTS miracles_saint_id_idx ON miracles (saint_id);
CREATE INDEX IF NOT EXISTS tags_category_name_idx ON tags (category, name);
CREATE INDEX IF NOT EXISTS saint_tags_tag_id_idx ON saint_tags (tag_id);
CREATE INDEX IF NOT EXISTS saint_contributions_saint_id_idx ON saint_contributions (saint_id);
