FROM node:20-alpine

WORKDIR /app

# Shared modülü kopyala
COPY shared /app/shared
RUN cd /app/shared && npm install && npm run build

# Servis dosyalarını kopyala
COPY services/analytics-service/package*.json ./
RUN npm install

COPY services/analytics-service .
RUN npm run build

EXPOSE 4005

CMD ["npm", "start"]
