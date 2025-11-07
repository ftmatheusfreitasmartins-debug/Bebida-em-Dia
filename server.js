// 🔧 CORREÇÃO CORS - Copie esta seção para seu server.js

const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ✅ CORS CONFIGURATION (ADICIONE ISTO)
app.use(cors({
    origin: '*', // Permite todas as origens
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// ✅ RESTO DO SEU CÓDIGO...
// (Mantenha todos os endpoints que você tem)

const DATA_FILE = './data.json';

// GET /api/data
app.get('/api/data', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data);
    } catch (error) {
        console.error('Erro ao ler data.json:', error);
        res.status(500).json({ error: 'Erro ao obter dados' });
    }
});

// PATCH /api/paid/toggle-today
app.patch('/api/paid/toggle-today', (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const today = new Date().toISOString().slice(0, 10);
        
        if (data.paidDates[today] === name) {
            delete data.paidDates[today];
        } else {
            data.paidDates[today] = name;
        }
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Pagamento atualizado',
            paidDates: data.paidDates
        });
    } catch (error) {
        console.error('Erro ao alternar pagamento:', error);
        res.status(500).json({ error: 'Erro ao atualizar pagamento' });
    }
});

// GET /api/next-person
app.get('/api/next-person', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const people = data.people || [];
        
        if (people.length === 0) {
            return res.json({ nextPerson: null });
        }
        
        const paidDates = data.paidDates || {};
        const counts = {};
        
        people.forEach(person => {
            counts[person] = Object.values(paidDates)
                .filter(p => p === person).length;
        });
        
        const nextPerson = people.reduce((prev, curr) =>
            counts[curr] < counts[prev] ? curr : prev
        );
        
        res.json({ nextPerson });
    } catch (error) {
        console.error('Erro ao obter próxima pessoa:', error);
        res.status(500).json({ error: 'Erro ao obter próxima pessoa' });
    }
});

// POST /api/chat
app.post('/api/chat', (req, res) => {
    try {
        const { userName, text } = req.body;
        
        if (!userName || !text) {
            return res.status(400).json({ error: 'Nome e texto são obrigatórios' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const chat = data.chat || [];
        
        const newMessage = {
            id: Date.now().toString(),
            userName,
            text,
            timestamp: new Date().toISOString()
        };
        
        chat.push(newMessage);
        data.chat = chat;
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, message: newMessage });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Senha é obrigatória' });
        }
        
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (password !== adminPassword) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        
        res.json({
            success: true,
            message: 'Login realizado'
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro no login' });
    }
});

// GET /api/admin/data
app.get('/api/admin/data', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao obter dados' });
    }
});


// POST /api/admin/people
app.post('/api/admin/people', (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const people = data.people || [];
        
        if (people.includes(name)) {
            return res.status(400).json({ error: 'Pessoa já existe' });
        }
        
        people.push(name);
        data.people = people;
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, people });
    } catch (error) {
        console.error('Erro ao adicionar pessoa:', error);
        res.status(500).json({ error: 'Erro ao adicionar pessoa' });
    }
});

// DELETE /api/admin/people
app.delete('/api/admin/people', (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const people = data.people || [];
        const paidDates = data.paidDates || {};
        
        const newPeople = people.filter(p => p !== name);
        
        const newPaidDates = {};
        Object.keys(paidDates).forEach(date => {
            if (paidDates[date] !== name) {
                newPaidDates[date] = paidDates[date];
            }
        });
        
        data.people = newPeople;
        data.paidDates = newPaidDates;
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, people: newPeople });
    } catch (error) {
        console.error('Erro ao remover pessoa:', error);
        res.status(500).json({ error: 'Erro ao remover pessoa' });
    }
});

// PATCH /api/admin/paid
app.patch('/api/admin/paid', (req, res) => {
    try {
        const { date, name } = req.body;
        
        if (!date) {
            return res.status(400).json({ error: 'Data é obrigatória' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const paidDates = data.paidDates || {};
        
        if (name) {
            paidDates[date] = name;
        } else {
            delete paidDates[date];
        }
        
        data.paidDates = paidDates;
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, paidDates });
    } catch (error) {
        console.error('Erro ao atualizar pagamento:', error);
        res.status(500).json({ error: 'Erro ao atualizar pagamento' });
    }
});

// DELETE /api/admin/reset
app.delete('/api/admin/reset', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        data.paidDates = {};
        data.chat = [];
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Histórico resetado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao resetar:', error);
        res.status(500).json({ error: 'Erro ao resetar histórico' });
    }
});

// PATCH /api/admin/settings
app.patch('/api/admin/settings', (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings) {
            return res.status(400).json({ error: 'Configurações são obrigatórias' });
        }
        
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        data.settings = settings;
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Painel admin disponível em http://localhost:${PORT}/admin`);
    console.log(`🔒 Senha do admin: ${process.env.ADMIN_PASSWORD}`);
});
