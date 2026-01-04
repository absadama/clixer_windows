FROM node:20-alpine

WORKDIR /app

# Shared modülü kopyala
COPY shared /app/shared
RUN cd /app/shared && npm install && npm run build

# Servis dosyalarını kopyala
COPY services/core-service/package*.json ./
RUN npm install

COPY services/core-service .
RUN npm run build

EXPOSE 4002

CMD ["npm", "start"]
