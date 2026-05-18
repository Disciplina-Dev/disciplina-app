FROM node:22
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

RUN useradd -ms /bin/sh -u 1001 app
USER app

COPY --chown=app:app . /app

CMD [ "npm", "run", "dev" ]
