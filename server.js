const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const DocumentProcessor = require('./src/services/documentProcessor');
const EmbeddingService = require('./src/services/embeddingService');
const RAGService = require('./src/services/ragService');
const uploadRoutes = require('./src/routes/upload');
const ragRoutes = require('./src/routes/rag');

class RAGServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Segurança
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // máximo 100 requests por IP
      message: 'Muitas requisições, tente novamente em 15 minutos'
    });
    this.app.use('/api/', limiter);

    // CORS configurado para produção
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'chrome-extension://*'];
    
    this.app.use(cors({
      origin: allowedOrigins,
      credentials: true
    }));

    // Parsing com limites configuráveis
    const maxFileSize = process.env.MAX_FILE_SIZE || '52428800'; // 50MB default
    const fileSizeLimit = `${Math.floor(parseInt(maxFileSize) / 1024 / 1024)}mb`;
    
    this.app.use(express.json({ limit: fileSizeLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: fileSizeLimit }));

    // Arquivos estáticos
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Logs
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  async setupServices() {
    try {
      console.log('🔧 Iniciando configuração de serviços...');
      
      // Inicializar serviços
      console.log('📦 Criando EmbeddingService...');
      this.embeddingService = new EmbeddingService();
      
      console.log('🚀 Inicializando EmbeddingService...');
      await this.embeddingService.initialize();
      
      console.log('📄 Criando DocumentProcessor...');
      this.documentProcessor = new DocumentProcessor();
      
      console.log('🤖 Criando RAGService...');
      this.ragService = new RAGService(this.embeddingService);
      
      console.log('✅ Serviços inicializados com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar serviços:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }

  setupRoutes() {
    // Rota principal
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Rotas da API
    this.app.use('/api/upload', uploadRoutes);
    this.app.use('/api/rag', ragRoutes);

    // Middleware de erro
    this.app.use((error, req, res, next) => {
      console.error('Erro no servidor:', error);
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Erro interno do servidor' 
          : error.message
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado'
      });
    });
  }

  async start() {
    try {
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 Servidor RAG rodando na porta ${this.port}`);
        console.log(`📁 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 URL: http://localhost:${this.port}`);
      });
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }
}

// Inicializar servidor
async function initializeServer() {
  const server = new RAGServer();
  await server.setupServices();
  await server.start();
}

initializeServer().catch(error => {
  console.error('❌ Erro fatal ao inicializar servidor:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});