FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY backend/nestjs/package*.json ./
RUN npm ci

FROM deps AS build

COPY backend/nestjs/ ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY backend/nestjs/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]

