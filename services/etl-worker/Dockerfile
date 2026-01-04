FROM node:20-alpine

WORKDIR /app

# Shared modülü kopyala
COPY shared /app/shared
RUN cd /app/shared && npm install && npm run build

# Servis dosyalarını kopyala
COPY services/etl-worker/package*.json ./
RUN npm install

COPY services/etl-worker .
RUN npm run build

EXPOSE 4006

CMD ["npm", "start"]
