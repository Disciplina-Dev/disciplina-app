FROM node:22

# Chromium provided by @sparticuz/chromium (npm) via puppeteer-core.
# No system Chromium needed — the npm package ships a binary for both
# amd64 and arm64, avoiding the SIGTRAP crash on Apple Silicon.

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
