import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DiscountAudience,
  DiscountCode,
  DiscountCodeDetail,
  DiscountCodePayload,
  DiscountKind,
  Paginated,
} from '../../../core/models/api.models';
import { AdminDiscountsService } from '../../../core/services/admin-discounts.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-discounts',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-discounts.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDiscountsComponent {
  private readonly api = inject(AdminDiscountsService);

  protected readonly page = signal<Paginated<DiscountCode> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  private readonly currentPage = signal(1);

  // ── Form crea/modifica ──
  protected readonly formOpen = signal(false);
  /** null = creazione; id = modifica. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly codeControl = new FormControl('', { nonNullable: true });
  protected readonly kindControl = new FormControl<DiscountKind>('PERCENT', {
    nonNullable: true,
  });
  protected readonly valueControl = new FormControl<number | null>(null);
  protected readonly audienceControl = new FormControl<DiscountAudience>(
    'RESTRICTED',
    { nonNullable: true },
  );
  protected readonly tierPesceControl = new FormControl(false, {
    nonNullable: true,
  });
  protected readonly tierSqualoControl = new FormControl(false, {
    nonNullable: true,
  });
  protected readonly activeControl = new FormControl(true, {
    nonNullable: true,
  });
  protected readonly validFromControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly validUntilControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly maxRedControl = new FormControl<number | null>(null);
  protected readonly noteControl = new FormControl('', { nonNullable: true });

  // ── Dettaglio (utenti ammessi) ──
  protected readonly detailId = signal<string | null>(null);
  protected readonly detail = signal<DiscountCodeDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly removingUserId = signal<string | null>(null);

  protected readonly kinds: DiscountKind[] = ['PERCENT', 'FIXED'];
  protected readonly audiences: DiscountAudience[] = ['RESTRICTED', 'PUBLIC'];

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.currentPage.set(1);
        this.load();
      });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        q: this.query() || undefined,
        page: this.currentPage(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(apiErrorMessage(err, 'Caricamento codici non riuscito.'));
        },
      });
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  // ── Etichette ─────────────────────────────────────────────────────────---

  protected kindLabel(k: DiscountKind): string {
    return k === 'PERCENT' ? 'Percentuale' : 'Importo fisso';
  }

  protected audienceLabel(a: DiscountAudience): string {
    return a === 'PUBLIC' ? 'Pubblico' : 'Riservato';
  }

  protected valueLabel(c: DiscountCode): string {
    return c.kind === 'PERCENT' ? `${c.value}%` : `€${c.value}`;
  }

  protected tiersLabel(c: DiscountCode): string {
    if (!c.tiers || c.tiers.length === 0) return 'Tutti i piani';
    return c.tiers
      .map((t) => (t === 'SQUALO' ? 'Squalo' : 'Pesce Rosso'))
      .join(', ');
  }

  // ── Date helper ───────────────────────────────────────────────────────---

  private isoToDateInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Form crea/modifica ────────────────────────────────────────────────---

  protected openCreate(): void {
    this.editingId.set(null);
    this.formError.set(null);
    this.feedback.set(null);
    this.codeControl.reset('');
    this.kindControl.setValue('PERCENT');
    this.valueControl.reset(null);
    this.audienceControl.setValue('RESTRICTED');
    this.tierPesceControl.setValue(false);
    this.tierSqualoControl.setValue(false);
    this.activeControl.setValue(true);
    this.validFromControl.setValue('');
    this.validUntilControl.setValue('');
    this.maxRedControl.reset(null);
    this.noteControl.reset('');
    this.formOpen.set(true);
  }

  protected openEdit(c: DiscountCode): void {
    this.editingId.set(c.id);
    this.formError.set(null);
    this.feedback.set(null);
    this.codeControl.setValue(c.code);
    this.kindControl.setValue(c.kind);
    this.valueControl.setValue(c.value);
    this.audienceControl.setValue(c.audience);
    this.tierPesceControl.setValue(c.tiers?.includes('PESCE_ROSSO') ?? false);
    this.tierSqualoControl.setValue(c.tiers?.includes('SQUALO') ?? false);
    this.activeControl.setValue(c.active);
    this.validFromControl.setValue(this.isoToDateInput(c.validFrom));
    this.validUntilControl.setValue(this.isoToDateInput(c.validUntil));
    this.maxRedControl.setValue(c.maxRedemptions ?? null);
    this.noteControl.setValue(c.note ?? '');
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  private buildPayload(): DiscountCodePayload {
    const tiers: ('PESCE_ROSSO' | 'SQUALO')[] = [];
    if (this.tierPesceControl.value) tiers.push('PESCE_ROSSO');
    if (this.tierSqualoControl.value) tiers.push('SQUALO');
    const vf = this.validFromControl.value;
    const vu = this.validUntilControl.value;
    const payload: DiscountCodePayload = {
      kind: this.kindControl.value,
      value: Number(this.valueControl.value),
      audience: this.audienceControl.value,
      tiers,
      active: this.activeControl.value,
      note: this.noteControl.value.trim() || undefined,
    };
    if (vf) payload.validFrom = new Date(`${vf}T00:00:00`).toISOString();
    if (vu) payload.validUntil = new Date(`${vu}T23:59:59`).toISOString();
    if (this.maxRedControl.value != null)
      payload.maxRedemptions = Number(this.maxRedControl.value);
    return payload;
  }

  protected save(): void {
    if (this.saving()) return;
    const value = this.valueControl.value;
    if (value == null || value < 0) {
      this.formError.set('Inserisci un valore valido.');
      return;
    }
    const editing = this.editingId();
    if (!editing && !this.codeControl.value.trim()) {
      this.formError.set('Inserisci il codice.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const obs = editing
      ? this.api.update(editing, this.buildPayload())
      : this.api.create({
          ...this.buildPayload(),
          code: this.codeControl.value.trim().toUpperCase(),
        });

    obs.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.closeForm();
        this.feedback.set(
          editing ? `Codice ${saved.code} aggiornato.` : `Codice ${saved.code} creato.`,
        );
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected remove(c: DiscountCode): void {
    if (
      !confirm(
        `Eliminare il codice ${c.code}?` +
          (c.redeemedCount > 0
            ? ' È già stato usato: verrà solo disattivato.'
            : ''),
      )
    ) {
      return;
    }
    this.error.set(null);
    this.feedback.set(null);
    this.api.remove(c.id).subscribe({
      next: (res) => {
        this.feedback.set(
          res.softDeleted
            ? `Codice ${c.code} disattivato.`
            : `Codice ${c.code} eliminato.`,
        );
        if (this.detailId() === c.id) this.closeDetail();
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }

  // ── Dettaglio / utenti ammessi ────────────────────────────────────────---

  protected openDetail(c: DiscountCode): void {
    this.detailId.set(c.id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.feedback.set(null);
    this.error.set(null);
    this.api.getOne(c.id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: (err: unknown) => {
        this.detailLoading.set(false);
        this.error.set(apiErrorMessage(err, 'Caricamento dettaglio non riuscito.'));
      },
    });
  }

  protected closeDetail(): void {
    this.detailId.set(null);
    this.detail.set(null);
  }

  protected removeEligible(userId: string): void {
    const id = this.detailId();
    if (!id || this.removingUserId()) return;
    this.removingUserId.set(userId);
    this.api.removeEligibility(id, userId).subscribe({
      next: (res) => {
        this.removingUserId.set(null);
        const d = this.detail();
        if (d) this.detail.set({ ...d, eligibles: res.eligibles });
      },
      error: (err: unknown) => {
        this.removingUserId.set(null);
        this.error.set(apiErrorMessage(err, 'Rimozione non riuscita.'));
      },
    });
  }
}
