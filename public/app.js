// app.js - Frontend da aplicação RAG

class RAGApp {
    constructor() {
        this.selectedFiles = [];
        this.initializeEventListeners();
        this.loadDocuments();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');

        // Upload area events
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // File input change
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Upload button
        uploadBtn.addEventListener('click', this.uploadFiles.bind(this));

        // Search input
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }

    addFiles(files) {
        this.selectedFiles = [...this.selectedFiles, ...files];
        this.updateFileList();
        this.updateUploadButton();
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (this.selectedFiles.length === 0) {
            fileList.classList.add('hidden');
            return;
        }

        fileList.classList.remove('hidden');
        fileList.innerHTML = this.selectedFiles.map((file, index) => `
            <div class="file-item">
                <span>📄 ${file.name} (${this.formatFileSize(file.size)})</span>
                <button onclick="app.removeFile(${index})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">❌</button>
            </div>
        `).join('');
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
        this.updateUploadButton();
    }

    updateUploadButton() {
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = this.selectedFiles.length === 0;
        uploadBtn.textContent = `📤 Upload ${this.selectedFiles.length} arquivo(s)`;
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;

        const formData = new FormData();
        this.selectedFiles.forEach(file => {
            formData.append('documents', file);
        });

        const progressBar = document.getElementById('progressBar');
        const progress = document.getElementById('progress');
        const status = document.getElementById('status');
        const uploadBtn = document.getElementById('uploadBtn');

        try {
            uploadBtn.disabled = true;
            progress.classList.remove('hidden');
            progressBar.style.width = '0%';

            // Simular progresso
            let progressValue = 0;
            const progressInterval = setInterval(() => {
                progressValue += Math.random() * 15;
                if (progressValue > 90) progressValue = 90;
                progressBar.style.width = progressValue + '%';
            }, 500);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            progressBar.style.width = '100%';

            const result = await response.json();

            if (result.success) {
                this.showStatus('✅ Upload concluído com sucesso!', 'success');
                this.selectedFiles = [];
                this.updateFileList();
                this.updateUploadButton();
                this.loadDocuments();
            } else {
                throw new Error(result.error || 'Erro no upload');
            }

        } catch (error) {
            console.error('Erro no upload:', error);
            this.showStatus(`❌ Erro: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            setTimeout(() => {
                progress.classList.add('hidden');
            }, 2000);
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const result = await response.json();

            if (result.success) {
                this.displayDocuments(result.documents);
            }
        } catch (error) {
            console.error('Erro ao carregar documentos:', error);
        }
    }

    displayDocuments(documents) {
        const grid = document.getElementById('documentsGrid');
        
        if (documents.length === 0) {
            grid.innerHTML = '<p>Nenhum documento encontrado. Faça upload de alguns arquivos!</p>';
            return;
        }

        grid.innerHTML = documents.map(doc => `
            <div class="document-card">
                <h3>📄 ${doc.filename}</h3>
                <p><strong>Chunks:</strong> ${doc.chunkCount}</p>
                <p><strong>Tamanho:</strong> ${this.formatFileSize(doc.fileSize)}</p>
                <p><strong>Upload:</strong> ${new Date(doc.createdAt).toLocaleString('pt-BR')}</p>
                <button onclick="app.deleteDocument('${doc.id}')" class="btn" style="background: #dc3545; margin-top: 10px;">
                    🗑️ Excluir
                </button>
            </div>
        `).join('');
    }

    async deleteDocument(id) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;

        try {
            const response = await fetch(`/api/documents/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('✅ Documento excluído!', 'success');
                this.loadDocuments();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao excluir documento:', error);
            this.showStatus(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = '<p>🔍 Buscando...</p>';

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, limit: 10 })
            });

            const result = await response.json();

            if (result.success) {
                this.displaySearchResults(result.results);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            resultsDiv.innerHTML = `<p>❌ Erro: ${error.message}</p>`;
        }
    }

    displaySearchResults(results) {
        const resultsDiv = document.getElementById('searchResults');
        
        if (results.length === 0) {
            resultsDiv.innerHTML = '<p>Nenhum resultado encontrado.</p>';
            return;
        }

        resultsDiv.innerHTML = results.map(result => `
            <div class="result-item">
                <h4>📄 ${result.filename}</h4>
                <p><strong>Similaridade:</strong> ${result.similarity}%</p>
                <p>${result.text}</p>
            </div>
        `).join('');
    }

    async testRAG() {
        const query = document.getElementById('testQuery').value.trim();
        if (!query) return;

        const resultsDiv = document.getElementById('testResults');
        resultsDiv.innerHTML = '<p>🧪 Testando sistema RAG...</p>';

        try {
            // Simular formato de mensagens da extensão
            const messages = [
                {
                    sender: 'Cliente',
                    message: query,
                    timestamp: new Date().toLocaleTimeString(),
                    isSystem: false
                }
            ];

            const response = await fetch('/api/rag', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages })
            });

            const result = await response.json();

            if (result.success) {
                resultsDiv.innerHTML = `
                    <div class="result-item">
                        <h4>🤖 Resposta da IA</h4>
                        <p><strong>Sugestão:</strong> ${result.suggestion}</p>
                        <p><strong>Confiança:</strong> ${result.confidence}%</p>
                        <p><strong>Tempo:</strong> ${result.metadata.processingTime}ms</p>
                        <p><strong>Tokens:</strong> ${result.metadata.tokensUsed}</p>
                        ${result.sources.length > 0 ? `
                            <p><strong>Fontes:</strong></p>
                            <ul>
                                ${result.sources.map(source => `
                                    <li>${source.filename} (${source.similarity}% similaridade)</li>
                                `).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro no teste RAG:', error);
            resultsDiv.innerHTML = `<p>❌ Erro: ${error.message}</p>`;
        }
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        status.innerHTML = `<div class="status ${type}">${message}</div>`;
        
        setTimeout(() => {
            status.innerHTML = '';
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Funções globais para navegação
function showTab(tabName) {
    // Esconder todas as abas
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar aba selecionada
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function performSearch() {
    app.performSearch();
}

function testRAG() {
    app.testRAG();
}

// Inicializar aplicação
const app = new RAGApp();