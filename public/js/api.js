// --- Módulo de API - VERSÃO FINAL PARA FIREBASE ---
// Configurado para usar SEMPRE o backend do Render (mesmo em localhost)

class ApiClient {
  constructor() {
    // FORÇAR uso do backend do Render sempre
    // Isso permite testar localmente sem rodar o backend
    this.baseUrl = 'https://bebidaemdia-backend.onrender.com';

    this.token = null;
    
    // Tentar recuperar token do localStorage (se existir)
    try {
      this.token = localStorage.getItem('adminToken');
    } catch (e) {
      console.warn('LocalStorage não disponível');
    }
    
    console.log('🌐 API Service Inicializado');
    console.log(`🔗 API URL: ${this.baseUrl}`);
  }

  // Configurar token de autenticação
  setToken(token) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('adminToken', token);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (e) {
      console.warn('Não foi possível salvar token no localStorage');
    }
  }

  // Obter headers padrão
  getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Método genérico para requisições
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.requireAuth),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Erro na API (${endpoint}):`, error);
      // Se erro de autenticação, limpar token
      if (error.message.includes('401') || error.message.includes('Token')) {
        this.setToken(null);
      }
      throw error;
    }
  }

  // --- Métodos Públicos ---
  async getData() {
    return this.request('/api/data');
  }

  async toggleTodayPayment(name) {
    return this.request('/api/paid/toggle-today', {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
  }

  async getNextPerson() {
    return this.request('/api/next-person');
  }

  async sendChatMessage(userName, text) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ userName, text })
    });
  }

  // --- Métodos de Administração ---
  async adminLogin(password) {
    const result = await this.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (result.success && result.token) {
      this.setToken(result.token);
    }
    return result;
  }

  adminLogout() {
    this.setToken(null);
  }

  async getAdminData() {
    return this.request('/api/admin/data', {
      requireAuth: true
    });
  }

  async addPerson(name) {
    return this.request('/api/admin/people', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  async removePerson(name) {
    return this.request('/api/admin/people', {
      method: 'DELETE',
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  async updatePayment(date, name = null) {
    return this.request('/api/admin/paid', {
      method: 'PATCH',
      requireAuth: true,
      body: JSON.stringify({ date, name })
    });
  }

  async resetHistory() {
    return this.request('/api/admin/reset', {
      method: 'DELETE',
      requireAuth: true
    });
  }

  async updateSettings(settings) {
    return this.request('/api/admin/settings', {
      method: 'PATCH',
      requireAuth: true,
      body: JSON.stringify(settings)
    });
  }

  isAdminAuthenticated() {
    return !!this.token;
  }
}

// --- Wrapper com tratamento de erros e loading ---
class ApiService {
  constructor() {
    this.client = new ApiClient();
    this.loadingElements = new Set();
  }

  showLoading(element, text = 'Carregando...') {
    if (element && typeof Utils !== 'undefined' && Utils.showLoading) {
      this.loadingElements.add(element);
      Utils.showLoading(element, text);
    }
  }

  hideLoading(element, originalContent = '') {
    if (element && typeof Utils !== 'undefined' && Utils.hideLoading) {
      if (this.loadingElements.has(element)) {
        this.loadingElements.delete(element);
        Utils.hideLoading(element, originalContent);
      }
    }
  }

  async withErrorHandling(apiCall, options = {}) {
    const {
      loadingElement,
      loadingText,
      successMessage,
      errorMessage,
      showToast = true
    } = options;

    try {
      if (loadingElement) {
        this.showLoading(loadingElement, loadingText);
      }

      const result = await apiCall();
      
      if (successMessage && showToast && typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(successMessage, 'success');
      }
      
      return result;
    } catch (error) {
      const message = errorMessage || error.message || 'Erro desconhecido';
      
      if (showToast && typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message, 'error');
      }
      
      console.error('Erro na API:', error);
      throw error;
    } finally {
      if (loadingElement) {
        this.hideLoading(loadingElement);
      }
    }
  }

  // --- Métodos Públicos com tratamento de erro ---
  async getData(options = {}) {
    return this.withErrorHandling(
      () => this.client.getData(),
      { errorMessage: 'Erro ao carregar dados', ...options }
    );
  }

  async toggleTodayPayment(name, options = {}) {
    return this.withErrorHandling(
      () => this.client.toggleTodayPayment(name),
      {
        successMessage: 'Bebida registrada com sucesso!',
        errorMessage: 'Erro ao registrar bebida',
        ...options
      }
    );
  }

  async getNextPerson(options = {}) {
    return this.withErrorHandling(
      () => this.client.getNextPerson(),
      { errorMessage: 'Erro ao obter próxima pessoa', ...options }
    );
  }

  async sendChatMessage(userName, text, options = {}) {
    return this.withErrorHandling(
      () => this.client.sendChatMessage(userName, text),
      {
        successMessage: 'Mensagem enviada!',
        errorMessage: 'Erro ao enviar mensagem',
        ...options
      }
    );
  }

  // --- Métodos de Administração ---
  async adminLogin(password, options = {}) {
    return this.withErrorHandling(
      () => this.client.adminLogin(password),
      {
        successMessage: 'Login realizado com sucesso!',
        errorMessage: 'Erro ao fazer login',
        ...options
      }
    );
  }

  adminLogout() {
    this.client.adminLogout();
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast('Logout realizado com sucesso!', 'info');
    }
  }

  async getAdminData(options = {}) {
    return this.withErrorHandling(
      () => this.client.getAdminData(),
      { errorMessage: 'Erro ao carregar dados administrativos', ...options }
    );
  }

  async addPerson(name, options = {}) {
    return this.withErrorHandling(
      () => this.client.addPerson(name),
      {
        successMessage: `${name} adicionado com sucesso!`,
        errorMessage: 'Erro ao adicionar pessoa',
        ...options
      }
    );
  }

  async removePerson(name, options = {}) {
    return this.withErrorHandling(
      () => this.client.removePerson(name),
      {
        successMessage: `${name} removido com sucesso!`,
        errorMessage: 'Erro ao remover pessoa',
        ...options
      }
    );
  }

  async updatePayment(date, name, options = {}) {
    const message = name
      ? `Pagamento registrado para ${name}!`
      : 'Pagamento removido!';
    return this.withErrorHandling(
      () => this.client.updatePayment(date, name),
      {
        successMessage: message,
        errorMessage: 'Erro ao atualizar pagamento',
        ...options
      }
    );
  }

  async resetHistory(options = {}) {
    return this.withErrorHandling(
      () => this.client.resetHistory(),
      {
        successMessage: 'Histórico resetado com sucesso!',
        errorMessage: 'Erro ao resetar histórico',
        ...options
      }
    );
  }

  async updateSettings(settings, options = {}) {
    return this.withErrorHandling(
      () => this.client.updateSettings(settings),
      {
        successMessage: 'Configurações atualizadas!',
        errorMessage: 'Erro ao atualizar configurações',
        ...options
      }
    );
  }

  isAdminAuthenticated() {
    return this.client.isAdminAuthenticated();
  }
}

// Instância global - disponível em window.API
window.API = new ApiService();
console.log('✅ API Service inicializado com sucesso');