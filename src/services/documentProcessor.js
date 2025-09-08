const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const cheerio = require('cheerio');

class DocumentProcessor {
  constructor() {
    this.supportedTypes = {
      'application/pdf': this.processPDF.bind(this),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.processDocx.bind(this),
      'application/vnd.ms-excel': this.processExcel.bind(this),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': this.processExcel.bind(this),
      'text/plain': this.processText.bind(this),
      'text/html': this.processHTML.bind(this),
      'application/json': this.processJSON.bind(this)
    };
  }

  async processDocument(file) {
    try {
      const { buffer, mimetype, originalname } = file;
      
      if (!this.supportedTypes[mimetype]) {
        throw new Error(`Tipo de arquivo não suportado: ${mimetype}`);
      }

      console.log(`📄 Processando: ${originalname} (${mimetype})`);
      
      const processor = this.supportedTypes[mimetype];
      const content = await processor(buffer);
      
      return {
        filename: originalname,
        mimetype,
        content: this.cleanText(content),
        chunks: this.chunkText(content),
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao processar documento:', error);
      throw error;
    }
  }

  async processPDF(buffer) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  async processDocx(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  async processExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let content = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_csv(sheet);
      content += `\n\n=== ${sheetName} ===\n${sheetData}`;
    });
    
    return content;
  }

  async processText(buffer) {
    return buffer.toString('utf-8');
  }

  async processHTML(buffer) {
    const html = buffer.toString('utf-8');
    const $ = cheerio.load(html);
    
    // Remove scripts e styles
    $('script, style').remove();
    
    return $.text();
  }

  async processJSON(buffer) {
    const jsonData = JSON.parse(buffer.toString('utf-8'));
    return JSON.stringify(jsonData, null, 2);
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Múltiplos espaços
      .replace(/\n\s*\n/g, '\n') // Múltiplas quebras de linha
      .trim();
  }

  chunkText(text, maxChunkSize = 1000, overlap = 200) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          
          // Overlap: pega as últimas palavras do chunk anterior
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(overlap / 10));
          currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
        } else {
          currentChunk = trimmedSentence;
        }
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50); // Remove chunks muito pequenos
  }
}

module.exports = DocumentProcessor;