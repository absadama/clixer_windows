FROM node:20-alpine

WORKDIR /app

# Shared modülü kopyala
COPY shared /app/shared
RUN cd /app/shared && npm install && npm run build

# Servis dosyalarını kopyala
COPY services/auth-service/package*.json ./
RUN npm install

COPY services/auth-service .
RUN npm run build

EXPOSE 4001

CMD ["npm", "start"]
