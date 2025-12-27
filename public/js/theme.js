// --- Módulo de Gerenciamento de Temas - v2.1 TEMAS AVANÇADOS ---

class ThemeManager {
    constructor() {
        this.themes = [
            'halloween',      // Tema atual (Orange/Purple/Black)
            'retro-70s',      // Novo: 70s retrô com laranja queimado e marrom
            'cyberpunk-pink', // Novo: Neon pink/cyan ultra futurista
            'vaporwave',      // Novo: Pastel retrowave anos 80/90
            'matrix',         // Novo: Verde matrix hacker style
            'synthwave',      // Novo: Neon roxo/rosa/azul synthwave
            'dark-minimal',   // Novo: Minimalista total preto/cinza
            'forest-moss',    // Novo: Verde floresta natural
            'sunset-beach',   // Novo: Gradiente pôr do sol
            'cosmic-space',   // Novo: Espaço cósmico roxo/azul
            'fire-lava',      // Novo: Fogo com vermelho/laranja/amarelo
            'ocean-deep',     // Novo: Oceano profundo azul
            'cotton-candy',   // Novo: Rosa doce e ciano pastel
            'nord',           // Mantido
            'dracula'         // Mantido
        ];

        this.themeNames = {
            'halloween': '🎃 Halloween',
            'retro-70s': '📻 Retro 70s',
            'cyberpunk-pink': '💖 Cyberpunk Pink',
            'vaporwave': '🌊 Vaporwave',
            'matrix': '💚 Matrix',
            'synthwave': '🌌 Synthwave',
            'dark-minimal': '⬛ Minimalista',
            'forest-moss': '🌲 Floresta',
            'sunset-beach': '🌅 Pôr do Sol',
            'cosmic-space': '🌌 Cósmico',
            'fire-lava': '🔥 Fogo',
            'ocean-deep': '🌊 Oceano',
            'cotton-candy': '🍭 Algodão Doce',
            'nord': '❄️ Nord',
            'dracula': '🧛 Dracula'
        };

        this.currentTheme = 'halloween';
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
            this.setTheme(prefersDark ? 'halloween' : 'cotton-candy', false);
        }

        // Escutar mudanças na preferência do sistema
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getSavedTheme()) {
                this.setTheme(e.matches ? 'halloween' : 'cotton-candy', false);
            }
        });
    }

    getSavedTheme() {
        return localStorage.getItem('selectedTheme');
    }

    saveTheme(theme) {
        localStorage.setItem('selectedTheme', theme);
    }

    setTheme(theme, save = true) {
        if (!this.themes.includes(theme)) {
            console.warn(`Tema '${theme}' não encontrado. Usando tema padrão.`);
            theme = 'halloween';
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

    getCurrentTheme() {
        return this.currentTheme;
    }

    getThemeName(theme) {
        return this.themeNames[theme] || theme;
    }

    getAvailableThemes() {
        return this.themes.map(theme => ({
            id: theme,
            name: this.getThemeName(theme)
        }));
    }

    toggleDarkMode() {
        const newTheme = this.currentTheme === 'cotton-candy' ? 'halloween' : 'cotton-candy';
        this.setTheme(newTheme);
    }

    nextTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.setTheme(this.themes[nextIndex]);
    }

    previousTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const prevIndex = currentIndex === 0 ? this.themes.length - 1 : currentIndex - 1;
        this.setTheme(this.themes[prevIndex]);
    }

    randomTheme() {
        const availableThemes = this.themes.filter(theme => theme !== this.currentTheme);
        const randomIndex = Math.floor(Math.random() * availableThemes.length);
        this.setTheme(availableThemes[randomIndex]);
    }

    onThemeChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }

    removeThemeChangeCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }

    isDarkTheme(theme = this.currentTheme) {
        const darkThemes = ['halloween', 'retro-70s', 'cyberpunk-pink', 'matrix', 'synthwave', 'dark-minimal', 'nord', 'dracula', 'cosmic-space', 'fire-lava', 'ocean-deep'];
        return darkThemes.includes(theme);
    }

    isLightTheme(theme = this.currentTheme) {
        return !this.isDarkTheme(theme);
    }

    getPrimaryColor() {
        const computedStyle = getComputedStyle(document.documentElement);
        return computedStyle.getPropertyValue('--accent-primary').trim();
    }

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

    applyCustomTheme(customColors) {
        const root = document.documentElement;
        Object.entries(customColors).forEach(([property, value]) => {
            root.style.setProperty(`--${property}`, value);
        });
    }

    resetToDefault() {
        this.setTheme('halloween');
    }

    exportThemeConfig() {
        return {
            theme: this.currentTheme,
            colors: this.getThemeColors(),
            timestamp: new Date().toISOString()
        };
    }

    importThemeConfig(config) {
        if (config.theme && this.themes.includes(config.theme)) {
            this.setTheme(config.theme);
            return true;
        }
        return false;
    }
}

// --- Utilitários de Tema ---

function createThemeSelector(containerId, options = {}) {
    const container = Utils.el(containerId);
    if (!container) {
        console.error(`Container ${containerId} não encontrado`);
        return null;
    }

    const { showLabels = true, showPreview = false, className = 'theme-selector' } = options;
    const selector = document.createElement('div');
    selector.className = className;

    const themes = Theme.getAvailableThemes();
    themes.forEach(({ id, name }) => {
        const themeOption = document.createElement('button');
        themeOption.className = 'theme-option';
        themeOption.dataset.theme = id;
        themeOption.setAttribute('aria-label', `Selecionar tema ${name}`);

        if (showPreview) {
            themeOption.innerHTML = `${showLabels ? `${name}` : ''} `;
        } else {
            themeOption.textContent = name;
        }

        if (id === Theme.getCurrentTheme()) {
            themeOption.classList.add('active');
        }

        themeOption.addEventListener('click', () => {
            Theme.setTheme(id);
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
        toggle.innerHTML = ` ${isDark ? 'Modo Claro' : 'Modo Escuro'} `;
    };

    updateToggle();

    toggle.addEventListener('click', () => {
        Theme.toggleDarkMode();
        updateToggle();
    });

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