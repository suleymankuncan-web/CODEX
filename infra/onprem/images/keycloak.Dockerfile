# ONP-3B builds a reproducible optimized Keycloak image instead of running the
# upstream distribution with a runtime-only database/health configuration.
# The base digest is intentionally repeated here so an image proof cannot drift
# to a mutable tag. The release workflow supplies the same value as an arg and
# records the final image ID in the sanitized proof manifest.
ARG NODE_BUILD_IMAGE=node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d
ARG KEYCLOAK_BASE_IMAGE=quay.io/keycloak/keycloak:26.7.3@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54

FROM ${NODE_BUILD_IMAGE} AS netty-downloader
WORKDIR /patch
COPY scripts/onprem-keycloak-netty-patch.mjs /patch/download.mjs
COPY scripts/onprem-keycloak-bouncycastle-patch.mjs /patch/download-bouncycastle.mjs
RUN node /patch/download.mjs \
    && node /patch/download-bouncycastle.mjs

FROM ${KEYCLOAK_BASE_IMAGE} AS patched-base
USER root
# Quarkus records these distribution paths in its application model. Preserve
# the paths while replacing every module with the checksum-pinned fixed JAR.
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-buffer.jar /opt/keycloak/lib/lib/main/io.netty.netty-buffer-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec-dns.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-dns-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec-haproxy.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-haproxy-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec-http.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-http-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec-http2.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-http2-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-codec-socks.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-socks-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-common.jar /opt/keycloak/lib/lib/main/io.netty.netty-common-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-handler.jar /opt/keycloak/lib/lib/main/io.netty.netty-handler-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-handler-proxy.jar /opt/keycloak/lib/lib/main/io.netty.netty-handler-proxy-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-resolver.jar /opt/keycloak/lib/lib/main/io.netty.netty-resolver-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-resolver-dns.jar /opt/keycloak/lib/lib/main/io.netty.netty-resolver-dns-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-transport.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-transport-classes-epoll.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-classes-epoll-4.1.136.Final.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-transport-native-epoll-linux-aarch_64.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-native-epoll-4.1.136.Final-linux-aarch_64.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-transport-native-epoll-linux-x86_64.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-native-epoll-4.1.136.Final-linux-x86_64.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/jars/netty-transport-native-unix-common.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-native-unix-common-4.1.136.Final.jar
# Keycloak 26.7.3 ships Bouncy Castle 1.84. Preserve Quarkus' recorded paths
# while replacing the vulnerable provider family with checksum-pinned 1.85.
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/bouncycastle/bcprov-jdk18on.jar /opt/keycloak/lib/lib/main/org.bouncycastle.bcprov-jdk18on-1.84.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/bouncycastle/bcprov-jdk18on.jar /opt/keycloak/bin/client/lib/bcprov-jdk18on-1.84.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/bouncycastle/bcpkix-jdk18on.jar /opt/keycloak/lib/lib/main/org.bouncycastle.bcpkix-jdk18on-1.84.jar
COPY --from=netty-downloader --chown=0:0 --chmod=0644 /patch/bouncycastle/bcutil-jdk18on.jar /opt/keycloak/lib/lib/main/org.bouncycastle.bcutil-jdk18on-1.84.jar
USER 1000

FROM patched-base AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true --metrics-enabled=true

# Copy the build-time augmentation into a fresh pinned base stage. This keeps
# the final image's entrypoint, user, license and distribution metadata from
# the exact base image while making `start --optimized` a valid command.
FROM patched-base
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
