FROM node:18-alpine

WORKDIR /app

# Copiar package.json do backend-proxy
COPY backend-proxy/package*.json ./

# Instalar dependências
RUN npm install

# Copiar código do backend-proxy
COPY backend-proxy/ ./

# Expor porta
EXPOSE 3001

# Comando de início
CMD ["node", "servidor.js"]
