// js/admin.js
class AdminPanel {
  constructor() {
    this.data = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.chart = null;

    this.bind();
    this.init();
  }

  bind() {
    this.loginBtn = document.getElementById("loginBtn");
    this.adminPassword = document.getElementById("adminPassword");
    this.errorMsg = document.getElementById("errorMsg");

    this.loginModal = document.getElementById("loginModal");
    this.adminNav = document.getElementById("adminNav");
    this.adminContent = document.getElementById("adminContent");

    this.logoutBtn = document.getElementById("logoutBtn");

    this.refreshDashboardBtn = document.getElementById("refreshDashboard");
    this.refreshChartBtn = document.getElementById("refreshChart");
    this.refreshActivityBtn = document.getElementById("refreshActivity");

    this.addPersonBtn = document.getElementById("addPersonBtn");
    this.peopleGrid = document.getElementById("peopleGrid");

    this.prevMonthBtn = document.getElementById("prevMonthBtn");
    this.nextMonthBtn = document.getElementById("nextMonthBtn");

    this.calendarGrid = document.getElementById("calendarGrid");
    this.currentMonthDisplay = document.getElementById("currentMonthDisplay");
    this.currentMonthName = document.getElementById("currentMonthName");

    this.totalPaymentsEl = document.getElementById("totalPayments");
    this.totalPeopleEl = document.getElementById("totalPeople");
    this.currentMonthEl = document.getElementById("currentMonth");
    this.lastPaymentDateEl = document.getElementById("lastPaymentDate");
    this.daysSincePaymentEl = document.getElementById("daysSincePayment");

    this.rankingTable = document.querySelector(".ranking-table");
    this.activityList = document.getElementById("activityList");

    this.headerTitle = document.getElementById("headerTitle");

    this.navTabs = Array.from(document.querySelectorAll(".nav-tab"));
    this.tabContents = Array.from(document.querySelectorAll(".tab-content"));
  }

  setupEvents() {
    if (this.loginBtn) this.loginBtn.addEventListener("click", () => this.handleLogin());
    if (this.adminPassword)
      this.adminPassword.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.handleLogin();
      });

    if (this.logoutBtn) this.logoutBtn.addEventListener("click", () => this.handleLogout());

    if (this.refreshDashboardBtn) this.refreshDashboardBtn.addEventListener("click", () => this.loadDashboard());
    if (this.refreshChartBtn) this.refreshChartBtn.addEventListener("click", () => this.renderChart());
    if (this.refreshActivityBtn) this.refreshActivityBtn.addEventListener("click", () => this.updateActivity());

    if (this.addPersonBtn)
      this.addPersonBtn.addEventListener("click", () => {
        const name = prompt("Nome da pessoa:");
        if (name && name.trim()) this.addPerson(name.trim());
      });

    if (this.prevMonthBtn) this.prevMonthBtn.addEventListener("click", () => this.navigateMonth(-1));
    if (this.nextMonthBtn) this.nextMonthBtn.addEventListener("click", () => this.navigateMonth(1));

    this.navTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  async init() {
    this.setupEvents();

    if (API.isAdminAuthenticated()) {
      await this.unlockAdmin();
    } else {
      this.lockAdmin();
    }
  }

  lockAdmin() {
    if (this.loginModal) this.loginModal.classList.remove("hidden");
    if (this.adminNav) this.adminNav.classList.add("hidden");
    if (this.adminContent) this.adminContent.classList.add("hidden");
  }

  async unlockAdmin() {
    if (this.loginModal) this.loginModal.classList.add("hidden");
    if (this.adminNav) this.adminNav.classList.remove("hidden");
    if (this.adminContent) this.adminContent.classList.remove("hidden");

    await this.loadDashboard();
  }

  async handleLogin() {
    try {
      if (this.errorMsg) this.errorMsg.textContent = "";

      const password = (this.adminPassword?.value || "").trim();
      if (!password) {
        if (this.errorMsg) this.errorMsg.textContent = "Digite a senha.";
        return;
      }

      const result = await API.adminLogin(password);
      if (result?.success) {
        await this.unlockAdmin();
      } else {
        if (this.errorMsg) this.errorMsg.textContent = result?.error || "Senha incorreta";
      }
    } catch (e) {
      if (this.errorMsg) this.errorMsg.textContent = e.message || "Erro ao fazer login";
    }
  }

  handleLogout() {
    API.adminLogout();
    location.reload();
  }

  switchTab(tabName) {
    this.tabContents.forEach((t) => t.classList.remove("active"));
    this.navTabs.forEach((t) => t.classList.remove("active"));

    const tabEl = document.getElementById(`${tabName}Tab`);
    const navEl = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (tabEl) tabEl.classList.add("active");
    if (navEl) navEl.classList.add("active");

    const titles = { dashboard: "Dashboard", people: "Gerenciar Pessoas", calendar: "Calendário de Pagamentos" };
    if (this.headerTitle) this.headerTitle.textContent = titles[tabName] || "Admin";

    if (tabName === "dashboard") this.loadDashboard();
    if (tabName === "people") this.loadPeople();
    if (tabName === "calendar") this.renderCalendar();
  }

  async loadDashboard() {
    try {
      const res = await API.getAdminData();
      this.data = res?.success ? res : { ...res, success: true };

      this.updateStatistics();
      this.renderChart();
      this.updateRanking();
      this.updateActivity();
      this.renderCalendar();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao carregar dashboard");
    }
  }

  updateStatistics() {
    if (!this.data) return;

    const totalPayments = Object.keys(this.data.paidDates || {}).length;
    const totalPeople = (this.data.people || []).length;

    const monthPayments = Object.keys(this.data.paidDates || {}).filter((date) => {
      const d = new Date(date);
      return d.getMonth() === this.currentMonth && d.getFullYear() === this.currentYear;
    }).length;

    if (this.totalPaymentsEl) this.totalPaymentsEl.textContent = String(totalPayments);
    if (this.totalPeopleEl) this.totalPeopleEl.textContent = String(totalPeople);
    if (this.currentMonthEl) this.currentMonthEl.textContent = String(monthPayments);

    const dates = Object.keys(this.data.paidDates || {}).sort().reverse();
    if (!dates.length) {
      if (this.lastPaymentDateEl) this.lastPaymentDateEl.textContent = "-";
      if (this.daysSincePaymentEl) this.daysSincePaymentEl.textContent = "-";
      return;
    }

    const last = new Date(dates[0]);
    const today = new Date();
    const diffDays = Math.ceil(Math.abs(today - last) / (1000 * 60 * 60 * 24));

    if (this.lastPaymentDateEl) this.lastPaymentDateEl.textContent = last.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    if (this.daysSincePaymentEl) this.daysSincePaymentEl.textContent = `Há ${diffDays} dias`;

    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    if (this.currentMonthName) this.currentMonthName.textContent = monthNames[this.currentMonth];
  }

  renderChart() {
    if (!this.data || typeof Chart === "undefined") return;

    const stats = {};
    (this.data.people || []).forEach((p) => (stats[p] = 0));
    Object.values(this.data.paidDates || {}).forEach((p) => {
      if (stats[p] !== undefined) stats[p] += 1;
    });

    const labels = Object.keys(stats);
    const values = Object.values(stats);

    const ctx = document.getElementById("paymentsChart");
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Bebidas Registradas",
            data: values,
            borderWidth: 2,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  updateRanking() {
    if (!this.data || !this.rankingTable) return;

    const stats = {};
    (this.data.people || []).forEach((p) => (stats[p] = 0));
    Object.values(this.data.paidDates || {}).forEach((p) => {
      if (stats[p] !== undefined) stats[p] += 1;
    });

    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    this.rankingTable.innerHTML = "";
    const max = sorted[0]?.[1] || 1;

    sorted.forEach(([name, count], idx) => {
      const percent = Math.round((count / max) * 100);
      const row = document.createElement("div");
      row.className = "ranking-row";
      row.innerHTML = `
        <div class="ranking-position">${idx + 1}</div>
        <div class="ranking-info">
          <div class="ranking-name">${name}</div>
          <div class="ranking-count">${count} bebidas</div>
        </div>
        <div class="ranking-progress"><div class="ranking-fill" style="width:${percent}%"></div></div>
        <div class="ranking-badge">${percent}</div>
      `;
      this.rankingTable.appendChild(row);
    });
  }

  updateActivity() {
    if (!this.data || !this.activityList) return;

    const dates = Object.keys(this.data.paidDates || {}).sort().reverse().slice(0, 5);
    this.activityList.innerHTML = "";

    dates.forEach((date) => {
      const person = this.data.paidDates[date];
      const item = document.createElement("div");
      item.className = "activity-item";
      item.innerHTML = `
        <div class="activity-dot"></div>
        <div class="activity-text">
          <div class="activity-title">${person} pagou bebida</div>
          <div class="activity-time">${new Date(date).toLocaleDateString("pt-BR")}</div>
        </div>
      `;
      this.activityList.appendChild(item);
    });
  }

  async loadPeople() {
    try {
      const res = await API.getAdminData();
      this.data = res?.success ? res : { ...res, success: true };
      this.renderPeople();
    } catch (e) {
      alert(e.message || "Erro ao carregar pessoas");
    }
  }

  renderPeople() {
    if (!this.peopleGrid || !this.data) return;

    this.peopleGrid.innerHTML = "";
    (this.data.people || []).forEach((person) => {
      const card = document.createElement("div");
      card.className = "person-card";
      card.innerHTML = `
        <div class="person-name">${person}</div>
        <button class="btn-small" data-person="${encodeURIComponent(person)}">Remover</button>
      `;
      card.querySelector("button").addEventListener("click", () => this.removePerson(person));
      this.peopleGrid.appendChild(card);
    });
  }

  async addPerson(name) {
    try {
      await API.addPerson(name);
      await this.loadPeople();
    } catch (e) {
      alert(e.message || "Erro ao adicionar pessoa");
    }
  }

  async removePerson(person) {
    if (!confirm(`Remover ${person}?`)) return;
    try {
      await API.removePerson(person);
      await this.loadPeople();
    } catch (e) {
      alert(e.message || "Erro ao remover pessoa");
    }
  }

  navigateMonth(direction) {
    this.currentMonth += direction;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear += 1;
    } else if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear -= 1;
    }
    this.renderCalendar();
  }

  async renderCalendar() {
    if (!this.data) return;

    // Atualiza label do mês (se existir no HTML)
    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    if (this.currentMonthDisplay) this.currentMonthDisplay.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;

    if (!this.calendarGrid) return;
    this.calendarGrid.innerHTML = "";

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-cell";
      empty.style.opacity = "0.3";
      this.calendarGrid.appendChild(empty);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const paidBy = this.data.paidDates?.[dateStr];
      const cellDate = new Date(`${dateStr}T00:00:00`);

      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      if (paidBy) cell.classList.add("active");
      if (cellDate.getTime() === today.getTime()) cell.classList.add("today");

      cell.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        ${paidBy ? `<div class="calendar-dot"></div><div class="calendar-paid-person">${paidBy}</div>` : ""}
      `;

      cell.style.cursor = "pointer";
      cell.addEventListener("click", () => this.calendarPick(dateStr, cellDate));

      this.calendarGrid.appendChild(cell);
    }
  }

  async calendarPick(dateStr, cellDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (cellDate > today) {
      alert("Não é possível marcar datas futuras.");
      return;
    }

    const paidBy = this.data.paidDates?.[dateStr] || null;

    const list = (this.data.people || []).map((p) => `- ${p}`).join("\n");
    const promptText =
      `Quem pagou em ${new Date(dateStr).toLocaleDateString("pt-BR")}?\n\n` +
      `Digite exatamente o nome (ou deixe vazio para remover):\n\n${list}`;

    const chosen = prompt(promptText, paidBy || "");
    if (chosen === null) return;

    const name = chosen.trim();
    try {
      await API.updatePayment(dateStr, name ? name : null);
      await this.loadDashboard();
    } catch (e) {
      alert(e.message || "Erro ao atualizar pagamento");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.adminPanel = new AdminPanel();
});
