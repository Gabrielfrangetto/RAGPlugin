const mongoose = require('mongoose');

class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        console.warn('⚠️ MONGODB_URI não encontrada - servidor iniciando sem banco de dados');
        console.warn('⚠️ Configure MONGODB_URI nas variáveis de ambiente do Render');
        return false;
      }

      console.log('🔄 Conectando ao MongoDB Atlas...');
      
      // Configurações otimizadas para MongoDB Atlas
      const options = {
        serverSelectionTimeoutMS: 10000, // Reduzido para 10 segundos
        socketTimeoutMS: 15000, // Reduzido para 15 segundos
        family: 4, // Força IPv4
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 5000,
        retryWrites: true,
        w: 'majority'
      };

      this.connection = await mongoose.connect(mongoUri, options);
      this.isConnected = true;
      
      console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
      console.log(`🗄️ Database: ${mongoose.connection.db.databaseName}`);
      console.log(`🌐 Host: ${mongoose.connection.host}`);
      
      // Event listeners para monitoramento
      mongoose.connection.on('error', (error) => {
        console.error('❌ Erro na conexão MongoDB:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB desconectado');
        this.isConnected = false;
      });
      
      return true;

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconectado');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      console.error('❌ Erro ao conectar ao MongoDB Atlas:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('🔌 Desconectado do MongoDB Atlas');
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar do MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', message: 'Não conectado ao banco' };
      }

      // Teste simples de ping
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'healthy',
        message: 'Conexão com MongoDB Atlas funcionando',
        database: mongoose.connection.db.databaseName,
        host: mongoose.connection.host
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// Singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;