FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY knowledge ./knowledge
RUN mkdir -p data && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "run", "start:prod"]
