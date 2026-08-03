# syntax=docker/dockerfile:1.7

FROM ubuntu:22.04@sha256:0e0a0fc6d18feda9db1590da249ac93e8d5abfea8f4c3c0c849ce512b5ef8982

ARG DEBIAN_FRONTEND=noninteractive
ARG DEV_GID=1000
ARG DEV_UID=1000
ARG NODE_VERSION=24.18.1
ARG RUST_VERSION=1.89.0
ARG TARGETARCH
ARG UBUNTU_SNAPSHOT=20260801T000000Z

# The minimal Ubuntu image does not contain a CA bundle. Bootstrap the bundle
# from a checksummed package before switching APT to the pinned HTTPS snapshot.
ADD --checksum=sha256:6e8cdcc8c86103acd4fc14649eac62ff2037108389074a7b167567af33c32245 \
    https://snapshot.ubuntu.com/ubuntu/20260801T000000Z/pool/main/c/ca-certificates/ca-certificates_20260601~22.04.1_all.deb \
    /tmp/ca-certificates.deb

RUN dpkg-deb --extract /tmp/ca-certificates.deb / \
    && mkdir -p /etc/ssl/certs \
    && cat /usr/share/ca-certificates/mozilla/*.crt > /etc/ssl/certs/ca-certificates.crt \
    && sed -E -i \
      "s#https?://(archive.ubuntu.com/ubuntu|security.ubuntu.com/ubuntu|ports.ubuntu.com/ubuntu-ports)/?#https://snapshot.ubuntu.com/ubuntu/${UBUNTU_SNAPSHOT}/#g" \
      /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      bash \
      build-essential \
      ca-certificates \
      clang \
      cmake \
      curl \
      git \
      jq \
      ninja-build \
      pkg-config \
      python3 \
      shellcheck \
      xz-utils \
    && rm -rf /var/lib/apt/lists/* /tmp/ca-certificates.deb

RUN case "${TARGETARCH}" in \
      amd64) node_arch=x64; node_sha=d6c664df3f3f61458e8c277585571328522d705166723a7c7823a9253a4d15a0 ;; \
      arm64) node_arch=arm64; node_sha=7201e3a09dc825bac57867c81913e2b8f0ef87d04cb9082af4cda82f6ff3d88c ;; \
      *) printf 'Unsupported architecture: %s\n' "${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
    && curl --fail --location --show-error --silent \
      "https://nodejs.org/dist/v${NODE_VERSION}/${node_archive}" \
      --output "/tmp/${node_archive}" \
    && printf '%s  %s\n' "${node_sha}" "/tmp/${node_archive}" | sha256sum --check --strict \
    && tar --extract --xz --file "/tmp/${node_archive}" \
      --directory /usr/local --strip-components=1 \
    && rm "/tmp/${node_archive}"

# Current prebuilt Tree-sitter CLI packages require a newer glibc than Ubuntu
# 22.04. Build the exact CLI release against this image instead.
RUN case "${TARGETARCH}" in \
      amd64) rust_target=x86_64-unknown-linux-gnu; rustup_sha=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10 ;; \
      arm64) rust_target=aarch64-unknown-linux-gnu; rustup_sha=9732d6c5e2a098d3521fca8145d826ae0aaa067ef2385ead08e6feac88fa5792 ;; \
      *) printf 'Unsupported architecture: %s\n' "${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl --fail --location --show-error --silent \
      "https://static.rust-lang.org/rustup/dist/${rust_target}/rustup-init" \
      --output /tmp/rustup-init \
    && printf '%s  %s\n' "${rustup_sha}" /tmp/rustup-init | sha256sum --check --strict \
    && chmod +x /tmp/rustup-init \
    && /tmp/rustup-init --no-modify-path --profile minimal \
      --default-toolchain "${RUST_VERSION}" -y \
    && /root/.cargo/bin/cargo install tree-sitter-cli \
      --locked --version 0.26.11 \
    && install /root/.cargo/bin/tree-sitter /usr/local/bin/tree-sitter \
    && rm -rf /root/.cargo /root/.rustup /tmp/rustup-init

RUN if existing_group="$(getent group "${DEV_GID}" | cut -d: -f1)" \
      && [ -n "${existing_group}" ]; then \
      developer_group="${existing_group}"; \
    else \
      groupadd --gid "${DEV_GID}" developer; \
      developer_group=developer; \
    fi \
    && useradd --create-home --gid "${developer_group}" --shell /bin/bash \
      --uid "${DEV_UID}" developer \
    && mkdir -p /workspace/tree-sitter-dslx \
    && chown developer:"${developer_group}" /workspace/tree-sitter-dslx

USER developer
WORKDIR /workspace/tree-sitter-dslx
