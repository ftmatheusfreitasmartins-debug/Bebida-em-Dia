// --- Utilitários Gerais ---

// Seletores DOM simplificados
const el = (id) => document.getElementById(id);
const qsa = (selector) => document.querySelectorAll(selector);
const qs = (selector) => document.querySelector(selector);

// Validação de URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Formatação de data
function formatDate(dateString, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  return new Date(dateString + 'T12:00:00').toLocaleDateString('pt-BR', finalOptions);
}

// Formatação de data curta
function formatDateShort(dateString) {
  return formatDate(dateString, { month: 'short', day: 'numeric' });
}

// Obter data de hoje no formato ISO
function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Debounce para otimizar eventos
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle para otimizar eventos
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Sanitização de texto
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Validação de nome
function isValidName(name) {
  return name && 
         typeof name === 'string' && 
         name.trim().length > 0 && 
         name.trim().length <= 50 &&
         /^[a-zA-ZÀ-ÿ\s]+$/.test(name.trim());
}

// Geração de ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Cópia para clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Erro ao copiar para clipboard:', err);
    return false;
  }
}

// Animação suave para scroll
function smoothScrollTo(element, duration = 300) {
  const targetPosition = element.offsetTop;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }

  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}

// Notificação toast avançada (stack + ação + barra de tempo)
function showToast(message, type = "info", options = {}) {
  const {
    title = null,
    duration = 3000,          // 0 = não auto-fecha
    dismissible = true,
    actionLabel = null,
    onAction = null,
    id = null,                // se passar id, pode substituir o toast existente
    replace = true,
    maxToasts = 4,
    position = "top-right",   // top-right | top-left | bottom-right | bottom-left
  } = options;

  // 1) Injetar estilos 1 vez
  if (!document.getElementById("toast-styles")) {
    const style = document.createElement("style");
    style.id = "toast-styles";
    style.textContent = `
      #toast-root{
        position: fixed;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px;
        pointer-events: none;
      }
      #toast-root.top-right{ top: 0; right: 0; align-items: flex-end; }
      #toast-root.top-left{ top: 0; left: 0; align-items: flex-start; }
      #toast-root.bottom-right{ bottom: 0; right: 0; align-items: flex-end; }
      #toast-root.bottom-left{ bottom: 0; left: 0; align-items: flex-start; }

      .toastx{
        width: min(360px, calc(100vw - 32px));
        pointer-events: auto;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 12px 30px rgba(0,0,0,.25);
        border: 1px solid rgba(255,255,255,.10);
        backdrop-filter: blur(8px);
        transform: translateY(-6px);
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
        color: #fff;
      }
      .toastx.show{ opacity: 1; transform: translateY(0); }

      .toastx__wrap{
        display: grid;
        grid-template-columns: 34px 1fr auto;
        gap: 10px;
        padding: 12px 12px;
        align-items: center;
      }
      .toastx__icon{
        width: 34px; height: 34px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,.12);
        font-size: 16px;
      }
      .toastx__content{ min-width: 0; }
      .toastx__title{
        font-weight: 700;
        font-size: 13px;
        line-height: 1.2;
        margin: 0 0 2px 0;
        opacity: .95;
      }
      .toastx__msg{
        font-weight: 500;
        font-size: 13px;
        line-height: 1.25;
        margin: 0;
        opacity: .9;
        word-wrap: break-word;
      }
      .toastx__actions{
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .toastx__btn{
        border: 0;
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        font-weight: 700;
        font-size: 12px;
        background: rgba(255,255,255,.14);
        color: #fff;
      }
      .toastx__btn:hover{ background: rgba(255,255,255,.22); }

      .toastx__close{
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: rgba(255,255,255,.12);
        border: 0;
        cursor: pointer;
        color: #fff;
        font-size: 16px;
        line-height: 1;
      }
      .toastx__close:hover{ background: rgba(255,255,255,.22); }

      .toastx__bar{
        height: 3px;
        width: 100%;
        opacity: .85;
        transform-origin: left;
        transform: scaleX(1);
      }

      .toastx.info{ background: linear-gradient(135deg, #2563EB, #3B82F6); }
      .toastx.success{ background: linear-gradient(135deg, #059669, #10B981); }
      .toastx.warning{ background: linear-gradient(135deg, #D97706, #F59E0B); }
      .toastx.error{ background: linear-gradient(135deg, #DC2626, #EF4444); }
    `;
    document.head.appendChild(style);
  }

  // 2) Criar root 1 vez
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.className = position;
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-relevant", "additions text");
    document.body.appendChild(root);
  } else {
    root.className = position;
  }

  // 3) Se tiver id, substituir
  if (id && replace) {
    const old = root.querySelector(`[data-toast-id="${id}"]`);
    if (old) old.remove();
  }

  // 4) Limitar stack
  while (root.children.length >= maxToasts) {
    root.removeChild(root.firstElementChild);
  }

  const iconMap = {
    info: "i",
    success: "✓",
    warning: "!",
    error: "×",
  };

  const toast = document.createElement("div");
  toast.className = `toastx ${type}`;
  if (id) toast.dataset.toastId = id;

  toast.innerHTML = `
    <div class="toastx__wrap">
      <div class="toastx__icon" aria-hidden="true">${iconMap[type] || iconMap.info}</div>
      <div class="toastx__content">
        ${title ? `<div class="toastx__title">${sanitizeText(title)}</div>` : ""}
        <p class="toastx__msg">${sanitizeText(String(message || ""))}</p>
      </div>
      <div class="toastx__actions">
        ${actionLabel ? `<button class="toastx__btn" type="button">${sanitizeText(actionLabel)}</button>` : ""}
        ${dismissible ? `<button class="toastx__close" type="button" aria-label="Fechar">×</button>` : ""}
      </div>
    </div>
    <div class="toastx__bar" style="background: rgba(255,255,255,.55)"></div>
  `;

  const close = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  };

  // Clique no X
  toast.querySelector(".toastx__close")?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  // Clique na ação
  toast.querySelector(".toastx__btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    try { if (typeof onAction === "function") onAction(); } finally { close(); }
  });

  // Clique no toast fecha (opcional)
  toast.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) return;
    if (dismissible) close();
  });

  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  // Barra de progresso / auto-close
  if (duration && duration > 0) {
    const bar = toast.querySelector(".toastx__bar");
    const start = performance.now();

    let raf = null;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      if (bar) bar.style.transform = `scaleX(${1 - p})`;
      if (p >= 1) close();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Pausar ao hover
    let pausedAt = null;
    toast.addEventListener("mouseenter", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      pausedAt = performance.now();
    });
    toast.addEventListener("mouseleave", () => {
      if (!pausedAt) return;
      const elapsed = pausedAt - start;
      const remaining = Math.max(0, duration - elapsed);
      if (remaining === 0) return close();

      const restart = performance.now();
      const tick2 = (t) => {
        const p = Math.min(1, (t - restart) / remaining);
        if (bar) bar.style.transform = `scaleX(${1 - p})`;
        if (p >= 1) close();
        else raf = requestAnimationFrame(tick2);
      };
      raf = requestAnimationFrame(tick2);
      pausedAt = null;
    });
  }

  return { close };
}


// Loading spinner
function showLoading(element, text = 'Carregando...') {
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.innerHTML = `
    <div class="spinner"></div>
    <span>${text}</span>
  `;
  
  // Estilos inline
  Object.assign(spinner.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '20px',
    color: 'var(--text-secondary)'
  });
  
  const spinnerElement = spinner.querySelector('.spinner');
  Object.assign(spinnerElement.style, {
    width: '24px',
    height: '24px',
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  });
  
  // Adicionar keyframes se não existir
  if (!document.querySelector('#spinner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'spinner-keyframes';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  element.innerHTML = '';
  element.appendChild(spinner);
  
  return spinner;
}

// Remover loading
function hideLoading(element, originalContent = '') {
  element.innerHTML = originalContent;
}

// Verificar se elemento está visível na viewport
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Aguardar elemento aparecer no DOM
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Elemento ${selector} não encontrado em ${timeout}ms`));
    }, timeout);
  });
}

// Exportar para uso global
window.Utils = {
  el,
  qsa,
  qs,
  isValidUrl,
  formatDate,
  formatDateShort,
  getTodayISO,
  debounce,
  throttle,
  sanitizeText,
  isValidName,
  generateId,
  copyToClipboard,
  smoothScrollTo,
  showToast,
  showLoading,
  hideLoading,
  isElementInViewport,
  waitForElement
};

