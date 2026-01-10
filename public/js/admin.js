class AdminPanel {
  constructor() {
    this.data = null;

    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();

    this.selectedDateForPayment = null;

    this.peopleSortMode = "az";
    this.calendarPersonFilter = "";

    this.init();
  }

  // -------------------------
  // Init / Auth
  // -------------------------
  async init() {
    this.setupModals();
    this.setupEventListeners();
    await this.checkAuthentication();
  }

  setupModals() {
    if (window.Modal?.setupModal) {
      Modal.setupModal("themeModal", { closeOnBackdrop: true, closeOnEscape: true });
      Modal.setupModal("paymentModal", { closeOnBackdrop: true, closeOnEscape: true });
      Modal.setupModal("personHistoryModal", { closeOnBackdrop: true, closeOnEscape: true });
    }
  }

  async checkAuthentication() {
    if (window.API?.isAdminAuthenticated?.() === true) {
      await this.loadAdminData();
      this.showAdminContent();
      return;
    }
    this.showLoginModal();
  }

  showLoginModal() {
    Utils.el("loginModal")?.classList.remove("hidden");
    Utils.el("adminContent")?.classList.add("hidden");
    Utils.el("adminPassword")?.focus();
  }

  showAdminContent() {
    Utils.el("loginModal")?.classList.add("hidden");
    Utils.el("adminContent")?.classList.remove("hidden");

    // Temas no admin
    this.renderThemeOptions();
    Theme?.onThemeChange?.(() => this.renderThemeOptions());

    setTimeout(() => this.renderAll(), 50);
  }

  async loadAdminData() {
    try {
      this.data = await API.getAdminData({ showToast: false });
    } catch (e) {
      Utils.showToast("Erro ao carregar dados do admin", "error");
      this.data = {
        people: [],
        paidDates: {},
        chat: [],
        settings: { rotationMode: "sequential", currentIndex: 0 },
      };
    }
  }

  // -------------------------
  // Events
  // -------------------------
  setupEventListeners() {
    // Login
    Utils.el("loginBtn")?.addEventListener("click", () => this.handleLogin());
    Utils.el("adminPassword")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleLogin();
    });

    // Tabs
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });

    // Theme modal
    Utils.el("openThemeModal")?.addEventListener("click", () => Modal.open("themeModal"));
    Utils.el("closeThemeModal")?.addEventListener("click", () => Modal.close("themeModal"));

    // Logout
    Utils.el("logoutBtn")?.addEventListener("click", () => this.handleLogout());

    // Settings
    Utils.el("saveRotationBtn")?.addEventListener("click", () => this.handleSaveRotation());
    Utils.el("resetHistoryBtn")?.addEventListener("click", () => this.handleResetHistory());

    // People: add / search / sort
    Utils.el("addPersonBtn")?.addEventListener("click", () => this.handleAddPerson());
    Utils.el("newPersonName")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleAddPerson();
    });

    const peopleSearchInput = Utils.el("peopleSearchInput");
    if (peopleSearchInput) {
      peopleSearchInput.addEventListener(
        "input",
        Utils.debounce(() => this.renderPeopleList(), 120)
      );
    }

    Utils.el("peopleSortSelect")?.addEventListener("change", (e) => {
      this.peopleSortMode = e.target.value || "az";
      this.renderPeopleList();
    });

    // People list actions (delegation)
    Utils.el("peopleList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const name = btn.dataset.name;

      if (action === "remove") this.confirmRemovePerson(name);
      if (action === "copy") this.copyPersonName(name);
      if (action === "today") this.markTodayForPerson(name);
      if (action === "history") this.openPersonHistoryModal(name);
    });

    // Calendar nav
    Utils.el("prevMonthBtn")?.addEventListener("click", () => this.navigateMonth(-1));
    Utils.el("nextMonthBtn")?.addEventListener("click", () => this.navigateMonth(1));
    Utils.el("goTodayBtn")?.addEventListener("click", () => this.goToCurrentMonth());

    // Calendar filter + open history
    Utils.el("calendarPersonFilter")?.addEventListener("change", (e) => {
      this.calendarPersonFilter = e.target.value || "";
      this.renderCalendar();
    });

    Utils.el("openPersonHistoryBtn")?.addEventListener("click", () => {
      const chosen = Utils.el("calendarPersonFilter")?.value || "";
      this.openPersonHistoryModal(chosen || null);
    });

    // Calendar day click
    Utils.el("calendarGrid")?.addEventListener("click", (e) => {
      const dayEl = e.target.closest(".calendar-day");
      if (dayEl?.dataset?.date) this.openPaymentModal(dayEl.dataset.date);
    });

    // Payment modal
    Utils.el("closePaymentModalBtn")?.addEventListener("click", () => Modal.close("paymentModal"));
    Utils.el("closePaymentModalBtn2")?.addEventListener("click", () => Modal.close("paymentModal"));
    Utils.el("clearPaymentBtn")?.addEventListener("click", () => this.handleClearPayment());

    Utils.el("paymentPeopleList")?.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-person]");
      if (!opt) return;
      this.handlePaymentPersonSelect(opt.dataset.person);
    });

    Utils.el("paymentSearchInput")?.addEventListener(
      "input",
      Utils.debounce(() => this.renderPaymentPeopleList(), 120)
    );

    // History modal
    Utils.el("closePersonHistoryModalBtn")?.addEventListener("click", () => Modal.close("personHistoryModal"));
    Utils.el("personHistorySelect")?.addEventListener("change", () => this.renderPersonHistory());
  }

  // -------------------------
  // Tabs
  // -------------------------
  switchTab(tabName) {
    // Nav state
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    // Content state
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("hidden", content.id !== `${tabName}Tab`);
    });

    // Tab-specific render
    if (!this.data) return;
    if (tabName === "dashboard") {
      this.renderDashboardStats();
      this.renderChart();
      this.renderRanking();
      this.renderActivity();
    }
    if (tabName === "people") {
      this.renderPeopleList();
    }
    if (tabName === "calendar") {
      this.renderCalendar();
    }
  }

  // -------------------------
  // Theme UI
  // -------------------------
  renderThemeOptions() {
    const container = Utils.el("themeOptions");
    if (!container || !window.Theme?.getAvailableThemes) return;

    const themes = Theme.getAvailableThemes();
    const current = Theme.getCurrentTheme?.() || "dark";

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
  }

  // -------------------------
  // Auth actions
  // -------------------------
  async handleLogin() {
    const input = Utils.el("adminPassword");
    const errorMsg = Utils.el("errorMsg");
    if (!input || !errorMsg) return;

    const password = input.value.trim();
    if (!password) {
      errorMsg.textContent = "Digite a senha";
      return;
    }

    try {
      const result = await API.adminLogin(password, { showToast: false });
      if (result?.success) {
        errorMsg.textContent = "";
        await this.loadAdminData();
        this.showAdminContent();
        Utils.showToast("Login realizado com sucesso!", "success");
      }
    } catch (e) {
      errorMsg.textContent = e.message || "Senha incorreta";
      input.focus();
    }
  }

  handleLogout() {
    const doLogout = () => {
      API.adminLogout?.();
      if (Utils.el("adminPassword")) Utils.el("adminPassword").value = "";
      if (Utils.el("errorMsg")) Utils.el("errorMsg").textContent = "";
      this.showLoginModal();
    };

    // Modal bonito (do seu modal.js) se existir
    if (typeof window.createConfirmModal === "function") {
      createConfirmModal("Tem certeza que deseja sair do painel administrativo?", {
        title: "Sair",
        confirmText: "Sair",
        cancelText: "Cancelar",
        onConfirm: doLogout,
      });
      return;
    }

    if (confirm("Tem certeza que deseja sair do painel administrativo?")) doLogout();
  }

  // -------------------------
  // Data helpers
  // -------------------------
  normalizeName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
  }

  getPaidDatesEntriesSortedDesc() {
    const entries = Object.entries(this.data?.paidDates || {});
    entries.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return entries;
  }

  getScores() {
    const scores = {};
    (this.data?.people || []).forEach((p) => (scores[p] = 0));
    Object.values(this.data?.paidDates || {}).forEach((p) => {
      if (scores[p] !== undefined) scores[p]++;
    });
    return scores;
  }

  getTopPeople(limit = 10) {
    const scores = this.getScores();
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, limit);
  }

  // -------------------------
  // Render: all
  // -------------------------
  renderAll() {
    if (!this.data) return;

    // Settings UI
    const rotation = this.data?.settings?.rotationMode || "sequential";
    if (Utils.el("rotationModeSelect")) Utils.el("rotationModeSelect").value = rotation;

    this.refreshPeopleSelectors();

    // Dashboard
    this.renderDashboardStats();
    this.renderChart();
    this.renderRanking();
    this.renderActivity();

    // People + Calendar
    this.renderPeopleList();
    this.renderCalendar();
  }

  // -------------------------
  // Dashboard
  // -------------------------
  renderDashboardStats() {
    const paidDates = this.data?.paidDates || {};
    const people = this.data?.people || [];

    const totalPayments = Object.keys(paidDates).length;
    const totalPeople = people.length;

    const allDates = Object.keys(paidDates).sort();
    const lastDate = allDates.length ? allDates[allDates.length - 1] : null;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const thisMonthPayments = allDates.filter((d) => {
      const [yy, mm] = d.split("-").map(Number);
      return yy === year && mm === month;
    }).length;

    Utils.el("totalPayments").textContent = String(totalPayments);
    Utils.el("totalPeople").textContent = String(totalPeople);
    Utils.el("lastPaymentDate").textContent = lastDate ? Utils.formatDateShort(lastDate) : "N/A";
    Utils.el("currentMonth").textContent = String(thisMonthPayments);
  }

  renderChart() {
    const container = Utils.el("paymentsChart");
    if (!container) return;

    const top = this.getTopPeople(8);
    if (!top.length) {
      container.innerHTML = `<div class="empty-state">Nenhum dado para exibir.</div>`;
      return;
    }

    const max = Math.max(...top.map(([, v]) => v)) || 1;

    container.innerHTML = `
      <div class="bar-chart">
        ${top
          .map(([name, value]) => {
            const pct = Math.round((value / max) * 100);
            return `
              <div class="bar-row">
                <div class="bar-name">${Utils.sanitizeText(name)}</div>
                <div class="bar-track" aria-hidden="true">
                  <div class="bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="bar-value">${value}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  renderRanking() {
    const list = Utils.el("adminRankingList");
    if (!list) return;

    const top = this.getTopPeople(15);
    if (!top.length) {
      list.innerHTML = `<li class="list-item"><span class="person">Sem registros</span><span class="score">0</span></li>`;
      return;
    }

    list.innerHTML = top
      .map(
        ([name, score]) => `
      <li class="list-item">
        <span class="person">${Utils.sanitizeText(name)}</span>
        <span class="score">${score}</span>
      </li>
    `
      )
      .join("");
  }

  renderActivity() {
    const list = Utils.el("adminActivityList");
    if (!list) return;

    const entries = this.getPaidDatesEntriesSortedDesc().slice(0, 12);
    if (!entries.length) {
      list.innerHTML = `<li class="admin-activity-item">Sem atividade ainda.</li>`;
      return;
    }

    list.innerHTML = entries
      .map(([date, payer]) => {
        const d = Utils.formatDateShort(date);
        return `
          <li class="admin-activity-item">
            <span class="activity-date">${d}</span>
            <span class="activity-payer">${Utils.sanitizeText(payer)}</span>
          </li>
        `;
      })
      .join("");
  }

  // -------------------------
  // Settings actions
  // -------------------------
  async handleSaveRotation() {
    const select = Utils.el("rotationModeSelect");
    if (!select) return;

    const rotationMode = select.value || "sequential";

    try {
      const result = await API.updateSettings({ rotationMode });
      if (result?.success) {
        this.data.settings = result.settings;
      }
    } catch (e) {}
  }

  async handleResetHistory() {
    const doReset = async () => {
      try {
        await API.resetHistory();
        await this.loadAdminData();
        this.renderAll();
      } catch (e) {}
    };

    // Modal bonito (do seu modal.js) se existir
    if (typeof window.createConfirmModal === "function") {
      createConfirmModal("Isso vai apagar todo o histórico de pagamentos. Deseja continuar?", {
        title: "Resetar histórico",
        confirmText: "Resetar",
        cancelText: "Cancelar",
        onConfirm: doReset,
      });
      return;
    }

    if (confirm("Isso vai apagar todo o histórico de pagamentos. Deseja continuar?")) doReset();
  }

  // -------------------------
  // People (search/sort/actions)
  // -------------------------
  getPeopleFilteredSorted() {
    const q = (Utils.el("peopleSearchInput")?.value || "").trim().toLowerCase();
    const scores = this.getScores();

    let people = [...(this.data?.people || [])];
    if (q) people = people.filter((p) => p.toLowerCase().includes(q));

    if (this.peopleSortMode === "za") {
      people.sort((a, b) => b.localeCompare(a, "pt-BR"));
    } else if (this.peopleSortMode === "score") {
      people.sort((a, b) => (scores[b] || 0) - (scores[a] || 0) || a.localeCompare(b, "pt-BR"));
    } else {
      people.sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    return { people, scores, totalAll: (this.data?.people || []).length };
  }

  renderPeopleList() {
    const list = Utils.el("peopleList");
    const chip = Utils.el("peopleCountChip");
    if (!list) return;

    const { people, scores, totalAll } = this.getPeopleFilteredSorted();
    if (chip) chip.textContent = `${people.length}/${totalAll} pessoas`;

    if (!people.length) {
      list.innerHTML = `
        <li class="list-item">
          <span class="person">Nenhuma pessoa encontrada.</span>
        </li>
      `;
      return;
    }

    const todayISO = Utils.getTodayISO();
    const todayPayer = this.data?.paidDates?.[todayISO] || null;

    list.innerHTML = people
      .map((name) => {
        const sc = scores[name] || 0;
        const todayMark = todayPayer === name ? "Hoje: sim" : "Hoje: não";
        return `
          <li class="list-item admin-person-item">
            <div class="admin-person-main">
              <span class="person">${Utils.sanitizeText(name)}</span>
              <div class="admin-person-meta">
                <span class="meta-pill"><i class="fas fa-trophy"></i> ${sc}</span>
                <span class="meta-pill"><i class="fas fa-calendar-day"></i> ${todayMark}</span>
              </div>
            </div>

            <div class="admin-person-actions">
              <button class="btn small-btn ghost" data-action="history" data-name="${Utils.sanitizeText(name)}" type="button" title="Histórico">
                <i class="fas fa-clock-rotate-left"></i>
              </button>
              <button class="btn small-btn ghost" data-action="today" data-name="${Utils.sanitizeText(name)}" type="button" title="Marcar hoje">
                <i class="fas fa-check"></i>
              </button>
              <button class="btn small-btn ghost" data-action="copy" data-name="${Utils.sanitizeText(name)}" type="button" title="Copiar nome">
                <i class="fas fa-copy"></i>
              </button>
              <button class="btn small-btn danger" data-action="remove" data-name="${Utils.sanitizeText(name)}" type="button" title="Remover">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </li>
        `;
      })
      .join("");
  }

  async handleAddPerson() {
    const input = Utils.el("newPersonName");
    if (!input) return;

    const name = this.normalizeName(input.value);

    if (!name) {
      Utils.showToast("Digite um nome válido", "warning");
      input.focus();
      return;
    }

    if (!Utils.isValidName(name)) {
      Utils.showToast("Nome inválido. Use apenas letras e espaços.", "error");
      input.focus();
      return;
    }

    const exists = (this.data?.people || []).some((p) => p.toLowerCase() === name.toLowerCase());
    if (exists) {
      Utils.showToast("Essa pessoa já existe (nome duplicado).", "warning");
      input.focus();
      return;
    }

    try {
      const result = await API.addPerson(name);
      if (result?.success) {
        this.data.people = result.people || [];
        input.value = "";
        this.refreshPeopleSelectors();
        this.renderAll();
      }
    } catch (e) {}
  }

  confirmRemovePerson(name) {
    const doRemove = () => this.removePerson(name);

    const msg = `Remover "${name}"? Todo o histórico dessa pessoa será apagado.`;
    if (typeof window.createConfirmModal === "function") {
      createConfirmModal(msg, {
        title: "Remover pessoa",
        confirmText: "Remover",
        cancelText: "Cancelar",
        onConfirm: doRemove,
      });
      return;
    }

    if (confirm(msg)) doRemove();
  }

  async removePerson(name) {
    try {
      const result = await API.removePerson(name);
      if (result?.success) {
        this.data.people = result.people || [];
        this.data.paidDates = result.paidDates || {};
        this.refreshPeopleSelectors();
        this.renderAll();
      }
    } catch (e) {}
  }

  async copyPersonName(name) {
    const ok = await Utils.copyToClipboard(name);
    Utils.showToast(ok ? "Nome copiado!" : "Não foi possível copiar.", ok ? "success" : "error");
  }

  markTodayForPerson(name) {
    const todayISO = Utils.getTodayISO();
    const current = this.data?.paidDates?.[todayISO] || null;

    const doMark = async () => {
      try {
        const result = await API.updatePayment(todayISO, name);
        if (result?.success) {
          this.data.paidDates = result.paidDates || {};
          this.renderAll();
        }
      } catch (e) {}
    };

    if (current && current !== name) {
      const msg = `Hoje já está marcado para "${current}". Substituir por "${name}"?`;
      if (typeof window.createConfirmModal === "function") {
        createConfirmModal(msg, {
          title: "Substituir pagamento de hoje",
          confirmText: "Substituir",
          cancelText: "Cancelar",
          onConfirm: doMark,
        });
        return;
      }
      if (confirm(msg)) doMark();
      return;
    }

    doMark();
  }

  // -------------------------
  // Calendar
  // -------------------------
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

  goToCurrentMonth() {
    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear = now.getFullYear();
    this.renderCalendar();
  }

  refreshPeopleSelectors() {
    const people = [...(this.data?.people || [])].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // Calendar filter
    const calendarSelect = Utils.el("calendarPersonFilter");
    if (calendarSelect) {
      const currentValue = calendarSelect.value || "";
      calendarSelect.innerHTML =
        `<option value="">Sem filtro</option>` +
        people.map((p) => `<option value="${Utils.sanitizeText(p)}">${Utils.sanitizeText(p)}</option>`).join("");
      calendarSelect.value = currentValue;
    }

    // History select
    const historySelect = Utils.el("personHistorySelect");
    if (historySelect) {
      const chosen = historySelect.value || "";
      historySelect.innerHTML = people
        .map((p) => `<option value="${Utils.sanitizeText(p)}">${Utils.sanitizeText(p)}</option>`)
        .join("");
      historySelect.value = chosen && people.includes(chosen) ? chosen : people[0] || "";
    }
  }

  renderCalendar() {
    const header = Utils.el("monthYear");
    const grid = Utils.el("calendarGrid");
    if (!header || !grid) return;

    if (!this.data?.paidDates) {
      grid.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Carregando calendário...</span></div>`;
      return;
    }

    const date = new Date(this.currentYear, this.currentMonth, 1);
    header.textContent = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    grid.innerHTML = "";

    const dayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    dayHeaders.forEach((d) => {
      const el = document.createElement("div");
      el.className = "day-header";
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      grid.appendChild(empty);
    }

    const filter = this.calendarPersonFilter || "";
    const todayISO = Utils.getTodayISO();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateISO = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
      const payer = this.data.paidDates[dateISO];

      const dayEl = document.createElement("div");
      dayEl.className = "calendar-day";
      dayEl.dataset.date = dateISO;

      if (payer) dayEl.classList.add("paid");
      if (dateISO === todayISO) dayEl.classList.add("today");

      if (filter) {
        if (payer === filter) dayEl.classList.add("match");
        else dayEl.classList.add("dimmed");
      }

      dayEl.innerHTML = `
        <span class="day-number">${day}</span>
        ${payer ? `<span class="payer-badge">${Utils.sanitizeText(payer).split(" ")[0]}</span>` : ""}
      `;

      grid.appendChild(dayEl);
    }
  }

  // -------------------------
  // Payment modal
  // -------------------------
  openPaymentModal(dateISO) {
    this.selectedDateForPayment = dateISO;

    Utils.el("paymentModalTitle").textContent = `Pagamento - ${Utils.formatDate(dateISO)}`;

    const payer = this.data?.paidDates?.[dateISO] || null;
    Utils.el("paymentCurrentPayer").textContent = payer ? payer : "—";

    if (Utils.el("paymentSearchInput")) Utils.el("paymentSearchInput").value = "";
    this.renderPaymentPeopleList();

    Modal.open("paymentModal");
  }

  renderPaymentPeopleList() {
    const container = Utils.el("paymentPeopleList");
    if (!container) return;

    const q = (Utils.el("paymentSearchInput")?.value || "").trim().toLowerCase();
    const people = (this.data?.people || [])
      .filter((p) => p.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    const dateISO = this.selectedDateForPayment;
    const currentPayer = dateISO ? this.data?.paidDates?.[dateISO] : null;

    if (!people.length) {
      container.innerHTML = `<div class="empty-state">Nenhuma pessoa encontrada.</div>`;
      return;
    }

    container.innerHTML = people
      .map((p) => {
        const selected = currentPayer === p ? "selected" : "";
        return `
          <button class="person-option ${selected}" type="button" data-person="${Utils.sanitizeText(p)}">
            <span class="person-option-name">${Utils.sanitizeText(p)}</span>
            <span class="person-option-check"><i class="fas fa-check"></i></span>
          </button>
        `;
      })
      .join("");
  }

  async handlePaymentPersonSelect(name) {
    const dateISO = this.selectedDateForPayment;
    if (!dateISO) return;

    const current = this.data?.paidDates?.[dateISO] || null;
    if (current === name) {
      Utils.showToast("Já está marcado para essa pessoa.", "info");
      return;
    }

    try {
      const result = await API.updatePayment(dateISO, name);
      if (result?.success) {
        this.data.paidDates = result.paidDates || {};
        Utils.el("paymentCurrentPayer").textContent = name;

        // Atualiza views (sem precisar recarregar tudo do servidor)
        this.renderDashboardStats();
        this.renderChart();
        this.renderRanking();
        this.renderActivity();
        this.renderPeopleList();
        this.renderCalendar();

        Modal.close("paymentModal");
      }
    } catch (e) {}
  }

  async handleClearPayment() {
    const dateISO = this.selectedDateForPayment;
    if (!dateISO) return;

    const current = this.data?.paidDates?.[dateISO] || null;
    if (!current) {
      Utils.showToast("Esse dia já está sem pagamento.", "info");
      return;
    }

    try {
      const result = await API.updatePayment(dateISO, null);
      if (result?.success) {
        this.data.paidDates = result.paidDates || {};
        Utils.el("paymentCurrentPayer").textContent = "—";

        this.renderDashboardStats();
        this.renderChart();
        this.renderRanking();
        this.renderActivity();
        this.renderPeopleList();
        this.renderCalendar();

        Modal.close("paymentModal");
      }
    } catch (e) {}
  }

  // -------------------------
  // Person history modal
  // -------------------------
  openPersonHistoryModal(nameOrNull) {
    // abre e seleciona a pessoa (ou primeira)
    this.refreshPeopleSelectors();

    const select = Utils.el("personHistorySelect");
    const people = this.data?.people || [];

    if (!select) return;

    if (nameOrNull && people.includes(nameOrNull)) {
      select.value = nameOrNull;
    } else if (!select.value && people.length) {
      select.value = people[0];
    }

    this.renderPersonHistory();
    Modal.open("personHistoryModal");
  }

  renderPersonHistory() {
    const select = Utils.el("personHistorySelect");
    const list = Utils.el("personHistoryList");
    const statsBox = Utils.el("personHistoryStats");

    if (!select || !list || !statsBox) return;

    const person = select.value;
    if (!person) {
      list.innerHTML = `<li class="list-item"><span>Selecione uma pessoa</span></li>`;
      statsBox.innerHTML = "";
      return;
    }

    const entries = Object.entries(this.data?.paidDates || {})
      .filter(([, payer]) => payer === person)
      .map(([date]) => date)
      .sort((a, b) => (a < b ? 1 : -1));

    const total = entries.length;
    const last = total ? entries[0] : null;
    const first = total ? entries[total - 1] : null;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const thisMonth = entries.filter((d) => {
      const [yy, mm] = d.split("-").map(Number);
      return yy === year && mm === month;
    }).length;

    statsBox.innerHTML = `
      <div class="ph-stat"><span class="ph-k">Total</span><span class="ph-v">${total}</span></div>
      <div class="ph-stat"><span class="ph-k">Este mês</span><span class="ph-v">${thisMonth}</span></div>
      <div class="ph-stat"><span class="ph-k">Último</span><span class="ph-v">${last ? Utils.formatDateShort(last) : "—"}</span></div>
      <div class="ph-stat"><span class="ph-k">Primeiro</span><span class="ph-v">${first ? Utils.formatDateShort(first) : "—"}</span></div>
    `;

    if (!entries.length) {
      list.innerHTML = `<li class="list-item"><span>Nenhum registro para essa pessoa.</span></li>`;
      return;
    }

    list.innerHTML = entries
      .slice(0, 50)
      .map(
        (date) => `
        <li class="list-item">
          <span>${Utils.formatDate(date)}</span>
          <i class="fas fa-check-circle" style="color: var(--accent-success)"></i>
        </li>
      `
      )
      .join("");
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  window.adminPanel = new AdminPanel();
});
