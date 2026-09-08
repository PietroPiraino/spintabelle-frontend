import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DiscountAudience,
  DiscountCode,
  DiscountCodeDetail,
  DiscountCodePayload,
  DiscountKind,
  DiscountScope,
  Paginated,
} from '../../../core/models/api.models';
import { AdminDiscountsService } from '../../../core/services/admin-discounts.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

type StatoFiltro = 'TUTTI' | 'ATTIVI' | 'DISATTIVATI';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-discounts',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    FiltroComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './admin-discounts.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
  ],
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

  /**
   * ⚠️ Un codice gia' riscattato NON si puo' cancellare (lo riferiscono le
   * richieste e gli ordini che l'hanno usato), quindi «non mi serve piu'» si
   * risolve disattivandolo — ma senza questo filtro la riga restava nella
   * griglia per sempre, e disattivare non toglieva niente di mezzo. Il
   * backend accetta gia' `active` come booleano: nessuna modifica lato server.
   */
  protected readonly stato = signal<StatoFiltro>('TUTTI');
  protected readonly statiFiltro: readonly VoceFiltro<StatoFiltro>[] = [
    { valore: 'TUTTI', etichetta: 'Tutti' },
    { valore: 'ATTIVI', etichetta: 'Solo attivi' },
    { valore: 'DISATTIVATI', etichetta: 'Solo disattivati' },
  ];

  protected setStato(v: StatoFiltro): void {
    if (this.stato() === v) return;
    this.stato.set(v);
    // Ogni filtro riporta alla prima pagina, o lo stato vuoto mente.
    this.currentPage.set(1);
    this.load();
  }

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
  protected readonly scopeControl = new FormControl<DiscountScope>(
    'SUBSCRIPTION',
    { nonNullable: true },
  );
  protected readonly reusableControl = new FormControl(false, {
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

  /**
   * Tutti i campi del form in un `FormGroup`, al solo scopo di poterne
   * osservare i cambiamenti in blocco.
   *
   * ⚠️ Il form è fatto di `FormControl` sciolti (undici), e per la modale serve
   * un `sporco` che REAGISCA: un `computed` che legge `control.value` non si
   * ricalcola mai — un FormControl non è un signal — quindi resterebbe `false`
   * per sempre ed Escape butterebbe via il digitato, cioè il difetto che quel
   * input esiste per prevenire. Il gruppo è solo la vetrina che espone un unico
   * `valueChanges`: i controlli restano quelli, e il template non cambia.
   */
  private readonly gruppo = new FormGroup({
    code: this.codeControl,
    kind: this.kindControl,
    value: this.valueControl,
    audience: this.audienceControl,
    tierPesce: this.tierPesceControl,
    tierSqualo: this.tierSqualoControl,
    scope: this.scopeControl,
    reusable: this.reusableControl,
    active: this.activeControl,
    validFrom: this.validFromControl,
    validUntil: this.validUntilControl,
    maxRed: this.maxRedControl,
    note: this.noteControl,
  });
  private readonly baseline = signal('');
  private readonly valori = toSignal(this.gruppo.valueChanges, {
    initialValue: this.gruppo.getRawValue() as Record<string, unknown>,
  });
  protected readonly sporco = computed(
    () => JSON.stringify(this.valori()) !== this.baseline(),
  );

  // ── Dettaglio (utenti ammessi) ──
  protected readonly detailId = signal<string | null>(null);
  protected readonly detail = signal<DiscountCodeDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly removingUserId = signal<string | null>(null);

  protected readonly kinds: DiscountKind[] = ['PERCENT', 'FIXED'];
  protected readonly audiences: DiscountAudience[] = ['RESTRICTED', 'PUBLIC'];
  protected readonly scopes: DiscountScope[] = [
    'SUBSCRIPTION',
    'GADGET',
    'ALL',
  ];

  protected scopeLabel(s: DiscountScope): string {
    if (s === 'GADGET') return 'Solo gadget';
    if (s === 'ALL') return 'Abbonamenti e gadget';
    return 'Solo abbonamenti';
  }

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.currentPage.set(1);
        this.load();
      });
    // Un codice riutilizzabile non ammette un tetto: disabilita il campo di conseguenza.
    this.reusableControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reusable) => {
        if (reusable) this.maxRedControl.disable();
        else this.maxRedControl.enable();
      });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        q: this.query() || undefined,
        // `undefined` = nessun filtro: la chiave non viene proprio scritta.
        active:
          this.stato() === 'TUTTI' ? undefined : this.stato() === 'ATTIVI',
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
    this.scopeControl.setValue('SUBSCRIPTION');
    this.reusableControl.setValue(false);
    this.activeControl.setValue(true);
    this.validFromControl.setValue('');
    this.validUntilControl.setValue('');
    this.maxRedControl.reset(null);
    this.noteControl.reset('');
    // ⚠️ La baseline si scrive DOPO aver riempito i campi, o la modale nasce
    // già sporca e il primo Escape chiede conferma senza che si sia digitato
    // nulla.
    this.baseline.set(JSON.stringify(this.gruppo.getRawValue()));
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
    this.scopeControl.setValue(c.scope ?? 'SUBSCRIPTION');
    this.reusableControl.setValue(c.reusable ?? false);
    this.activeControl.setValue(c.active);
    this.validFromControl.setValue(this.isoToDateInput(c.validFrom));
    this.validUntilControl.setValue(this.isoToDateInput(c.validUntil));
    this.maxRedControl.setValue(c.maxRedemptions ?? null);
    this.noteControl.setValue(c.note ?? '');
    // ⚠️ La baseline si scrive DOPO aver riempito i campi, o la modale nasce
    // già sporca e il primo Escape chiede conferma senza che si sia digitato
    // nulla.
    this.baseline.set(JSON.stringify(this.gruppo.getRawValue()));
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.confermaElimina.set(false);
    this.editingId.set(null);
    this.closeDetail();
  }

  private buildPayload(): DiscountCodePayload {
    const tiers: ('PESCE_ROSSO' | 'SQUALO')[] = [];
    if (this.tierPesceControl.value) tiers.push('PESCE_ROSSO');
    if (this.tierSqualoControl.value) tiers.push('SQUALO');
    const vf = this.validFromControl.value;
    const vu = this.validUntilControl.value;
    const reusable = this.reusableControl.value;
    const payload: DiscountCodePayload = {
      kind: this.kindControl.value,
      value: Number(this.valueControl.value),
      audience: this.audienceControl.value,
      tiers,
      scope: this.scopeControl.value,
      reusable,
      active: this.activeControl.value,
      note: this.noteControl.value.trim() || undefined,
    };
    if (vf) payload.validFrom = new Date(`${vf}T00:00:00`).toISOString();
    if (vu) payload.validUntil = new Date(`${vu}T23:59:59`).toISOString();
    // Un codice riutilizzabile non può avere un tetto (il backend lo rifiuterebbe).
    if (!reusable && this.maxRedControl.value != null)
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

  /**
   * Accende e spegne il codice.
   *
   * ⚠️ Prima questa cosa non esisteva e la faceva il pulsante rosso: quello
   * chiamava la DELETE, che sul server DEGRADA a `active:false` quando il
   * codice e' gia' stato riscattato. Funzionava — ma la sua etichetta era
   * legata a `redeemedCount`, cioe' a QUANTE VOLTE E' STATO USATO, non allo
   * stato della riga: su un codice riscattato diceva «Disattiva» per sempre,
   * anche dopo averlo disattivato. Chi lo premeva vedeva il pulsante identico
   * e concludeva che non fosse successo niente, e ripremendolo rifaceva lo
   * stesso spegnimento a vuoto.
   *
   * ⚠️ Nessuna conferma, ed e' voluto: e' l'unica azione REVERSIBILE della
   * riga, e chiedere conferma per qualcosa che si annulla con un secondo clic
   * insegna a rispondere «sì» senza leggere — poi la stessa abitudine arriva
   * sulla cancellazione, che invece non torna indietro.
   */
  protected toggleAttivo(c: DiscountCode): void {
    this.error.set(null);
    this.feedback.set(null);
    this.api.update(c.id, { active: !c.active }).subscribe({
      next: (saved) => {
        // ⚠️ Prima si chiude la modale, poi si scrive: la banda di successo
        // vive nella PAGINA, e scriverla col dialog aperto la metterebbe dietro
        // il fondale (top layer).
        this.closeForm();
        this.feedback.set(
          saved.active
            ? `Codice ${c.code} riattivato.`
            : `Codice ${c.code} disattivato: non è più spendibile.`,
        );
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Aggiornamento non riuscito.')),
    });
  }

  /**
   * ⚠️ Il pulsante che chiama questo metodo compare SOLO su un codice mai
   * riscattato: il server cancella davvero solo in quel caso, e offrire
   * «Elimina» su una riga che il server non cancellera' mai e' una promessa
   * che non puo' mantenere.
   *
   * ⚠️ Il ramo `softDeleted` resta comunque, e non e' codice morto: fra il
   * caricamento dell'elenco e il clic qualcuno puo' aver speso il codice. In
   * quel caso il server degrada a spegnimento e il messaggio lo DICE, invece
   * di annunciare una cancellazione che non c'e' stata.
   */
  /** La cancellazione è armata (conferma in linea). */
  protected readonly confermaElimina = signal(false);

  protected remove(c: DiscountCode): void {
    // ⚠️ Conferma IN LINEA e non `confirm()` nativo: il riquadro di sistema
    // non si stila, non si legge nel contesto della modale, e su alcune
    // configurazioni il browser lo sopprime — nel qual caso il ramo «annulla»
    // non è raggiungibile e il codice sparisce al primo clic.
    this.confermaElimina.set(false);
    this.error.set(null);
    this.feedback.set(null);
    this.api.remove(c.id).subscribe({
      next: (res) => {
        this.feedback.set(
          res.softDeleted
            ? `Codice ${c.code} usato nel frattempo: l'ho solo disattivato.`
            : `Codice ${c.code} eliminato.`,
        );
        this.closeForm();
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }

  // ── Dettaglio / utenti ammessi ────────────────────────────────────────---

  /** Il codice in modifica, RILETTO dalla pagina (mai una copia congelata). */
  protected readonly codiceAperto = computed(() => {
    const id = this.editingId();
    if (!id) return null;
    return this.page()?.items.find((c) => c.id === id) ?? null;
  });

  /**
   * Carica gli utenti ammessi alla PRIMA apertura del `<details>`.
   *
   * ⚠️ Pigro e una volta sola: l'elenco è una chiamata in più, e la scheda di
   * un codice si apre quasi sempre per cambiarne il valore, non per guardare
   * chi lo può usare. `(toggle)` scatta anche in chiusura, quindi la guardia
   * sull'id già caricato non è un'ottimizzazione: senza, richiudere e riaprire
   * rifà la GET ogni volta.
   */
  protected caricaAmmessi(): void {
    const c = this.codiceAperto();
    if (!c || this.detailId() === c.id || this.detailLoading()) return;
    this.openDetail(c);
  }

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
