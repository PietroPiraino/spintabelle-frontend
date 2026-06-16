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

  /** Voci dirette ai lati delle tendine: prodotto-core e conversione. */
  protected readonly tabelle: NavLink = { path: '/tabelle', label: 'Tabelle' };
  protected readonly abbonati: NavLink = { path: '/abbonati', label: 'Abbonati' };

  /** Le altre destinazioni, raggruppate per ridurre le voci di primo livello. */
  protected readonly groups: NavGroup[] = [
    {
      id: 'studia',
      label: 'Studia',
      children: [
        { path: '/allenamento', label: 'Allenamento' },
        { path: '/lezioni', label: 'Lezioni' },
      ],
    },
    {
      id: 'community',
      label: 'Community',
      children: [
        { path: '/live', label: 'Live' },
        { path: '/news', label: 'News' },
        { path: '/chi-siamo', label: 'Chi siamo' },
      ],
    },
    {
      id: 'risorse',
      label: 'Risorse',
      children: [
        { path: '/docs', label: 'Docs', isNew: true },
        { path: '/affiliazioni', label: 'Affiliazioni', isNew: true },
      ],
    },
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
