# Use Node.js LTS with glibc for onnxruntime compatibility
FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

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