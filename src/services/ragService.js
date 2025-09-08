const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

class RAGService {
  constructor(embeddingService) {
    this.embeddingService = embeddingService;
    this.conversationHistory = new Map();
  }

  async processQuery(messages, options = {}) {
    try {
      const {
        maxResults = 5,
        threshold = 0.3,
        includeContext = true
      } = options;

      // Extrair a última mensagem como query principal
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage?.message || '';
      
      if (!query.trim()) {
        return {
          success: false,
          error: 'Query vazia'
        };
      }

      console.log(`🔍 Processando query: "${query.substring(0, 100)}..."`);

      // Buscar contexto relevante
      const relevantChunks = await this.embeddingService.searchSimilar(
        query, 
        maxResults, 
        threshold
      );

      if (relevantChunks.length === 0) {
        return {
          success: true,
          suggestion: 'Desculpe, não encontrei informações relevantes para responder sua pergunta. Poderia reformular ou fornecer mais detalhes?',
          confidence: 0,
          context: []
        };
      }

      // Gerar resposta baseada no contexto
      const response = await this.generateResponse(query, relevantChunks, messages);
      
      return {
        success: true,
        suggestion: response.text,
        confidence: response.confidence,
        context: includeContext ? relevantChunks : [],
        metadata: {
          chunksUsed: relevantChunks.length,
          avgSimilarity: relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Erro no processamento RAG:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateResponse(query, relevantChunks, conversationHistory = []) {
    try {
      // Construir contexto a partir dos chunks relevantes
      const context = relevantChunks
        .map(chunk => chunk.chunk)
        .join('\n\n');

      // Analisar o tipo de pergunta
      const queryType = this.analyzeQueryType(query);
      
      // Gerar resposta baseada no contexto
      const response = this.constructResponse(query, context, queryType, conversationHistory);
      
      // Calcular confiança baseada na similaridade dos chunks
      const confidence = this.calculateConfidence(relevantChunks);
      
      return {
        text: response,
        confidence,
        queryType
      };
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);
      throw error;
    }
  }

  analyzeQueryType(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('como') || lowerQuery.includes('how')) {
      return 'procedural';
    }
    if (lowerQuery.includes('o que') || lowerQuery.includes('what')) {
      return 'factual';
    }
    if (lowerQuery.includes('por que') || lowerQuery.includes('why')) {
      return 'explanatory';
    }
    if (lowerQuery.includes('quando') || lowerQuery.includes('when')) {
      return 'temporal';
    }
    if (lowerQuery.includes('onde') || lowerQuery.includes('where')) {
      return 'locational';
    }
    
    return 'general';
  }

  constructResponse(query, context, queryType, conversationHistory) {
    // Templates de resposta baseados no tipo de pergunta
    const templates = {
      procedural: this.generateProceduralResponse,
      factual: this.generateFactualResponse,
      explanatory: this.generateExplanatoryResponse,
      temporal: this.generateTemporalResponse,
      locational: this.generateLocationalResponse,
      general: this.generateGeneralResponse
    };

    const generator = templates[queryType] || templates.general;
    return generator.call(this, query, context, conversationHistory);
  }

  generateProceduralResponse(query, context) {
    // Extrair passos do contexto
    const steps = this.extractSteps(context);
    
    if (steps.length > 0) {
      return `Para ${query.toLowerCase()}, siga estes passos:\n\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
    }
    
    return `Baseado nas informações disponíveis: ${this.summarizeContext(context)}`;
  }

  generateFactualResponse(query, context) {
    const summary = this.summarizeContext(context);
    return summary;
  }

  generateExplanatoryResponse(query, context) {
    const explanation = this.extractExplanation(context);
    return explanation || this.summarizeContext(context);
  }

  generateTemporalResponse(query, context) {
    const timeInfo = this.extractTimeInformation(context);
    return timeInfo || this.summarizeContext(context);
  }

  generateLocationalResponse(query, context) {
    const locationInfo = this.extractLocationInformation(context);
    return locationInfo || this.summarizeContext(context);
  }

  generateGeneralResponse(query, context) {
    return this.summarizeContext(context);
  }

  extractSteps(context) {
    const stepPatterns = [
      /\d+\.[^\n]+/g,
      /primeiro[^\n]+/gi,
      /segundo[^\n]+/gi,
      /terceiro[^\n]+/gi,
      /em seguida[^\n]+/gi,
      /depois[^\n]+/gi,
      /finalmente[^\n]+/gi
    ];
    
    const steps = [];
    stepPatterns.forEach(pattern => {
      const matches = context.match(pattern);
      if (matches) {
        steps.push(...matches.map(match => match.trim()));
      }
    });
    
    return [...new Set(steps)].slice(0, 10); // Remove duplicatas e limita
  }

  extractExplanation(context) {
    // Procurar por explicações (frases com "porque", "devido a", etc.)
    const explanationPatterns = [
      /porque[^.!?]+[.!?]/gi,
      /devido a[^.!?]+[.!?]/gi,
      /isso acontece[^.!?]+[.!?]/gi,
      /a razão[^.!?]+[.!?]/gi
    ];
    
    for (const pattern of explanationPatterns) {
      const match = context.match(pattern);
      if (match) {
        return match.join(' ');
      }
    }
    
    return null;
  }

  extractTimeInformation(context) {
    const timePatterns = [
      /\d{1,2}:\d{2}/g,
      /\d{1,2}h\d{0,2}/g,
      /segunda|terça|quarta|quinta|sexta|sábado|domingo/gi,
      /janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/gi,
      /\d{1,2}\/\d{1,2}\/\d{4}/g
    ];
    
    const timeInfo = [];
    timePatterns.forEach(pattern => {
      const matches = context.match(pattern);
      if (matches) {
        timeInfo.push(...matches);
      }
    });
    
    return timeInfo.length > 0 ? `Informações de tempo encontradas: ${timeInfo.join(', ')}` : null;
  }

  extractLocationInformation(context) {
    // Padrões simples para localização
    const locationPatterns = [
      /endereço[^.!?]+[.!?]/gi,
      /localizado[^.!?]+[.!?]/gi,
      /fica[^.!?]+[.!?]/gi,
      /situado[^.!?]+[.!?]/gi
    ];
    
    for (const pattern of locationPatterns) {
      const match = context.match(pattern);
      if (match) {
        return match.join(' ');
      }
    }
    
    return null;
  }

  summarizeContext(context, maxLength = 500) {
    if (context.length <= maxLength) {
      return context;
    }
    
    // Pegar as primeiras frases até o limite
    const sentences = context.split(/[.!?]+/);
    let summary = '';
    
    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) {
        break;
      }
      summary += sentence + '. ';
    }
    
    return summary.trim();
  }

  calculateConfidence(relevantChunks) {
    if (relevantChunks.length === 0) return 0;
    
    const avgSimilarity = relevantChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / relevantChunks.length;
    const chunkCount = Math.min(relevantChunks.length / 5, 1); // Normalizar por 5 chunks
    
    return Math.min(avgSimilarity * chunkCount, 1);
  }
}

module.exports = RAGService;