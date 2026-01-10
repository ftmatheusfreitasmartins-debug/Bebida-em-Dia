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

// Notificação toast simples
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Estilos inline para garantir que funcione
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    zIndex: '10000',
    opacity: '0',
    transform: 'translateX(100%)',
    transition: 'all 0.3s ease',
    maxWidth: '300px',
    wordWrap: 'break-word'
  });

  // Cores baseadas no tipo
  const colors = {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6'
  };
  
  toast.style.backgroundColor = colors[type] || colors.info;
  
  document.body.appendChild(toast);
  
  // Animação de entrada
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // Remoção automática
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
  
  // Clique para fechar
  toast.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  });
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

