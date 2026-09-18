/**
 * Accessible Modal Dialog Component for Team D Frontend.
 */

class ModalManager {
  constructor() {
    this.modalRoot = document.getElementById('modal-root');
    if (!this.modalRoot) {
      this.modalRoot = document.createElement('div');
      this.modalRoot.id = 'modal-root';
      document.body.appendChild(this.modalRoot);
    }

    // Handle ESC key to dismiss modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentModal) {
        this.close();
      }
    });
  }

  open({ title, contentHtml, buttons = [], onClose = null }) {
    this.close();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'modal-title');

    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h2 id="modal-title" class="card-title">${this._escape(title)}</h2>
          <button class="btn-ghost btn-sm modal-close-btn" aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body">
          ${contentHtml}
        </div>
        <div class="modal-footer"></div>
      </div>
    `;

    const footer = backdrop.querySelector('.modal-footer');
    if (buttons.length === 0) {
      buttons.push({ text: 'Close', className: 'btn-secondary', onClick: () => this.close() });
    }

    buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.className || 'btn-secondary'}`;
      btn.textContent = btnConfig.text;
      btn.addEventListener('click', async (e) => {
        if (btnConfig.onClick) {
          const shouldClose = await btnConfig.onClick(e, backdrop);
          if (shouldClose !== false) this.close();
        } else {
          this.close();
        }
      });
      footer.appendChild(btn);
    });

    const closeBtn = backdrop.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => this.close());

    // Backdrop click outside dialog to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });

    this.modalRoot.appendChild(backdrop);
    this.currentModal = { backdrop, onClose };

    // Trigger animation
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      const firstFocusable = backdrop.querySelector('button, input, select, textarea, [tabindex="0"]');
      if (firstFocusable) firstFocusable.focus();
    });
  }

  close() {
    if (this.currentModal) {
      const { backdrop, onClose } = this.currentModal;
      backdrop.classList.remove('open');
      setTimeout(() => {
        if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
        if (onClose) onClose();
      }, 200);
      this.currentModal = null;
    }
  }

  confirm({ title, message, confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
    this.open({
      title,
      contentHtml: `<p style="color: var(--text-secondary);">${this._escape(message)}</p>`,
      buttons: [
        { text: 'Cancel', className: 'btn-secondary', onClick: () => true },
        { text: confirmText, className: confirmClass, onClick: async () => { await onConfirm(); return true; } }
      ]
    });
  }

  _escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.modal = new ModalManager();
