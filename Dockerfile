FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g @openai/codex
COPY tsconfig.json .
COPY src src
RUN npx tsc
CMD ["node", "dist/index.js"]