FROM node:22

# Install system Chromium (correct arch for the host) + Puppeteer system deps
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  --no-install-recommends \
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
