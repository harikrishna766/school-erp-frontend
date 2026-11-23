# syntax=docker/dockerfile:1.7

# ---- build: compile the Angular app ----
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# `production` (default) or `mock-production` for a backend-less demo image.
ARG BUILD_CONFIGURATION=production
RUN npx ng build --configuration ${BUILD_CONFIGURATION} \
 && node scripts/check-bundle-size.mjs

# ---- runtime: static files on unprivileged nginx ----
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build --chown=101:101 /app/dist/school-erp-frontend/browser /usr/share/nginx/html

# Runtime config (see src/app/core/config/app-config.ts); written on container start.
ENV API_BASE_URL=/api/v1 \
    WS_URL=/ \
    DEFAULT_LANGUAGE=en \
    TENANT_SLUG= \
    CSP_CONNECT_SRC="'self'"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
