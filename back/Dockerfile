# --- base: deps + Chromium (partagé dev/prod) ---
FROM node:22 AS base

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

# --- dev: ts-node-dev hot reload (comportement historique) ---
FROM base AS dev
RUN --mount=type=cache,target=/root/.npm npm ci
RUN useradd -ms /bin/sh -u 1001 app
USER app
COPY --chown=app:app . /app
CMD [ "npm", "run", "dev" ]

# --- build: compile TS -> dist/ ---
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . /app
RUN npm run build

# --- prod: runtime deps only, node dist/index.js ---
FROM base AS prod
ENV NODE_ENV=production
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
RUN useradd -ms /bin/sh -u 1001 app
COPY --from=build --chown=app:app /app/dist /app/dist
# PDF statiques (mandat / catalogue) servis par /api/needs-analysis/signature/*
COPY --from=build --chown=app:app /app/assets /app/assets
USER app
CMD [ "node", "dist/index.js" ]
