// --- Painel Administrativo - Bebida em Dia ---

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
    try {
      // Configurar modais
      this.setupModals();
      
      // Configurar eventos
      this.setupEventListeners();
      
      // Configurar temas
      this.setupThemes();
      
      // Verificar autenticação
      await this.checkAuthentication();
      
      console.log('✅ Painel administrativo inicializado');
    } catch (error) {
      console.error('❌ Erro na inicialização do admin:', error);

    }
  }

  setupModals() {
    Modal.setupModal('loginModal', {
      closeOnBackdrop: false,
      closeOnEscape: false
    });
    
    Modal.setupModal('paymentModal', {
      closeOnBackdrop: true,
      closeOnEscape: true
    });
    
    Modal.setupModal('themeModal', {
      closeOnBackdrop: true,
      closeOnEscape: true,
      triggers: ['#changeThemeBtn']
    });
  }

  setupEventListeners() {
    // Login
    Utils.el('loginBtn').addEventListener('click', () => {
      this.handleLogin();
    });

    // Enter no campo de senha
    Utils.el('adminPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });

    // Logout
    Utils.el('logoutBtn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Navegação entre abas
    Utils.qsa('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Navegação do calendário
    Utils.el('prevMonthBtn').addEventListener('click', () => {
      this.navigateMonth(-1);
    });

    Utils.el('nextMonthBtn').addEventListener('click', () => {
      this.navigateMonth(1);
    });

    // Gerenciamento de pessoas
    Utils.el('addPersonBtn').addEventListener('click', () => {
      this.handleAddPerson();
    });

    // Enter no campo de nova pessoa
    Utils.el('newPersonName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleAddPerson();
      }
    });

    // Lista de pessoas (delegação de eventos)
    Utils.el('peopleList').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.remove-person-btn');
      if (removeBtn) {
        this.handleRemovePerson(removeBtn.dataset.name);
      }
    });

    // Calendário (delegação de eventos)
    Utils.el('calendarGrid').addEventListener('click', (e) => {
      const dayEl = e.target.closest('.calendar-day');
      if (dayEl && dayEl.dataset.date) {
        this.handleCalendarDayClick(dayEl.dataset.date);
      }
    });

    // Modal de pagamento
    Utils.el('paymentPeopleList').addEventListener('click', (e) => {
      const personBtn = e.target.closest('.person-btn');
      if (personBtn) {
        this.handlePaymentPersonSelect(personBtn.dataset.name);
      }
    });

    Utils.el('clearPaymentBtn').addEventListener('click', () => {
      this.handleClearPayment();
    });

    // Configurações
    Utils.el('saveSettingsBtn').addEventListener('click', () => {
      this.handleSaveSettings();
    });

    // Zona de perigo
    Utils.el('resetHistoryBtn').addEventListener('click', () => {
      this.handleResetHistory();
    });

    // Temas
    Utils.el('themeList').addEventListener('click', (e) => {
      const themeBtn = e.target.closest('.theme-option');
      if (themeBtn) {
        this.handleThemeSelect(themeBtn.dataset.theme);
      }
    });
  }

  setupThemes() {
    // Renderizar lista de temas
    this.renderThemeList();
    
    // Escutar mudanças de tema
    Theme.onThemeChange((theme) => {
      // Atualizar seleção ativa
      Utils.qsa('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === theme);
      });
    });
  }

  async checkAuthentication() {
    if (API.isAdminAuthenticated()) {
      // Já autenticado, carregar dados
      await this.loadAdminData();
      this.showAdminContent();
      // Pequeno atraso para garantir que o DOM esteja pronto após a remoção da classe 'hidden'
      setTimeout(() => this.renderAll(), 50);
    } else {
      // Mostrar modal de login
      this.showLoginModal();
    }
  }

  showLoginModal() {
    Utils.el('loginModal').classList.remove('hidden');
    Utils.el('adminContent').classList.add('hidden');
    Utils.el('adminPassword').focus();
  }

  showAdminContent() {
    Utils.el('loginModal').classList.add('hidden');
    Utils.el('adminContent').classList.remove('hidden');
  }

  async handleLogin() {
    const password = Utils.el('adminPassword').value.trim();
    const errorMsg = Utils.el('errorMsg');
    
    if (!password) {
      errorMsg.textContent = 'Digite a senha';
      return;
    }

    try {
      const result = await API.adminLogin(password, {
        loadingElement: Utils.el('loginBtn'),
        loadingText: 'Entrando...',
        showToast: false
      });

      if (result?.success) {
        errorMsg.textContent = '';
        await this.loadAdminData();
        this.showAdminContent();
        // Pequeno atraso para garantir que o DOM esteja pronto após a remoção da classe 'hidden'
        setTimeout(() => this.renderAll(), 50);
        Utils.showToast('Login realizado com sucesso!', 'success');
      }
    } catch (error) {
      errorMsg.textContent = error.message || 'Senha incorreta';
      Utils.el('adminPassword').focus();
    }
  }

  handleLogout() {
    const modalId = ModalUtils.createConfirmModal(
      'Tem certeza que deseja sair do painel administrativo?',
      {
        title: 'Confirmar Logout',
        confirmText: 'Sair',
        cancelText: 'Cancelar',
        onConfirm: () => {
          API.adminLogout();
          this.showLoginModal();
          Utils.el('adminPassword').value = '';
          Utils.el('errorMsg').textContent = '';
        }
      }
    );
    
    Modal.open(modalId);
  }

  async loadAdminData() {
    try {
      this.data = await API.getAdminData({
        loadingElement: Utils.qs('.main-content'),
        loadingText: 'Carregando dados administrativos...'
      });
      
      this.renderAll();
    } catch (error) {
      console.error('Erro ao carregar dados admin:', error);
      Utils.showToast('Erro ao carregar dados', 'error');
    }
  }

  switchTab(tabName) {
    // Atualizar navegação
    Utils.qsa('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Mostrar conteúdo da aba
    Utils.qsa('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}Tab`);
    });

    // Ações específicas por aba
    if (tabName === 'calendar') {
      this.renderCalendar();
    } else if (tabName === 'settings') {
      this.loadSettings();
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
    const nameInput = Utils.el('newPersonName');
    const name = nameInput.value.trim();
    
    if (!name) {
      Utils.showToast('Digite um nome válido', 'warning');
      nameInput.focus();
      return;
    }

    if (!Utils.isValidName(name)) {
      Utils.showToast('Nome inválido. Use apenas letras e espaços', 'error');
      nameInput.focus();
      return;
    }

    try {
      const result = await API.addPerson(name, {
        loadingElement: Utils.el('addPersonBtn'),
        loadingText: 'Adicionando...'
      });

      if (result?.success) {
        this.data.people = result.people;
        nameInput.value = '';
        this.renderPeopleList();
        this.renderDashboardStats();
      }
    } catch (error) {
      console.error('Erro ao adicionar pessoa:', error);
    }
  }

  handleRemovePerson(name) {
    const modalId = ModalUtils.createConfirmModal(
      `Tem certeza que deseja remover "${name}"? Todo o histórico de pagamentos desta pessoa será perdido.`,
      {
        title: 'Confirmar Remoção',
        confirmText: 'Remover',
        cancelText: 'Cancelar',
        confirmClass: 'danger',
        onConfirm: async () => {
          try {
            const result = await API.removePerson(name);
            
            if (result?.success) {
              this.data.people = result.people;
              this.data.paidDates = result.paidDates;
              this.renderAll();
            }
          } catch (error) {
            console.error('Erro ao remover pessoa:', error);
          }
        }
      }
    );
    
    Modal.open(modalId);
  }

  handleCalendarDayClick(date) {
    this.selectedDateForPayment = date;
    
    const formattedDate = Utils.formatDate(date);
    Utils.el('paymentModalTitle').textContent = `Pagamento - ${formattedDate}`;
    
    this.renderPaymentPeopleList();
    Modal.open('paymentModal');
  }

  async handlePaymentPersonSelect(name) {
    if (!this.selectedDateForPayment) return;

    try {
      const result = await API.updatePayment(this.selectedDateForPayment, name);
      
      if (result?.success) {
        this.data.paidDates = result.paidDates;
        Modal.close('paymentModal');
        this.renderAll();
      }
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error);
    }
  }

  async handleClearPayment() {
    if (!this.selectedDateForPayment) return;

    try {
      const result = await API.updatePayment(this.selectedDateForPayment, null);
      
      if (result?.success) {
        this.data.paidDates = result.paidDates;
        Modal.close('paymentModal');
        this.renderAll();
      }
    } catch (error) {
      console.error('Erro ao limpar pagamento:', error);
    }
  }

  async handleSaveSettings() {
    const rotationMode = Utils.el('rotationMode').value;
    
    try {
      const result = await API.updateSettings({ rotationMode }, {
        loadingElement: Utils.el('saveSettingsBtn'),
        loadingText: 'Salvando...'
      });
      
      if (result?.success) {
        this.data.settings = result.settings;
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  }

  handleResetHistory() {
    const modalId = ModalUtils.createConfirmModal(
      'Esta ação irá remover TODOS os registros de pagamentos. Um backup será criado automaticamente. Esta ação é IRREVERSÍVEL.',
      {
        title: 'ATENÇÃO - Resetar Histórico',
        confirmText: 'Sim, Resetar Tudo',
        cancelText: 'Cancelar',
        confirmClass: 'danger',
        onConfirm: async () => {
          try {
            const result = await API.resetHistory({
              loadingElement: Utils.el('resetHistoryBtn'),
              loadingText: 'Resetando...'
            });
            
            if (result?.success) {
              this.data.paidDates = {};
              this.renderAll();
              
              if (result.backup) {
                Utils.showToast(`Backup criado: ${result.backup}`, 'info', 5000);
              }
            }
          } catch (error) {
            console.error('Erro ao resetar histórico:', error);
          }
        }
      }
    );
    
    Modal.open(modalId);
  }

  handleThemeSelect(theme) {
    Theme.setTheme(theme);
    Modal.close('themeModal');
  }

  renderAll() {
    // Aguardar que o adminContent esteja visível antes de renderizar
    const adminContent = Utils.el('adminContent');
    if (!adminContent || adminContent.classList.contains('hidden')) {
      console.log('AdminContent ainda não está visível, aguardando...');
      setTimeout(() => this.renderAll(), 100);
      return;
    }
    
    console.log('Renderizando todos os componentes...');
    this.renderDashboardStats();
    this.renderChart();
    this.renderPeopleList();
    this.renderCalendar();
  }

  renderDashboardStats() {
    if (!this.data) {
      console.log('Dados não carregados ainda, pulando renderDashboardStats');
      return;
    }

    console.log('Renderizando estatísticas do dashboard...');

    // Total de pagamentos
    const totalPayments = Object.keys(this.data.paidDates || {}).length;
    const totalPaymentsEl = Utils.el("totalPayments");
    if (totalPaymentsEl) {
      totalPaymentsEl.textContent = totalPayments;
      console.log('Total de pagamentos atualizado:', totalPayments);
    } else {
      console.warn('Elemento totalPayments não encontrado');
    }

    const totalPeopleEl = Utils.el("totalPeople");
    if (totalPeopleEl) {
      totalPeopleEl.textContent = this.data.people?.length || 0;
      console.log('Total de pessoas atualizado:', this.data.people?.length || 0);
    } else {
      console.warn('Elemento totalPeople não encontrado');
    }

    const dates = Object.keys(this.data.paidDates || {}).sort();
    const lastPaymentDateEl = Utils.el("lastPaymentDate");
    if (lastPaymentDateEl) {
      if (dates.length > 0) {
        const lastDate = dates[dates.length - 1];
        lastPaymentDateEl.textContent = Utils.formatDateShort(lastDate);
        console.log('Última data de pagamento atualizada:', lastDate);
      } else {
        lastPaymentDateEl.textContent = 'N/A';
        console.log('Nenhuma data de pagamento encontrada');
      }
    } else {
      console.warn('Elemento lastPaymentDate não encontrado');
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const thisMonthPayments = dates.filter(date => {
      const [year, month] = date.split('-').map(Number);
      return year === currentYear && month === currentMonth;
    }).length;
    const currentMonthEl = Utils.el("currentMonth");
    if (currentMonthEl) {
      currentMonthEl.textContent = thisMonthPayments;
      console.log('Pagamentos do mês atual atualizados:', thisMonthPayments);
    } else {
      console.warn('Elemento currentMonth não encontrado');
    }
  }

  renderChart() {
    if (!this.data) return;

    const paymentsChartEl = Utils.el("paymentsChart");
    if (!paymentsChartEl) return;
    const ctx = paymentsChartEl.getContext("2d");
    
    // Destruir gráfico anterior
    if (this.statsChart) {
      this.statsChart.destroy();
    }

    // Calcular dados para o gráfico
    const scores = {};
    this.data.people.forEach(person => scores[person] = 0);
    
    Object.values(this.data.paidDates || {}).forEach(person => {
      if (scores[person] !== undefined) {
        scores[person]++;
      }
    });

    const labels = Object.keys(scores);
    const data = Object.values(scores);
    const colors = this.generateChartColors(labels.length);

    this.statsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Bebidas Pagas',
          data: data,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'var(--text-secondary)',
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'var(--panel)',
            titleColor: 'var(--text-primary)',
            bodyColor: 'var(--text-secondary)',
            borderColor: 'var(--border)',
            borderWidth: 1
          }
        }
      }
    });
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
    const list = Utils.el('peopleList');
    if (!list) return;
    
    if (!this.data.people || this.data.people.length === 0) {
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
                aria-label="Remover ${person}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      list.appendChild(item);
    });
  }

  renderCalendar() {
    const monthYear = Utils.el('monthYear');
    if (!monthYear) return;
    const grid = Utils.el("calendarGrid");
    if (!grid) return;
    
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
      
      const payer = this.data.paidDates[date];
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
    const list = Utils.el('paymentPeopleList');
    
    if (!this.data.people || this.data.people.length === 0) {
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

  renderThemeList() {
    const list = Utils.el('themeList');
    list.innerHTML = '';
    
    Theme.getAvailableThemes().forEach(({ id, name }) => {
      const button = document.createElement('button');
      button.className = 'theme-option';
      button.dataset.theme = id;
      button.textContent = name;
      
      if (id === Theme.getCurrentTheme()) {
        button.classList.add('active');
      }
      
      list.appendChild(button);
    });
  }

  loadSettings() {
    if (this.data?.settings) {
      Utils.el('rotationMode').value = this.data.settings.rotationMode || 'sequential';
    }
  }
}

// Inicializar painel administrativo quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});

