// --- Aplicação Principal - Bebida em Dia ---

class BebidaEmDiaApp {
  constructor() {
    this.data = null;
    this.selectedProfile = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    
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
      
      // Carregar dados iniciais
      await this.loadInitialData();
      
      // Carregar perfil salvo
      this.loadSavedProfile();
      
      // Renderizar interface
      this.renderAll();
      
      console.log('✅ Aplicação inicializada com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      Utils.showToast('Erro ao inicializar aplicação', 'error');
    }
  }

  setupModals() {
    // Configurar modais principais
    Modal.setupModal('selectPersonModal', {
      closeOnBackdrop: false,
      closeOnEscape: true
    });
    
    Modal.setupModal('settingsModal', {
      closeOnBackdrop: true,
      closeOnEscape: true,
      triggers: ['#openSettingsModal']
    });
    
    Modal.setupModal('helpModal', {
      closeOnBackdrop: true,
      closeOnEscape: true,
      triggers: ['#openHelpModal']
    });
  }

  setupEventListeners() {
    // Botão de registrar bebida
    Utils.el('togglePaidBtn').addEventListener('click', () => {
      this.handleTogglePaid();
    });

    // Botão de logout
    Utils.el('logoutBtn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Navegação do calendário
    Utils.el('prevMonthBtn').addEventListener('click', () => {
      this.navigateMonth(-1);
    });

    Utils.el('nextMonthBtn').addEventListener('click', () => {
      this.navigateMonth(1);
    });

    // Toggle do histórico
    Utils.el('historyToggle').addEventListener('click', () => {
      this.toggleHistory();
    });

    // Menu mobile
    Utils.qs('.menu-toggle').addEventListener('click', () => {
      Utils.qs('.nav-menu').classList.toggle('active');
    });

    // Configurações
    this.setupSettingsEvents();

    // Fechar modais com botões específicos
    Utils.el('closeHelpModalBtn').addEventListener('click', () => {
      Modal.close('helpModal');
    });
  }

  setupSettingsEvents() {
    // Seletor de tema
    Utils.el('themeSelector').addEventListener('change', (e) => {
      if (this.selectedProfile) {
        Theme.setTheme(e.target.value);
        this.saveProfilePreferences();
      }
    });

    // Aplicar fundo
    Utils.el('applyBackgroundBtn').addEventListener('click', () => {
      this.applyBackground();
    });

    // Limpar fundo
    Utils.el('clearBackgroundBtn').addEventListener('click', () => {
      this.clearBackground();
    });

    // Aplicar foto de perfil
    Utils.el('applyProfileImageBtn').addEventListener('click', () => {
      this.applyProfileImage();
    });

    // Limpar foto de perfil
    Utils.el('clearProfileImageBtn').addEventListener('click', () => {
      this.clearProfileImage();
    });
  }

  setupThemes() {
    // Preencher seletor de temas
    const themeSelector = Utils.el('themeSelector');
    themeSelector.innerHTML = '';
    
    Theme.getAvailableThemes().forEach(({ id, name }) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      themeSelector.appendChild(option);
    });

    // Escutar mudanças de tema
    Theme.onThemeChange((theme) => {
      themeSelector.value = theme;
    });
  }

  async loadInitialData() {
    try {
      this.data = await API.getData({
        loadingElement: Utils.el('leaderboard'),
        loadingText: 'Carregando dados...'
      });
      
      if (!this.data) {
        throw new Error('Dados não carregados');
      }
      
      // Carregar próxima pessoa
      const nextPersonData = await API.getNextPerson();
      if (nextPersonData?.nextPerson) {
        Utils.el('nextPersonName').textContent = nextPersonData.nextPerson;
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      // Dados de fallback
      this.data = {
        people: [],
        paidDates: {},
        chat: []
      };
    }
  }

  loadSavedProfile() {
    const savedProfile = localStorage.getItem('selectedProfile');
    if (savedProfile && this.data.people.includes(savedProfile)) {
      this.selectProfile(savedProfile);
    } else {
      // Mostrar modal de seleção se não há perfil salvo
      this.showProfileSelection();
    }
  }

  showProfileSelection() {
    this.renderProfileList();
    Modal.open('selectPersonModal');
  }

  renderProfileList() {
    const container = Utils.el('personSelectModalList');
    
    if (!this.data.people || this.data.people.length === 0) {
      container.innerHTML = `
        <div class="profile-item-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Nenhum perfil disponível. Entre em contato com o administrador.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    
    this.data.people.forEach(name => {
      const profileItem = document.createElement('div');
      profileItem.className = 'profile-item';
      profileItem.dataset.profileName = name;
      profileItem.setAttribute('role', 'button');
      profileItem.setAttribute('aria-label', `Selecionar perfil ${name}`);

      const savedPrefs = this.getProfilePreferences(name);
      
      profileItem.innerHTML = `
        <img src="${savedPrefs.profileImage}" alt="Avatar de ${name}" 
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff'">
        <span>${name}</span>
      `;

      profileItem.addEventListener('click', () => {
        this.selectProfile(name);
        Modal.close('selectPersonModal');
      });

      container.appendChild(profileItem);
    });
  }

  selectProfile(name) {
    if (!this.data.people.includes(name)) {
      Utils.showToast('Perfil não encontrado', 'error');
      return;
    }

    this.selectedProfile = name;
    localStorage.setItem('selectedProfile', name);

    // Aplicar preferências do perfil
    const prefs = this.getProfilePreferences(name);
    this.applyProfilePreferences(prefs);

    // Atualizar interface
    this.updateProfileUI(name, prefs);
    this.updateToggleButton();
    this.renderPersonalHistory();

    // Habilitar botão
    Utils.el('togglePaidBtn').disabled = false;

    Utils.showToast(`Perfil ${name} selecionado!`, 'success');
  }

  getProfilePreferences(name) {
    const defaultPrefs = {
      theme: 'dark',
      background: '',
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`
    };

    const saved = localStorage.getItem(`profile_${name}`);
    return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
  }

  saveProfilePreferences() {
    if (!this.selectedProfile) return;

    const prefs = {
      theme: Theme.getCurrentTheme(),
      background: Utils.el('backgroundInput').value || '',
      profileImage: Utils.el('profileImageInput').value || this.getProfilePreferences(this.selectedProfile).profileImage
    };

    localStorage.setItem(`profile_${this.selectedProfile}`, JSON.stringify(prefs));
  }

  applyProfilePreferences(prefs) {
    // Aplicar tema
    Theme.setTheme(prefs.theme);

    // Aplicar fundo
    if (prefs.background && Utils.isValidUrl(prefs.background)) {
      document.body.style.backgroundImage = `url(${prefs.background})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }

    // Atualizar campos de configuração
    Utils.el('backgroundInput').value = prefs.background || '';
    Utils.el('profileImageInput').value = prefs.profileImage || '';
  }

  updateProfileUI(name, prefs) {
    // Atualizar avatar
    const avatar = Utils.el('profileAvatar');
    avatar.innerHTML = `<img src="${prefs.profileImage}" alt="Avatar de ${name}" 
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff'">`;

    // Atualizar informações
    Utils.el('personName').textContent = name;
    Utils.el('profileStatus').textContent = 'Status: Ativo';
  }

  updateToggleButton() {
    const today = Utils.getTodayISO();
    const todayPayer = this.data.paidDates[today];
    const button = Utils.el('togglePaidBtn');
    const text = Utils.el('toggleButtonText');

    if (todayPayer === this.selectedProfile) {
      text.textContent = 'Bebida registrada hoje!';
      button.classList.add('success');
      button.classList.remove('danger');
    } else if (todayPayer) {
      text.textContent = `${todayPayer} já pagou hoje`;
      button.classList.add('danger');
      button.classList.remove('success');
    } else {
      text.textContent = 'Registrar minha bebida hoje';
      button.classList.remove('success', 'danger');
    }
  }

  async handleTogglePaid() {
    if (!this.selectedProfile) {
      Utils.showToast('Selecione um perfil primeiro', 'warning');
      this.showProfileSelection();
      return;
    }

    try {
      const result = await API.toggleTodayPayment(this.selectedProfile, {
        loadingElement: Utils.el('togglePaidBtn'),
        loadingText: 'Processando...'
      });

      if (result?.success) {
        this.data.paidDates = result.paidDates;
        this.renderAll();
      }
    } catch (error) {
      console.error('Erro ao registrar bebida:', error);
    }
  }

  handleLogout() {
    // Confirmar logout
    const modalId = ModalUtils.createConfirmModal(
      'Tem certeza que deseja sair? Suas preferências serão mantidas.',
      {
        title: 'Confirmar Logout',
        confirmText: 'Sair',
        cancelText: 'Cancelar',
        onConfirm: () => {
          this.performLogout();
        }
      }
    );
    
    Modal.open(modalId);
  }

  performLogout() {
    // Limpar dados da sessão
    localStorage.removeItem('selectedProfile');
    this.selectedProfile = null;

    // Resetar interface
    Utils.el('profileAvatar').innerHTML = '<i class="fas fa-user-circle"></i>';
    Utils.el('personName').textContent = 'Visitante';
    Utils.el('profileStatus').textContent = 'Status: Pendente';
    Utils.el('togglePaidBtn').disabled = true;
    Utils.el('toggleButtonText').textContent = 'Selecione um perfil para continuar';

    // Limpar estilos personalizados
    document.body.style.backgroundImage = '';
    Theme.setTheme('dark');

    // Mostrar seleção de perfil
    this.showProfileSelection();

    Utils.showToast('Logout realizado com sucesso', 'info');
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

  toggleHistory() {
    const content = Utils.el('historyContent');
    const icon = Utils.qs('#historyToggle i');
    
    content.classList.toggle('open');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
  }

  applyBackground() {
    const url = Utils.el('backgroundInput').value.trim();
    
    if (url && !Utils.isValidUrl(url)) {
      Utils.showToast('URL inválida para imagem de fundo', 'error');
      return;
    }

    if (url) {
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }

    this.saveProfilePreferences();
    Utils.showToast('Fundo aplicado com sucesso!', 'success');
  }

  clearBackground() {
    document.body.style.backgroundImage = '';
    Utils.el('backgroundInput').value = '';
    this.saveProfilePreferences();
    Utils.showToast('Fundo removido', 'info');
  }

  applyProfileImage() {
    const url = Utils.el('profileImageInput').value.trim();
    
    if (url && !Utils.isValidUrl(url)) {
      Utils.showToast('URL inválida para foto de perfil', 'error');
      return;
    }

    if (url && this.selectedProfile) {
      const avatar = Utils.el('profileAvatar');
      avatar.innerHTML = `<img src="${url}" alt="Avatar" 
                               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(this.selectedProfile)}&background=3B82F6&color=fff'">`;
      
      this.saveProfilePreferences();
      Utils.showToast('Foto de perfil atualizada!', 'success');
    }
  }

  clearProfileImage() {
    if (this.selectedProfile) {
      const defaultImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.selectedProfile)}&background=3B82F6&color=fff`;
      const avatar = Utils.el('profileAvatar');
      avatar.innerHTML = `<img src="${defaultImage}" alt="Avatar">`;
      
      Utils.el('profileImageInput').value = '';
      this.saveProfilePreferences();
      Utils.showToast('Foto de perfil removida', 'info');
    }
  }

  renderAll() {
    this.renderDailyStats();
    this.renderLeaderboard();
    this.renderCalendar();
    this.updateToggleButton();
    
    if (this.selectedProfile) {
      this.renderPersonalHistory();
    }
  }

  renderDailyStats() {
    // Dia do ano
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    Utils.el('dayOfTheYear').textContent = dayOfYear;

    // Bebidas registradas hoje
    const todayISO = Utils.getTodayISO();
    const paidToday = this.data.paidDates[todayISO] ? 1 : 0;
    Utils.el('paidPeopleCount').textContent = paidToday;
  }

  renderLeaderboard() {
    const list = Utils.el('leaderboard');
    
    if (!this.data.people || this.data.people.length === 0) {
      list.innerHTML = '<li class="list-item"><span>Nenhuma pessoa cadastrada</span></li>';
      return;
    }

    // Calcular pontuações
    const scores = {};
    this.data.people.forEach(person => scores[person] = 0);
    
    Object.values(this.data.paidDates).forEach(person => {
      if (scores[person] !== undefined) {
        scores[person]++;
      }
    });

    // Ordenar por pontuação
    const sortedScores = Object.entries(scores)
      .sort(([nameA, scoreA], [nameB, scoreB]) => {
        // Primeiro por pontuação (maior para menor)
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        // Em caso de empate, ordenar por nome (alfabética)
        return String(nameA).localeCompare(String(nameB));
      });

    // Renderizar lista
    list.innerHTML = '';
    sortedScores.forEach(([person, score], index) => {
      const item = document.createElement('li');
      item.className = 'list-item';
      
      const position = index + 1;
      let medal = '';
      if (position === 1) medal = '🥇';
      else if (position === 2) medal = '🥈';
      else if (position === 3) medal = '🥉';
      
      item.innerHTML = `
        <span class="person">${medal} ${position}. ${person}</span>
        <span class="score">${score} bebida${score !== 1 ? 's' : ''}</span>
      `;
      
      // Destacar perfil atual
      if (person === this.selectedProfile) {
        item.style.backgroundColor = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)';
      }
      
      list.appendChild(item);
    });
  }

  renderPersonalHistory() {
    const list = Utils.el('paidHistory');
    
    if (!this.selectedProfile) {
      list.innerHTML = '<li class="list-item"><span>Selecione um perfil para ver o histórico</span></li>';
      return;
    }

    // Filtrar datas do perfil atual
    const personalDates = Object.entries(this.data.paidDates)
      .filter(([, person]) => person === this.selectedProfile)
      .map(([date]) => date)
      .sort()
      .reverse()
      .slice(0, 20); // Últimas 20 entradas

    list.innerHTML = '';
    
    if (personalDates.length === 0) {
      list.innerHTML = '<li class="list-item"><span>Nenhuma bebida registrada ainda</span></li>';
      return;
    }

    personalDates.forEach(date => {
      const item = document.createElement('li');
      item.className = 'list-item';
      item.innerHTML = `
        <span>${Utils.formatDate(date)}</span>
        <i class="fas fa-check-circle" style="color: var(--accent-success);"></i>
      `;
      list.appendChild(item);
    });
  }

  renderCalendar() {
    const monthYear = Utils.el('monthYear');
    const grid = Utils.el('calendarGrid');
    
    if (!monthYear || !grid) {
      console.warn('Elementos do calendário não encontrados');
      return;
    }
    
    // Verificar se os dados estão disponíveis
    if (!this.data || !this.data.paidDates) {
      console.log('Dados não disponíveis ainda para o calendário');
      grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Carregando calendário...</span></div>';
      return;
    }
    
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
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BebidaEmDiaApp();
});


