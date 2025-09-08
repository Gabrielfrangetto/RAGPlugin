const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const DocumentProcessor = require('../services/documentProcessor');
const EmbeddingService = require('../services/embeddingService');

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/html',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`), false);
    }
  }
});

// Instâncias dos serviços (serão injetadas pelo servidor principal)
let documentProcessor;
let embeddingService;

// Middleware para injetar serviços
router.use((req, res, next) => {
  if (!documentProcessor) {
    documentProcessor = req.app.locals.documentProcessor || new DocumentProcessor();
  }
  if (!embeddingService) {
    embeddingService = req.app.locals.embeddingService;
  }
  next();
});

// POST /api/upload - Upload de documento
router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    if (!embeddingService) {
      return res.status(500).json({
        success: false,
        error: 'Serviço de embeddings não disponível'
      });
    }

    const documentId = uuidv4();
    
    // Processar documento
    const processedDoc = await documentProcessor.processDocument(req.file);
    
    // Adicionar ao vector store
    await embeddingService.addDocument(
      documentId,
      processedDoc.chunks,
      {
        filename: processedDoc.filename,
        mimetype: processedDoc.mimetype,
        uploadedAt: new Date().toISOString(),
        size: req.file.size
      }
    );

    res.json({
      success: true,
      documentId,
      filename: processedDoc.filename,
      chunks: processedDoc.chunks.length,
      message: 'Documento processado e adicionado com sucesso'
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/upload/stats - Estatísticas dos documentos
router.get('/stats', (req, res) => {
  try {
    if (!embeddingService) {
      return res.status(500).json({
        success: false,
        error: 'Serviço de embeddings não disponível'
      });
    }

    const stats = embeddingService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;