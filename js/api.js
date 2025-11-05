// --- Módulo de API ---

class ApiClient {
  constructor() {
    this.baseUrl = '';
    this.token = localStorage.getItem('adminToken');
  }

  // Configurar token de autenticação
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('adminToken', token);
    } else {
      localStorage.removeItem('adminToken');
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

  // Obter dados gerais
  async getData() {
    return this.request('/api/data');
  }

  // Alternar pagamento de hoje
  async toggleTodayPayment(name) {
    return this.request('/api/paid/toggle-today', {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
  }

  // Obter próxima pessoa na rotação
  async getNextPerson() {
    return this.request('/api/next-person');
  }

  // Enviar mensagem no chat
  async sendChatMessage(userName, text) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ userName, text })
    });
  }

  // --- Métodos de Administração ---

  // Login do administrador
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

  // Logout do administrador
  adminLogout() {
    this.setToken(null);
  }

  // Obter dados completos (admin)
  async getAdminData() {
    return this.request('/api/admin/data', {
      requireAuth: true
    });
  }

  // Adicionar pessoa
  async addPerson(name) {
    return this.request('/api/admin/people', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  // Remover pessoa
  async removePerson(name) {
    return this.request('/api/admin/people', {
      method: 'DELETE',
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  // Atualizar pagamento
  async updatePayment(date, name = null) {
    return this.request('/api/admin/paid', {
      method: 'PATCH',
      requireAuth: true,
      body: JSON.stringify({ date, name })
    });
  }

  // Resetar histórico
  async resetHistory() {
    return this.request('/api/admin/reset', {
      method: 'DELETE',
      requireAuth: true
    });
  }

  // Atualizar configurações
  async updateSettings(settings) {
    return this.request('/api/admin/settings', {
      method: 'PATCH',
      requireAuth: true,
      body: JSON.stringify(settings)
    });
  }

  // Verificar se está autenticado como admin
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

  // Mostrar loading em elemento
  showLoading(element, text = 'Carregando...') {
    if (element) {
      this.loadingElements.add(element);
      Utils.showLoading(element, text);
    }
  }

  // Esconder loading
  hideLoading(element, originalContent = '') {
    if (element && this.loadingElements.has(element)) {
      this.loadingElements.delete(element);
      Utils.hideLoading(element, originalContent);
    }
  }

  // Wrapper para requisições com tratamento de erro
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

      if (successMessage && showToast) {
        Utils.showToast(successMessage, 'success');
      }

      return result;
    } catch (error) {
      const message = errorMessage || error.message || 'Erro desconhecido';
      
      if (showToast) {
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
    Utils.showToast('Logout realizado com sucesso!', 'info');
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

  // Verificar autenticação
  isAdminAuthenticated() {
    return this.client.isAdminAuthenticated();
  }
}

// Instância global
window.API = new ApiService();

