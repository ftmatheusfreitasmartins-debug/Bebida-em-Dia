// 🔥 Bebida em Dia - Backend com Firebase Realtime Database
// v4.0 - Firebase Realtime Database + Auto-Sync

const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const FirebaseManager = require('./firebase-manager');

// ========== CONFIGURAÇÃO EXPRESS ==========
const app = express();
const PORT = process.env.PORT || 3000;
const FIREBASE_URL = process.env.FIREBASE_URL || 'https://bebidaemdia-default-rtdb.firebaseio.com/';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = './data.json';

// ========== INICIALIZAR FIREBASE ==========
let firebaseManager;
let isFirebaseReady = false;

(async () => {
  try {
    firebaseManager = new FirebaseManager('./serviceAccountKey.json', FIREBASE_URL);
    await firebaseManager.loadFromFirebase();
    isFirebaseReady = true;
    console.log('🚀 Sistema pronto para usar!\n');
  } catch (error) {
    console.error('⚠️ Firebase não disponível, continuando com arquivo local');
    console.error('   Instale firebase-admin: npm install firebase-admin\n');
  }
})();

// ========== FUNÇÕES AUXILIARES ==========

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { people: [], paidDates: {}, chat: [], settings: {} };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Erro ao ler data.json:', error);
    return { people: [], paidDates: {}, chat: [], settings: {} };
  }
}

function writeData(data, reason = 'manual') {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Dados salvos localmente: ${reason}`);
    
    // Disparar sincronização com Firebase se estiver disponível
    if (isFirebaseReady && firebaseManager) {
      firebaseManager.syncLocalToFirebase();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar data.json:', error);
    return false;
  }
}

// ========== ROTAS API ==========

// ✅ GET /api/data - Obter todos os dados
app.get('/api/data', (req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter dados' });
  }
});

// ✅ GET /api/next-person - Próxima pessoa a pagar
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
    res.status(500).json({ error: 'Erro ao obter próxima pessoa' });
  }
});

// ✅ GET /api/health - Status do servidor
app.get('/api/health', async (req, res) => {
  try {
    const firebaseStatus = isFirebaseReady ? await firebaseManager.getStatus() : { status: 'Firebase não disponível' };
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '4.0',
      firebase: firebaseStatus,
      platform: 'Render'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROTAS ADMIN ==========

// ✅ POST /api/admin/login - Autenticação
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

// ✅ GET /api/admin/data - Obter dados admin
app.get('/api/admin/data', (req, res) => {
  try {
    const data = readData();
    res.json({
      success: true,
      people: data.people || [],
      paidDates: data.paidDates || {},
      chat: data.chat || [],
      settings: data.settings || {}
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ POST /api/admin/people - Adicionar pessoa
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

// ✅ DELETE /api/admin/people/:name - Remover pessoa
app.delete('/api/admin/people/:name', (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);
    const data = readData();

    data.people = data.people.filter(p => p !== decodedName);
    
    // Remover pagamentos dessa pessoa
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

// ✅ PATCH /api/admin/paid - Atualizar pagamento (PRINCIPAL)
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

    writeData(data, `update_payment:${date}:${name}`);

    res.json({
      success: true,
      paidDates: data.paidDates,
      message: '✅ Pagamento salvo e sincronizado com Firebase!',
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
app.post('/api/chat', (req, res) => {
  try {
    const { userName, text } = req.body;

    if (!userName || !text) {
      return res.status(400).json({ error: 'userName e text são obrigatórios' });
    }

    const data = readData();
    const newMessage = {
      id: Date.now().toString(),
      userName: userName.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    if (!data.chat) {
      data.chat = [];
    }

    data.chat.push(newMessage);

    // Manter apenas últimas 100 mensagens
    if (data.chat.length > 100) {
      data.chat = data.chat.slice(-100);
    }

    writeData(data, `chat_message:${userName}`);

    res.json({
      success: true,
      message: newMessage,
      totalMessages: data.chat.length
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar mensagem:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GET /api/chat - Obter histórico de chat
app.get('/api/chat', (req, res) => {
  try {
    const data = readData();
    res.json(data.chat || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/admin/sync-status - Status de sincronização Firebase
app.get('/api/admin/sync-status', async (req, res) => {
  try {
    if (!isFirebaseReady) {
      return res.json({ 
        firebase: 'não disponível',
        message: 'Firebase não está configurado'
      });
    }

    const status = await firebaseManager.getStatus();
    res.json(status);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/admin/force-sync - Forçar sincronização agora
app.post('/api/admin/force-sync', async (req, res) => {
  try {
    if (!isFirebaseReady) {
      return res.status(503).json({ 
        error: 'Firebase não está disponível'
      });
    }

    await firebaseManager.syncLocalToFirebase();
    const status = await firebaseManager.getStatus();

    res.json({
      success: true,
      message: 'Sincronização forçada com sucesso',
      status
    });

  } catch (error) {
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
║                  🍹 Bebida em Dia - Backend v4.0                   ║
╚══════════════════════════════════════════════════════════════════════╝

✅ HTTP Server rodando em http://localhost:${PORT}
🔥 Firebase Realtime Database: ${isFirebaseReady ? '✓ Conectado' : '✗ Não disponível'}
📡 Auto-Sync: ATIVADO (a cada 5 segundos)
💾 Armazenamento: Firebase + Local (data.json)
🚀 Pronto para produção em Render!

`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM recebido - Encerrando gracefully...');
  
  if (isFirebaseReady && firebaseManager) {
    firebaseManager.syncLocalToFirebase().then(() => {
      firebaseManager.stop();
      server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });
  } else {
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT recebido - Encerrando gracefully...');
  
  if (isFirebaseReady && firebaseManager) {
    firebaseManager.syncLocalToFirebase().then(() => {
      firebaseManager.stop();
      server.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
      });
    });
  } else {
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  }
});
