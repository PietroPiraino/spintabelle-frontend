import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bff-theme';

/**
 * Tema chiaro/scuro: applica data-theme su <html> e persiste la scelta.
 * Lo stato iniziale è già stato impostato dallo script inline in index.html
 * (localStorage o prefers-color-scheme) per evitare il flash al caricamento.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage non disponibile: il tema vale solo per la sessione */
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  private initialTheme(): Theme {
    return document.documentElement.dataset['theme'] === 'dark'
      ? 'dark'
      : 'light';
  }
}
