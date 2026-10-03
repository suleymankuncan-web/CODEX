FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe AS dependencies

WORKDIR /workspace/backend
COPY backend/nestjs/package*.json ./
RUN npm ci

FROM dependencies AS build

COPY backend/nestjs/ ./
RUN npx tsc -p tsconfig.onprem.json

FROM build AS production-dependencies

RUN npm prune --omit=dev \
  && find node_modules -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' -o -name '*.d.ts' -o -name '*.map' \) -delete \
  && find node_modules -type f -iname '*.md' ! -iname 'license*' ! -iname 'licence*' ! -iname 'notice*' ! -iname 'copying*' -delete \
  && find node_modules -type d \( -iname '.github' -o -iname '.git' -o -iname 'test' -o -iname 'tests' -o -iname '__tests__' -o -iname 'spec' -o -iname 'specs' -o -iname 'docs' -o -iname 'examples' -o -iname 'coverage' -o -iname '.cache' -o -iname 'cache' \) -prune -exec rm -rf {} + \
  && find node_modules -type f \( -iname '*.test.js' -o -iname '*.spec.js' -o -iname '*.test.json' -o -iname '*.spec.json' -o -iname 'test.js' -o -iname 'test-*.js' -o -iname '*-test.js' \) -delete \
  && find node_modules -xtype l -delete \
  && find node_modules -type f -iname 'readme*' -delete \
  && find dist -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.map' -o -name '*.spec.js' -o -name '*.test.js' -o -name '*-test-helpers.js' \) -delete \
  && find dist -type d \( -iname 'test' -o -iname 'tests' -o -iname '__tests__' -o -iname 'spec' -o -iname 'specs' -o -iname 'evidence' -o -iname 'coverage' -o -iname '.cache' -o -iname 'cache' -o -iname 'build' -o -iname 'docs' -o -iname 'examples' \) -prune -exec rm -rf {} +

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e AS runtime

ARG SOURCE_REVISION=synthetic-unknown
ARG BUILD_VERSION=onprem-unknown
ARG BUILD_TIMESTAMP=unknown
LABEL org.opencontainers.image.revision=$SOURCE_REVISION \
      org.opencontainers.image.version=$BUILD_VERSION \
      org.opencontainers.image.created=$BUILD_TIMESTAMP

WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /workspace/backend/dist ./dist
COPY backend/nestjs/src/shared/mail/assets/ ./dist/src/shared/mail/assets/
COPY --from=production-dependencies /workspace/backend/node_modules ./node_modules
COPY db/schema.sql /app/db/schema.sql
COPY db/migrations/ /app/db/migrations/
COPY db/seeds/001_reference_seed.sql /app/db/seeds/001_reference_seed.sql
COPY db/seeds/002_onprem_keycloak_personas.sql /app/db/seeds/002_onprem_keycloak_personas.sql

EXPOSE 3000
USER nonroot
CMD ["dist/src/main.js"]
