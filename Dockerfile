FROM node:20-alpine

WORKDIR /app

RUN mkdir -p /app/data

COPY src/ ./

EXPOSE 80

VOLUME ["/app/data"]

CMD ["node", "server.js"]
