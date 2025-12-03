// 🔥 Bebida em Dia - Backend com MySQL v5.0
// CORRIGIDO - Sem template literals problemáticos

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const MySQLManager = require('./mysql-manager');

// ========== CONFIGURAÇÃO EXPRESS ==========
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.static('public'));

// ========== INICIALIZAR MySQL ==========
let db;
let isDBReady = false;

(async () => {
    try {
        db = new MySQLManager({
            host: process.env.DB_HOST || 'sql10.freesqldatabase.com',
            user: process.env.DB_USER || 'sql10810558',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'sql10810558',
            port: process.env.DB_PORT || 3306
        });

        await db.connect();
        isDBReady = true;
        console.log('🚀 Sistema pronto para usar!\n');
    } catch (error) {
        console.error('⚠️ MySQL não disponível:', error.message);
        console.error('Verifique as variáveis de ambiente no .env\n');
    }
})();

// ========== ROTAS API ==========

// ✅ GET /api/data - Obter todos os dados
app.get('/api/data', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        const people = await db.getAllPeople();
        const paidDates = await db.getAllPaidDates();
        const chat = await db.getAllChatMessages();
        const settings = await db.getAllSettings();

        res.json({ people, paidDates, chat, settings });
    } catch (error) {
        console.error('❌ Erro ao obter dados:', error);
        res.status(500).json({ error: 'Erro ao obter dados' });
    }
});

// ✅ GET /api/next-person - Próxima pessoa a pagar
app.get('/api/next-person', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        const people = await db.getAllPeople();
        if (people.length === 0) {
            return res.json({ nextPerson: null });
        }

        const contributors = await db.getTopContributors(people.length);
        const counts = {};
        people.forEach(function(p) { counts[p] = 0; });
        contributors.forEach(function(c) { counts[c.name] = c.count; });

        const nextPerson = people.reduce(function(prev, curr) {
            return counts[curr] < counts[prev] ? curr : prev;
        });

        console.log('📊 Próxima pessoa calculada:', nextPerson);
        res.json({ nextPerson });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ error: 'Erro ao obter próxima pessoa' });
    }
});

// ✅ GET /api/health - Status do servidor
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = isDBReady ? await db.healthCheck() : { status: 'MySQL não disponível' };
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '5.0',
            database: dbStatus,
            platform: 'Render'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS ADMIN ==========

// ✅ POST /api/admin/login - Autenticação
app.post('/api/admin/login', function(req, res) {
    var password = req.body.password;
    if (password === process.env.ADMIN_PASSWORD || password === 'coca') {
        var token = 'admin_token_' + Date.now();
        res.json({
            success: true,
            token: token,
            message: 'Login realizado com sucesso'
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Senha incorreta'
        });
    }
});

// ✅ GET /api/admin/data - Obter dados admin
app.get('/api/admin/data', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ success: false, error: 'Database não disponível' });
        }

        const people = await db.getAllPeople();
        const paidDates = await db.getAllPaidDates();
        const chat = await db.getAllChatMessages();
        const settings = await db.getAllSettings();

        res.json({
            success: true,
            people: people,
            paidDates: paidDates,
            chat: chat,
            settings: settings
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ POST /api/admin/people - Adicionar pessoa
app.post('/api/admin/people', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var name = req.body.name;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nome inválido' });
        }

        var exists = await db.personExists(name.trim());
        if (exists) {
            return res.status(400).json({ error: 'Pessoa já existe' });
        }

        await db.addPerson(name.trim());
        var people = await db.getAllPeople();

        console.log('✅ Pessoa adicionada: ' + name.trim());
        res.json({
            success: true,
            people: people,
            message: 'Pessoa adicionada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar pessoa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ DELETE /api/admin/people/:name - Remover pessoa
app.delete('/api/admin/people/:name', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var name = req.params.name;
        var decodedName = decodeURIComponent(name);

        await db.removePerson(decodedName);
        var people = await db.getAllPeople();
        var paidDates = await db.getAllPaidDates();

        console.log('✅ Pessoa removida: ' + decodedName);
        res.json({
            success: true,
            people: people,
            paidDates: paidDates,
            message: 'Pessoa removida com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao remover pessoa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ PATCH /api/admin/paid - Atualizar pagamento
app.patch('/api/admin/paid', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var date = req.body.date;
        var name = req.body.name;

        if (!date) {
            return res.status(400).json({ error: 'Data não fornecida' });
        }

        if (name === null || name === undefined || name === '') {
            await db.removePaidDate(date);
            console.log('🗑️ Pagamento removido: ' + date);
        } else {
            await db.addPaidDate(date, name);
            console.log('✅ PAGAMENTO REGISTRADO: ' + date + ' -> ' + name);
        }

        var paidDates = await db.getAllPaidDates();

        res.json({
            success: true,
            paidDates: paidDates,
            message: '✅ Pagamento salvo com sucesso!',
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

// ✅ POST /api/chat - Adicionar mensagem ao chat
app.post('/api/chat', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var userName = req.body.userName;
        var text = req.body.text;

        if (!userName || !text) {
            return res.status(400).json({ error: 'userName e text são obrigatórios' });
        }

        var newMessage = await db.addChatMessage(userName.trim(), text.trim());

        // Limpar mensagens antigas (manter apenas últimas 100)
        await db.clearOldChatMessages(100);

        var allMessages = await db.getAllChatMessages();
        var totalMessages = allMessages.length;

        console.log('💬 Mensagem adicionada: ' + userName);
        res.json({
            success: true,
            message: newMessage,
            totalMessages: totalMessages
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar mensagem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ GET /api/chat - Obter histórico de chat
app.get('/api/chat', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var chat = await db.getAllChatMessages();
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ GET /api/admin/stats - Estatísticas
app.get('/api/admin/stats', async (req, res) => {
    try {
        if (!isDBReady) {
            return res.status(503).json({ error: 'Database não disponível' });
        }

        var stats = await db.getStats();
        var topContributors = await db.getTopContributors(5);
        var monthlyStats = await db.getMonthlyStats();

        res.json({
            success: true,
            stats: stats,
            topContributors: topContributors,
            monthlyStats: monthlyStats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== INICIAR SERVIDOR ==========
var server = require('http').createServer(app);

server.listen(PORT, function() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              🍹 Bebida em Dia - Backend v5.0                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ HTTP Server rodando em http://localhost:' + PORT);
    console.log('🗄️  MySQL Database: ' + (isDBReady ? '✓ Conectado' : '✗ Não disponível'));
    console.log('💾 Armazenamento: MySQL');
    console.log('🚀 Pronto para produção em Render!');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', async function() {
    console.log('\n🛑 SIGTERM recebido - Encerrando gracefully...');
    if (isDBReady && db) {
        await db.close();
    }
    server.close(function() {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', async function() {
    console.log('\n🛑 SIGINT recebido - Encerrando gracefully...');
    if (isDBReady && db) {
        await db.close();
    }
    server.close(function() {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});
