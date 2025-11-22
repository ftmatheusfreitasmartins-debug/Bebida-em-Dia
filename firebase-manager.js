// ✅ Firebase Realtime Database Manager
// Sincroniza automaticamente data.json com Firebase

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseManager {
  constructor(serviceAccountPath, databaseURL) {
    try {
      let serviceAccount;

      // Ler de variável de ambiente (Render) ou arquivo (desenvolvimento local)
      if (process.env.SERVICE_ACCOUNT_KEY) {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
        console.log('📱 Usando Firebase credenciais de variável de ambiente (Render)');
      } else if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = require(path.resolve(serviceAccountPath));
        console.log('📱 Usando Firebase credenciais de arquivo local');
      } else {
        throw new Error('serviceAccountKey.json não encontrado e SERVICE_ACCOUNT_KEY não está definida');
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: databaseURL
        });
      }

      this.db = admin.database();
      this.dataRef = this.db.ref('data');
      this.localDataFile = './data.json';
      this.syncInterval = null;
      this.lastSyncTime = Date.now();
      this.failureCount = 0;
      
      console.log('✅ Firebase Realtime Database conectado');
      console.log(`📍 Database: ${databaseURL}\n`);

      this.startAutoSync();

    } catch (error) {
      console.error('❌ Erro ao conectar Firebase:', error.message);
      throw error;
    }
  }

  // ✅ Iniciar sincronização automática
  startAutoSync() {
    console.log('⏱️ Iniciando sincronização automática com Firebase...\n');

    // Sincronizar local → Firebase a cada 5 segundos
    this.syncInterval = setInterval(() => {
      this.syncLocalToFirebase();
    }, 5000);

    // Health check a cada 30 minutos
    setInterval(() => {
      this.healthCheck();
    }, 1800000);
  }

  // ✅ Sincronizar arquivo local para Firebase
  async syncLocalToFirebase() {
    try {
      if (!fs.existsSync(this.localDataFile)) {
        return;
      }

      const localData = JSON.parse(fs.readFileSync(this.localDataFile, 'utf8'));
      
      // Enviar para Firebase
      await this.dataRef.set(localData);
      
      this.lastSyncTime = Date.now();
      this.failureCount = 0;
      
      console.log(`✅ Sincronizado com Firebase - ${new Date().toLocaleTimeString('pt-BR')}`);

    } catch (error) {
      this.failureCount++;
      console.error(`❌ Erro ao sincronizar (tentativa ${this.failureCount}):`, error.message);
    }
  }

  // ✅ Carregar dados do Firebase (útil na inicialização)
  async loadFromFirebase() {
    try {
      console.log('📥 Carregando dados do Firebase...');
      
      const snapshot = await this.dataRef.once('value');
      const firebaseData = snapshot.val();

      if (firebaseData) {
        fs.writeFileSync(this.localDataFile, JSON.stringify(firebaseData, null, 2));
        console.log('✅ Dados carregados do Firebase com sucesso\n');
        return firebaseData;
      } else {
        console.log('ℹ️ Firebase vazio, usando arquivo local\n');
        if (fs.existsSync(this.localDataFile)) {
          return JSON.parse(fs.readFileSync(this.localDataFile, 'utf8'));
        }
        return { people: [], paidDates: {}, chat: [], settings: {} };
      }

    } catch (error) {
      console.error('❌ Erro ao carregar do Firebase:', error.message);
      console.log('ℹ️ Continuando com arquivo local\n');
      
      if (fs.existsSync(this.localDataFile)) {
        return JSON.parse(fs.readFileSync(this.localDataFile, 'utf8'));
      }
      return { people: [], paidDates: {}, chat: [], settings: {} };
    }
  }

  // ✅ Obter status de sincronização
  async getStatus() {
    return {
      ultimaSincronizacao: new Date(this.lastSyncTime).toLocaleString('pt-BR'),
      falhasRecentes: this.failureCount,
      status: this.failureCount === 0 ? '✅ Conectado' : '⚠️ Com problemas',
      timestamp: new Date().toISOString()
    };
  }

  // ✅ Health check
  async healthCheck() {
    try {
      const snapshot = await this.dataRef.once('value');
      const data = snapshot.val();

      const stats = {
        pessoas: data?.people?.length || 0,
        pagamentos: Object.keys(data?.paidDates || {}).length,
        mensagens: data?.chat?.length || 0,
        status: '✅ Saudável',
        timestamp: new Date().toLocaleString('pt-BR')
      };

      console.log('✅ Health Check Firebase:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Health Check falhou:', error.message);
      return { status: '❌ Erro', error: error.message };
    }
  }

  // ✅ Parar sincronização
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      console.log('⏹️ Sincronização Firebase parada');
    }
  }
}

module.exports = FirebaseManager;
