import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * Contenitore dei toast effimeri (montato una volta in app-root). Legge i toast
 * dal [[ToastService]] e li impila in basso al centro; ogni toast è dismissibile.
 * `aria-live="polite"` annuncia i messaggi agli screen reader.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="toast-host" aria-live="polite" aria-atomic="false">
    @for (t of toasts(); track t.id) {
      <div class="toast" [class]="'toast is-' + t.kind">
        <span class="toast__text">{{ t.text }}</span>
        <button
          type="button"
          class="toast__close"
          aria-label="Chiudi notifica"
          (click)="dismiss(t.id)"
        >
          ×
        </button>
      </div>
    }
  </div>`,
  styles: `
    .toast-host {
      position: fixed;
      left: 50%;
      bottom: 1.5rem;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      width: max-content;
      max-width: min(92vw, 460px);
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.7rem 0.9rem 0.7rem 1rem;
      border-radius: var(--radius);
      border: 1px solid var(--line-strong);
      background: var(--surface-1);
      color: var(--text);
      box-shadow: var(--shadow-pop);
      font-size: 0.92rem;
      font-weight: 500;
      border-left-width: 4px;
    }
    .toast.is-success {
      border-left-color: var(--felt);
    }
    .toast.is-error {
      border-left-color: var(--danger);
    }
    .toast.is-info {
      border-left-color: var(--neon-cyan);
    }
    .toast__text {
      min-width: 0;
    }
    .toast__close {
      flex: none;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
      color: var(--text-muted);
      padding: 0 0.15rem;
    }
    .toast__close:hover {
      color: var(--text);
    }
    @media (prefers-reduced-motion: no-preference) {
      .toast {
        animation: toast-in 180ms var(--ease-out, ease-out);
      }
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class ToastComponent {
  private readonly svc = inject(ToastService);
  readonly toasts = this.svc.toasts;

  dismiss(id: number): void {
    this.svc.dismiss(id);
  }
}
