# Postgres 17 with BOTH PostGIS (geo) and pgvector (semantic search).
# The official single-purpose images ship only one of these, so we compose them:
# start from the PostGIS image and add pgvector from the PGDG apt repo it already has.
FROM postgis/postgis:17-3.5

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-pgvector \
  && rm -rf /var/lib/apt/lists/*
