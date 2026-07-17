# Version alignée sur back/Dockerfile (node:22).
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY --chown=node:node . .

# L'image node fournit déjà l'utilisateur `node` : pas de root inutile.
USER node

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
