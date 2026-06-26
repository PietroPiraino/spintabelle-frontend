import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Nomi delle icone disponibili (set minimo per la sala live). */
export type IconName =
  | 'mic'
  | 'mic-off'
  | 'video'
  | 'video-off'
  | 'screen-share'
  | 'maximize'
  | 'users'
  | 'log-out'
  | 'record'
  | 'square'
  | 'radio';

/**
 * Icona SVG inline, theme-aware (`currentColor`), 24×24 viewBox.
 * Sostituisce le emoji di sistema nei controlli: rese coerenti cross-OS,
 * ereditano il colore del testo e si allineano ai pulsanti.
 * Uso: `<app-icon name="mic" />` o `<app-icon name="users" [size]="18" />`.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon', 'aria-hidden': 'true' },
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false"
  >
    @switch (name()) {
      @case ('mic') {
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      }
      @case ('mic-off') {
        <line x1="2" x2="22" y1="2" y2="22" />
        <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
        <path d="M5 10v2a7 7 0 0 0 12 5" />
        <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        <line x1="12" x2="12" y1="19" y2="22" />
      }
      @case ('video') {
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
      }
      @case ('video-off') {
        <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
        <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" />
        <line x1="2" x2="22" y1="2" y2="22" />
      }
      @case ('screen-share') {
        <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="m17 8 5-5" />
        <path d="M17 3h5v5" />
      }
      @case ('maximize') {
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      }
      @case ('users') {
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      }
      @case ('log-out') {
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      }
      @case ('record') {
        <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
      }
      @case ('square') {
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
      }
      @case ('radio') {
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
      }
    }
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    svg {
      display: block;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
