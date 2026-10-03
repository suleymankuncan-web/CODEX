FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe AS build

WORKDIR /workspace
COPY admin-web/package*.json ./admin-web/
RUN cd admin-web && npm ci

COPY admin-web/ ./admin-web/

ARG VITE_API_BASE_URL=/api

RUN cd admin-web \
  && VITE_API_BASE_URL="$VITE_API_BASE_URL" VITE_AUTH_MODE=bearer VITE_AUTH_PROVIDER=oidc VITE_OIDC_AUTO_REDIRECT=true VITE_OIDC_PAR_ENABLED=true VITE_BROWSER_SESSION_TRANSPORT=cookie VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= npm run build \
  && find dist -type f -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.30.4-alpine-slim@sha256:7bbe8940bc478e5618e6d4cfbeda406e5b4217cacc06faacd665aca5e468595e AS runtime

USER root
RUN apk add --no-cache --upgrade \
      'libcrypto3=3.5.9-r0' \
      'libssl3=3.5.9-r0' \
      'pcre2=10.49-r0'

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
