// --- Módulo de Gerenciamento de Temas ---

class ThemeManager {
  constructor() {
    this.themes = [
      'dark', 'light', 'nord', 'cyberpunk', 'dracula', 
      'solarized-light', 'gruvbox-dark', 'oceanic', 
      'monokai', 'synthwave', 'forest', 'aura', 'midnight'
    ];
    
    this.themeNames = {
      'dark': 'Escuro',
      'light': 'Claro',
      'nord': 'Nord',
      'cyberpunk': 'Cyberpunk',
      'dracula': 'Dracula',
      'solarized-light': 'Solarized Light',
      'gruvbox-dark': 'Gruvbox Dark',
      'oceanic': 'Oceânico',
      'monokai': 'Monokai',
      'synthwave': 'Synthwave',
      'forest': 'Floresta',
      'aura': 'Aura',
      'midnight': 'Meia-noite'
    };

    this.currentTheme = 'dark';
    this.callbacks = [];
    
    this.init();
  }

  init() {
    // Carregar tema salvo
    const savedTheme = this.getSavedTheme();
    if (savedTheme && this.themes.includes(savedTheme)) {
      this.setTheme(savedTheme, false);
    }

    // Detectar preferência do sistema se não houver tema salvo
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light', false);
    }

    // Escutar mudanças na preferência do sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!this.getSavedTheme()) {
        this.setTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  // Obter tema salvo do localStorage
  getSavedTheme() {
    return localStorage.getItem('selectedTheme');
  }

  // Salvar tema no localStorage
  saveTheme(theme) {
    localStorage.setItem('selectedTheme', theme);
  }

  // Definir tema atual
  setTheme(theme, save = true) {
    if (!this.themes.includes(theme)) {
      console.warn(`Tema '${theme}' não encontrado. Usando tema padrão.`);
      theme = 'dark';
    }

    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    if (save) {
      this.saveTheme(theme);
    }

    // Notificar callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('Erro no callback de tema:', error);
      }
    });

    // Disparar evento customizado
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme, themeName: this.getThemeName(theme) }
    }));
  }

  // Obter tema atual
  getCurrentTheme() {
    return this.currentTheme;
  }

  // Obter nome amigável do tema
  getThemeName(theme) {
    return this.themeNames[theme] || theme;
  }

  // Obter lista de temas disponíveis
  getAvailableThemes() {
    return this.themes.map(theme => ({
      id: theme,
      name: this.getThemeName(theme)
    }));
  }

  // Alternar entre claro e escuro
  toggleDarkMode() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  // Próximo tema na lista
  nextTheme() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.setTheme(this.themes[nextIndex]);
  }

  // Tema anterior na lista
  previousTheme() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const prevIndex = currentIndex === 0 ? this.themes.length - 1 : currentIndex - 1;
    this.setTheme(this.themes[prevIndex]);
  }

  // Tema aleatório
  randomTheme() {
    const availableThemes = this.themes.filter(theme => theme !== this.currentTheme);
    const randomIndex = Math.floor(Math.random() * availableThemes.length);
    this.setTheme(availableThemes[randomIndex]);
  }

  // Adicionar callback para mudanças de tema
  onThemeChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }

  // Remover callback
  removeThemeChangeCallback(callback) {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  // Verificar se é tema escuro
  isDarkTheme(theme = this.currentTheme) {
    const darkThemes = ['dark', 'nord', 'cyberpunk', 'dracula', 'gruvbox-dark', 'oceanic', 'monokai', 'synthwave', 'forest', 'aura', 'midnight'];
    return darkThemes.includes(theme);
  }

  // Verificar se é tema claro
  isLightTheme(theme = this.currentTheme) {
    return !this.isDarkTheme(theme);
  }

  // Obter cor primária do tema atual
  getPrimaryColor() {
    const computedStyle = getComputedStyle(document.documentElement);
    return computedStyle.getPropertyValue('--accent-primary').trim();
  }

  // Obter todas as cores do tema atual
  getThemeColors() {
    const computedStyle = getComputedStyle(document.documentElement);
    return {
      bg: computedStyle.getPropertyValue('--bg').trim(),
      panel: computedStyle.getPropertyValue('--panel').trim(),
      border: computedStyle.getPropertyValue('--border').trim(),
      textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
      textSecondary: computedStyle.getPropertyValue('--text-secondary').trim(),
      textMuted: computedStyle.getPropertyValue('--text-muted').trim(),
      accentPrimary: computedStyle.getPropertyValue('--accent-primary').trim(),
      accentDanger: computedStyle.getPropertyValue('--accent-danger').trim(),
      accentSuccess: computedStyle.getPropertyValue('--accent-success').trim()
    };
  }

  // Aplicar tema personalizado (para futuras extensões)
  applyCustomTheme(customColors) {
    const root = document.documentElement;
    
    Object.entries(customColors).forEach(([property, value]) => {
      root.style.setProperty(`--${property}`, value);
    });
  }

  // Resetar para tema padrão
  resetToDefault() {
    this.setTheme('dark');
  }

  // Exportar configuração atual
  exportThemeConfig() {
    return {
      theme: this.currentTheme,
      colors: this.getThemeColors(),
      timestamp: new Date().toISOString()
    };
  }

  // Importar configuração
  importThemeConfig(config) {
    if (config.theme && this.themes.includes(config.theme)) {
      this.setTheme(config.theme);
      return true;
    }
    return false;
  }
}

// --- Utilitários de Tema ---

// Criar seletor de tema
function createThemeSelector(containerId, options = {}) {
  const container = Utils.el(containerId);
  if (!container) {
    console.error(`Container ${containerId} não encontrado`);
    return null;
  }

  const {
    showLabels = true,
    showPreview = false,
    className = 'theme-selector'
  } = options;

  const selector = document.createElement('div');
  selector.className = className;

  const themes = Theme.getAvailableThemes();
  
  themes.forEach(({ id, name }) => {
    const themeOption = document.createElement('button');
    themeOption.className = 'theme-option';
    themeOption.dataset.theme = id;
    themeOption.setAttribute('aria-label', `Selecionar tema ${name}`);
    
    if (showPreview) {
      themeOption.innerHTML = `
        <div class="theme-preview" data-theme="${id}"></div>
        ${showLabels ? `<span class="theme-name">${name}</span>` : ''}
      `;
    } else {
      themeOption.textContent = name;
    }

    if (id === Theme.getCurrentTheme()) {
      themeOption.classList.add('active');
    }

    themeOption.addEventListener('click', () => {
      Theme.setTheme(id);
      
      // Atualizar estado ativo
      selector.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('active');
      });
      themeOption.classList.add('active');
    });

    selector.appendChild(themeOption);
  });

  container.appendChild(selector);
  return selector;
}

// Criar toggle de tema escuro/claro
function createDarkModeToggle(containerId) {
  const container = Utils.el(containerId);
  if (!container) {
    console.error(`Container ${containerId} não encontrado`);
    return null;
  }

  const toggle = document.createElement('button');
  toggle.className = 'dark-mode-toggle';
  toggle.setAttribute('aria-label', 'Alternar modo escuro');
  
  const updateToggle = () => {
    const isDark = Theme.isDarkTheme();
    toggle.innerHTML = `
      <i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>
      <span>${isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
    `;
  };

  updateToggle();

  toggle.addEventListener('click', () => {
    Theme.toggleDarkMode();
    updateToggle();
  });

  // Escutar mudanças de tema
  Theme.onThemeChange(updateToggle);

  container.appendChild(toggle);
  return toggle;
}

// Instância global
window.Theme = new ThemeManager();

// Utilitários globais
window.ThemeUtils = {
  createThemeSelector,
  createDarkModeToggle
};

