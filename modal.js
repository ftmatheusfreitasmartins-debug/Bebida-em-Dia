// --- Módulo de Gerenciamento de Modais ---

class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.modalStack = [];
    this.escapeKeyHandler = this.handleEscapeKey.bind(this);
    this.init();
  }

  init() {
    // Escutar tecla ESC globalmente
    document.addEventListener('keydown', this.escapeKeyHandler);
    
    // Escutar cliques no backdrop
    document.addEventListener('click', this.handleBackdropClick.bind(this));
  }

  // Abrir modal
  open(modalId, options = {}) {
    const modal = Utils.el(modalId);
    if (!modal) {
      console.error(`Modal ${modalId} não encontrado`);
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
    this.activeModals.add(modalId);

    // Focar no modal
    if (focus) {
      this.focusModal(modal);
    }

    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';

    // Callback de abertura
    if (onOpen && typeof onOpen === 'function') {
      try {
        onOpen(modal);
      } catch (error) {
        console.error('Erro no callback onOpen:', error);
      }
    }

    // Disparar evento
    window.dispatchEvent(new CustomEvent('modalOpened', { 
      detail: { modalId, modal }
    }));

    return true;
  }

  // Fechar modal
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

    // Callback de fechamento
    if (modalData?.options.onClose && typeof modalData.options.onClose === 'function') {
      try {
        const shouldClose = modalData.options.onClose(modal);
        if (shouldClose === false && !force) {
          return false;
        }
      } catch (error) {
        console.error('Erro no callback onClose:', error);
      }
    }

    // Esconder modal
    modal.classList.add('hidden');
    modal.style.display = 'none';
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

  // Fechar todos os modais
  closeAll() {
    const modalIds = Array.from(this.activeModals);
    modalIds.forEach(modalId => this.close(modalId, { force: true }));
  }

  // Verificar se modal está aberto
  isOpen(modalId) {
    return this.activeModals.has(modalId);
  }

  // Obter modal ativo no topo
  getTopModal() {
    if (this.modalStack.length === 0) return null;
    return this.modalStack[this.modalStack.length - 1];
  }

  // Focar no modal
  focusModal(modal) {
    // Procurar primeiro elemento focável
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modal.focus();
    }
  }

  // Manipular tecla ESC
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      const topModal = this.getTopModal();
      if (topModal && topModal.options.closeOnEscape) {
        this.close(topModal.id);
      }
    }
  }

  // Manipular clique no backdrop
  handleBackdropClick(event) {
    const topModal = this.getTopModal();
    if (!topModal) return;

    const modalElement = topModal.element;
    const modalContent = modalElement.querySelector('.modal');

    // Verificar se o clique foi no backdrop (fora do conteúdo do modal)
    if (event.target === modalElement && topModal.options.closeOnBackdrop) {
      this.close(topModal.id);
    }
  }

  // Configurar botões de fechar
  setupCloseButtons(modalId) {
    const modal = Utils.el(modalId);
    if (!modal) return;

    // Botões com classe 'close-btn' ou 'modal-close'
    const closeButtons = modal.querySelectorAll('.close-btn, .modal-close, [data-modal-close]');
    
    closeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.close(modalId);
      });
    });
  }

  // Configurar modal automaticamente
  setupModal(modalId, options = {}) {
    const modal = Utils.el(modalId);
    if (!modal) {
      console.error(`Modal ${modalId} não encontrado`);
      return false;
    }

    // Garantir que o modal tenha a classe correta
    modal.classList.add('modal-backdrop');
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }

    // Configurar botões de fechar
    this.setupCloseButtons(modalId);

    // Configurar triggers de abertura
    if (options.triggers) {
      options.triggers.forEach(triggerSelector => {
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

  // Criar modal dinamicamente
  createModal(modalId, content, options = {}) {
    const {
      title = '',
      className = '',
      showCloseButton = true,
      size = 'medium' // small, medium, large
    } = options;

    const modalHTML = `
      <div class="modal-backdrop hidden" id="${modalId}">
        <div class="modal modal-${size} ${className}">
          ${title ? `
            <div class="modal-header">
              <h2 class="modal-title">${title}</h2>
              ${showCloseButton ? '<button class="btn close-btn" aria-label="Fechar modal"><i class="fas fa-times"></i></button>' : ''}
            </div>
          ` : ''}
          <div class="modal-content">
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

  // Remover modal do DOM
  removeModal(modalId) {
    this.close(modalId, { force: true });
    const modal = Utils.el(modalId);
    if (modal) {
      modal.remove();
    }
  }

  // Atualizar conteúdo do modal
  updateContent(modalId, content) {
    const modal = Utils.el(modalId);
    if (!modal) return false;

    const contentElement = modal.querySelector('.modal-content') || modal.querySelector('.modal');
    if (contentElement) {
      contentElement.innerHTML = content;
      return true;
    }
    return false;
  }

  // Obter lista de modais ativos
  getActiveModals() {
    return Array.from(this.activeModals);
  }

  // Destruir gerenciador
  destroy() {
    this.closeAll();
    document.removeEventListener('keydown', this.escapeKeyHandler);
    this.activeModals.clear();
    this.modalStack = [];
  }
}

// --- Utilitários de Modal ---

// Criar modal de confirmação
function createConfirmModal(message, options = {}) {
  const {
    title = 'Confirmação',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmClass = 'btn-danger',
    onConfirm = null,
    onCancel = null
  } = options;

  const modalId = `confirm-modal-${Utils.generateId()}`;
  
  const content = `
    <p class="modal-desc">${message}</p>
    <div class="actions-group">
      <button class="btn ${confirmClass}" id="${modalId}-confirm">${confirmText}</button>
      <button class="btn btn-outline" id="${modalId}-cancel">${cancelText}</button>
    </div>
  `;

  const modal = Modal.createModal(modalId, content, { 
    title, 
    closeOnBackdrop: false,
    closeOnEscape: true 
  });

  // Configurar botões
  Utils.el(`${modalId}-confirm`).addEventListener('click', () => {
    Modal.close(modalId);
    if (onConfirm) onConfirm();
  });

  Utils.el(`${modalId}-cancel`).addEventListener('click', () => {
    Modal.close(modalId);
    if (onCancel) onCancel();
  });

  return modalId;
}

// Criar modal de alerta
function createAlertModal(message, options = {}) {
  const {
    title = 'Aviso',
    buttonText = 'OK',
    type = 'info', // info, success, warning, error
    onClose = null
  } = options;

  const modalId = `alert-modal-${Utils.generateId()}`;
  
  const icons = {
    info: 'fa-info-circle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    error: 'fa-times-circle'
  };

  const content = `
    <div class="alert-content alert-${type}">
      <i class="fas ${icons[type]} alert-icon"></i>
      <p class="modal-desc">${message}</p>
    </div>
    <div class="actions-group">
      <button class="btn" id="${modalId}-ok">${buttonText}</button>
    </div>
  `;

  const modal = Modal.createModal(modalId, content, { 
    title,
    closeOnBackdrop: true,
    closeOnEscape: true 
  });

  // Configurar botão
  Utils.el(`${modalId}-ok`).addEventListener('click', () => {
    Modal.close(modalId);
    if (onClose) onClose();
  });

  return modalId;
}

// Criar modal de prompt
function createPromptModal(message, options = {}) {
  const {
    title = 'Entrada',
    placeholder = '',
    defaultValue = '',
    confirmText = 'OK',
    cancelText = 'Cancelar',
    inputType = 'text',
    onConfirm = null,
    onCancel = null
  } = options;

  const modalId = `prompt-modal-${Utils.generateId()}`;
  const inputId = `${modalId}-input`;
  
  const content = `
    <p class="modal-desc">${message}</p>
    <input type="${inputType}" id="${inputId}" class="form-input" placeholder="${placeholder}" value="${defaultValue}">
    <div class="actions-group">
      <button class="btn" id="${modalId}-confirm">${confirmText}</button>
      <button class="btn btn-outline" id="${modalId}-cancel">${cancelText}</button>
    </div>
  `;

  const modal = Modal.createModal(modalId, content, { 
    title,
    closeOnBackdrop: false,
    closeOnEscape: true 
  });

  const input = Utils.el(inputId);

  // Configurar botões
  Utils.el(`${modalId}-confirm`).addEventListener('click', () => {
    const value = input.value.trim();
    Modal.close(modalId);
    if (onConfirm) onConfirm(value);
  });

  Utils.el(`${modalId}-cancel`).addEventListener('click', () => {
    Modal.close(modalId);
    if (onCancel) onCancel();
  });

  // Enter para confirmar
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = input.value.trim();
      Modal.close(modalId);
      if (onConfirm) onConfirm(value);
    }
  });

  return modalId;
}

// Instância global
window.Modal = new ModalManager();

// Utilitários globais
window.ModalUtils = {
  createConfirmModal,
  createAlertModal,
  createPromptModal
};

