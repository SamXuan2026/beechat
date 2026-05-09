FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5188

COPY package.json ./
COPY server ./server
COPY web ./web
COPY scripts ./scripts
COPY migrations ./migrations
COPY README.md ./

RUN mkdir -p /app/data/uploads /app/logs /app/run

EXPOSE 5188

CMD ["node", "server/index.js"]
