// --- Backend Otimizado para Render - server.js v2.6 ---
// ✅ WebSocket + HTTP Polling + Persistência Garantida

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

// ⚠️ WebSocket é opcional no Render
let wss = null;
try {
    const WebSocket = require('ws');
    const server = http.createServer();
    wss = new WebSocket.Server({ server, path: '/ws', perMessageDeflate: false });
    console.log('✅ WebSocket disponível');
} catch (error) {
    console.log('⚠️ WebSocket desabilitado (não instalado ou Render não suporta)');
}

const app = express();
const server = http.createServer(app);

// ========== CONFIGURAÇÃO CORS ==========
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// ========== MIDDLEWARES ==========
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = './data.json';
const BACKUP_DIR = './backups';
const PORT = process.env.PORT || 3000;

// ========== GARANTIR DIRETÓRIOS ==========
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✅ Diretório de backups criado');
}

// ========== GERENCIADOR DE PERSISTÊNCIA ==========
class PersistenceManager {
    constructor() {
        this.writeQueue = [];
        this.isWriting = false;
        this.maxBackups = 50;
        this.listeners = new Set();
    }

    /**
     * Registra listener para notificações de mudança
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notifica todos os listeners
     */
    notifyListeners(type, data) {
        this.listeners.forEach(callback => {
            try {
                callback({ type, data });
            } catch (error) {
                console.error('❌ Erro em listener:', error);
            }
        });
    }

    /**
     * Salva dados com verificação de integridade
     */
    async saveData(data, reason = 'manual') {
        return new Promise((resolve, reject) => {
            this.writeQueue.push({ data, reason, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Processa fila de escrita sequencialmente
     */
    async processQueue() {
        if (this.isWriting || this.writeQueue.length === 0) {
            return;
        }

        this.isWriting = true;
        const { data, reason, resolve, reject } = this.writeQueue.shift();

        try {
            // Criar backup automático antes de salvar
            await this.createAutoBackup();

            // Validar dados antes de salvar
            if (!this.validateData(data)) {
                throw new Error('❌ Dados inválidos! Não salvando.');
            }

            // Escrever dados no arquivo
            const dataStr = JSON.stringify(data, null, 2);
            fs.writeFileSync(DATA_FILE, dataStr, 'utf8');

            // Verificar integridade após escrita
            const verifyData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (!this.validateData(verifyData)) {
                throw new Error('❌ Falha na verificação de integridade!');
            }

            console.log(`✅ Dados salvos com sucesso [${reason}]`);
            console.log(`   📊 ${Object.keys(data.paidDates || {}).length} pagamentos registrados`);
            console.log(`   👥 ${data.people?.length || 0} pessoas cadastradas`);

            // Notificar listeners
            this.notifyListeners('dataUpdate', data);

            resolve({ success: true, data });
        } catch (error) {
            console.error(`❌ Erro ao salvar dados [${reason}]:`, error.message);
            reject(error);
        } finally {
            this.isWriting = false;

            // Processar próxima na fila
            if (this.writeQueue.length > 0) {
                setImmediate(() => this.processQueue());
            }
        }
    }

    /**
     * Valida estrutura dos dados
     */
    validateData(data) {
        return (
            data &&
            typeof data === 'object' &&
            Array.isArray(data.people) &&
            typeof data.paidDates === 'object'
        );
    }

    /**
     * Cria backup automático
     */
    async createAutoBackup() {
        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

            fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf8');
            console.log(`📦 Backup criado: ${path.basename(backupFile)}`);

            this.cleanOldBackups();
        } catch (error) {
            console.error('⚠️ Erro ao criar backup automático:', error.message);
        }
    }

    /**
     * Remove backups antigos
     */
    cleanOldBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('backup-'))
                .sort()
                .reverse();

            if (files.length > this.maxBackups) {
                const filesToDelete = files.slice(this.maxBackups);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(path.join(BACKUP_DIR, file));
                    console.log(`🗑️ Backup antigo removido: ${file}`);
                });
            }
        } catch (error) {
            console.error('⚠️ Erro ao limpar backups antigos:', error.message);
        }
    }

    /**
     * Restaura dados de um backup
     */
    async restoreFromBackup(backupFile) {
        try {
            const backupPath = path.join(BACKUP_DIR, backupFile);
            if (!fs.existsSync(backupPath)) {
                throw new Error('Arquivo de backup não encontrado');
            }

            const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            return await this.saveData(data, `restore:${backupFile}`);
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error.message);
            throw error;
        }
    }

    /**
     * Lista todos os backups disponíveis
     */
    getBackupsList() {
        try {
            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('backup-'))
                .sort()
                .reverse()
                .map(file => ({
                    filename: file,
                    timestamp: file.replace('backup-', '').replace('.json', ''),
                    size: fs.statSync(path.join(BACKUP_DIR, file)).size
                }));
            return files;
        } catch (error) {
            console.error('❌ Erro ao listar backups:', error.message);
            return [];
        }
    }
}

const persistenceManager = new PersistenceManager();

// ========== GERENCIADOR DE WEBSOCKET (OPCIONAL) ==========
class WebSocketManager {
    constructor() {
        this.clients = new Set();
        this.lastUpdate = null;
    }

    addClient(ws) {
        this.clients.add(ws);
        console.log(`✅ Cliente WebSocket conectado. Total: ${this.clients.size}`);

        try {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            ws.send(JSON.stringify({
                type: 'initialData',
                data: data,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Erro ao enviar dados iniciais:', error);
        }
    }

    removeClient(ws) {
        this.clients.delete(ws);
        console.log(`❌ Cliente WebSocket desconectado. Total: ${this.clients.size}`);
    }

    broadcastUpdate(type, data) {
        const message = JSON.stringify({
            type,
            data,
            timestamp: new Date().toISOString()
        });

        let successCount = 0;
        this.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN = 1
                try {
                    client.send(message);
                    successCount++;
                } catch (error) {
                    console.error('Erro ao enviar para cliente WebSocket:', error);
                }
            }
        });

        if (successCount > 0) {
            console.log(`📡 Broadcast: ${successCount}/${this.clients.size} clientes WebSocket notificados`);
        }
        this.lastUpdate = new Date().toISOString();
    }

    getClientCount() {
        return this.clients.size;
    }

    getLastUpdate() {
        return this.lastUpdate;
    }
}

let wsManager = null;
if (wss) {
    wsManager = new WebSocketManager();

    wss.on('connection', (ws) => {
        wsManager.addClient(ws);

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('📨 Mensagem WebSocket recebida:', data.type);

                switch (data.type) {
                    case 'ping':
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: new Date().toISOString()
                        }));
                        break;

                    case 'requestUpdate':
                        const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                        ws.send(JSON.stringify({
                            type: 'dataUpdate',
                            data: currentData,
                            timestamp: new Date().toISOString()
                        }));
                        break;

                    default:
                        console.log('⚠️ Tipo de mensagem desconhecido:', data.type);
                }
            } catch (error) {
                console.error('❌ Erro ao processar mensagem WebSocket:', error);
            }
        });

        ws.on('close', () => {
            wsManager.removeClient(ws);
        });

        ws.on('error', (error) => {
            console.error('❌ Erro WebSocket:', error);
        });
    });

    // Listener de persistência para broadcast
    persistenceManager.addListener((update) => {
        if (wsManager) {
            wsManager.broadcastUpdate(update.type, update.data);
        }
    });
}

// ========== FUNÇÕES AUXILIARES ==========

function readData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('❌ Erro ao ler data.json:', error);
        return { people: [], paidDates: {} };
    }
}

// ========== ROTAS API ==========

// GET /api/data - Obter todos os dados
app.get('/api/data', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao obter dados:', error);
        res.status(500).json({ error: 'Erro ao obter dados' });
    }
});

// GET /api/next-person - Obter próxima pessoa a pagar (pessoa com menos pagamentos)
app.get('/api/next-person', (req, res) => {
    try {
        const data = readData();
        const people = data.people || [];
        
        if (people.length === 0) {
            return res.json({ nextPerson: null });
        }
        
        const paidDates = data.paidDates || {};
        
        // Contar pagamentos de cada pessoa
        const counts = {};
        people.forEach(person => {
            counts[person] = Object.values(paidDates).filter(p => p === person).length;
        });
        
        // Encontrar pessoa com menos pagamentos
        const nextPerson = people.reduce((prev, curr) => {
            return counts[curr] < counts[prev] ? curr : prev;
        });
        
        console.log('📊 Próxima pessoa calculada:', nextPerson, 'Contagem:', counts);
        res.json({ nextPerson });
    } catch (error) {
        console.error('❌ Erro ao obter próxima pessoa:', error);
        res.status(500).json({ error: 'Erro ao obter próxima pessoa' });
    }
});

// GET /api/health - Status de saúde
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        wsEnabled: !!wsManager,
        wsClients: wsManager ? wsManager.getClientCount() : 0,
        lastUpdate: wsManager ? wsManager.getLastUpdate() : null,
        backups: persistenceManager.getBackupsList().length,
        version: '2.6'
    });
});

// POST /api/admin/login - Login administrativo
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
        const token = 'admin_token_' + Date.now();
        res.json({
            success: true,
            token,
            message: 'Login realizado com sucesso'
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Senha incorreta'
        });
    }
});

// GET /api/admin/data - Obter dados administrativos
app.get('/api/admin/data', (req, res) => {
    try {
        const data = readData();
        res.json({
            success: true,
            people: data.people || [],
            paidDates: data.paidDates || {},
            backupCount: persistenceManager.getBackupsList().length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/people - Adicionar pessoa
app.post('/api/admin/people', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nome inválido' });
        }

        const data = readData();
        if (!data.people.includes(name.trim())) {
            data.people.push(name.trim());
            await persistenceManager.saveData(data, `add_person:${name}`);
        }

        res.json({
            success: true,
            people: data.people,
            message: 'Pessoa adicionada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar pessoa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/people/:name - Remover pessoa
app.delete('/api/admin/people/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const decodedName = decodeURIComponent(name);
        const data = readData();

        data.people = data.people.filter(p => p !== decodedName);

        Object.keys(data.paidDates).forEach(date => {
            if (data.paidDates[date] === decodedName) {
                delete data.paidDates[date];
            }
        });

        await persistenceManager.saveData(data, `remove_person:${decodedName}`);

        res.json({
            success: true,
            people: data.people,
            paidDates: data.paidDates,
            message: 'Pessoa removida com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao remover pessoa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/admin/paid - Atualizar data de pagamento (PRINCIPAL - SEMPRE SALVA)
app.patch('/api/admin/paid', async (req, res) => {
    try {
        const { date, name } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Data não fornecida' });
        }

        const data = readData();

        if (name === null || name === undefined || name === '') {
            delete data.paidDates[date];
            console.log(`🗑️ Pagamento removido para ${date}`);
        } else {
            data.paidDates[date] = name;
            console.log(`✅ PAGAMENTO REGISTRADO: ${date} -> ${name}`);
        }

        // ✅ SALVAR COM PERSISTÊNCIA GARANTIDA
        await persistenceManager.saveData(data, `update_payment:${date}:${name}`);

        res.json({
            success: true,
            paidDates: data.paidDates,
            message: '✅ Pagamento salvo permanentemente no backend!',
            timestamp: new Date().toISOString(),
            savedDate: date,
            savedPerson: name
        });
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao atualizar pagamento:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'Erro ao salvar pagamento'
        });
    }
});

// GET /api/admin/backups - Listar backups
app.get('/api/admin/backups', (req, res) => {
    try {
        const backups = persistenceManager.getBackupsList();
        res.json({
            success: true,
            backups,
            message: `${backups.length} backup(s) disponível(is)`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/backup - Criar backup manual
app.post('/api/admin/backup', async (req, res) => {
    try {
        const data = readData();
        await persistenceManager.saveData(data, 'manual_backup');
        const backups = persistenceManager.getBackupsList();

        res.json({
            success: true,
            backup: backups[0],
            message: 'Backup criado com sucesso',
            totalBackups: backups.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/backup/restore - Restaurar backup
app.post('/api/admin/backup/restore', async (req, res) => {
    try {
        const { backupFile } = req.body;
        
        if (!backupFile) {
            return res.status(400).json({ error: 'Arquivo de backup não fornecido' });
        }

        await persistenceManager.restoreFromBackup(backupFile);
        const data = readData();

        res.json({
            success: true,
            data,
            message: `✅ Backup restaurado: ${backupFile}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== INICIAR SERVIDOR ==========
server.listen(PORT, () => {
    console.log(`
╔═════════════════════════════════════════════════════════════════════╗
║  🍹 Bebida em Dia - Backend v2.6 (Otimizado para Render)           ║
║  ✅ HTTP Server rodando em http://localhost:${PORT}                
║  🔌 WebSocket: ${wss ? 'ATIVADO ✓' : 'DESATIVADO (Render não suporta)'}                           
║  💾 Persistência: Fila automática + Verificação de integridade     
║  📦 Backups automáticos em: ./backups/                             
║  📨 HTTP Polling: ATIVO (Fallback automático)                      
║  ⚠️  IMPORTANTE: Todos os pagamentos são salvos imediatamente!     
╚═════════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recebido, encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT recebido, encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});
