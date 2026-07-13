FROM node:22

# Chromium provided by @sparticuz/chromium (npm) via puppeteer-core.
# No system Chromium needed — the npm package ships a binary for both
# amd64 and arm64, avoiding the SIGTRAP crash on Apple Silicon.
# The binary still needs a few shared libraries at runtime.

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    libnspr4 libnss3 \
    libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 \
    libpango-1.0-0 libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
