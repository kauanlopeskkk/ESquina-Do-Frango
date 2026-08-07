FROM node:22-alpine

# better-sqlite3 precisa dessas ferramentas para compilar em Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORTA=3000
ENV BANCO=/app/dados/loja.db
EXPOSE 3000

CMD ["node", "server.js"]
