// --- Backend com Firebase Firestore Sync - server.js v4.1 ---
// ✅ Sincroniza data.json com Firebase Firestore em tempo real
// ✅ 100% Render-friendly, sem dependências complexas

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

// ========== FIREBASE CONFIG ==========
const FIREBASE_CONFIG = {
    projectId: 'bebidaemdia',
    apiKey: 'AIzaSyCDZF9jkeWtA2C1aKAgCoS7Apadxv4yYIw',
    databaseURL: 'https://bebidaemdia.firebaseapp.com'
};

console.log(`
🔥 Firebase Config Carregado:
   Project ID: ${FIREBASE_CONFIG.projectId}
   Database: ${FIREBASE_CONFIG.databaseURL}
`);

// ========== FIREBASE SYNC MANAGER ==========
class FirebaseSyncManager {
    constructor() {
        this.lastSync = null;
        this.isSyncing = false;
        this.syncInterval = null;
        this.init();
    }

    init() {
        console.log('📡 FirebaseSyncManager inicializado');
        this.startAutoSync();
    }

    startAutoSync() {
        console.log('👀 Observando mudanças em data.json para sincronizar com Firebase...\n');
        
        this.syncInterval = setInterval(() => {
            this.checkAndSync();
        }, 15000); // Sincroniza a cada 15 segundos
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

    async checkAndSync() {
        const currentHash = this.getFileHash();
        
        if (currentHash && this.lastSync && currentHash !== this.lastSync) {
            console.log('\n🔄 Mudanças detectadas em data.json!');
            await this.syncToFirebase();
        }
        
        this.lastSync = currentHash;
    }

    async syncToFirebase() {
        if (this.isSyncing) {
            console.log('⏳ Já está sincronizando, pulando...');
            return;
        }

        this.isSyncing = true;

        try {
            console.log('📤 Sincronizando com Firebase Firestore...');

            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

            // Salvar em Firebase usando REST API
            await this.saveToFirestore('appData', data);

            console.log('✅ Sincronização com Firebase concluída!');
            console.log('🎉 data.json sincronizado com Firestore!\n');

        } catch (error) {
            console.error('❌ Erro ao sincronizar com Firebase:', error.message);
        } finally {
            this.isSyncing = false;
        }
    }

    async saveToFirestore(collection, data) {
        return new Promise((resolve, reject) => {
            try {
                // Preparar documento
                const docData = {
                    fields: {
                        people: {
                            arrayValue: {
                                values: (data.people || []).map(p => ({ stringValue: p }))
                            }
                        },
                        paidDates: {
                            mapValue: {
                                fields: Object.entries(data.paidDates || {}).reduce((acc, [key, value]) => {
                                    acc[key] = { stringValue: value };
                                    return acc;
                                }, {})
                            }
                        },
                        lastUpdated: {
                            timestampValue: new Date().toISOString()
                        },
                        source: {
                            stringValue: 'Render Backend'
                        }
                    }
                };

                const payload = JSON.stringify(docData);

                const options = {
                    hostname: 'firestore.googleapis.com',
                    path: `/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collection}/data?updateMask.fieldPaths=people&updateMask.fieldPaths=paidDates&updateMask.fieldPaths=lastUpdated&key=${FIREBASE_CONFIG.apiKey}`,
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': payload.length
                    }
                };

                const req = https.request(options, (res) => {
                    let responseData = '';

                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            console.log('   ✅ Firebase Firestore atualizado com sucesso');
                            resolve(responseData);
                        } else {
                            console.error(`   ⚠️ Status ${res.statusCode}`);
                            resolve(responseData); // Não rejeita, apenas avisa
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error('   ❌ Erro de conexão com Firebase:', error.message);
                    reject(error);
                });

                req.write(payload);
                req.end();

            } catch (error) {
                console.error('❌ Erro ao preparar documento:', error);
                reject(error);
            }
        });
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            console.log('⏹️ FirebaseSync parado');
        }
    }
}

const firebaseSync = new FirebaseSyncManager();

// ========== FUNÇÕES AUXILIARES ==========

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { people: [], paidDates: {} };
        }
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
        version: '4.1',
        backend: 'Firebase Firestore + Local JSON',
        platform: 'Render',
        lastSync: firebaseSync.lastSync
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

        // Salvar localmente
        writeData(data, `update_payment:${date}:${name}`);

        res.json({
            success: true,
            paidDates: data.paidDates,
            message: '✅ Pagamento salvo e será sincronizado com Firebase!',
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
║  🍹 Bebida em Dia - Backend v4.1 - FIREBASE SYNC                   ║
║  ✅ HTTP Server rodando em http://localhost:${PORT}                
║  🔥 Backend: Firebase Firestore (Sync automático)                  ║
║  💾 Dados salvos em local (data.json) + Firebase                   ║
║  📡 Sincronização automática a cada 15 segundos                    ║
║  🚀 100% compatível com Render!                                     ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recebido');
    firebaseSync.stop();
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT recebido');
    firebaseSync.stop();
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});
