// =============================================
// 🔥 BEBIDA EM DIA - Backend Firebase v6.0
// Realtime Database + Firestore Sync
// =============================================

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// ========== FIREBASE INITIALIZATION ==========

let firebaseConnected = false;
let realtimeDb;
let firestoreDb;
let dataRef;

async function initFirebase() {
  try {
    // ✅ Ler credenciais
    let serviceAccount;

    if (process.env.SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      console.log('📱 Firebase: Credenciais da variável de ambiente');
    } else if (fs.existsSync('./serviceAccountKey.json')) {
      serviceAccount = require(path.resolve('./serviceAccountKey.json'));
      console.log('📱 Firebase: Arquivo local serviceAccountKey.json');
    } else {
      throw new Error('Credenciais Firebase não encontradas');
    }

    // ✅ Inicializar Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://bebidaemdia-default-rtdb.firebaseio.com',
        projectId: 'bebidaemdia'
      });
    }

    // ✅ Conectar aos dois bancos
    realtimeDb = admin.database();
    firestoreDb = admin.firestore();
    dataRef = realtimeDb.ref('data');

    firebaseConnected = true;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║ 🍹 Bebida em Dia - Backend v6.0 Firebase                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    console.log('✅ Firebase Realtime Database conectado');
    console.log('✅ Firebase Firestore conectado');
    console.log('📍 Projeto: bebidaemdia');
    console.log('🚀 Sincronização automática ativada\n');

  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error.message);
    console.error('⚠️ Verifique serviceAccountKey.json ou variável SERVICE_ACCOUNT_KEY\n');
    firebaseConnected = false;
  }
}

// ========== HELPER FUNCTIONS ==========

async function getAllPeople() {
  try {
    const snapshot = await dataRef.child('people').once('value');
    return snapshot.val() || [];
  } catch (error) {
    console.error('❌ Erro ao ler people:', error.message);
    return [];
  }
}

async function getAllPaidDates() {
  try {
    const snapshot = await dataRef.child('paidDates').once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('❌ Erro ao ler paidDates:', error.message);
    return {};
  }
}

async function getFullData() {
  try {
    const snapshot = await dataRef.once('value');
    return snapshot.val() || { 
      people: [], 
      paidDates: {}, 
      chat: [], 
      settings: {} 
    };
  } catch (error) {
    console.error('❌ Erro ao ler dados:', error.message);
    return { people: [], paidDates: {}, chat: [], settings: {} };
  }
}

// ✅ SALVAR EM REALTIME + FIRESTORE (SINCRONIZADO)
async function saveToFirebase(data) {
  try {
    // 1️⃣ Salvar no Realtime Database (TEMPO REAL)
    await dataRef.set(data);

    // 2️⃣ Salvar no Firestore (BACKUP)
    await firestoreDb.collection('bebida-em-dia').doc('current-data').set({
      ...data,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedDate: new Date().toISOString()
    });

    console.log(`✅ Sincronizado em Realtime + Firestore - ${new Date().toLocaleTimeString('pt-BR')}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao sincronizar Firebase:', error.message);
    return false;
  }
}

// ========== ROTAS PÚBLICAS ==========

// ✅ GET /api/data - Carregar todos os dados
app.get('/api/data', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const people = await getAllPeople();
    const paidDates = await getAllPaidDates();

    res.json({
      success: true,
      people,
      paidDates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro em GET /api/data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/next-person - Próxima pessoa a pagar
app.get('/api/next-person', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const people = await getAllPeople();

    if (people.length === 0) {
      return res.json({ nextPerson: null });
    }

    const paidDates = await getAllPaidDates();
    const counts = {};

    people.forEach(p => counts[p] = 0);
    Object.values(paidDates).forEach(p => {
      if (counts[p] !== undefined) counts[p]++;
    });

    const nextPerson = people.reduce((prev, curr) =>
      counts[curr] < counts[prev] ? curr : prev
    );

    console.log('📊 Próxima pessoa:', nextPerson);
    res.json({ 
      nextPerson, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('❌ Erro em GET /api/next-person:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/health - Status do servidor
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: firebaseConnected ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: '6.0',
      database: 'Firebase (Realtime + Firestore)',
      connected: firebaseConnected,
      message: firebaseConnected ? 'Sistema operacional' : 'Falha na conexão Firebase'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROTAS ADMIN ==========

// ✅ POST /api/admin/login - Autenticação
app.post('/api/admin/login', (req, res) => {
  try {
    const password = req.body.password;
    const adminPassword = process.env.ADMIN_PASSWORD || 'coca';

    if (password === adminPassword) {
      const token = 'admin_token_' + Date.now();
      console.log('✅ Login realizado com sucesso');
      
      res.json({
        success: true,
        token: token,
        message: 'Login OK'
      });
    } else {
      console.log('❌ Tentativa de login com senha incorreta');
      res.status(401).json({ 
        success: false,
        error: 'Senha incorreta' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/admin/data - Carregar dados administrativos
app.get('/api/admin/data', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const people = await getAllPeople();
    const paidDates = await getAllPaidDates();

    res.json({
      success: true,
      people,
      paidDates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro em GET /api/admin/data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/admin/people - Adicionar pessoa
app.post('/api/admin/people', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const name = req.body.name?.trim();

    if (!name || name.length === 0) {
      return res.status(400).json({ error: 'Nome inválido' });
    }

    const people = await getAllPeople();

    if (people.includes(name)) {
      return res.status(400).json({ error: 'Pessoa já existe' });
    }

    // ✅ Adicionar e salvar
    people.push(name);
    const data = await getFullData();
    data.people = people;

    await saveToFirebase(data);

    console.log('✅ Pessoa adicionada:', name);
    res.json({
      success: true,
      people,
      message: 'Pessoa adicionada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro em POST /api/admin/people:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ DELETE /api/admin/people - Remover pessoa
app.delete('/api/admin/people', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const name = req.body.name?.trim();

    if (!name || name.length === 0) {
      return res.status(400).json({ error: 'Nome inválido' });
    }

    let people = await getAllPeople();
    const paidDates = await getAllPaidDates();

    if (!people.includes(name)) {
      return res.status(404).json({ error: 'Pessoa não encontrada' });
    }

    // Remover pessoa
    people = people.filter(p => p !== name);

    // Remover pagamentos associados
    const newPaidDates = {};
    Object.entries(paidDates).forEach(([date, person]) => {
      if (person !== name) {
        newPaidDates[date] = person;
      }
    });

    const data = await getFullData();
    data.people = people;
    data.paidDates = newPaidDates;

    await saveToFirebase(data);

    console.log('✅ Pessoa removida:', name);
    res.json({
      success: true,
      people,
      paidDates: newPaidDates,
      message: 'Pessoa removida com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro em DELETE /api/admin/people:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PATCH /api/admin/paid - Salvar pagamento (MAIS IMPORTANTE!)
app.patch('/api/admin/paid', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { date, name } = req.body;

    // ✅ VALIDAÇÃO 1: Data
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Data inválida' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Formato de data inválido (YYYY-MM-DD)' });
    }

    const paidDates = await getAllPaidDates();

    // Se name é null/undefined = remover pagamento
    if (name === null || name === undefined || name === '') {
      delete paidDates[date];
      console.log('🗑️ Pagamento removido:', date);
    } else {
      // ✅ VALIDAÇÃO 2: Pessoa existe?
      const cleanName = name.trim();
      const people = await getAllPeople();

      if (!people.includes(cleanName)) {
        return res.status(400).json({
          error: `Pessoa '${cleanName}' não existe no banco`,
          availablePeople: people
        });
      }

      // ✅ SALVAR PAGAMENTO
      paidDates[date] = cleanName;
      console.log('✅ PAGAMENTO SALVO:', date, '→', cleanName);
    }

    // ✅ Salvar no Firebase
    const data = await getFullData();
    data.paidDates = paidDates;
    await saveToFirebase(data);

    res.json({
      success: true,
      paidDates,
      message: '✅ Pagamento salvo com sucesso',
      timestamp: new Date().toISOString(),
      savedDate: date,
      savedPerson: name || null
    });
  } catch (error) {
    console.error('❌ ERRO ao salvar pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ POST /api/chat - Adicionar mensagem
app.post('/api/chat', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { userName, text } = req.body;

    if (!userName || !text) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const data = await getFullData();
    const chat = data.chat || [];

    chat.push({
      id: Date.now().toString(),
      userName: userName.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString()
    });

    data.chat = chat;
    await saveToFirebase(data);

    console.log('💬 Mensagem adicionada:', userName);
    res.json({ 
      success: true, 
      message: 'Mensagem enviada' 
    });
  } catch (error) {
    console.error('❌ Erro em POST /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/chat - Obter mensagens
app.get('/api/chat', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const data = await getFullData();
    const chat = data.chat || [];

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/admin/stats - Estatísticas
app.get('/api/admin/stats', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const people = await getAllPeople();
    const paidDates = await getAllPaidDates();
    const data = await getFullData();

    // Contar contribuições
    const counts = {};
    people.forEach(p => counts[p] = 0);
    Object.values(paidDates).forEach(p => {
      if (counts[p] !== undefined) counts[p]++;
    });

    // Top contribuidores
    const topContributors = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      stats: {
        totalPeople: people.length,
        totalPayments: Object.keys(paidDates).length,
        totalMessages: (data.chat || []).length
      },
      topContributors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ========== INICIAR SERVIDOR ==========

async function start() {
  await initFirebase();

  const server = require('http').createServer(app);
  
  server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
    console.log(`🌍 API disponível em http://localhost:${PORT}`);
    console.log(`📡 Status: ${firebaseConnected ? '✅ Conectado ao Firebase' : '❌ Desconectado'}\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM recebido - Encerrando...');
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT recebido - Encerrando...');
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });
}

start();

module.exports = app;
