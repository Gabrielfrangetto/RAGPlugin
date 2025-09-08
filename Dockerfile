# Use Node.js LTS
FROM node:20-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install --only=production

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p data uploads

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]