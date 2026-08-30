import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
// ⚠️ Import di SOLO TIPO: lega `core/services/` a `shared/ui/icon/` in
// compilazione e in nient'altro (nessuna dipendenza a runtime, nessun peso nel
// bundle). Il guadagno e' che un refuso nel nome di un'icona diventa un errore
// di compilazione invece di un <svg> VUOTO renderizzato in silenzio — che e' il
// modo in cui `app-icon` fallisce quando il nome non ha il suo ramo @case.
import type { IconName } from '../../shared/ui/icon/icon.component';

export type Theme = 'light' | 'tramonto' | 'dark';

const STORAGE_KEY = 'bff-theme';

export interface ThemeOption {
  value: Theme;
  name: string;
  icon: IconName;
}

/** i temi disponibili, nell'ordine del menù */
// ⚠️ Erano tre CARATTERI (U+2600, U+1F307, U+263E) e ora sono tre icone del
// set. I font del sito sono sottoinsiemi latini e non contengono nessuno dei
// tre: li disegnava il sistema operativo, con forma e peso diversi su ogni
// piattaforma. Il tramonto era per giunta un'emoji, quindi ignorava
// `currentColor` in tutti e quattro gli stati del pulsante e portava dentro
// arancio e blu — l'unico colore che il tema Tramonto ha eliminato.
// Stessa conclusione, e stesso rimedio, dei semi delle carte.
const OPTIONS: ThemeOption[] = [
  { value: 'light', name: 'Ghiaccio', icon: 'sun' },
  { value: 'tramonto', name: 'Tramonto', icon: 'sunset' },
  { value: 'dark', name: 'Notte', icon: 'moon' },
];

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
  // DOCUMENT iniettato (non il globale `document`): SSR/prerender-safe — sul
  // platform-server `document` come global non esiste, il token invece sì.
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly options = OPTIONS;
  readonly theme = signal<Theme>(this.initialTheme());

  /** icona del tema attivo (trigger del menù) */
  readonly icon = computed<IconName>(
    // ⚠️ Il ripiego e' un NOME del set, non un carattere: con `icon: IconName`
    // una stringa qualunque qui non compilerebbe piu'. Scatta solo con un
    // `data-theme` sconosciuto, cioe' quasi mai, cioe' quando nessuno guarda.
    () => OPTIONS.find((o) => o.value === this.theme())?.icon ?? 'sun',
  );

  constructor() {
    effect(() => {
      const theme = this.theme();
      // In prerender (Node/domino) non tocchiamo il DOM: `dataset`/localStorage
      // non esistono e il tema lo applica comunque lo script anti-flash in
      // index.html prima del paint. Lato client l'effect gira normalmente.
      if (!this.isBrowser) return;
      this.doc.documentElement.dataset['theme'] = theme;
      this.doc
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', META_COLORS[theme]);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* storage non disponibile: il tema vale solo per la sessione */
      }
    });
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private initialTheme(): Theme {
    // Sul server default 'light' (lo script inline sceglierà il tema reale nel
    // browser); evita di leggere `dataset` che su domino è undefined.
    if (!this.isBrowser) return 'light';
    const current = this.doc.documentElement.dataset['theme'];
    return OPTIONS.some((o) => o.value === current)
      ? (current as Theme)
      : 'light';
  }
}
