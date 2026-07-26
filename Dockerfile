# ---- Frontend ----
FROM node:22-bookworm-slim AS web-build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
# Same-origin API when SPA is served by Axum
ENV VITE_API_URL=
RUN npm run build

# ---- Backend ----
FROM rust:1-bookworm AS api-build
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml ./
COPY crates ./crates
# Ensure workspace lock resolves
RUN cargo generate-lockfile
COPY apps/web/public/data/catalog.json ./apps/web/public/data/catalog.json
RUN cargo build --release -p cookbook-api

# ---- Runtime ----
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-build /app/target/release/cookbook-api /app/cookbook-api
COPY --from=api-build /app/apps/web/public/data/catalog.json /app/catalog.json
COPY --from=web-build /web/dist /app/static

ENV HOST=0.0.0.0
ENV PORT=8080
ENV CATALOG_PATH=/app/catalog.json
ENV STATIC_DIR=/app/static

EXPOSE 8080
CMD ["/app/cookbook-api"]
