import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  AdminActionLogEntry,
  Paginated,
} from '../../../core/models/api.models';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

const ACTION_LABELS: Record<string, string> = {
  'set-expiry': 'Scadenza modificata',
  'grant-subscription': 'Abbonamento concesso',
  'set-role': 'Ruolo modificato',
  'edit-profile': 'Dati modificati',
  'grant-discount-eligibility': 'Codice sconto assegnato',
  'revoke-discount-eligibility': 'Codice sconto revocato',
  'create-discount': 'Codice sconto creato',
  'update-discount': 'Codice sconto modificato',
  'delete-discount': 'Codice sconto eliminato',
};

const KEY_LABELS: Record<string, string> = {
  role: 'Ruolo',
  subscriptionExpiresAt: 'Scadenza',
  code: 'Codice',
  email: 'Email',
  nickname: 'Nickname',
  verified: 'Verificato',
  kind: 'Tipo',
  value: 'Valore',
  audience: 'Platea',
  active: 'Attivo',
};

@Component({
  selector: 'app-admin-audit',
  imports: [DatePipe],
  templateUrl: './admin-audit.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditComponent {
  private readonly api = inject(AdminUsersService);

  protected readonly page = signal<Paginated<AdminActionLogEntry> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly currentPage = signal(1);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.auditAll(this.currentPage(), 25).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Caricamento log non riuscito.'));
      },
    });
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  /** Riepilogo compatto delle modifiche (prima → dopo) per i campi noti. */
  protected details(e: AdminActionLogEntry): string {
    const b = e.before ?? {};
    const a = e.after ?? {};
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    const parts: string[] = [];
    for (const k of keys) {
      const bv = this.fmt(b[k]);
      const av = this.fmt(a[k]);
      const label = KEY_LABELS[k] ?? k;
      if (bv && av && bv !== av) parts.push(`${label}: ${bv} → ${av}`);
      else if (av && !bv) parts.push(`${label}: ${av}`);
    }
    return parts.join(' · ');
  }

  private fmt(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'Sì' : 'No';
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('it-IT');
      }
      return v;
    }
    return String(v);
  }
}
