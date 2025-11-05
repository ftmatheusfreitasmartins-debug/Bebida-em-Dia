require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Módulo de Persistência de Dados ---
class DataManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.defaultData = {
      people: ['Matheus', 'Ana Beatriz', 'Maria Carolina', 'Lais Dias'],
      paidDates: {},
      chat: [],
      settings: {
        rotationMode: 'sequential', // 'sequential' ou 'random'
        currentIndex: 0
      }
    };
  }

  readData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        // Garantir que settings existe
        if (!data.settings) {
          data.settings = this.defaultData.settings;
          this.saveData(data);
        }
        return data;
      }
    } catch (error) {
      console.error('Erro ao ler data.json:', error);
    }
    
    const data = { ...this.defaultData };
    this.saveData(data);
    return data;
  }

  saveData(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Erro ao escrever data.json:', error);
      return false;
    }
  }

  backup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(__dirname, `data_backup_${timestamp}.json`);
      fs.copyFileSync(this.filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      return null;
    }
  }
}

const dataManager = new DataManager(DATA_FILE);

// --- Middleware de Autenticação ---
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de acesso necessário.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token inválido.' });
  }
};

// --- Utilitários ---
const getNextPersonInRotation = (people, settings, paidDates) => {
  if (people.length === 0) return null;

  if (settings.rotationMode === 'random') {
    return people[Math.floor(Math.random() * people.length)];
  }

  // Modo sequencial
  const currentIndex = settings.currentIndex || 0;
  return people[currentIndex % people.length];
};

const updateRotationIndex = (data) => {
  if (data.settings.rotationMode === 'sequential') {
    data.settings.currentIndex = (data.settings.currentIndex + 1) % data.people.length;
  }
};

// --- Rotas Públicas ---
app.get('/api/data', (req, res) => {
  try {
    const data = dataManager.readData();
    // Não enviar configurações sensíveis para o frontend
    const publicData = {
      people: data.people,
      paidDates: data.paidDates,
      chat: data.chat
    };
    res.json(publicData);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.patch('/api/paid/toggle-today', (req, res) => {
  try {
    const { name } = req.body;
    const data = dataManager.readData();
    const today = new Date().toISOString().slice(0, 10);

    if (!name || !data.people.includes(name)) {
      return res.status(400).json({ success: false, error: 'Nome inválido.' });
    }

    if (data.paidDates[today]) {
      // Se já há pagamento hoje, remove
      delete data.paidDates[today];
    } else {
      // Registra o pagamento
      data.paidDates[today] = name;
      updateRotationIndex(data);
    }

    if (dataManager.saveData(data)) {
      res.json({ success: true, paidDates: data.paidDates });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar dados.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.get('/api/next-person', (req, res) => {
  try {
    const data = dataManager.readData();
    const nextPerson = getNextPersonInRotation(data.people, data.settings, data.paidDates);
    res.json({ success: true, nextPerson });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.post('/api/chat', (req, res) => {
  try {
    const { userName, text } = req.body;
    
    if (!userName || !text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Nome de usuário e texto são obrigatórios.' });
    }

    if (text.length > 500) {
      return res.status(400).json({ success: false, error: 'Mensagem muito longa.' });
    }

    const data = dataManager.readData();
    const newChatMsg = {
      id: Date.now().toString(),
      userName: userName.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    data.chat.push(newChatMsg);
    
    // Manter apenas as últimas 100 mensagens
    if (data.chat.length > 100) {
      data.chat = data.chat.slice(-100);
    }

    if (dataManager.saveData(data)) {
      res.status(201).json({ success: true, chat: data.chat });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar mensagem.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// --- Rotas de Administração ---
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ success: false, error: 'Senha é obrigatória.' });
    }

    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { role: 'admin', timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, error: 'Senha incorreta.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.get('/api/admin/data', authenticateAdmin, (req, res) => {
  try {
    const data = dataManager.readData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.post('/api/admin/people', authenticateAdmin, (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'O nome é obrigatório.' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ success: false, error: 'Nome muito longo.' });
    }

    const data = dataManager.readData();
    
    if (data.people.includes(trimmedName)) {
      return res.status(400).json({ success: false, error: 'Pessoa já existe.' });
    }

    data.people.push(trimmedName);
    
    if (dataManager.saveData(data)) {
      res.status(201).json({ success: true, people: data.people });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar dados.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.delete('/api/admin/people', authenticateAdmin, (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'O nome é obrigatório.' });
    }

    const data = dataManager.readData();
    const initialLength = data.people.length;
    
    data.people = data.people.filter(p => p !== name);
    
    if (data.people.length === initialLength) {
      return res.status(404).json({ success: false, error: 'Pessoa não encontrada.' });
    }

    // Remove todos os pagamentos da pessoa removida
    const newPaidDates = {};
    for (const date in data.paidDates) {
      if (data.paidDates[date] !== name) {
        newPaidDates[date] = data.paidDates[date];
      }
    }
    data.paidDates = newPaidDates;

    // Ajusta o índice de rotação se necessário
    if (data.settings.currentIndex >= data.people.length) {
      data.settings.currentIndex = 0;
    }

    if (dataManager.saveData(data)) {
      res.json({ success: true, people: data.people, paidDates: data.paidDates });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar dados.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.patch('/api/admin/paid', authenticateAdmin, (req, res) => {
  try {
    const { date, name } = req.body;
    
    if (!date) {
      return res.status(400).json({ success: false, error: 'Data é obrigatória.' });
    }

    // Validar formato da data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Formato de data inválido.' });
    }

    const data = dataManager.readData();
    
    if (name) {
      if (!data.people.includes(name)) {
        return res.status(400).json({ success: false, error: 'Pessoa não encontrada.' });
      }
      data.paidDates[date] = name;
    } else {
      delete data.paidDates[date];
    }

    if (dataManager.saveData(data)) {
      res.json({ success: true, paidDates: data.paidDates });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar dados.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.delete('/api/admin/reset', authenticateAdmin, (req, res) => {
  try {
    const data = dataManager.readData();
    
    // Criar backup antes de resetar
    const backupPath = dataManager.backup();
    
    data.paidDates = {};
    data.settings.currentIndex = 0;
    
    if (dataManager.saveData(data)) {
      res.json({ 
        success: true, 
        message: 'Histórico de pagamentos resetado.',
        backup: backupPath ? path.basename(backupPath) : null
      });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar dados.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

app.patch('/api/admin/settings', authenticateAdmin, (req, res) => {
  try {
    const { rotationMode } = req.body;
    
    if (!['sequential', 'random'].includes(rotationMode)) {
      return res.status(400).json({ success: false, error: 'Modo de rotação inválido.' });
    }

    const data = dataManager.readData();
    data.settings.rotationMode = rotationMode;
    
    if (rotationMode === 'sequential' && !data.settings.currentIndex) {
      data.settings.currentIndex = 0;
    }

    if (dataManager.saveData(data)) {
      res.json({ success: true, settings: data.settings });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao salvar configurações.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
});

// --- Rota para servir páginas HTML ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Middleware de tratamento de erros ---
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

// --- Rota 404 ---
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

// --- Inicialização do servidor ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Painel admin disponível em http://localhost:${PORT}/admin`);
  console.log(`🔒 Senha do admin: ${ADMIN_PASSWORD}`);
});

// --- Tratamento de sinais do sistema ---
process.on('SIGINT', () => {
  console.log('\n🛑 Servidor sendo encerrado...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Exceção não capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason);
  process.exit(1);
});

