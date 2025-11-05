// --- Painel Administrativo Reformulado - Bebida em Dia ---

console.log('admin.js carregado com sucesso');

class AdminPanel {
  constructor() {
    this.data = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.selectedDateForPayment = null;
    this.statsChart = null;
    
    this.init();
  }

  async init() {
    console.log('Inicializando painel administrativo...');
    
    // Configurar eventos
    this.setupEventListeners();
    
    // Verificar autenticação
    await this.checkAuthentication();
    
    console.log('✅ Painel administrativo inicializado');
  }

  setupEventListeners() {
    // Login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    // Enter no campo de senha
    const adminPassword = document.getElementById('adminPassword');
    if (adminPassword) {
      adminPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleLogin();
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Navegação entre abas
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Navegação do calendário
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
    }

    const nextMonthBtn = document.getElementById('nextMonthBtn');
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));
    }

    // Gerenciamento de pessoas
    const addPersonBtn = document.getElementById('addPersonBtn');
    if (addPersonBtn) {
      addPersonBtn.addEventListener('click', () => this.handleAddPerson());
    }

    // Enter no campo de nova pessoa
    const newPersonName = document.getElementById('newPersonName');
    if (newPersonName) {
      newPersonName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleAddPerson();
        }
      });
    }

    // Lista de pessoas (delegação de eventos)
    const peopleList = document.getElementById('peopleList');
    if (peopleList) {
      peopleList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-person-btn');
        if (removeBtn) {
          this.handleRemovePerson(removeBtn.dataset.name);
        }
      });
    }

    // Calendário (delegação de eventos)
    const calendarGrid = document.getElementById('calendarGrid');
    if (calendarGrid) {
      calendarGrid.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl && dayEl.dataset.date) {
          this.handleCalendarDayClick(dayEl.dataset.date);
        }
      });
    }

    // Modal de pagamento
    const paymentPeopleList = document.getElementById('paymentPeopleList');
    if (paymentPeopleList) {
      paymentPeopleList.addEventListener('click', (e) => {
        const personBtn = e.target.closest('.person-btn');
        if (personBtn) {
          this.handlePaymentPersonSelect(personBtn.dataset.name);
        }
      });
    }

    const clearPaymentBtn = document.getElementById('clearPaymentBtn');
    if (clearPaymentBtn) {
      clearPaymentBtn.addEventListener('click', () => this.handleClearPayment());
    }
  }

  async checkAuthentication() {
    if (API && API.isAdminAuthenticated && API.isAdminAuthenticated()) {
      // Já autenticado, carregar dados
      await this.loadAdminData();
      this.showAdminContent();
    } else {
      // Mostrar modal de login
      this.showLoginModal();
    }
  }

  showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const adminContent = document.getElementById('adminContent');
    const adminPassword = document.getElementById('adminPassword');
    
    if (loginModal) loginModal.classList.remove('hidden');
    if (adminContent) adminContent.classList.add('hidden');
    if (adminPassword) adminPassword.focus();
  }

  showAdminContent() {
    const loginModal = document.getElementById('loginModal');
    const adminContent = document.getElementById('adminContent');
    
    if (loginModal) loginModal.classList.add('hidden');
    if (adminContent) adminContent.classList.remove('hidden');
    
    // Aguardar um pouco para garantir que o DOM esteja pronto
    setTimeout(() => {
      this.renderAll();
    }, 100);
  }

  async handleLogin() {
    const adminPassword = document.getElementById('adminPassword');
    const errorMsg = document.getElementById('errorMsg');
    
    if (!adminPassword || !errorMsg) return;
    
    const password = adminPassword.value.trim();
    
    if (!password) {
      errorMsg.textContent = 'Digite a senha';
      return;
    }

    try {
      const result = await API.adminLogin(password);

      if (result && result.success) {
        errorMsg.textContent = '';
        await this.loadAdminData();
        this.showAdminContent();
        this.showToast('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      errorMsg.textContent = error.message || 'Senha incorreta';
      adminPassword.focus();
    }
  }

  handleLogout() {
    if (confirm('Tem certeza que deseja sair do painel administrativo?')) {
      if (API && API.adminLogout) {
        API.adminLogout();
      }
      this.showLoginModal();
      const adminPassword = document.getElementById('adminPassword');
      const errorMsg = document.getElementById('errorMsg');
      if (adminPassword) adminPassword.value = '';
      if (errorMsg) errorMsg.textContent = '';
    }
  }

  async loadAdminData() {
    try {
      console.log('Carregando dados administrativos...');
      this.data = await API.getAdminData();
      console.log('Dados carregados:', this.data);
    } catch (error) {
      console.error('Erro ao carregar dados admin:', error);
      this.showToast('Erro ao carregar dados', 'error');
    }
  }

  switchTab(tabName) {
    console.log('Mudando para aba:', tabName);
    
    // Atualizar navegação
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Mostrar conteúdo da aba
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}Tab`);
    });

    // Ações específicas por aba
    if (tabName === 'calendar') {
      this.renderCalendar();
    } else if (tabName === 'people') {
      this.renderPeopleList();
    } else if (tabName === 'dashboard') {
      this.renderDashboardStats();
      this.renderChart();
    }
  }

  navigateMonth(direction) {
    this.currentMonth += direction;
    
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    
    this.renderCalendar();
  }

  async handleAddPerson() {
    const nameInput = document.getElementById('newPersonName');
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    
    if (!name) {
      this.showToast('Digite um nome válido', 'warning');
      nameInput.focus();
      return;
    }

    if (!this.isValidName(name)) {
      this.showToast('Nome inválido. Use apenas letras e espaços', 'error');
      nameInput.focus();
      return;
    }

    try {
      const result = await API.addPerson(name);

      if (result && result.success) {
        this.data.people = result.people;
        nameInput.value = '';
        this.renderPeopleList();
        this.renderDashboardStats();
        this.showToast('Pessoa adicionada com sucesso!', 'success');
      }
    } catch (error) {
      console.error('Erro ao adicionar pessoa:', error);
      this.showToast('Erro ao adicionar pessoa', 'error');
    }
  }

  handleRemovePerson(name) {
    if (confirm(`Tem certeza que deseja remover "${name}"? Todo o histórico de pagamentos desta pessoa será perdido.`)) {
      this.removePerson(name);
    }
  }

  async removePerson(name) {
    try {
      const result = await API.removePerson(name);
      
      if (result && result.success) {
        this.data.people = result.people;
        this.data.paidDates = result.paidDates;
        this.renderAll();
        this.showToast('Pessoa removida com sucesso!', 'success');
      }
    } catch (error) {
      console.error('Erro ao remover pessoa:', error);
      this.showToast('Erro ao remover pessoa', 'error');
    }
  }

  handleCalendarDayClick(date) {
    this.selectedDateForPayment = date;
    
    const formattedDate = this.formatDate(date);
    const paymentModalTitle = document.getElementById('paymentModalTitle');
    if (paymentModalTitle) {
      paymentModalTitle.textContent = `Pagamento - ${formattedDate}`;
    }
    
    this.renderPaymentPeopleList();
    this.openPaymentModal();
  }

  async handlePaymentPersonSelect(name) {
    if (!this.selectedDateForPayment) return;

    try {
      const result = await API.updatePayment(this.selectedDateForPayment, name);
      
      if (result && result.success) {
        this.data.paidDates = result.paidDates;
        this.closePaymentModal();
        this.renderAll();
        this.showToast('Pagamento registrado!', 'success');
      }
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error);
      this.showToast('Erro ao registrar pagamento', 'error');
    }
  }

  async handleClearPayment() {
    if (!this.selectedDateForPayment) return;

    try {
      const result = await API.updatePayment(this.selectedDateForPayment, null);
      
      if (result && result.success) {
        this.data.paidDates = result.paidDates;
        this.closePaymentModal();
        this.renderAll();
        this.showToast('Pagamento removido!', 'success');
      }
    } catch (error) {
      console.error('Erro ao limpar pagamento:', error);
      this.showToast('Erro ao limpar pagamento', 'error');
    }
  }

  renderAll() {
    console.log('Renderizando todos os componentes...');
    
    if (!this.data) {
      console.log('Dados não disponíveis ainda');
      return;
    }
    
    this.renderDashboardStats();
    this.renderChart();
    this.renderPeopleList();
    this.renderCalendar();
  }

  renderDashboardStats() {
    if (!this.data) return;

    console.log('Renderizando estatísticas do dashboard...');

    // Total de pagamentos
    const totalPayments = Object.keys(this.data.paidDates || {}).length;
    const totalPaymentsEl = document.getElementById("totalPayments");
    if (totalPaymentsEl) {
      totalPaymentsEl.textContent = totalPayments;
    }

    // Total de pessoas
    const totalPeopleEl = document.getElementById("totalPeople");
    if (totalPeopleEl) {
      totalPeopleEl.textContent = this.data.people?.length || 0;
    }

    // Última data de pagamento
    const dates = Object.keys(this.data.paidDates || {}).sort();
    const lastPaymentDateEl = document.getElementById("lastPaymentDate");
    if (lastPaymentDateEl) {
      if (dates.length > 0) {
        const lastDate = dates[dates.length - 1];
        lastPaymentDateEl.textContent = this.formatDateShort(lastDate);
      } else {
        lastPaymentDateEl.textContent = 'N/A';
      }
    }

    // Pagamentos do mês atual
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const thisMonthPayments = dates.filter(date => {
      const [year, month] = date.split('-').map(Number);
      return year === currentYear && month === currentMonth;
    }).length;
    const currentMonthEl = document.getElementById("currentMonth");
    if (currentMonthEl) {
      currentMonthEl.textContent = thisMonthPayments;
    }
    
    console.log('Estatísticas renderizadas com sucesso');
  }

  renderChart() {
    if (!this.data) return;

    const paymentsChartEl = document.getElementById("paymentsChart");
    if (!paymentsChartEl) return;
    
    // Calcular dados para exibição simples
    const scores = {};
    this.data.people.forEach(person => scores[person] = 0);
    
    Object.values(this.data.paidDates || {}).forEach(person => {
      if (scores[person] !== undefined) {
        scores[person]++;
      }
    });

    // Criar visualização simples sem Chart.js
    const chartContainer = paymentsChartEl.parentElement;
    chartContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center;">
        <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Estatísticas por Pessoa</h3>
        <div style="display: grid; gap: 1rem; max-width: 400px; margin: 0 auto;">
          ${Object.entries(scores)
            .sort(([nameA, scoreA], [nameB, scoreB]) => {
              // Primeiro por pontuação (maior para menor)
              if (scoreB !== scoreA) return scoreB - scoreA;
              // Em caso de empate, ordem alfabética
              return String(nameA).localeCompare(String(nameB));
            })
            .map(([person, count]) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <span style="color: var(--text-primary);">${person}</span>
                <span style="color: var(--accent-primary); font-weight: bold;">${count}</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  generateChartColors(count) {
    const baseColors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
    ];
    
    const background = [];
    const border = [];
    
    for (let i = 0; i < count; i++) {
      const color = baseColors[i % baseColors.length];
      background.push(color + '80'); // 50% opacity
      border.push(color);
    }
    
    return { background, border };
  }

  renderPeopleList() {
    const list = document.getElementById('peopleList');
    if (!list) return;
    
    if (!this.data || !this.data.people || this.data.people.length === 0) {
      list.innerHTML = '<li class="list-item"><span>Nenhuma pessoa cadastrada</span></li>';
      return;
    }

    list.innerHTML = '';
    
    this.data.people.forEach(person => {
      const item = document.createElement('li');
      item.className = 'list-item';
      
      // Contar pagamentos da pessoa
      const paymentCount = Object.values(this.data.paidDates || {})
        .filter(p => p === person).length;
      
      item.innerHTML = `
        <div>
          <span class="person">${person}</span>
          <small style="color: var(--text-muted);">${paymentCount} bebida${paymentCount !== 1 ? 's' : ''}</small>
        </div>
        <button class="btn danger small-btn remove-person-btn" 
                data-name="${person}" 
                title="Remover ${person}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      list.appendChild(item);
    });
  }

  renderCalendar() {
    const monthYear = document.getElementById('monthYear');
    const grid = document.getElementById("calendarGrid");
    
    if (!monthYear || !grid) return;
    
    // Atualizar título
    const date = new Date(this.currentYear, this.currentMonth);
    monthYear.textContent = date.toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });

    // Limpar grid
    grid.innerHTML = '';

    // Cabeçalhos dos dias
    const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = day;
      grid.appendChild(header);
    });

    // Calcular dias
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    // Dias vazios no início
    for (let i = 0; i < firstDay; i++) {
      const emptyDay = document.createElement('div');
      grid.appendChild(emptyDay);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.dataset.date = date;
      
      const payer = this.data && this.data.paidDates ? this.data.paidDates[date] : null;
      if (payer) {
        dayEl.classList.add('paid');
      }

      dayEl.innerHTML = `
        <span class="day-number">${day}</span>
        ${payer ? `<span class="payer-badge">${payer.split(' ')[0]}</span>` : ''}
      `;

      grid.appendChild(dayEl);
    }
  }

  renderPaymentPeopleList() {
    const list = document.getElementById('paymentPeopleList');
    if (!list) return;
    
    if (!this.data || !this.data.people || this.data.people.length === 0) {
      list.innerHTML = '<p>Nenhuma pessoa cadastrada</p>';
      return;
    }

    list.innerHTML = '';
    
    this.data.people.forEach(person => {
      const button = document.createElement('button');
      button.className = 'btn btn-outline full-width person-btn';
      button.dataset.name = person;
      button.innerHTML = `
        <i class="fas fa-user"></i>
        ${person}
      `;
      list.appendChild(button);
    });
  }

  // Funções auxiliares
  openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  formatDate(dateString) {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateShort(dateString) {
    return new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric'
    });
  }

  isValidName(name) {
    return name && 
           typeof name === 'string' && 
           name.trim().length > 0 && 
           name.trim().length <= 50 &&
           /^[a-zA-ZÀ-ÿ\s]+$/.test(name.trim());
  }

  showToast(message, type = 'info') {
    console.log(`Toast ${type}: ${message}`);
    
    // Implementação simples de toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease',
      maxWidth: '300px'
    });

    const colors = {
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Função global para fechar modal de pagamento
function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Inicializar painel administrativo quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado, inicializando AdminPanel...');
  window.adminPanel = new AdminPanel();
});