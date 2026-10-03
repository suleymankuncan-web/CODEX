# ONP-3B builds a reproducible optimized Keycloak image from the immutable
# upstream 26.8.0 security release. Its fixed dependency set replaces the
# former local Netty, Bouncy Castle, and FreeMarker patch stages.
ARG KEYCLOAK_BASE_IMAGE=quay.io/keycloak/keycloak:26.8.0@sha256:b0f60d489d51c5d113390bdf5461d4c06e6051be026c05549f2e1e10ec352bcc

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
COPY --chown=1000:0 infra/onprem/core/keycloak/themes/hr-axis/ /opt/keycloak/themes/hr-axis/
COPY --chown=1000:0 admin-web/src/styles/onprem-login.css /opt/keycloak/themes/hr-axis/login/resources/css/login-studio.css
COPY --chown=1000:0 admin-web/src/styles/onprem-login-motion.css /opt/keycloak/themes/hr-axis/login/resources/css/login-motion.css
COPY --chown=1000:0 admin-web/src/assets/login-studio/ /opt/keycloak/themes/hr-axis/login/resources/img/
USER root
RUN mkdir -p /var/lib/keycloak-bootstrap \
    && chown 1000:1000 /var/lib/keycloak-bootstrap \
    && chmod 0700 /var/lib/keycloak-bootstrap
USER 1000
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
