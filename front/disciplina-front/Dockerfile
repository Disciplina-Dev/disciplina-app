# --- base: deps commun ---
FROM node:alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- dev: vite dev server (hot reload) ---
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# --- build: compile vers dist/ ---
FROM base AS build
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- prod: nginx sert dist/ ---
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
