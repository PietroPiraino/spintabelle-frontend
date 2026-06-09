import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdminLessonsComponent } from './admin-lessons/admin-lessons.component';
import { AdminNewsComponent } from './admin-news/admin-news.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';

type AdminTab = 'lezioni' | 'news' | 'iscritti';

@Component({
  selector: 'app-admin',
  imports: [AdminLessonsComponent, AdminNewsComponent, AdminUsersComponent],
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
            (click)="tab.set('lezioni')"
          >♠ Lezioni</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'news'"
            [attr.aria-selected]="tab() === 'news'"
            (click)="tab.set('news')"
          >♦ News</button>
          <button
            type="button"
            role="tab"
            class="admin-tabs__tab"
            [class.is-active]="tab() === 'iscritti'"
            [attr.aria-selected]="tab() === 'iscritti'"
            (click)="tab.set('iscritti')"
          >♣ Iscritti</button>
        </div>

        @if (tab() === 'lezioni') {
          <app-admin-lessons />
        } @else if (tab() === 'news') {
          <app-admin-news />
        } @else {
          <app-admin-users />
        }
      </div>
    </section>
  `,
  styles: `
    .admin-tabs {
      display: flex;
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
  protected readonly tab = signal<AdminTab>('lezioni');
}
