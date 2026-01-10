class ThemeManager {
  constructor() {
    // Mantém os 3 que você já tinha no CSS + adiciona 10 novos
    this.themeMeta = {
      dark:         { name: "Escuro",        accentRgb: "59,130,246" },
      light:        { name: "Claro",         accentRgb: "37,99,235" },
      cyberpunk:    { name: "Cyberpunk",     accentRgb: "255,51,196" },
      dracula:      { name: "Dracula",       accentRgb: "189,147,249" },

      aurora:       { name: "Aurora",        accentRgb: "32,227,178" },
      matrix:       { name: "Matrix",        accentRgb: "57,255,20" },
      sakura:       { name: "Sakura",        accentRgb: "255,77,141" },
      desert:       { name: "Desert",        accentRgb: "255,138,0" },
      glacier:      { name: "Glacier",       accentRgb: "76,201,240" },
      espresso:     { name: "Espresso",      accentRgb: "212,163,115" },
      "neon-lime":  { name: "Neon Lime",     accentRgb: "198,255,0" },
      "deep-ocean": { name: "Deep Ocean",    accentRgb: "0,212,255" },
      "royal-purple": { name: "Royal Purple", accentRgb: "124,58,237" },
      copper:       { name: "Copper",        accentRgb: "255,107,53" }
    };

    this.themes = Object.keys(this.themeMeta);
    this.currentTheme = "dark";
    this.callbacks = [];
    this.init();
  }

  init() {
    const saved = localStorage.getItem("selectedTheme");
    if (saved && this.themes.includes(saved)) {
      this.setTheme(saved, false);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.setTheme(prefersDark ? "dark" : "light", false);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("selectedTheme")) {
        this.setTheme(e.matches ? "dark" : "light", false);
      }
    });
  }

  setTheme(theme, save = true) {
    if (!this.themes.includes(theme)) theme = "dark";
    this.currentTheme = theme;

    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) document.body.setAttribute("data-theme", theme);

    if (save) localStorage.setItem("selectedTheme", theme);

    this.callbacks.forEach((cb) => {
      try { cb(theme); } catch (e) { console.error(e); }
    });

    window.dispatchEvent(new CustomEvent("themeChanged", {
      detail: { theme, themeName: this.getThemeName(theme) }
    }));
  }

  getCurrentTheme() { return this.currentTheme; }

  getThemeName(theme) {
    return this.themeMeta[theme]?.name || theme;
  }

  getThemeAccentRgb(theme) {
    return this.themeMeta[theme]?.accentRgb || "59,130,246";
  }

  getAvailableThemes() {
    return this.themes.map((id) => ({
      id,
      name: this.getThemeName(id),
      accentRgb: this.getThemeAccentRgb(id)
    }));
  }

  onThemeChange(cb) {
    if (typeof cb === "function") this.callbacks.push(cb);
  }
}

window.Theme = new ThemeManager();
