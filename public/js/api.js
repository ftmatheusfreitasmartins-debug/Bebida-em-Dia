// js/api.js
class ApiClient {
  constructor() {
    this.baseUrl = ""; // Netlify: usa o mesmo domínio
    this.token = localStorage.getItem("adminToken");
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem("adminToken", token);
    else localStorage.removeItem("adminToken");
  }

  getHeaders(includeAuth = false) {
    const headers = { "Content-Type": "application/json" };
    if (includeAuth && this.token) headers["Authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.requireAuth),
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error || `Erro HTTP: ${response.status}`;
      if (String(response.status) === "401" || msg.includes("Token")) this.setToken(null);
      throw new Error(msg);
    }

    return await response.json();
  }

  // Públicos
  getData() {
    return this.request("/api/data");
  }

  toggleTodayPayment(name) {
    return this.request("/api/paid/toggle-today", {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
  }

  getNextPerson() {
    return this.request("/api/next-person");
  }

  sendChatMessage(userName, text) {
    return this.request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ userName, text })
    });
  }

  // Admin
  async adminLogin(password) {
    const result = await this.request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password })
    });

    if (result?.success && result?.token) this.setToken(result.token);
    return result;
  }

  adminLogout() {
    this.setToken(null);
  }

  getAdminData() {
    return this.request("/api/admin/data", { requireAuth: true });
  }

  addPerson(name) {
    return this.request("/api/admin/people", {
      method: "POST",
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  removePerson(name) {
    return this.request("/api/admin/people", {
      method: "DELETE",
      requireAuth: true,
      body: JSON.stringify({ name })
    });
  }

  updatePayment(date, name = null) {
    return this.request("/api/admin/paid", {
      method: "PATCH",
      requireAuth: true,
      body: JSON.stringify({ date, name })
    });
  }

  resetHistory() {
    return this.request("/api/admin/reset", {
      method: "DELETE",
      requireAuth: true
    });
  }

  updateSettings(settings) {
    return this.request("/api/admin/settings", {
      method: "PATCH",
      requireAuth: true,
      body: JSON.stringify(settings)
    });
  }

  isAdminAuthenticated() {
    return !!this.token;
  }
}

class ApiService {
  constructor() {
    this.client = new ApiClient();
  }

  async getData(options = {}) {
    return this.client.getData(options);
  }

  async toggleTodayPayment(name, options = {}) {
    return this.client.toggleTodayPayment(name, options);
  }

  async getNextPerson(options = {}) {
    return this.client.getNextPerson(options);
  }

  async sendChatMessage(userName, text, options = {}) {
    return this.client.sendChatMessage(userName, text, options);
  }

  async adminLogin(password, options = {}) {
    return this.client.adminLogin(password, options);
  }

  adminLogout() {
    this.client.adminLogout();
  }

  async getAdminData(options = {}) {
    return this.client.getAdminData(options);
  }

  async addPerson(name, options = {}) {
    return this.client.addPerson(name, options);
  }

  async removePerson(name, options = {}) {
    return this.client.removePerson(name, options);
  }

  async updatePayment(date, name, options = {}) {
    return this.client.updatePayment(date, name, options);
  }

  async resetHistory(options = {}) {
    return this.client.resetHistory(options);
  }

  async updateSettings(settings, options = {}) {
    return this.client.updateSettings(settings, options);
  }

  isAdminAuthenticated() {
    return this.client.isAdminAuthenticated();
  }
}

window.API = new ApiService();
