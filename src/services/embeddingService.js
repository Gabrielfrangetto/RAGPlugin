const { pipeline } = require('@xenova/transformers');
const fs = require('fs-extra');
const path = require('path');

class EmbeddingService {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.vectorStore = new Map();
    this.vectorStorePath = path.join(__dirname, '../../data/vectors.json');
  }

  async initialize() {
    // Forçar modo fallback para evitar problemas com o modelo
    console.log('⚠️ Iniciando em modo fallback (modelo ML desabilitado)...');
    
    this.model = null;
    this.fallbackMode = true;
    
    try {
      await this.loadVectorStore();
      console.log('✅ Serviço iniciado em modo fallback');
    } catch (error) {
      console.error('❌ Erro ao carregar vector store:', error.message);
      // Continuar mesmo com erro no vector store
      console.log('⚠️ Continuando sem vector store persistente...');
    }
  }

  async generateEmbedding(text) {
    if (this.fallbackMode || !this.model) {
      return this.generateFallbackEmbedding(text);
    }

    try {
      const output = await this.model(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Erro ao gerar embedding:', error);
      console.log('🔄 Usando fallback para este embedding...');
      return this.generateFallbackEmbedding(text);
    }
  }

  generateFallbackEmbedding(text) {
    // Gerar embedding simples baseado em características do texto
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Mesmo tamanho do modelo original
    
    // Usar hash simples e características do texto
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Distribuir o hash pelo vetor
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash * (i + 1) * 0.01) * 0.1;
    }
    
    // Adicionar características baseadas em palavras
    words.forEach((word, idx) => {
      const wordHash = word.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      const pos = Math.abs(wordHash) % embedding.length;
      embedding[pos] += 0.1;
    });
    
    // Normalizar
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }

  async generateEmbeddings(texts) {
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i++) {
      console.log(`📊 Gerando embedding ${i + 1}/${texts.length}`);
      const embedding = await this.generateEmbedding(texts[i]);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async addDocument(documentId, chunks, metadata = {}) {
    try {
      console.log(`📚 Adicionando documento: ${documentId}`);
      
      const embeddings = await this.generateEmbeddings(chunks);
      
      const documentData = {
        id: documentId,
        chunks,
        embeddings,
        metadata,
        addedAt: new Date().toISOString()
      };
      
      this.vectorStore.set(documentId, documentData);
      await this.saveVectorStore();
      
      console.log(`✅ Documento adicionado: ${chunks.length} chunks`);
      return documentData;
    } catch (error) {
      console.error('Erro ao adicionar documento:', error);
      throw error;
    }
  }

  async searchSimilar(query, topK = 5, threshold = 0.3) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results = [];
      
      for (const [docId, docData] of this.vectorStore) {
        for (let i = 0; i < docData.chunks.length; i++) {
          const similarity = this.cosineSimilarity(queryEmbedding, docData.embeddings[i]);
          
          if (similarity >= threshold) {
            results.push({
              documentId: docId,
              chunkIndex: i,
              chunk: docData.chunks[i],
              similarity,
              metadata: docData.metadata
            });
          }
        }
      }
      
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('Erro na busca:', error);
      throw error;
    }
  }

  async loadVectorStore() {
    try {
      await fs.ensureDir(path.dirname(this.vectorStorePath));
      
      if (await fs.pathExists(this.vectorStorePath)) {
        const data = await fs.readJSON(this.vectorStorePath);
        this.vectorStore = new Map(Object.entries(data));
        console.log(`📂 Carregados ${this.vectorStore.size} documentos`);
      }
    } catch (error) {
      console.error('Erro ao carregar vector store:', error);
    }
  }

  async saveVectorStore() {
    try {
      const data = Object.fromEntries(this.vectorStore);
      await fs.writeJSON(this.vectorStorePath, data, { spaces: 2 });
    } catch (error) {
      console.error('Erro ao salvar vector store:', error);
    }
  }

  getStats() {
    let totalChunks = 0;
    for (const docData of this.vectorStore.values()) {
      totalChunks += docData.chunks.length;
    }
    
    return {
      documents: this.vectorStore.size,
      totalChunks,
      modelName: this.modelName
    };
  }
}

module.exports = EmbeddingService;