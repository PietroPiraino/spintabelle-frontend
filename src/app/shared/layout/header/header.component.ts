import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Theme, ThemeService } from '../../../core/services/theme.service';

interface NavLink {
  path: string;
  label: string;
  /** mostra un micro-badge "Nuovo" finché la voce è una novità */
  isNew?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  children: NavLink[];
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  /** menu mobile (burger) aperto */
  protected readonly menuOpen = signal(false);
  /**
   * Id dell'UNICA tendina aperta via click/tap (gruppi di nav + tema).
   * Su desktop le tendine si aprono anche all'hover/focus (solo CSS); questo
   * signal è il fallback per touch e l'accordion su mobile. null = tutte chiuse.
   */
  protected readonly openDropdown = signal<string | null>(null);

  /**
   * Le destinazioni raggruppate. Due tendine sole: `Studia` = tutto cio' che si
   * studia, `Scuola` = tutto il resto del perimetro.
   * ⚠️ Le voci di primo livello restano CINQUE (2 tendine + 3 link diretti),
   * come prima del 23/08/2026: `Tabelle` e' scesa in `Studia`, `News` e `Live`
   * sono salite. Le etichette nuove sono piu' corte e i caret passano da 3 a 2,
   * quindi la barra si e' ristretta e il breakpoint burger (1024/1025px, la
   * sola coppia di media query del file) NON va toccato. Aggiungendo altre voci
   * dirette va invece rimisurata: a 1025px la barra deve stare su una riga.
   */
  protected readonly groups: NavGroup[] = [
    {
      id: 'studia',
      label: 'Studia',
      children: [
        { path: '/lezioni', label: 'Lezioni' },
        // ⚠️ `isNew` spostato qui dal Negozio: il flag e' UNO e si muove a mano,
        // e il Replayer e' la sezione nuova. Riportarlo indietro e' una riga.
        { path: '/replayer', label: 'Replayer', isNew: true },
        { path: '/docs', label: 'Docs' },
        { path: '/simulatore-varianza', label: 'Simulatore varianza' },
        { path: '/tabelle', label: 'Tabelle' },
        { path: '/allenamento', label: 'Allenamento' },
      ],
    },
    {
      id: 'scuola',
      label: 'Scuola',
      children: [
        { path: '/affiliazioni', label: 'Affiliazioni' },
        // ⚠️ `isNew` e' un flag che si sposta A MANO: oggi sta sul Replayer.
        // Le guide e il Negozio ce l'hanno avuto e non sono piu' una novita'.
        { path: '/negozio', label: 'Negozio' },
        { path: '/guide', label: 'Guide' },
        { path: '/chi-siamo', label: 'Chi siamo' },
      ],
    },
  ];

  /**
   * Voci dirette, dopo le tendine: le due sezioni che si aggiornano da sole
   * (e vanno raggiunte in un clic) e la conversione.
   * ⚠️ Il micro-badge `isNew` NON funziona qui: e' posizionato con
   * `margin-left: auto` e vive del `display: flex` di `.header__menu-link`,
   * che `.header__link` non ha. Per un "Nuovo" su una voce diretta servono
   * markup e CSS nuovi.
   */
  protected readonly dirette: NavLink[] = [
    { path: '/news', label: 'News' },
    { path: '/live', label: 'Live' },
    { path: '/abbonati', label: 'Abbonati' },
  ];

  /** Punti BFF col separatore migliaia italiano (150000 → "150.000"). */
  protected readonly pointsFmt = computed(() =>
    new Intl.NumberFormat('it-IT').format(this.auth.points()),
  );

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    if (!this.menuOpen()) {
      this.openDropdown.set(null);
    }
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.openDropdown.set(null);
  }

  /** Apre/chiude una tendina (gruppo o tema); ne tiene aperta una sola. */
  protected toggleDropdown(id: string): void {
    this.openDropdown.update((current) => (current === id ? null : id));
  }

  protected setTheme(theme: Theme): void {
    this.themeService.set(theme);
    // su desktop chiude la tendina tema; su mobile il tema è una riga sempre
    // visibile, quindi non tocca il pannello burger
    this.openDropdown.set(null);
  }

  // chiude la tendina aperta cliccando fuori da qualunque menu
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.openDropdown() &&
      !(event.target as Element | null)?.closest('.header__has-menu')
    ) {
      this.openDropdown.set(null);
    }
  }

  // Esc: prima chiude un'eventuale tendina, poi il pannello mobile
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.openDropdown()) {
      this.openDropdown.set(null);
    } else {
      this.menuOpen.set(false);
    }
  }

  protected logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe(() => void this.router.navigate(['/']));
  }
}
