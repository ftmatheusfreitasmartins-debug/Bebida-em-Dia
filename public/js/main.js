// --- Aplicação Principal - Bebida em Dia (Home + Ranking + Modal de Perfil melhorado) ---
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
      this.setupModals();
      this.setupEventListeners();
      this.renderThemeOptions();
      await this.loadInitialData();
      this.loadSavedProfile();
      this.renderAll();
      console.log("✅ Aplicação inicializada com sucesso");
    } catch (error) {
      console.error("Erro na inicialização", error);
      Utils.showToast("Erro ao inicializar aplicação", "error");
    }
  }

  setupModals() {
    Modal.setupModal("selectPersonModal", { closeOnBackdrop: false, closeOnEscape: true });
    Modal.setupModal("themeModal", { closeOnBackdrop: true, closeOnEscape: true });
  }

  setupEventListeners() {
    // Registrar bebida
    Utils.el("togglePaidBtn")?.addEventListener("click", () => this.handleTogglePaid());

    // Logout/trocar perfil
    Utils.el("logoutBtn")?.addEventListener("click", () => this.handleLogout());

    // Fechar modal de perfil
    Utils.el("closePersonModal")?.addEventListener("click", () => {
      if (!this.selectedProfile) return;
      Modal.close("selectPersonModal");
    });

    // Calendário
    Utils.el("prevMonthBtn")?.addEventListener("click", () => this.navigateMonth(-1));
    Utils.el("nextMonthBtn")?.addEventListener("click", () => this.navigateMonth(1));

    // Histórico accordion
    Utils.el("historyToggle")?.addEventListener("click", () => this.toggleHistory());

    // Temas
    Utils.el("openThemeModal")?.addEventListener("click", () => Modal.open("themeModal"));
    Utils.el("closeThemeModal")?.addEventListener("click", () => Modal.close("themeModal"));

    // Re-render quando o tema mudar (pra manter "ativo" marcado)
    Theme.onThemeChange(() => this.renderThemeOptions());

    // Busca do modal (re-render sem duplicar binding)
    const search = Utils.el("personSearchInput");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", () => this.renderProfileList());
    }
  }

renderThemeOptions() {
  const container = Utils.el("themeOptions");
  if (!container) return;

  const themes = Theme.getAvailableThemes();
  const current = Theme.getCurrentTheme();

  container.innerHTML = `
    <div class="theme-grid">
      ${themes
        .map(
          (t) => `
        <button
          class="theme-pill ${t.id === current ? "active" : ""}"
          type="button"
          data-theme="${t.id}"
          style="--pill-accent-rgb: ${t.accentRgb};"
        >
          <span class="theme-pill-name">${t.name}</span>
          <span class="theme-pill-id">${t.id}</span>
        </button>
      `
        )
        .join("")}
    </div>
  `;

  container.querySelectorAll(".theme-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const themeId = btn.getAttribute("data-theme");
      Theme.setTheme(themeId);
    });
  });

    container.querySelectorAll(".theme-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const themeId = btn.getAttribute("data-theme");
        Theme.setTheme(themeId);
      });
    });
  }

  async loadInitialData() {
    try {
      this.data = await API.getData({
        loadingElement: Utils.el("calendarGrid"),
        loadingText: "Carregando dados...",
        showToast: false,
      });

      if (!this.data) throw new Error("Dados não carregados");

      const nextPersonData = await API.getNextPerson({ showToast: false });
      if (nextPersonData?.nextPerson) {
        Utils.el("nextPersonName").textContent = nextPersonData.nextPerson;
      }
    } catch (error) {
      console.error("Erro ao carregar dados", error);
      Utils.showToast("Erro ao carregar dados", "error");
      this.data = { people: [], paidDates: {}, chat: [] };
    }
  }

  loadSavedProfile() {
    const savedProfile = localStorage.getItem("selectedProfile");
    if (savedProfile && this.data?.people?.includes(savedProfile)) {
      this.selectProfile(savedProfile);
      return;
    }
    this.showProfileSelection();
  }

  showProfileSelection() {
    this.renderProfileList();
    Modal.open("selectPersonModal");

    // Foco no input de busca
    setTimeout(() => {
      const input = Utils.el("personSearchInput");
      if (input) input.focus();
    }, 50);
  }

  renderProfileList() {
    const container = Utils.el("personSelectModalList");
    if (!container) return;

    const input = Utils.el("personSearchInput");
    const q = (input?.value || "").trim().toLowerCase();

    const allPeople = this.data?.people || [];
    if (allPeople.length === 0) {
      container.innerHTML = `
        <div class="profile-item-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Nenhum perfil disponível. Entre em contato com o administrador.</p>
        </div>
      `;
      return;
    }

    const people = allPeople.filter((name) => name.toLowerCase().includes(q));

    container.innerHTML = "";
    if (people.length === 0) {
      container.innerHTML = `
        <div class="profile-item-error">
          <i class="fas fa-circle-info"></i>
          <p>Nenhum perfil encontrado.</p>
        </div>
      `;
      return;
    }

    people.forEach((name) => {
      const profileItem = document.createElement("div");
      profileItem.className = "profile-item";
      profileItem.dataset.profileName = name;
      profileItem.setAttribute("role", "button");
      profileItem.setAttribute("aria-label", `Selecionar perfil ${name}`);
      profileItem.tabIndex = 0;

      if (name === this.selectedProfile) {
        profileItem.classList.add("active");
        profileItem.setAttribute("aria-current", "true");
      }

      const avatarUrl = `https://ui-avatars.com/api?name=${encodeURIComponent(
        name
      )}&background=3B82F6&color=fff`;

      profileItem.innerHTML = `<img src="${avatarUrl}" alt="Avatar de ${name}" /><span>${Utils.sanitizeText(
        name
      )}</span>`;

      const activate = () => {
        this.selectProfile(name);
        Modal.close("selectPersonModal");
      };

      profileItem.addEventListener("click", activate);
      profileItem.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });

      container.appendChild(profileItem);
    });
  }

  selectProfile(name) {
    if (!this.data?.people?.includes(name)) {
      Utils.showToast("Perfil não encontrado", "error");
      return;
    }

    this.selectedProfile = name;
    localStorage.setItem("selectedProfile", name);

    const avatar = Utils.el("profileAvatar");
    if (avatar) {
      const url = `https://ui-avatars.com/api?name=${encodeURIComponent(
        name
      )}&background=3B82F6&color=fff`;
      avatar.innerHTML = `<img src="${url}" alt="Avatar de ${name}" />`;
    }

    Utils.el("personName").textContent = name;
    Utils.el("profileStatus").textContent = "Perfil ativo";

    const btn = Utils.el("togglePaidBtn");
    if (btn) btn.disabled = false;

    this.updateToggleButton();
    this.renderPersonalHistory();
    this.updateTodayChip();
    this.renderRanking();

    Utils.showToast(`Perfil ${name} selecionado!`, "success");
  }

  updateTodayChip() {
    const chip = Utils.el("todayChip");
    if (!chip) return;

    if (!this.selectedProfile) {
      chip.innerHTML = `<i class="fas fa-circle-info"></i><span>Selecione um perfil</span>`;
      return;
    }

    const todayISO = Utils.getTodayISO();
    const payer = this.data?.paidDates?.[todayISO];

    if (!payer) {
      chip.innerHTML = `<i class="fas fa-circle-xmark"></i><span>Sem registro hoje</span>`;
      return;
    }

    if (payer === this.selectedProfile) {
      chip.innerHTML = `<i class="fas fa-circle-check"></i><span>Você registrou hoje</span>`;
      return;
    }

    chip.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>${Utils.sanitizeText(
      payer
    )} já registrou</span>`;
  }

  updateToggleButton() {
    const todayISO = Utils.getTodayISO();
    const todayPayer = this.data?.paidDates?.[todayISO];

    const button = Utils.el("togglePaidBtn");
    const text = Utils.el("toggleButtonText");
    if (!button || !text) return;

    button.classList.remove("success", "danger");

    if (!this.selectedProfile) {
      text.textContent = "Selecione um perfil para continuar";
      button.disabled = true;
      return;
    }

    button.disabled = false;

    if (todayPayer === this.selectedProfile) {
      text.textContent = "Bebida registrada hoje!";
      button.classList.add("success");
      return;
    }

    if (todayPayer) {
      text.textContent = `${todayPayer} já pagou hoje`;
      button.classList.add("danger");
      return;
    }

    text.textContent = "Registrar minha bebida hoje";
  }

  async handleTogglePaid() {
    if (!this.selectedProfile) {
      Utils.showToast("Selecione um perfil primeiro", "warning");
      this.showProfileSelection();
      return;
    }

    try {
      const result = await API.toggleTodayPayment(this.selectedProfile, {
        loadingElement: Utils.el("togglePaidBtn"),
        loadingText: "Processando...",
      });

      if (result?.success) {
        this.data.paidDates = result.paidDates;
        this.renderAll();
      }
    } catch (error) {
      console.error("Erro ao registrar bebida", error);
      Utils.showToast("Erro ao registrar bebida", "error");
    }
  }

  handleLogout() {
    const modalId = ModalUtils.createConfirmModal({
      title: "Trocar perfil",
      message: "Deseja sair do perfil atual e escolher outro?",
      confirmText: "Trocar",
      cancelText: "Cancelar",
      onConfirm: () => this.performLogout(),
    });

    Modal.open(modalId);
  }

  performLogout() {
    localStorage.removeItem("selectedProfile");
    this.selectedProfile = null;

    Utils.el("profileAvatar").innerHTML = `<i class="fas fa-user-circle"></i>`;
    Utils.el("personName").textContent = "Visitante";
    Utils.el("profileStatus").textContent = "Selecione um perfil";

    const btn = Utils.el("togglePaidBtn");
    if (btn) btn.disabled = true;

    const text = Utils.el("toggleButtonText");
    if (text) text.textContent = "Selecione um perfil para continuar";

    this.updateTodayChip();
    this.renderPersonalHistory();
    this.renderRanking();
    this.showProfileSelection();

    Utils.showToast("Perfil removido", "info");
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
    const content = Utils.el("historyContent");
    const toggle = Utils.el("historyToggle");
    const icon = toggle?.querySelector("i");
    if (!content || !toggle || !icon) return;

    content.classList.toggle("active");
    toggle.classList.toggle("active");
    icon.classList.toggle("fa-chevron-down");
    icon.classList.toggle("fa-chevron-up");
  }

  renderAll() {
    this.renderDailyStats();
    this.renderRanking();
    this.renderCalendar();
    this.updateToggleButton();
    this.updateTodayChip();
    if (this.selectedProfile) this.renderPersonalHistory();
  }

  renderDailyStats() {
    const now = new Date();

    const todayDate = Utils.el("todayDate");
    if (todayDate) {
      todayDate.textContent = now.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    // Dia do ano
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / 1000 / 60 / 60 / 24);
    const dayEl = Utils.el("dayOfTheYear");
    if (dayEl) dayEl.textContent = String(dayOfYear);

    // Pagamentos hoje (simples: 0 ou 1)
    const todayISO = Utils.getTodayISO();
    const paidToday = this.data?.paidDates?.[todayISO] ? 1 : 0;
    const paidEl = Utils.el("paidPeopleCount");
    if (paidEl) paidEl.textContent = String(paidToday);
  }

  renderRanking() {
    const list = Utils.el("rankingList");
    if (!list) return;

    const people = this.data?.people || [];
    if (people.length === 0) {
      list.innerHTML = `
        <li class="list-item">
          <span class="person">Nenhuma pessoa cadastrada</span>
          <span class="score">0</span>
        </li>
      `;
      return;
    }

    const scores = {};
    people.forEach((p) => (scores[p] = 0));

    Object.values(this.data?.paidDates || {}).forEach((payer) => {
      if (scores[payer] !== undefined) scores[payer]++;
    });

    const ranking = Object.entries(scores).sort((a, b) => {
      const diff = b[1] - a[1];
      if (diff !== 0) return diff;
      return a[0].localeCompare(b[0], "pt-BR");
    });

    list.innerHTML = "";
    ranking.forEach(([name, count]) => {
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `
        <span class="person">${Utils.sanitizeText(name)}</span>
        <span class="score">${count}</span>
      `;
      list.appendChild(item);
    });
  }

  renderPersonalHistory() {
    const list = Utils.el("paidHistory");
    const toggle = Utils.el("historyToggle");
    if (!list || !toggle) return;

    if (!this.selectedProfile) {
      list.innerHTML = `<li class="list-item"><span>Selecione um perfil para ver o histórico</span></li>`;
      toggle.setAttribute("data-count", "0");
      return;
    }

    const personalDates = Object.entries(this.data?.paidDates || {})
      .filter(([, person]) => person === this.selectedProfile)
      .map(([date]) => date)
      .sort()
      .reverse()
      .slice(0, 30);

    toggle.setAttribute("data-count", String(personalDates.length));

    if (personalDates.length === 0) {
      list.innerHTML = `<li class="list-item"><span>Nenhuma bebida registrada ainda</span></li>`;
      return;
    }

    list.innerHTML = "";
    personalDates.forEach((date) => {
      const item = document.createElement("li");
      item.className = "list-item";
      item.innerHTML = `
        <span>${Utils.formatDate(date)}</span>
        <i class="fas fa-check-circle" style="color: var(--accent-success)"></i>
      `;
      list.appendChild(item);
    });
  }

  renderCalendar() {
    const monthYear = Utils.el("monthYear");
    const grid = Utils.el("calendarGrid");
    if (!monthYear || !grid) return;

    if (!this.data || !this.data.paidDates) {
      grid.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Carregando calendário...</span>
        </div>
      `;
      return;
    }

    const date = new Date(this.currentYear, this.currentMonth, 1);
    monthYear.textContent = date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    grid.innerHTML = "";

    const dayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    dayHeaders.forEach((d) => {
      const header = document.createElement("div");
      header.className = "day-header";
      header.textContent = d;
      grid.appendChild(header);
    });

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateISO = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;

      const payer = this.data.paidDates[dateISO];

      const dayEl = document.createElement("div");
      dayEl.className = "calendar-day";
      if (payer) dayEl.classList.add("paid");

      dayEl.innerHTML = `
        <span class="day-number">${day}</span>
        ${payer ? `<span class="payer-badge">${Utils.sanitizeText(payer.split(" ")[0])}</span>` : ""}
      `;

      grid.appendChild(dayEl);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new BebidaEmDiaApp();
});
