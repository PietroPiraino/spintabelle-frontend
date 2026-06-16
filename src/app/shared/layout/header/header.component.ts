import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Theme, ThemeService } from '../../../core/services/theme.service';

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

  protected readonly menuOpen = signal(false);
  /** tendina dei temi aperta via click/tap (su desktop basta l'hover) */
  protected readonly themeMenuOpen = signal(false);

  protected readonly navLinks = [
    { path: '/tabelle', label: 'Tabelle' },
    { path: '/allenamento', label: 'Allenamento' },
    { path: '/lezioni', label: 'Lezioni' },
    { path: '/live', label: 'Live' },
    { path: '/abbonati', label: 'Abbonati' },
    { path: '/news', label: 'News' },
    { path: '/chi-siamo', label: 'Chi siamo' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleThemeMenu(): void {
    this.themeMenuOpen.update((open) => !open);
  }

  protected setTheme(theme: Theme): void {
    this.themeService.set(theme);
    this.themeMenuOpen.set(false);
  }

  // chiude la tendina dei temi cliccando altrove o premendo Esc
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.themeMenuOpen() &&
      !(event.target as Element | null)?.closest('.header__theme-wrap')
    ) {
      this.themeMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.themeMenuOpen.set(false);
  }

  protected logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe(() => void this.router.navigate(['/']));
  }
}
