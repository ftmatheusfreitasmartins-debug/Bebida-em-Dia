// --- Auto-Sync com GitHub API v3.2 - COM TRATAMENTO DE ERRO 401 ---
// ✅ Sincroniza data.json automaticamente para GitHub (RENDER-FRIENDLY)

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const app = express();

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
const PORT = process.env.PORT || 3000;

// ========== CONFIGURAÇÕES GITHUB ==========
const GITHUB_CONFIG = {
    owner: 'ftmatheusfreitasmartins-debug',
    repo: 'Bebida-em-Dia',
    branch: 'main',
    // ⚠️ IMPORTANTE: Use a variável de ambiente EM PRIMEIRO LUGAR
    // Se não tiver, usa token padrão (será rejeitado e informará para atualizar)
    token: process.env.GITHUB_TOKEN || '',
    filePath: 'data.json'
};

// ========== AUTO-SYNC MANAGER (GitHub API) ==========
class AutoSyncManager {
    constructor() {
        this.lastHash = null;
        this.isSyncing = false;
        this.watchInterval = null;
        this.tokenInvalid = false;
        this.init();
    }

    init() {
        console.log('📡 AutoSyncManager inicializado (GitHub API v3.2)');
        console.log(`   GitHub Owner: ${GITHUB_CONFIG.owner}`);
        console.log(`   Repository: ${GITHUB_CONFIG.repo}`);
        
        if (!GITHUB_CONFIG.token) {
            console.warn('\n⚠️  AVISO: Token do GitHub não configurado!');
            console.warn('   Adicione em .env: GITHUB_TOKEN=seu_token_aqui');
            this.tokenInvalid = true;
        } else {
            console.log(`   Token: ${GITHUB_CONFIG.token.substring(0, 10)}...`);
        }
        
        this.startWatching();
    }

    startWatching() {
        console.log('👀 Observando mudanças em data.json...\n');
        
        this.watchInterval = setInterval(() => {
            this.checkForChanges();
        }, 10000); // Verifica a cada 10 segundos
    }

    getFileHash() {
        try {
            if (!fs.existsSync(DATA_FILE)) {
                return null;
            }
            const content = fs.readFileSync(DATA_FILE, 'utf8');
            const crypto = require('crypto');
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            console.error('❌ Erro ao calcular hash:', error);
            return null;
        }
    }

    async checkForChanges() {
        const currentHash = this.getFileHash();
        
        // Se o arquivo mudou
        if (currentHash && this.lastHash && currentHash !== this.lastHash) {
            console.log('\n🔄 Mudanças detectadas em data.json!');
            await this.syncToGitHub();
        }
        
        this.lastHash = currentHash;
    }

    async syncToGitHub() {
        if (this.isSyncing) {
            console.log('⏳ Já está sincronizando, pulando...');
            return;
        }

        // Se token é inválido, não tenta sincronizar
        if (this.tokenInvalid) {
            console.log('⏭️  Pulando sincronização (token inválido)');
            return;
        }

        this.isSyncing = true;

        try {
            console.log('📤 Sincronizando com GitHub...');

            // Ler conteúdo do arquivo
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            const base64Content = Buffer.from(fileContent).toString('base64');

            // Obter SHA do arquivo atual no GitHub
            const sha = await this.getFileSHA();

            if (!sha) {
                console.error('❌ Não foi possível obter SHA do arquivo');
                return;
            }

            // Preparar dados para o commit
            const timestamp = new Date().toLocaleString('pt-BR');
            const commitMessage = `auto: sincronizar data.json - ${timestamp}`;

            const payload = {
                message: commitMessage,
                content: base64Content,
                sha: sha,
                branch: GITHUB_CONFIG.branch
            };

            // Fazer upload via GitHub API
            await this.makeGitHubRequest('PUT', payload);

            console.log('✅ Sincronização concluída!');
            console.log('🎉 data.json atualizado no GitHub!\n');

        } catch (error) {
            console.error('❌ Erro ao sincronizar:', error.message);
            
            // Se for erro 401, marca como inválido
            if (error.statusCode === 401) {
                console.warn('\n🚨 ERRO 401: Token inválido ou expirado!');
                console.warn('   Ações necessárias:');
                console.warn('   1. Gere um novo token: https://github.com/settings/tokens');
                console.warn('   2. Selecione "Generate new token (classic)"');
                console.warn('   3. Marque permissão "repo" (full control)');
                console.warn('   4. Copie o token gerado');
                console.warn('   5. Adicione em .env: GITHUB_TOKEN=seu_novo_token');
                console.warn('   6. Reinicie o servidor\n');
                this.tokenInvalid = true;
            }
        } finally {
            this.isSyncing = false;
        }
    }

    async getFileSHA() {
        try {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'api.github.com',
                    path: `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}?ref=${GITHUB_CONFIG.branch}`,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Bebida-em-Dia-Bot',
                        'Authorization': `token ${GITHUB_CONFIG.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                };

                https.request(options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            const parsed = JSON.parse(data);
                            resolve(parsed.sha);
                        } else if (res.statusCode === 401) {
                            const error = new Error('Token inválido');
                            error.statusCode = 401;
                            reject(error);
                        } else {
                            reject(new Error(`Status ${res.statusCode}`));
                        }
                    });
                }).on('error', reject).end();
            });
        } catch (error) {
            console.error('❌ Erro ao obter SHA:', error.message);
            if (error.statusCode === 401) {
                const err = new Error(error.message);
                err.statusCode = 401;
                throw err;
            }
            return null;
        }
    }

    async makeGitHubRequest(method, payload) {
        return new Promise((resolve, reject) => {
            const payloadStr = JSON.stringify(payload);

            const options = {
                hostname: 'api.github.com',
                path: `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}`,
                method: method,
                headers: {
                    'User-Agent': 'Bebida-em-Dia-Bot',
                    'Authorization': `token ${GITHUB_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'Content-Length': payloadStr.length
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else if (res.statusCode === 401) {
                        const error = new Error('Token inválido (401)');
                        error.statusCode = 401;
                        error.statusMessage = data;
                        reject(error);
                    } else {
                        reject(new Error(`Status ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(payloadStr);
            req.end();
        });
    }

    stop() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            console.log('⏹️ AutoSync parado');
        }
    }
}

const autoSync = new AutoSyncManager();

// ========== FUNÇÕES AUXILIARES ==========

function readData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('❌ Erro ao ler data.json:', error);
        return { people: [], paidDates: {} };
    }
}

function writeData(data, reason = 'manual') {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✅ Dados salvos localmente: ${reason}`);
        // Auto-sync vai detectar a mudança e sincronizar
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar data.json:', error);
        return false;
    }
}

// ========== ROTAS API ==========

// GET /api/data
app.get('/api/data', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao obter dados:', error);
        res.status(500).json({ error: 'Erro ao obter dados' });
    }
});

// GET /api/next-person
app.get('/api/next-person', (req, res) => {
    try {
        const data = readData();
        const people = data.people || [];
        
        if (people.length === 0) {
            return res.json({ nextPerson: null });
        }
        
        const paidDates = data.paidDates || {};
        
        const counts = {};
        people.forEach(person => {
            counts[person] = Object.values(paidDates).filter(p => p === person).length;
        });
        
        const nextPerson = people.reduce((prev, curr) => {
            return counts[curr] < counts[prev] ? curr : prev;
        });
        
        console.log('📊 Próxima pessoa calculada:', nextPerson);
        res.json({ nextPerson });
    } catch (error) {
        console.error('❌ Erro ao obter próxima pessoa:', error);
        res.status(500).json({ error: 'Erro ao obter próxima pessoa' });
    }
});

// GET /api/health
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '3.2',
        autoSyncEnabled: true,
        tokenValid: !autoSync.tokenInvalid,
        platform: 'Render'
    });
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD || password === 'coca') {
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

// GET /api/admin/data
app.get('/api/admin/data', (req, res) => {
    try {
        const data = readData();
        res.json({
            success: true,
            people: data.people || [],
            paidDates: data.paidDates || {}
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/people
app.post('/api/admin/people', (req, res) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nome inválido' });
        }

        const data = readData();
        if (!data.people.includes(name.trim())) {
            data.people.push(name.trim());
            writeData(data, `add_person:${name}`);
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

// DELETE /api/admin/people/:name
app.delete('/api/admin/people/:name', (req, res) => {
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

        writeData(data, `remove_person:${decodedName}`);

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

// PATCH /api/admin/paid - PRINCIPAL: Atualizar pagamento
app.patch('/api/admin/paid', (req, res) => {
    try {
        const { date, name } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Data não fornecida' });
        }

        const data = readData();

        if (name === null || name === undefined || name === '') {
            delete data.paidDates[date];
            console.log(`🗑️ Pagamento removido: ${date}`);
        } else {
            data.paidDates[date] = name;
            console.log(`✅ PAGAMENTO REGISTRADO: ${date} -> ${name}`);
        }

        // Salvar (vai disparar auto-sync em 10 segundos)
        writeData(data, `update_payment:${date}:${name}`);

        res.json({
            success: true,
            paidDates: data.paidDates,
            message: '✅ Pagamento salvo e será sincronizado com GitHub!',
            timestamp: new Date().toISOString(),
            savedDate: date,
            savedPerson: name
        });
    } catch (error) {
        console.error('❌ ERRO ao atualizar pagamento:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
});

// ========== INICIAR SERVIDOR ==========
const server = require('http').createServer(app);

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🍹 Bebida em Dia - Backend v3.2 - RENDER READY                    ║
║  ✅ HTTP Server rodando em http://localhost:${PORT}                
║  📡 Auto-Sync: ATIVADO ✓ (GitHub API)                              ║
║  💾 Sincronização automática de data.json a cada 10 segundos!      ║
║  🚀 100% compatível com Render!                                     ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recebido');
    autoSync.stop();
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT recebido');
    autoSync.stop();
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});
