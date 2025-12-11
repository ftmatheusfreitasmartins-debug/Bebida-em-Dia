// =============================================
// 🔥 BEBIDA EM DIA - Backend Firebase v6.1
// Realtime Database + Firestore Sincronizado
// =============================================

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ========== CONFIGURAÇÃO ==========
const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis globais
let firebaseConnected = false;
let realtimeDb;
let firestoreDb;
let dataRef;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// ========== FIREBASE INITIALIZATION ==========
async function initFirebase() {
  try {
    let serviceAccount;

    // 1️⃣ Tentar variável de ambiente
    if (process.env.FIREBASE_CONFIG) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
        console.log('📱 Firebase: Credenciais da variável de ambiente');
      } catch (parseError) {
        console.error('❌ Erro ao parsear FIREBASE_CONFIG:', parseError.message);
        throw new Error('FIREBASE_CONFIG inválido');
      }
    }
    // 2️⃣ Tentar arquivo local
    else if (fs.existsSync('./serviceAccountKey.json')) {
      serviceAccount = require(path.resolve('./serviceAccountKey.json'));
      console.log('📱 Firebase: Arquivo local serviceAccountKey.json');
    }
    // 3️⃣ Falhar se não encontrar
    else {
      throw new Error('❌ Credenciais Firebase não encontradas. Configure FIREBASE_CONFIG ou adicione serviceAccountKey.json');
    }

    // ✅ Inicializar Firebase Admin SDK
    if (!admin.apps.length) {
      const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://bebidaemdia-default-rtdb.firebaseio.com';
      const projectId = process.env.FIREBASE_PROJECT_ID || 'bebidaemdia';

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL,
        projectId: projectId
      });

      console.log('✅ Firebase Admin SDK inicializado');
    }

    // ✅ Conectar aos dois bancos
    realtimeDb = admin.database();
    firestoreDb = admin.firestore();
    dataRef = realtimeDb.ref('data');

    firebaseConnected = true;

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║        🍹 Bebida em Dia - Backend v6.1 Firebase              ║');
    console.log('║         Realtime Database + Firestore Sincronizado           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Firebase Realtime Database conectado');
    console.log('✅ Firebase Firestore Database conectado');
    console.log('📍 Projeto: bebidaemdia');
    console.log('🔄 Sincronização automática em ambos os bancos\n');

  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error.message);
    firebaseConnected = false;
    process.exit(1);
  }
}

// ========== VALIDAÇÃO DE DADOS ==========

/**
 * Validar estrutura de dados
 * @param {Object} data - Dados a validar
 * @returns {Object} Dados validados
 */
function validateDataStructure(data) {
  if (!data) data = {};
  
  return {
    people: Array.isArray(data.people) ? data.people : [],
    paidDates: (data.paidDates && typeof data.paidDates === 'object' && !Array.isArray(data.paidDates)) 
      ? data.paidDates 
      : {},
    chat: Array.isArray(data.chat) ? data.chat : [],
    settings: (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) 
      ? data.settings 
      : {}
  };
}

/**
 * Validar nome de pessoa
 * @param {string} name - Nome a validar
 * @returns {Object} {valid: boolean, errors: Array, value: string}
 */
function validatePersonName(name) {
  const errors = [];

  if (!name || typeof name !== 'string') {
    errors.push('Nome deve ser uma string');
    return { valid: false, errors };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    errors.push('Nome não pode estar vazio');
  }

  if (trimmed.length > 50) {
    errors.push('Nome não pode ter mais de 50 caracteres');
  }

  if (!/^[a-záéíóúãõâêôç\s'-]+$/i.test(trimmed)) {
    errors.push('Nome contém caracteres inválidos');
  }

  return {
    valid: errors.length === 0,
    errors,
    value: trimmed
  };
}

/**
 * Validar formato de data YYYY-MM-DD
 * @param {string} dateString - Data a validar
 * @returns {boolean}
 */
function isValidDateFormat(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

// ========== HELPER FUNCTIONS ==========

/**
 * Obter todas as pessoas
 * @returns {Promise<Array>}
 */
async function getAllPeople() {
  try {
    const snapshot = await dataRef.child('people').once('value');
    const data = snapshot.val();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Erro ao ler people:', error.message);
    return [];
  }
}

/**
 * Obter todos os pagamentos
 * @returns {Promise<Object>}
 */
async function getAllPaidDates() {
  try {
    const snapshot = await dataRef.child('paidDates').once('value');
    const data = snapshot.val();
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch (error) {
    console.error('❌ Erro ao ler paidDates:', error.message);
    return {};
  }
}

/**
 * Obter todos os dados
 * @returns {Promise<Object>}
 */
async function getFullData() {
  try {
    const snapshot = await dataRef.once('value');
    const rawData = snapshot.val();
    return validateDataStructure(rawData);
  } catch (error) {
    console.error('❌ Erro ao ler dados:', error.message);
    return validateDataStructure({});
  }
}

/**
 * Salvar dados em REALTIME DATABASE + FIRESTORE (SINCRONIZADO)
 * Esta é a função mais crítica - salva em ambos simultaneamente
 * @param {Object} data - Dados a salvar
 * @param {number} retries - Número de tentativas
 * @returns {Promise<boolean>}
 */
async function saveToFirebase(data, retries = 3) {
  // 1️⃣ VALIDAR DADOS
  const validatedData = validateDataStructure(data);

  // 2️⃣ TENTAR SALVAR COM RETRY
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const isoTimestamp = new Date().toISOString();

      console.log(`\n📤 Sincronização ${attempt}/${retries}...`);

      // ✅ SALVAR NO REALTIME DATABASE (PRIORIDADE 1)
      // Este é o banco primário - tem que funcionar sempre
      await dataRef.set(validatedData);
      console.log('  ✅ Realtime Database atualizado');

      // ✅ SALVAR NO FIRESTORE (PRIORIDADE 2 - BACKUP)
      // Firestore é o backup com histórico
      await firestoreDb
        .collection('bebida-em-dia')
        .doc('current-data')
        .set({
          ...validatedData,
          lastSyncTime: timestamp,
          lastSyncDate: isoTimestamp,
          syncAttempt: attempt,
          syncStatus: 'success'
        }, { merge: true });
      
      console.log('  ✅ Firestore atualizado');

      // ✅ SALVAR BACKUP AUTOMÁTICO NO FIRESTORE
      // Mantém histórico de todas as alterações
      await firestoreDb
        .collection('bebida-em-dia')
        .collection('backups')
        .add({
          ...validatedData,
          backedUpAt: timestamp,
          backedUpDate: isoTimestamp,
          dataSize: JSON.stringify(validatedData).length
        });

      console.log('  ✅ Backup automático criado');

      const now = new Date().toLocaleTimeString('pt-BR');
      console.log(`✅ SINCRONIZADO COM SUCESSO às ${now}\n`);

      return true;

    } catch (error) {
      console.error(`  ❌ Tentativa ${attempt}/${retries} falhou:`, error.message);

      if (attempt < retries) {
        // Backoff exponencial: 2^attempt segundos
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`  ⏳ Aguardando ${delayMs}ms antes de retry...\n`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error(`\n❌ FALHA FINAL AO SINCRONIZAR FIREBASE APÓS ${retries} TENTATIVAS\n`);
        return false;
      }
    }
  }
}

/**
 * Carregar dados da Firestore (se Realtime cair)
 * @returns {Promise<Object>}
 */
async function loadFromFirestore() {
  try {
    console.log('📥 Tentando carregar do Firestore...');
    const doc = await firestoreDb
      .collection('bebida-em-dia')
      .doc('current-data')
      .get();

    if (doc.exists) {
      const data = doc.data();
      // Remover campos de timestamp
      delete data.lastSyncTime;
      delete data.lastSyncDate;
      delete data.syncAttempt;
      
      console.log('✅ Dados recuperados do Firestore\n');
      return validateDataStructure(data);
    } else {
      console.log('ℹ️ Firestore vazio, tentando Realtime...\n');
      return await loadFromRealtime();
    }
  } catch (error) {
    console.error('❌ Erro ao carregar do Firestore:', error.message);
    return await loadFromRealtime();
  }
}

/**
 * Carregar dados do Realtime Database
 * @returns {Promise<Object>}
 */
async function loadFromRealtime() {
  try {
    console.log('📥 Tentando carregar do Realtime Database...');
    const snapshot = await dataRef.once('value');
    const data = snapshot.val();

    if (data) {
      console.log('✅ Dados recuperados do Realtime\n');
      return validateDataStructure(data);
    } else {
      console.log('ℹ️ Realtime vazio\n');
      return validateDataStructure({});
    }
  } catch (error) {
    console.error('❌ Erro ao carregar do Realtime:', error.message);
    return validateDataStructure({});
  }
}

// ========== ROTAS PÚBLICAS ==========

/**
 * GET /api/data
 * Carregar todos os dados do sistema
 */
app.get('/api/data', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({
        error: 'Database não disponível',
        status: 'disconnected'
      });
    }

    const data = await getFullData();

    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
      source: 'Realtime Database'
    });

  } catch (error) {
    console.error('❌ Erro em GET /api/data:', error);
    res.status(500).json({
      error: error.message,
      endpoint: '/api/data'
    });
  }
});

/**
 * GET /api/next-person
 * Retornar próxima pessoa que deve pagar
 */
app.get('/api/next-person', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const people = await getAllPeople();
    const paidDates = await getAllPaidDates();

    if (people.length === 0) {
      return res.json({
        nextPerson: null,
        message: 'Nenhuma pessoa configurada',
        timestamp: new Date().toISOString()
      });
    }

    // Contar quantas vezes cada pessoa pagou
    const counts = {};
    people.forEach(p => counts[p] = 0);
    Object.values(paidDates).forEach(p => {
      if (counts[p] !== undefined) counts[p]++;
    });

    // Encontrar quem pagou menos
    const nextPerson = people.reduce((prev, curr) =>
      counts[curr] < counts[prev] ? curr : prev
    );

    console.log('📊 Próxima pessoa:', nextPerson, '- Pagamentos:', counts[nextPerson]);

    res.json({
      success: true,
      nextPerson,
      counts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em GET /api/next-person:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * Status do servidor e conexão Firebase
 */
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: firebaseConnected ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '6.1',
      database: {
        realtime: 'enabled',
        firestore: 'enabled',
        syncStatus: firebaseConnected ? 'synchronized' : 'disconnected'
      },
      uptime: process.uptime(),
      message: firebaseConnected 
        ? '✅ Sistema operacional - Sincronização ativa'
        : '⚠️ Problema na conexão Firebase'
    };

    res.json(health);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat
 * Obter todas as mensagens
 */
app.get('/api/chat', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const data = await getFullData();
    const chat = data.chat || [];

    res.json({
      success: true,
      messages: chat,
      count: chat.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ROTAS ADMIN ==========

/**
 * POST /api/admin/login
 * Autenticação do administrador
 */
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'coca';

    if (!password) {
      return res.status(400).json({ error: 'Senha não fornecida' });
    }

    if (password === adminPassword) {
      const token = 'admin_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      console.log('✅ Login realizado com sucesso');

      res.json({
        success: true,
        token: token,
        message: 'Login OK',
        expiresIn: 86400
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

/**
 * GET /api/admin/data
 * Carregar dados administrativos (completos)
 */
app.get('/api/admin/data', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const data = await getFullData();

    res.json({
      success: true,
      people: data.people,
      paidDates: data.paidDates,
      chat: data.chat,
      settings: data.settings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em GET /api/admin/data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/people
 * Adicionar nova pessoa
 */
app.post('/api/admin/people', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { name } = req.body;
    const validation = validatePersonName(name);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validação falhou',
        errors: validation.errors
      });
    }

    const people = await getAllPeople();

    if (people.includes(validation.value)) {
      return res.status(409).json({
        success: false,
        error: 'Pessoa já existe',
        existingPeople: people
      });
    }

    // Adicionar e salvar
    people.push(validation.value);
    const data = await getFullData();
    data.people = people;

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({
        error: 'Falha ao salvar dados no Firebase'
      });
    }

    console.log('✅ Pessoa adicionada:', validation.value);

    res.status(201).json({
      success: true,
      people: people,
      message: `${validation.value} foi adicionado(a) com sucesso`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em POST /api/admin/people:', error);
    res.status(500).json({
      error: 'Erro ao adicionar pessoa',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/people
 * Remover pessoa
 */
app.delete('/api/admin/people', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { name } = req.body;
    const validation = validatePersonName(name);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validação falhou',
        errors: validation.errors
      });
    }

    let people = await getAllPeople();
    const paidDates = await getAllPaidDates();

    if (!people.includes(validation.value)) {
      return res.status(404).json({
        error: 'Pessoa não encontrada',
        availablePeople: people
      });
    }

    // Remover pessoa
    people = people.filter(p => p !== validation.value);

    // Remover pagamentos associados
    const newPaidDates = {};
    Object.entries(paidDates).forEach(([date, person]) => {
      if (person !== validation.value) {
        newPaidDates[date] = person;
      }
    });

    const data = await getFullData();
    data.people = people;
    data.paidDates = newPaidDates;

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({
        error: 'Falha ao salvar dados'
      });
    }

    console.log('✅ Pessoa removida:', validation.value);

    res.json({
      success: true,
      people: people,
      paidDates: newPaidDates,
      message: `${validation.value} foi removido(a) com sucesso`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em DELETE /api/admin/people:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/paid
 * Registrar/atualizar pagamento em uma data específica
 */
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

    if (!isValidDateFormat(date)) {
      return res.status(400).json({
        error: 'Formato de data inválido (use YYYY-MM-DD)',
        example: '2025-12-11'
      });
    }

    const paidDates = await getAllPaidDates();

    // Se name é null/undefined/vazio = remover pagamento
    if (name === null || name === undefined || name === '') {
      delete paidDates[date];
      console.log('🗑️  Pagamento removido:', date);

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
      console.log('✅ PAGAMENTO REGISTRADO:', date, '→', cleanName);
    }

    // ✅ Salvar no Firebase
    const data = await getFullData();
    data.paidDates = paidDates;

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({ error: 'Falha ao salvar' });
    }

    res.json({
      success: true,
      paidDates: paidDates,
      message: name
        ? `✅ Pagamento registrado para ${name}`
        : '✅ Pagamento removido',
      timestamp: new Date().toISOString(),
      savedDate: date,
      savedPerson: name || null
    });

  } catch (error) {
    console.error('❌ ERRO ao salvar pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/settings
 * Atualizar configurações do sistema
 */
app.patch('/api/admin/settings', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        error: 'Settings deve ser um objeto válido'
      });
    }

    const data = await getFullData();
    data.settings = { ...data.settings, ...settings };

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({ error: 'Falha ao salvar' });
    }

    console.log('✅ Configurações atualizadas');

    res.json({
      success: true,
      settings: data.settings,
      message: 'Configurações atualizadas com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em PATCH /api/admin/settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/reset
 * Resetar histórico (com backup automático)
 */
app.delete('/api/admin/reset', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const currentData = await getFullData();
    const timestamp = new Date().toISOString();

    // ✅ CRIAR BACKUP ANTES DE DELETAR
    try {
      await firestoreDb
        .collection('bebida-em-dia')
        .collection('backups')
        .doc(`reset-${Date.now()}`)
        .set({
          ...currentData,
          reason: 'Manual reset via API',
          backedUpAt: admin.firestore.FieldValue.serverTimestamp(),
          backedUpDate: timestamp
        });

      console.log('✅ Backup criado antes de reset');
    } catch (backupError) {
      console.error('⚠️  Erro ao criar backup:', backupError.message);
    }

    // ✅ RESETAR (mantém pessoas, limpa histórico)
    const resetData = {
      people: currentData.people,
      paidDates: {},
      chat: [],
      settings: currentData.settings || {}
    };

    const saveSuccess = await saveToFirebase(resetData);

    if (!saveSuccess) {
      return res.status(500).json({ error: 'Falha ao salvar reset' });
    }

    console.log('✅ Histórico resetado. Backup salvo em Firestore');

    res.json({
      success: true,
      message: 'Histórico resetado com sucesso',
      backupId: `reset-${Date.now()}`,
      dataReset: resetData,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('❌ Erro em DELETE /api/admin/reset:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/paid/toggle-today
 * Toggle de pagamento para hoje
 */
app.patch('/api/paid/toggle-today', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { person } = req.body;

    if (!person) {
      return res.status(400).json({ error: 'Pessoa não informada' });
    }

    const validation = validatePersonName(person);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Pessoa inválida',
        errors: validation.errors
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const data = await getFullData();

    // Se já tem registro de hoje, remove
    if (data.paidDates[today] === validation.value) {
      delete data.paidDates[today];
      console.log('🗑️  Pagamento removido:', today);
    } else {
      // Senão, adiciona
      data.paidDates[today] = validation.value;
      console.log('✅ Pagamento adicionado:', today, '→', validation.value);
    }

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({ error: 'Falha ao salvar' });
    }

    res.json({
      success: true,
      date: today,
      person: validation.value,
      toggled: true,
      paidDates: data.paidDates,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em PATCH /api/paid/toggle-today:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chat
 * Adicionar mensagem no chat
 */
app.post('/api/chat', async (req, res) => {
  try {
    if (!firebaseConnected) {
      return res.status(503).json({ error: 'Database não disponível' });
    }

    const { userName, text } = req.body;

    if (!userName || !text) {
      return res.status(400).json({ error: 'userName e text são obrigatórios' });
    }

    const data = await getFullData();
    const chat = data.chat || [];

    // Limitar histórico de chat a 500 mensagens
    if (chat.length > 500) {
      chat.shift(); // Remove a mensagem mais antiga
    }

    const message = {
      id: Date.now().toString(),
      userName: userName.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    chat.push(message);
    data.chat = chat;

    const saveSuccess = await saveToFirebase(data);

    if (!saveSuccess) {
      return res.status(500).json({ error: 'Falha ao salvar mensagem' });
    }

    console.log('💬 Mensagem adicionada:', userName);

    res.status(201).json({
      success: true,
      message: message,
      messageText: 'Mensagem enviada com sucesso',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em POST /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Estatísticas do sistema
 */
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
        totalMessages: (data.chat || []).length,
        averagePaymentsPerPerson: people.length > 0
          ? (Object.keys(paidDates).length / people.length).toFixed(2)
          : 0
      },
      topContributors: topContributors,
      contributions: counts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro em GET /api/admin/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ERROR HANDLING ==========

/**
 * Erro não tratado
 */
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message
  });
});

/**
 * Rota não encontrada
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// ========== INICIAR SERVIDOR ==========

async function start() {
  try {
    // Inicializar Firebase
    await initFirebase();

    // Iniciar servidor HTTP
    const server = require('http').createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
      console.log(`🌍 API disponível em http://localhost:${PORT}`);
      console.log(`📡 Status: ${firebaseConnected ? '✅ Conectado ao Firebase' : '❌ Desconectado'}`);
      console.log(`📚 Documentação: http://localhost:${PORT}/api-docs\n`);
    });

    // ========== GRACEFUL SHUTDOWN ==========

    process.on('SIGTERM', async () => {
      console.log('\n🛑 SIGTERM recebido - Encerrando gracefully...');
      server.close(() => {
        console.log('✅ Servidor HTTP encerrado');
        process.exit(0);
      });

      // Forçar saída após 10 segundos
      setTimeout(() => {
        console.error('❌ Timeout ao encerrar, saída forçada');
        process.exit(1);
      }, 10000);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 SIGINT recebido - Encerrando gracefully...');
      server.close(() => {
        console.log('✅ Servidor HTTP encerrado');
        process.exit(0);
      });

      // Forçar saída após 10 segundos
      setTimeout(() => {
        console.error('❌ Timeout ao encerrar, saída forçada');
        process.exit(1);
      }, 10000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar aplicação
start();

module.exports = app;
