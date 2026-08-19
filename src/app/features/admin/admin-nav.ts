import { IconName } from '../../shared/ui/icon/icon.component';

/**
 * Quali conteggi "in attesa" la sidebar sa mostrare. Union unica: la firma di
 * `AdminComponent.badgeCount` la importa da qui invece di riscriverla, così
 * aggiungere un badge non compila finché non gli si dà anche la sua fonte.
 */
export type AdminBadge = 'richieste' | 'affiliazioni' | 'redazione';

export interface AdminNavItem {
  /** Segmento figlio sotto `/admin` (`''` = Panoramica). */
  path: string;
  label: string;
  icon: IconName;
  /** Quale conteggio di `AdminPendingService` mostrare come badge. */
  badge?: AdminBadge;
  /** Sezione placeholder: mostra il chip "Presto". */
  soon?: boolean;
}

export interface AdminNavGroup {
  id: string;
  /** `null` = voci senza intestazione (la Panoramica in testa). */
  label: string | null;
  items: AdminNavItem[];
}

/**
 * Le voci della sidebar admin, raggruppate. Aggiungere una sezione = una voce
 * qui + una rotta figlia in `app.routes.ts` (con `title`) — la regola
 * `/admin/*` in `public/_redirects` copre già ogni nuovo segmento.
 *
 * I `path` dei 12 tab storici coincidono con i vecchi valori di `?tab=`:
 * è il contratto su cui si regge `adminTabCompatGuard` (email già inviate).
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'home',
    label: null,
    items: [{ path: '', label: 'Panoramica', icon: 'layout-dashboard' }],
  },
  {
    id: 'contenuti',
    label: 'Contenuti',
    items: [
      { path: 'lezioni', label: 'Lezioni', icon: 'graduation-cap' },
      { path: 'live', label: 'Live', icon: 'video' },
      { path: 'news', label: 'News', icon: 'newspaper' },
      {
        path: 'redazione',
        label: 'Redazione',
        icon: 'pen-tool',
        badge: 'redazione',
      },
      { path: 'documenti', label: 'Documenti', icon: 'file-text' },
    ],
  },
  {
    id: 'vendite',
    label: 'Vendite',
    items: [
      { path: 'richieste', label: 'Richieste', icon: 'inbox', badge: 'richieste' },
      { path: 'sconti', label: 'Sconti', icon: 'percent' },
      { path: 'negozio', label: 'Negozio', icon: 'shopping-bag' },
      {
        path: 'affiliazioni',
        label: 'Affiliazioni',
        icon: 'link-2',
        badge: 'affiliazioni',
      },
    ],
  },
  {
    id: 'utenti',
    label: 'Utenti',
    items: [
      { path: 'iscritti', label: 'Iscritti', icon: 'users' },
      { path: 'partecipazione', label: 'Partecipazione', icon: 'activity' },
    ],
  },
  {
    id: 'finanze',
    label: 'Finanze',
    items: [
      { path: 'stakings', label: 'Stakings', icon: 'hand-coins', soon: true },
      {
        path: 'conteggi-mensili',
        label: 'Conteggi mensili',
        icon: 'calendar-days',
        soon: true,
      },
    ],
  },
  {
    id: 'analisi',
    label: 'Analisi',
    items: [
      { path: 'statistiche', label: 'Statistiche', icon: 'bar-chart-3' },
      { path: 'log', label: 'Log', icon: 'scroll-text' },
    ],
  },
];
