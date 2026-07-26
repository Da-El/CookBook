# ---- Frontend ----
FROM node:22-bookworm-slim AS web-build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
# Same-origin API when SPA is served by Axum (PWA + /v1 on one host)
ENV VITE_API_URL=
RUN npm run build

# ---- Backend ----
FROM rust:1-bookworm AS api-build
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY apps/web/public/data/catalog.json ./apps/web/public/data/catalog.json
RUN cargo build --release -p grok-cookbook-api

# ---- Runtime ----
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-build /app/target/release/grok-cookbook-api /app/grok-cookbook-api
COPY --from=api-build /app/apps/web/public/data/catalog.json /app/catalog.json
COPY --from=web-build /web/dist /app/static
RUN mkdir -p /app/uploads

ENV HOST=0.0.0.0
ENV PORT=8080
ENV CATALOG_PATH=/app/catalog.json
ENV STATIC_DIR=/app/static
ENV UPLOAD_DIR=/app/uploads

EXPOSE 8080
CMD ["/app/grok-cookbook-api"]
