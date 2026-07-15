FROM node:22

# Dépendances système nécessaires à Chrome (mais PAS Chromium lui-même)
RUN apt-get update && apt-get install -y \
  fonts-liberation \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# On laisse Puppeteer télécharger SON Chromium → on retire le SKIP
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
