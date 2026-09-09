# ONP-3B builds a reproducible optimized Keycloak image instead of running the
# upstream distribution with a runtime-only database/health configuration.
# The base digest is intentionally repeated here so an image proof cannot drift
# to a mutable tag. The release workflow supplies the same value as an arg and
# records the final image ID in the sanitized proof manifest.
ARG KEYCLOAK_BASE_IMAGE=quay.io/keycloak/keycloak:26.7.3@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54

FROM ${KEYCLOAK_BASE_IMAGE} AS patched-base
USER root
# Quarkus records these distribution paths in its application model. Preserve
# the paths while replacing every module with the checksum-pinned fixed JAR.
ADD --checksum=sha256:f474b14c7734f15e0540394cb6f39d67777b7581a42919e4ac89d253d4efd929 https://repo.maven.apache.org/maven2/io/netty/netty-buffer/4.1.137.Final/netty-buffer-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-buffer-4.1.136.Final.jar
ADD --checksum=sha256:9987b6a660b0a6b1f0d791485dae33180b3d1c63687c006fe6d3fd025e9e3798 https://repo.maven.apache.org/maven2/io/netty/netty-codec/4.1.137.Final/netty-codec-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-4.1.136.Final.jar
ADD --checksum=sha256:2d9a33ce41bd9f6f607df95039e42518a1fca16f83c9bbfe72beb57df6e2489f https://repo.maven.apache.org/maven2/io/netty/netty-codec-dns/4.1.137.Final/netty-codec-dns-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-dns-4.1.136.Final.jar
ADD --checksum=sha256:5ffa58b94c5ac48fb7e41843c18acf7a268e90b5b85423987829c9291ce3a5df https://repo.maven.apache.org/maven2/io/netty/netty-codec-haproxy/4.1.137.Final/netty-codec-haproxy-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-haproxy-4.1.136.Final.jar
ADD --checksum=sha256:0535bb5a736472bef5c948d15eb273c4ab9f796656fc7c5d6b982ad92bddbd49 https://repo.maven.apache.org/maven2/io/netty/netty-codec-http/4.1.137.Final/netty-codec-http-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-http-4.1.136.Final.jar
ADD --checksum=sha256:576ddcfb51b78e86f145c9a52b60e500b1a1d5a257cafec8aa5416ffba044b49 https://repo.maven.apache.org/maven2/io/netty/netty-codec-http2/4.1.137.Final/netty-codec-http2-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-http2-4.1.136.Final.jar
ADD --checksum=sha256:4a6190e08988c058bfeef2b5965e71946439c771abf721c68f4039b4e7b023e8 https://repo.maven.apache.org/maven2/io/netty/netty-codec-socks/4.1.137.Final/netty-codec-socks-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-codec-socks-4.1.136.Final.jar
ADD --checksum=sha256:d31926b01adcc07af86f5e27b81b6d6c115df17d366e835d1fc3f5a1924e7e52 https://repo.maven.apache.org/maven2/io/netty/netty-common/4.1.137.Final/netty-common-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-common-4.1.136.Final.jar
ADD --checksum=sha256:d0e4c6ee4779f59f6ab2fb5d388e4f57147c82270164b37945764bb9bda96a44 https://repo.maven.apache.org/maven2/io/netty/netty-handler/4.1.137.Final/netty-handler-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-handler-4.1.136.Final.jar
ADD --checksum=sha256:843de10c4cef34cbc1a5344090f1b57db532fbebf141559862da675f6b656df4 https://repo.maven.apache.org/maven2/io/netty/netty-handler-proxy/4.1.137.Final/netty-handler-proxy-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-handler-proxy-4.1.136.Final.jar
ADD --checksum=sha256:b4cf2aeedd9fc7c8c439bbfe574f63cfe5b83392e88bbc07ca0e8424b7cff955 https://repo.maven.apache.org/maven2/io/netty/netty-resolver/4.1.137.Final/netty-resolver-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-resolver-4.1.136.Final.jar
ADD --checksum=sha256:898d63ca62ed68ff46543c5344f969424b417f1e8d082fe2bb0181ba10144194 https://repo.maven.apache.org/maven2/io/netty/netty-resolver-dns/4.1.137.Final/netty-resolver-dns-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-resolver-dns-4.1.136.Final.jar
ADD --checksum=sha256:6251adc2a2921572382732a2db188d4f4f2251fd6ebb49c5d44bbf33d6bfb1a7 https://repo.maven.apache.org/maven2/io/netty/netty-transport/4.1.137.Final/netty-transport-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-4.1.136.Final.jar
ADD --checksum=sha256:55049554b799dc8e53bf234fffa36e001f7b5b65c32994b9bd59fc6356f1c52f https://repo.maven.apache.org/maven2/io/netty/netty-transport-classes-epoll/4.1.137.Final/netty-transport-classes-epoll-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-classes-epoll-4.1.136.Final.jar
ADD --checksum=sha256:8056e7637f9948f953314894cf995ab664711b66c73c4cd5b593ae84f0b1048c https://repo.maven.apache.org/maven2/io/netty/netty-transport-native-unix-common/4.1.137.Final/netty-transport-native-unix-common-4.1.137.Final.jar /opt/keycloak/lib/lib/main/io.netty.netty-transport-native-unix-common-4.1.136.Final.jar
RUN chmod 0644 /opt/keycloak/lib/lib/main/io.netty.*-4.1.136.Final.jar
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
USER root
RUN mkdir -p /var/lib/keycloak-bootstrap \
    && chown 1000:1000 /var/lib/keycloak-bootstrap \
    && chmod 0700 /var/lib/keycloak-bootstrap
USER 1000
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
