FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

RUN mkdir -p /app/data

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/index.js"]
