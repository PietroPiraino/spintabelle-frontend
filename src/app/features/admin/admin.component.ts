import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AdminPendingService } from '../../core/services/admin-pending.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ADMIN_NAV } from './admin-nav';

/**
 * Shell della dashboard admin: sidebar di navigazione (gruppi + badge "in
 * attesa") e `<router-outlet>` per le sezioni. Ogni sezione è una rotta figlia
 * `/admin/<sezione>` col suo chunk lazy — la shell non importa più nessun tab.
 *
 * Sotto i 1024px (stesso breakpoint del burger dell'header) la sidebar diventa
 * un pannello a scomparsa in-flow aperto dal pulsante "Sezioni" della topbar:
 * accordion, non overlay — niente focus-trap/scroll-lock da scrivere a mano.
 *
 * I vecchi deep-link `?tab=` (email già inviate) sono gestiti da
 * `adminTabCompatGuard` sulla rotta figlia a path vuoto.
 */
@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly router = inject(Router);
  protected readonly pending = inject(AdminPendingService);

  protected readonly nav = ADMIN_NAV;

  /** Pannello sezioni mobile (≤1024px) aperto. */
  protected readonly drawerOpen = signal(false);

  /** Etichetta della sezione corrente per l'h1 della topbar. */
  protected readonly currentLabel = signal(this.labelFor(this.router.url));

  constructor() {
    this.pending.refresh();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.currentLabel.set(this.labelFor(this.router.url));
        this.drawerOpen.set(false);
        // il min-interval sta nel service: cambiare sezione non fa raffiche
        this.pending.refresh();
      });
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  /** Conteggio per il badge di una voce (null/0 = badge assente). */
  protected badgeCount(badge: 'richieste' | 'affiliazioni'): number | null {
    return badge === 'richieste'
      ? this.pending.richieste()
      : this.pending.affiliazioni();
  }

  // chiude il pannello mobile cliccando fuori da sidebar e toggle
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.drawerOpen()) return;
    const target = event.target as Element | null;
    if (
      !target?.closest('.admin-shell__sidebar') &&
      !target?.closest('.admin-shell__toggle')
    ) {
      this.drawerOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.drawerOpen.set(false);
  }

  private labelFor(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const seg = path.startsWith('/admin')
      ? path.slice('/admin'.length).replace(/^\//, '')
      : '';
    for (const group of ADMIN_NAV) {
      const hit = group.items.find((item) => item.path === seg);
      if (hit) return hit.label;
    }
    return 'Panoramica';
  }
}
