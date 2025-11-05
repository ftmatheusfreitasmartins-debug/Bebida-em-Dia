// =============================================================================
// MÓDULO DE GERENCIAMENTO DE MODAIS - BEBIDA EM DIA v2.0
// =============================================================================
// Autor: Bebida em Dia Team
// Versão: 2.0.1 (Corrigido)
// Data: 03/11/2025
// Descrição: Sistema completo de gerenciamento de modais com suporte a:
//   - Múltiplos modais aninhados
//   - Criação dinâmica de modais
//   - Modais de confirmação, alerta e prompt
//   - Navegação por teclado
//   - Callbacks customizados
// =============================================================================

// --- Fallback para Utils (caso não carregue antes) ---
const Utils = window.Utils || {
  el: (id) => document.getElementById(id),
  generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
};

// =============================================================================
// CLASSE PRINCIPAL: ModalManager
// =============================================================================

class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.modalStack = [];
    this.escapeKeyHandler = this.handleEscapeKey.bind(this);
    this.backdropClickHandler = null;
    this.init();
  }

  /**
   * Inicializar gerenciador de modais
   */
  init() {
    // Prevenir duplicação de listeners
    if (this.backdropClickHandler) {
      document.removeEventListener('click', this.backdropClickHandler);
    }

    // Escutar tecla ESC globalmente
    document.addEventListener('keydown', this.escapeKeyHandler);

    // Escutar cliques no backdrop
    this.backdropClickHandler = this.handleBackdropClick.bind(this);
    document.addEventListener('click', this.backdropClickHandler);

    console.log('✅ ModalManager inicializado');
  }

  /**
   * Abrir modal
   * @param {string} modalId - ID do modal
   * @param {Object} options - Opções de configuração
   * @returns {boolean}
   */
  open(modalId, options = {}) {
    // Validações
    if (!modalId || typeof modalId !== 'string') {
      console.error('❌ modalId inválido:', modalId);
      return false;
    }

    const modal = Utils.el(modalId);
    if (!modal) {
      console.error(`❌ Modal "${modalId}" não encontrado no DOM`);
      return false;
    }

    const {
      closeOnBackdrop = true,
      closeOnEscape = true,
      focus = true,
      onOpen = null,
      onClose = null
    } = options;

    // Fechar outros modais se especificado
    if (options.closeOthers) {
      this.closeAll();
    }

    // Adicionar à pilha
    this.modalStack.push({
      id: modalId,
      element: modal,
      options: { closeOnBackdrop, closeOnEscape, onOpen, onClose }
    });

    // Mostrar modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    this.activeModals.add(modalId);

    // Focar no modal
    if (focus) {
      setTimeout(() => this.focusModal(modal), 100);
    }

    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';

    // Callback de abertura
    if (onOpen && typeof onOpen === 'function') {
      try {
        onOpen(modal);
      } catch (error) {
        console.error('❌ Erro no callback onOpen:', error);
      }
    }

    // Disparar evento customizado
    window.dispatchEvent(new CustomEvent('modalOpened', {
      detail: { modalId, modal }
    }));

    return true;
  }

  /**
   * Fechar modal
   * @param {string} modalId - ID do modal
   * @param {Object} options - Opções
   * @returns {boolean}
   */
  close(modalId, options = {}) {
    const modal = Utils.el(modalId);
    if (!modal || !this.activeModals.has(modalId)) {
      return false;
    }

    const { force = false } = options;

    // Encontrar modal na pilha
    const modalIndex = this.modalStack.findIndex(m => m.id === modalId);
    if (modalIndex === -1 && !force) {
      return false;
    }

    const modalData = this.modalStack[modalIndex];

    // Callback de fechamento (pode prevenir fechamento)
    if (modalData?.options.onClose && typeof modalData.options.onClose === 'function') {
      try {
        const shouldClose = modalData.options.onClose(modal);
        if (shouldClose === false && !force) {
          return false;
        }
      } catch (error) {
        console.error('❌ Erro no callback onClose:', error);
      }
    }

    // Esconder modal
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    this.activeModals.delete(modalId);

    // Remover da pilha
    if (modalIndex > -1) {
      this.modalStack.splice(modalIndex, 1);
    }

    // Restaurar scroll se não há mais modais
    if (this.activeModals.size === 0) {
      document.body.style.overflow = '';
    }

    // Focar no modal anterior ou no documento
    if (this.modalStack.length > 0) {
      const previousModal = this.modalStack[this.modalStack.length - 1];
      this.focusModal(previousModal.element);
    } else {
      document.body.focus();
    }

    // Disparar evento
    window.dispatchEvent(new CustomEvent('modalClosed', {
      detail: { modalId, modal }
    }));

    return true;
  }

  /**
   * Fechar todos os modais
   */
  closeAll() {
    const modalIds = Array.from(this.activeModals);
    modalIds.forEach(modalId => this.close(modalId, { force: true }));
  }

  /**
   * Verificar se modal está aberto
   * @param {string} modalId
   * @returns {boolean}
   */
  isOpen(modalId) {
    return this.activeModals.has(modalId);
  }

  /**
   * Obter modal ativo no topo da pilha
   * @returns {Object|null}
   */
  getTopModal() {
    if (this.modalStack.length === 0) return null;
    return this.modalStack[this.modalStack.length - 1];
  }

  /**
   * Focar no primeiro elemento focável do modal
   * @param {HTMLElement} modal
   */
  focusModal(modal) {
    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modal.setAttribute('tabindex', '-1');
      modal.focus();
    }
  }

  /**
   * Manipular tecla ESC
   * @param {KeyboardEvent} event
   */
  handleEscapeKey(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      const topModal = this.getTopModal();
      if (topModal && topModal.options.closeOnEscape) {
        event.preventDefault();
        this.close(topModal.id);
      }
    }
  }

  /**
   * Manipular clique no backdrop
   * @param {MouseEvent} event
   */
  handleBackdropClick(event) {
    const topModal = this.getTopModal();
    if (!topModal) return;

    const modalElement = topModal.element;

    // Verificar se o clique foi diretamente no backdrop
    if (event.target === modalElement && topModal.options.closeOnBackdrop) {
      this.close(topModal.id);
    }
  }

  /**
   * Configurar botões de fechar
   * @param {string} modalId
   */
  setupCloseButtons(modalId) {
    const modal = Utils.el(modalId);
    if (!modal) return;

    // Botões com classe 'close-btn', 'modal-close' ou atributo data-modal-close
    const closeButtons = modal.querySelectorAll('.close-btn, .modal-close, [data-modal-close]');

    closeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close(modalId);
      });
    });
  }

  /**
   * Configurar modal automaticamente
   * @param {string} modalId
   * @param {Object} options
   * @returns {boolean}
   */
  setupModal(modalId, options = {}) {
    const modal = Utils.el(modalId);
    if (!modal) {
      console.error(`❌ Modal "${modalId}" não encontrado`);
      return false;
    }

    // Garantir classes corretas
    if (!modal.classList.contains('modal-backdrop')) {
      modal.classList.add('modal-backdrop');
    }
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }

    // Configurar atributos de acessibilidade
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    // Configurar botões de fechar
    this.setupCloseButtons(modalId);

    // Configurar triggers de abertura
    if (options.triggers) {
      const triggerList = Array.isArray(options.triggers) ? options.triggers : [options.triggers];

      triggerList.forEach(triggerSelector => {
        const triggers = document.querySelectorAll(triggerSelector);
        triggers.forEach(trigger => {
          trigger.addEventListener('click', (e) => {
            e.preventDefault();
            this.open(modalId, options);
          });
        });
      });
    }

    return true;
  }

  /**
   * Criar modal dinamicamente
   * @param {string} modalId
   * @param {string} content
   * @param {Object} options
   * @returns {HTMLElement}
   */
  createModal(modalId, content, options = {}) {
    const {
      title = '',
      className = '',
      showCloseButton = true,
      size = 'medium' // small, medium, large
    } = options;

    const sizeClass = `modal--${size}`;
    const closeBtn = showCloseButton
      ? `<button class="close-btn" aria-label="Fechar modal">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <line x1="18" y1="6" x2="6" y2="18"></line>
             <line x1="6" y1="6" x2="18" y2="18"></line>
           </svg>
         </button>`
      : '';

    const titleSection = title
      ? `<div class="modal-header">
           <h2 class="modal-title">${title}</h2>
         </div>`
      : '';

    const modalHTML = `
      <div id="${modalId}" class="modal-backdrop hidden ${className}" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal ${sizeClass}">
          ${closeBtn}
          ${titleSection}
          <div class="modal-body">
            ${content}
          </div>
        </div>
      </div>
    `;

    // Adicionar ao DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Configurar o modal
    this.setupModal(modalId, options);

    return Utils.el(modalId);
  }

  /**
   * Remover modal do DOM
   * @param {string} modalId
   */
  removeModal(modalId) {
    this.close(modalId, { force: true });
    const modal = Utils.el(modalId);
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Atualizar conteúdo do modal
   * @param {string} modalId
   * @param {string} content
   * @returns {boolean}
   */
  updateContent(modalId, content) {
    const modal = Utils.el(modalId);
    if (!modal) return false;

    const contentElement = modal.querySelector('.modal-body') || modal.querySelector('.modal-content') || modal.querySelector('.modal');

    if (contentElement) {
      contentElement.innerHTML = content;
      return true;
    }

    return false;
  }

  /**
   * Obter lista de modais ativos
   * @returns {Array}
   */
  getActiveModals() {
    return Array.from(this.activeModals);
  }

  /**
   * Destruir gerenciador
   */
  destroy() {
    this.closeAll();
    document.removeEventListener('keydown', this.escapeKeyHandler);
    if (this.backdropClickHandler) {
      document.removeEventListener('click', this.backdropClickHandler);
    }
    this.activeModals.clear();
    this.modalStack = [];
  }
}

// =============================================================================
// FUNÇÕES UTILITÁRIAS DE MODAL
// =============================================================================

/**
 * Criar modal de confirmação
 * @param {string} message - Mensagem de confirmação
 * @param {Object} options - Opções
 * @returns {string} - ID do modal criado
 */
function createConfirmModal(message, options = {}) {
  const {
    title = 'Confirmação',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmClass = 'btn--primary',
    cancelClass = 'btn--secondary',
    onConfirm = null,
    onCancel = null
  } = options;

  const modalId = `confirm-modal-${Utils.generateId()}`;

  const content = `
    <div class="confirm-modal">
      <div class="confirm-modal__message">
        <p>${message}</p>
      </div>
      <div class="confirm-modal__actions">
        <button class="btn ${confirmClass}" id="${modalId}-confirm">
          ${confirmText}
        </button>
        <button class="btn ${cancelClass}" id="${modalId}-cancel">
          ${cancelText}
        </button>
      </div>
    </div>
  `;

  Modal.createModal(modalId, content, {
    title,
    size: 'small',
    closeOnBackdrop: false,
    closeOnEscape: true,
    showCloseButton: false
  });

  // Configurar event listeners
  const confirmBtn = document.getElementById(`${modalId}-confirm`);
  const cancelBtn = document.getElementById(`${modalId}-cancel`);

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (onConfirm && typeof onConfirm === 'function') {
        onConfirm();
      }
      Modal.close(modalId);
      setTimeout(() => Modal.removeModal(modalId), 300);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (onCancel && typeof onCancel === 'function') {
        onCancel();
      }
      Modal.close(modalId);
      setTimeout(() => Modal.removeModal(modalId), 300);
    });
  }

  Modal.open(modalId);
  return modalId;
}

/**
 * Criar modal de alerta
 * @param {string} message - Mensagem de alerta
 * @param {Object} options - Opções
 * @returns {string} - ID do modal criado
 */
function createAlertModal(message, options = {}) {
  const {
    title = 'Aviso',
    buttonText = 'OK',
    buttonClass = 'btn--primary',
    type = 'info', // info, success, warning, error
    onClose = null
  } = options;

  const modalId = `alert-modal-${Utils.generateId()}`;

  const iconMap = {
    info: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    success: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    warning: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    error: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
  };

  const content = `
    <div class="alert-modal alert-modal--${type}">
      <div class="alert-modal__icon">
        ${iconMap[type] || iconMap.info}
      </div>
      <div class="alert-modal__message">
        <p>${message}</p>
      </div>
      <div class="alert-modal__actions">
        <button class="btn ${buttonClass}" id="${modalId}-ok">
          ${buttonText}
        </button>
      </div>
    </div>
  `;

  Modal.createModal(modalId, content, {
    title,
    size: 'small',
    closeOnBackdrop: true,
    closeOnEscape: true,
    showCloseButton: true
  });

  // Configurar event listener
  const okBtn = document.getElementById(`${modalId}-ok`);
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      if (onClose && typeof onClose === 'function') {
        onClose();
      }
      Modal.close(modalId);
      setTimeout(() => Modal.removeModal(modalId), 300);
    });
  }

  Modal.open(modalId);
  return modalId;
}

/**
 * Criar modal de prompt (input)
 * @param {string} message - Mensagem do prompt
 * @param {Object} options - Opções
 * @returns {string} - ID do modal criado
 */
function createPromptModal(message, options = {}) {
  const {
    title = 'Entrada de Dados',
    placeholder = '',
    defaultValue = '',
    inputType = 'text',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm = null,
    onCancel = null
  } = options;

  const modalId = `prompt-modal-${Utils.generateId()}`;

  const content = `
    <div class="prompt-modal">
      <div class="prompt-modal__message">
        <p>${message}</p>
      </div>
      <div class="prompt-modal__input">
        <input 
          type="${inputType}" 
          id="${modalId}-input" 
          class="form-control" 
          placeholder="${placeholder}"
          value="${defaultValue}"
          autofocus
        />
      </div>
      <div class="prompt-modal__actions">
        <button class="btn btn--primary" id="${modalId}-confirm">
          ${confirmText}
        </button>
        <button class="btn btn--secondary" id="${modalId}-cancel">
          ${cancelText}
        </button>
      </div>
    </div>
  `;

  Modal.createModal(modalId, content, {
    title,
    size: 'small',
    closeOnBackdrop: false,
    closeOnEscape: true,
    showCloseButton: false
  });

  const inputEl = document.getElementById(`${modalId}-input`);
  const confirmBtn = document.getElementById(`${modalId}-confirm`);
  const cancelBtn = document.getElementById(`${modalId}-cancel`);

  // Função para confirmar
  const confirm = () => {
    const value = inputEl.value.trim();
    if (onConfirm && typeof onConfirm === 'function') {
      onConfirm(value);
    }
    Modal.close(modalId);
    setTimeout(() => Modal.removeModal(modalId), 300);
  };

  // Enter no input confirma
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      }
    });
  }

  // Botão confirmar
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirm);
  }

  // Botão cancelar
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (onCancel && typeof onCancel === 'function') {
        onCancel();
      }
      Modal.close(modalId);
      setTimeout(() => Modal.removeModal(modalId), 300);
    });
  }

  Modal.open(modalId);
  setTimeout(() => inputEl?.focus(), 100);

  return modalId;
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================

const Modal = new ModalManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.Modal = Modal;
  window.createConfirmModal = createConfirmModal;
  window.createAlertModal = createAlertModal;
  window.createPromptModal = createPromptModal;
}

// =============================================================================
// FIM DO ARQUIVO
// =============================================================================
