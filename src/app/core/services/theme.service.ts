import { Injectable, computed, effect, signal } from '@angular/core';

export type Theme = 'light' | 'tramonto' | 'dark';

const STORAGE_KEY = 'bff-theme';

/** ordine del ciclo: giorno → tramonto → notte */
const ORDER: Theme[] = ['light', 'tramonto', 'dark'];

const NAMES: Record<Theme, string> = {
  light: 'Ghiaccio',
  tramonto: 'Tramonto',
  dark: 'Notte',
};

const ICONS: Record<Theme, string> = {
  light: '☀',
  tramonto: '🌇',
  dark: '☾',
};

/** colore della cornice browser (meta theme-color) per ogni tema */
const META_COLORS: Record<Theme, string> = {
  light: '#f7f5f0',
  tramonto: '#fdeee4',
  dark: '#0b1124',
};

/**
 * Temi del sito: applica data-theme su <html> e persiste la scelta.
 * Lo stato iniziale è già stato impostato dallo script inline in index.html
 * (localStorage o prefers-color-scheme) per evitare il flash al caricamento.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initialTheme());

  /** il tema che si attiverebbe al prossimo click (per icona e tooltip) */
  readonly next = computed<Theme>(
    () => ORDER[(ORDER.indexOf(this.theme()) + 1) % ORDER.length],
  );
  readonly nextName = computed(() => NAMES[this.next()]);
  readonly nextIcon = computed(() => ICONS[this.next()]);

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', META_COLORS[theme]);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage non disponibile: il tema vale solo per la sessione */
      }
    });
  }

  /** passa al tema successivo del ciclo */
  cycle(): void {
    this.theme.set(this.next());
  }

  private initialTheme(): Theme {
    const current = document.documentElement.dataset['theme'];
    return ORDER.includes(current as Theme) ? (current as Theme) : 'light';
  }
}
