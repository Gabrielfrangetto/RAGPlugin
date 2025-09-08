const express = require('express');
const RAGService = require('../services/ragService');

const router = express.Router();

// Instância do serviço RAG (será injetada pelo servidor principal)
let ragService;

// Middleware para injetar serviços
router.use((req, res, next) => {
  if (!ragService) {
    ragService = req.app.locals.ragService;
  }
  next();
});

// POST /api/rag - Endpoint principal para consultas (usado pela extensão)
router.post('/', async (req, res) => {
  try {
    const { messages, options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mensagens são obrigatórias e devem ser um array não vazio'
      });
    }

    if (!ragService) {
      return res.status(500).json({
        success: false,
        error: 'Serviço RAG não disponível'
      });
    }

    console.log(`🤖 Nova consulta RAG: ${messages.length} mensagens`);

    const result = await ragService.processQuery(messages, options);
    
    res.json(result);

  } catch (error) {
    console.error('Erro na consulta RAG:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/rag/query - Endpoint alternativo para consultas simples
router.post('/query', async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query é obrigatória e deve ser uma string'
      });
    }

    if (!ragService) {
      return res.status(500).json({
        success: false,
        error: 'Serviço RAG não disponível'
      });
    }

    // Converter query simples para formato de mensagens
    const messages = [{
      sender: 'user',
      message: query,
      timestamp: new Date().toISOString()
    }];

    const result = await ragService.processQuery(messages, options);
    
    res.json(result);

  } catch (error) {
    console.error('Erro na consulta RAG:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;