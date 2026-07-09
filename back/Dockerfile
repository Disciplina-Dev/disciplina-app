FROM node:22

# Install system Chromium (correct arch for the host) + Puppeteer system deps.
# Chromium is PINNED to 147: the 150.x Debian security build (deb12u1, jul 2026)
# crashe au rendu (SIGTRAP / "Trace/breakpoint trap") sous la VM arm64 de Docker
# Desktop sur Apple Silicon — le binaire se lance (`--version` OK) mais toute
# génération de page trap. La 147 rend correctement. `apt-mark hold` empêche une
# remontée vers la 150 lors d'un rebuild.
RUN apt-get update && apt-get install -y --allow-downgrades \
  chromium=147.0.7727.137-1~deb12u1 \
  chromium-common=147.0.7727.137-1~deb12u1 \
  fonts-liberation \
  --no-install-recommends \
  && apt-mark hold chromium chromium-common \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
