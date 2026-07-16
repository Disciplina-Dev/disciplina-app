FROM node:22

# Chromium natif du système, piloté par puppeteer-core. apt installe le binaire
# à la bonne architecture (amd64 ou arm64), ce qui évite l'erreur Rosetta sous
# Apple Silicon. On expose son chemin à l'app via PUPPETEER_EXECUTABLE_PATH.

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
