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
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Erro ao inicializar aplicação', 'error');
      }
    }
  }

  setupModals() {
    if (typeof Modal === 'undefined') return;
    
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
    if (typeof Utils === 'undefined') return;
    
    // Botão de registrar bebida
    const togglePaidBtn = Utils.el('togglePaidBtn');
    if (togglePaidBtn) {
      togglePaidBtn.addEventListener('click', () => {
        this.handleTogglePaid();
      });
    }

    // Botão de logout
    const logoutBtn = Utils.el('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // Navegação do calendário
    const prevMonthBtn = Utils.el('prevMonthBtn');
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        this.navigateMonth(-1);
      });
    }

    const nextMonthBtn = Utils.el('nextMonthBtn');
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        this.navigateMonth(1);
      });
    }

    // Toggle do histórico
    const historyToggle = Utils.el('historyToggle');
    if (historyToggle) {
      historyToggle.addEventListener('click', () => {
        this.toggleHistory();
      });
    }

    // Menu mobile
    const menuToggle = Utils.qs('.menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        const navMenu = Utils.qs('.nav-menu');
        if (navMenu) {
          navMenu.classList.toggle('active');
        }
      });
    }

    // Configurações
    this.setupSettingsEvents();

    // Fechar modais com botões específicos
    const closeHelpModalBtn = Utils.el('closeHelpModalBtn');
    if (closeHelpModalBtn && typeof Modal !== 'undefined') {
      closeHelpModalBtn.addEventListener('click', () => {
        Modal.close('helpModal');
      });
    }
  }

  setupSettingsEvents() {
    if (typeof Utils === 'undefined') return;
    
    // Seletor de tema
    const themeSelector = Utils.el('themeSelector');
    if (themeSelector && typeof Theme !== 'undefined') {
      themeSelector.addEventListener('change', (e) => {
        if (this.selectedProfile) {
          Theme.setTheme(e.target.value);
          this.saveProfilePreferences();
        }
      });
    }

    // Aplicar fundo
    const applyBackgroundBtn = Utils.el('applyBackgroundBtn');
    if (applyBackgroundBtn) {
      applyBackgroundBtn.addEventListener('click', () => {
        this.applyBackground();
      });
    }

    // Limpar fundo
    const clearBackgroundBtn = Utils.el('clearBackgroundBtn');
    if (clearBackgroundBtn) {
      clearBackgroundBtn.addEventListener('click', () => {
        this.clearBackground();
      });
    }

    // Aplicar foto de perfil
    const applyProfileImageBtn = Utils.el('applyProfileImageBtn');
    if (applyProfileImageBtn) {
      applyProfileImageBtn.addEventListener('click', () => {
        this.applyProfileImage();
      });
    }

    // Limpar foto de perfil
    const clearProfileImageBtn = Utils.el('clearProfileImageBtn');
    if (clearProfileImageBtn) {
      clearProfileImageBtn.addEventListener('click', () => {
        this.clearProfileImage();
      });
    }
  }

  setupThemes() {
    if (typeof Utils === 'undefined' || typeof Theme === 'undefined') return;
    
    // Preencher seletor de temas
    const themeSelector = Utils.el('themeSelector');
    if (!themeSelector) return;
    
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
    if (typeof API === 'undefined') {
      console.warn('API não está disponível');
      this.data = { people: [], paidDates: {}, chat: [] };
      return;
    }
    
    try {
      const leaderboard = typeof Utils !== 'undefined' ? Utils.el('leaderboard') : null;
      
      this.data = await API.getData({
        loadingElement: leaderboard,
        loadingText: 'Carregando dados...'
      });
      
      if (!this.data) {
        throw new Error('Dados não carregados');
      }

      // Carregar próxima pessoa
      const nextPersonData = await API.getNextPerson();
      if (nextPersonData?.nextPerson && typeof Utils !== 'undefined') {
        const nextPersonName = Utils.el('nextPersonName');
        if (nextPersonName) {
          nextPersonName.textContent = nextPersonData.nextPerson;
        }
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
    try {
      const savedProfile = localStorage.getItem('selectedProfile');
      if (savedProfile && this.data.people.includes(savedProfile)) {
        this.selectProfile(savedProfile);
      } else {
        // Mostrar modal de seleção se não há perfil salvo
        this.showProfileSelection();
      }
    } catch (error) {
      console.error('Erro ao carregar perfil salvo:', error);
      this.showProfileSelection();
    }
  }

  showProfileSelection() {
    this.renderProfileList();
    if (typeof Modal !== 'undefined') {
      Modal.open('selectPersonModal');
    }
  }

  renderProfileList() {
    if (typeof Utils === 'undefined') return;
    
    const container = Utils.el('personSelectModalList');
    if (!container) return;
    
    if (!this.data.people || this.data.people.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Nenhum perfil disponível. Entre em contato com o administrador.</p>
        </div>
      `;
      return;
    }

    // Renderizar lista de pessoas
    container.innerHTML = this.data.people.map(person => `
      <div class="person-card" data-person="${person}">
        <div class="person-avatar">${person.charAt(0).toUpperCase()}</div>
        <div class="person-name">${person}</div>
      </div>
    `).join('');

    // Adicionar eventos de clique
    container.querySelectorAll('.person-card').forEach(card => {
      card.addEventListener('click', () => {
        const person = card.dataset.person;
        this.selectProfile(person);
        if (typeof Modal !== 'undefined') {
          Modal.close('selectPersonModal');
        }
      });
    });
  }

  selectProfile(name) {
    this.selectedProfile = name;
    try {
      localStorage.setItem('selectedProfile', name);
    } catch (error) {
      console.warn('Não foi possível salvar perfil no localStorage');
    }
    
    this.loadProfilePreferences();
    this.renderAll();
  }

  loadProfilePreferences() {
    if (!this.selectedProfile) return;
    
    try {
      const key = `profile_${this.selectedProfile}_preferences`;
      const prefs = localStorage.getItem(key);
      if (prefs) {
        const preferences = JSON.parse(prefs);
        if (preferences.theme && typeof Theme !== 'undefined') {
          Theme.setTheme(preferences.theme);
        }
        if (preferences.background) {
          this.applyCustomBackground(preferences.background);
        }
        if (preferences.profileImage) {
          this.applyCustomProfileImage(preferences.profileImage);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    }
  }

  saveProfilePreferences() {
    if (!this.selectedProfile) return;
    
    try {
      const key = `profile_${this.selectedProfile}_preferences`;
      const currentTheme = typeof Theme !== 'undefined' ? Theme.getCurrentTheme() : 'dark';
      const preferences = {
        theme: currentTheme,
        background: this.getCurrentBackground(),
        profileImage: this.getCurrentProfileImage()
      };
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  }

  getCurrentBackground() {
    const body = document.body;
    return body.style.backgroundImage || null;
  }

  getCurrentProfileImage() {
    if (typeof Utils === 'undefined') return null;
    const profileAvatar = Utils.el('profileAvatar');
    return profileAvatar ? (profileAvatar.style.backgroundImage || null) : null;
  }

  applyCustomBackground(background) {
    document.body.style.backgroundImage = background;
  }

  applyCustomProfileImage(profileImage) {
    if (typeof Utils === 'undefined') return;
    const profileAvatar = Utils.el('profileAvatar');
    if (profileAvatar) {
      profileAvatar.style.backgroundImage = profileImage;
    }
  }

  applyBackground() {
    if (typeof Utils === 'undefined') return;
    const backgroundUrl = Utils.el('backgroundUrl');
    if (!backgroundUrl || !backgroundUrl.value.trim()) {
      if (Utils.showToast) {
        Utils.showToast('Por favor, insira uma URL válida', 'error');
      }
      return;
    }
    document.body.style.backgroundImage = `url(${backgroundUrl.value})`;
    this.saveProfilePreferences();
    if (Utils.showToast) {
      Utils.showToast('Fundo aplicado com sucesso!', 'success');
    }
  }

  clearBackground() {
    document.body.style.backgroundImage = '';
    this.saveProfilePreferences();
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast('Fundo removido', 'info');
    }
  }

  applyProfileImage() {
    if (typeof Utils === 'undefined') return;
    const profileImageUrl = Utils.el('profileImageUrl');
    if (!profileImageUrl || !profileImageUrl.value.trim()) {
      if (Utils.showToast) {
        Utils.showToast('Por favor, insira uma URL válida', 'error');
      }
      return;
    }
    const profileAvatar = Utils.el('profileAvatar');
    if (profileAvatar) {
      profileAvatar.style.backgroundImage = `url(${profileImageUrl.value})`;
      this.saveProfilePreferences();
      if (Utils.showToast) {
        Utils.showToast('Foto de perfil aplicada!', 'success');
      }
    }
  }

  clearProfileImage() {
    if (typeof Utils === 'undefined') return;
    const profileAvatar = Utils.el('profileAvatar');
    if (profileAvatar) {
      profileAvatar.style.backgroundImage = '';
      this.saveProfilePreferences();
      if (Utils.showToast) {
        Utils.showToast('Foto de perfil removida', 'info');
      }
    }
  }

  handleLogout() {
    this.selectedProfile = null;
    try {
      localStorage.removeItem('selectedProfile');
    } catch (error) {
      console.warn('Não foi possível remover perfil do localStorage');
    }
    this.showProfileSelection();
  }

  async handleTogglePaid() {
    if (!this.selectedProfile) {
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast('Selecione um perfil primeiro', 'error');
      }
      return;
    }

    if (typeof API === 'undefined') {
      console.error('API não disponível');
      return;
    }

    try {
      const toggleBtn = typeof Utils !== 'undefined' ? Utils.el('togglePaidBtn') : null;
      const result = await API.toggleTodayPayment(this.selectedProfile, {
        loadingElement: toggleBtn
      });
      
      if (result.success) {
        await this.loadInitialData();
        this.renderAll();
      }
    } catch (error) {
      console.error('Erro ao registrar bebida:', error);
    }
  }

  navigateMonth(direction) {
    this.currentMonth += direction;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.renderCalendar();
  }

  toggleHistory() {
    if (typeof Utils === 'undefined') return;
    const historySection = Utils.el('historySection');
    if (historySection) {
      historySection.classList.toggle('expanded');
    }
  }

  renderAll() {
    this.renderProfile();
    this.renderStats();
    this.renderLeaderboard();
    this.renderCalendar();
    this.renderHistory();
  }

  renderProfile() {
    if (!this.selectedProfile || typeof Utils === 'undefined') return;
    
    const profileName = Utils.el('profileName');
    if (profileName) {
      profileName.textContent = this.selectedProfile;
    }
    
    const profileAvatar = Utils.el('profileAvatar');
    if (profileAvatar) {
      profileAvatar.textContent = this.selectedProfile.charAt(0).toUpperCase();
    }
  }

  renderStats() {
    if (!this.data || typeof Utils === 'undefined') return;
    
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
    
    // Total de bebidas hoje
    const todayCount = Object.keys(this.data.paidDates).filter(date => 
      date === today
    ).length;
    
    const totalBebidasEl = Utils.el('totalBebidas');
    if (totalBebidasEl) {
      totalBebidasEl.textContent = todayCount;
    }
    
    // Dia do ano
    const start = new Date(this.currentYear, 0, 0);
    const diff = new Date() - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const diaDoAnoEl = Utils.el('diaDoAno');
    if (diaDoAnoEl) {
      diaDoAnoEl.textContent = dayOfYear;
    }
  }

  renderLeaderboard() {
    if (!this.data || !this.data.people || typeof Utils === 'undefined') return;
    
    const leaderboard = Utils.el('leaderboard');
    if (!leaderboard) return;
    
    // Calcular contagem
    const counts = {};
    this.data.people.forEach(person => {
      counts[person] = Object.values(this.data.paidDates).filter(p => p === person).length;
    });
    
    // Ordenar
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (sorted.length === 0) {
      leaderboard.innerHTML = '<div class="empty-state">Nenhuma pessoa cadastrada</div>';
      return;
    }
    
    leaderboard.innerHTML = sorted.map(([person, count], index) => `
      <div class="ranking-item">
        <span class="ranking-position">#${index + 1}</span>
        <span class="ranking-name">${person}</span>
        <span class="ranking-count">${count}</span>
      </div>
    `).join('');
  }

  renderCalendar() {
    if (!this.data || typeof Utils === 'undefined') return;
    
    const calendar = Utils.el('calendar');
    if (!calendar) return;
    
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    let html = '<div class="calendar-grid">';
    
    // Dias da semana
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startingDayOfWeek; i++) {
      html += '<div class="calendar-day empty"></div>';
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const person = this.data.paidDates[dateStr];
      const hasPayment = !!person;
      
      html += `
        <div class="calendar-day ${hasPayment ? 'paid' : ''}">
          <span class="day-number">${day}</span>
          ${hasPayment ? `<span class="day-person">${person}</span>` : ''}
        </div>
      `;
    }
    
    html += '</div>';
    calendar.innerHTML = html;
    
    // Atualizar título do mês
    const monthYearEl = Utils.el('currentMonthYear');
    if (monthYearEl) {
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                         'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      monthYearEl.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
    }
  }

  renderHistory() {
    if (!this.selectedProfile || !this.data || typeof Utils === 'undefined') return;
    
    const historyList = Utils.el('historyList');
    if (!historyList) return;
    
    const personalHistory = Object.entries(this.data.paidDates)
      .filter(([date, person]) => person === this.selectedProfile)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));
    
    if (personalHistory.length === 0) {
      historyList.innerHTML = '<div class="empty-state">Nenhum histórico encontrado</div>';
      return;
    }
    
    historyList.innerHTML = personalHistory.map(([date]) => {
      const dateObj = new Date(date + 'T00:00:00');
      return `
        <div class="history-item">
          <span class="history-date">${dateObj.toLocaleDateString('pt-BR')}</span>
        </div>
      `;
    }).join('');
  }
}

// Inicializar aplicação quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new BebidaEmDiaApp();
  });
} else {
  window.app = new BebidaEmDiaApp();
}
