FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g @openai/codex
COPY src src
CMD ["node", "src/index.js"]