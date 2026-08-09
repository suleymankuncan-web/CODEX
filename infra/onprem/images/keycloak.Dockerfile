# ONP-3B builds a reproducible optimized Keycloak image instead of running the
# upstream distribution with a runtime-only database/health configuration.
# The base digest is intentionally repeated here so an image proof cannot drift
# to a mutable tag. The release workflow supplies the same value as an arg and
# records the final image ID in the sanitized proof manifest.
ARG KEYCLOAK_BASE_IMAGE=quay.io/keycloak/keycloak:26.7.0@sha256:0f198be292568439d700cdbfb893e69a6009bb43a94a06a945b1d3d506c76b13

FROM ${KEYCLOAK_BASE_IMAGE} AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true --metrics-enabled=true

# Copy the build-time augmentation into a fresh pinned base stage. This keeps
# the final image's entrypoint, user, license and distribution metadata from
# the exact base image while making `start --optimized` a valid command.
FROM ${KEYCLOAK_BASE_IMAGE}
COPY --from=builder /opt/keycloak/ /opt/keycloak/
USER root
RUN mkdir -p /var/lib/keycloak-bootstrap \
    && chown 1000:1000 /var/lib/keycloak-bootstrap \
    && chmod 0700 /var/lib/keycloak-bootstrap
USER 1000
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
