import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminAuditComponent } from './admin-audit/admin-audit.component';
import { AdminDiscountsComponent } from './admin-discounts/admin-discounts.component';
import { AdminDocumentsComponent } from './admin-documents/admin-documents.component';
import { AdminLessonsComponent } from './admin-lessons/admin-lessons.component';
import { AdminLiveComponent } from './admin-live/admin-live.component';
import { AdminNewsComponent } from './admin-news/admin-news.component';
import { AdminShopComponent } from './admin-shop/admin-shop.component';
import { AdminSubscriptionRequestsComponent } from './admin-subscription-requests/admin-subscription-requests.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';

type AdminTab =
  | 'lezioni'
  | 'live'
  | 'news'
  | 'documenti'
  | 'negozio'
  | 'iscritti'
  | 'richieste'
  | 'sconti'
  | 'log';

@Component({
  selector: 'app-admin',
  imports: [
    AdminLessonsComponent,
    AdminLiveComponent,
    AdminNewsComponent,
    AdminDocumentsComponent,
    AdminShopComponent,
    AdminUsersComponent,
    AdminSubscriptionRequestsComponent,
    AdminDiscountsComponent,
    AdminAuditComponent,
  ],
  template: `
    <section class="section">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Backstage</span>
          <h1>Pannello admin</h1>
        </div>

        <div class="admin-tabs" role="tablist" aria-label="Sezioni del pannello">
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'lezioni'"
            [attr.aria-selected]="tab() === 'lezioni'"
            (click)="setTab('lezioni')"
          >♠ Lezioni</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'live'"
            [attr.aria-selected]="tab() === 'live'"
            (click)="setTab('live')"
          >▶ Live</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'news'"
            [attr.aria-selected]="tab() === 'news'"
            (click)="setTab('news')"
          >♦ News</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'documenti'"
            [attr.aria-selected]="tab() === 'documenti'"
            (click)="setTab('documenti')"
          >▤ Documenti</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'negozio'"
            [attr.aria-selected]="tab() === 'negozio'"
            (click)="setTab('negozio')"
          >🛍 Negozio</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'iscritti'"
            [attr.aria-selected]="tab() === 'iscritti'"
            (click)="setTab('iscritti')"
          >♣ Iscritti</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'richieste'"
            [attr.aria-selected]="tab() === 'richieste'"
            (click)="setTab('richieste')"
          >♥ Richieste</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'sconti'"
            [attr.aria-selected]="tab() === 'sconti'"
            (click)="setTab('sconti')"
          >% Sconti</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'log'"
            [attr.aria-selected]="tab() === 'log'"
            (click)="setTab('log')"
          >⛁ Log</button>
        </div>

        @if (tab() === 'lezioni') {
          <app-admin-lessons />
        } @else if (tab() === 'live') {
          <app-admin-live />
        } @else if (tab() === 'news') {
          <app-admin-news />
        } @else if (tab() === 'documenti') {
          <app-admin-documents />
        } @else if (tab() === 'negozio') {
          <app-admin-shop />
        } @else if (tab() === 'iscritti') {
          <app-admin-users />
        } @else if (tab() === 'richieste') {
          <app-admin-subscription-requests />
        } @else if (tab() === 'sconti') {
          <app-admin-discounts />
        } @else {
          <app-admin-audit />
        }
      </div>
    </section>
  `,
  styles: `
    .admin-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 2.2rem;
      border-bottom: 1px solid var(--line);
    }

    .admin-tabs__tab {
      padding: 0.7rem 1.4rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: color var(--t-fast), border-color var(--t-fast);

      &:hover {
        color: var(--cream-100);
      }

      &.is-active {
        color: var(--ember);
        border-bottom-color: var(--copper-400);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private static readonly TABS: AdminTab[] = [
    'lezioni',
    'live',
    'news',
    'documenti',
    'negozio',
    'iscritti',
    'richieste',
    'sconti',
    'log',
  ];

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Tab deep-linkabile via ?tab= (es. il link nell'email all'owner → richieste).
  protected readonly tab = signal<AdminTab>(this.initialTab());

  private initialTab(): AdminTab {
    const q = this.route.snapshot.queryParamMap.get('tab') ?? '';
    return (AdminComponent.TABS as string[]).includes(q)
      ? (q as AdminTab)
      : 'lezioni';
  }

  protected setTab(tab: AdminTab): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
