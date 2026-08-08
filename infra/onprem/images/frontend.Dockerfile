FROM node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d AS build

WORKDIR /workspace
COPY admin-web/package*.json ./admin-web/
RUN cd admin-web && npm ci

COPY admin-web/ ./admin-web/

ARG VITE_API_BASE_URL=/api

RUN cd admin-web \
  && VITE_API_BASE_URL="$VITE_API_BASE_URL" VITE_AUTH_MODE=bearer VITE_AUTH_PROVIDER=oidc npm run build \
  && find dist -type f -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.30.4-alpine-slim@sha256:e88d990b349df8cf4aa82f16642d7a23375016638c9ace4e5c6ca25028e62e65 AS runtime

ARG SOURCE_REVISION=synthetic-unknown
ARG BUILD_VERSION=onprem-unknown
ARG BUILD_TIMESTAMP=unknown
LABEL org.opencontainers.image.revision=$SOURCE_REVISION \
      org.opencontainers.image.version=$BUILD_VERSION \
      org.opencontainers.image.created=$BUILD_TIMESTAMP

COPY infra/onprem/images/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/admin-web/dist /usr/share/nginx/html

EXPOSE 8080
USER 101
