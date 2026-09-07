import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AdminActionLogEntry,
  AdminUser,
  AdminUsersPage,
  AffiliationAdmin,
  AffiliazioneCompatta,
  DiscountCode,
  LessonViewSummary,
  PokerRoomAdmin,
  Role,
  SubscriptionRequest,
  SubscriptionTier,
  UserLiveAttendance,
} from '../../../core/models/api.models';
import { haScadenza, ROLE_ORDER } from '../../../core/models/roles';
import { AdminDiscountsService } from '../../../core/services/admin-discounts.service';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { AffiliationsService } from '../../../core/services/affiliations.service';
import { AuthService } from '../../../core/services/auth.service';
import { PointsService } from '../../../core/services/points.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { actionLabel } from '../action-labels';
import { ROLE_LABELS } from '../role-labels';

/**
 * Elenco iscritti: una TABELLA, con tutte le azioni dietro una modale.
 *
 * ⚠️ Prima ogni riga era una card con fino a dieci pulsanti più una select, e i
 * pannelli si aprivano come fratelli della card spingendo in basso il resto
 * dell'elenco. La densità è la ragione per cui questa schermata esiste: è da
 * qui che si ripara tutto il resto del sito.
 */
@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, DatePipe, ModalComponent, IconComponent],
  templateUrl: './admin-users.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent {
  private readonly usersApi = inject(AdminUsersService);
  private readonly pointsApi = inject(PointsService);
  private readonly discountsApi = inject(AdminDiscountsService);
  private readonly affiliationsApi = inject(AffiliationsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly page = signal<AdminUsersPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly salvando = signal(false);

  // ── Modale ───────────────────────────────────────────────────────────────

  /** L'id dell'iscritto aperto nella modale, o null. */
  protected readonly apertoId = signal<string | null>(null);

  /**
   * L'iscritto della modale, RILETTO dalla pagina a ogni giro.
   *
   * ⚠️ Non è una copia congelata all'apertura: `patchUser()` aggiorna la riga in
   * `page()` dopo ogni salvataggio, e una copia mostrerebbe ancora i valori di
   * prima — il saldo punti vecchio, la scadenza vecchia — mentre la tabella
   * dietro mostra quelli nuovi.
   * ⚠️ Torna `null` anche quando l'iscritto sparisce dall'elenco (cancellato, o
   * uscito dalla pagina corrente dopo un ricaricamento): il template chiude la
   * modale in quel caso, invece di lasciarla aperta su un fantasma.
   */
  protected readonly utenteAperto = computed<AdminUser | null>(() => {
    const id = this.apertoId();
    if (!id) return null;
    return this.page()?.items.find((u) => u.id === id) ?? null;
  });

  /**
   * TUTTI i campi della modale in un gruppo solo.
   *
   * ⚠️ Un gruppo e non tredici `FormControl` sciolti, e la ragione è `sporco`:
   * serve UN punto da cui derivare «c'è del testo non salvato». Con i controlli
   * sciolti servirebbero tredici sottoscrizioni, e dimenticarne una renderebbe
   * la guardia di chiusura silenziosamente parziale.
   */
  protected readonly form = this.fb.nonNullable.group({
    ruolo: 'USER' as Role,
    delta: null as number | null,
    motivo: '',
    scadenza: '',
    avvisa: false,
    concediTier: 'PESCE_ROSSO' as SubscriptionTier,
    concediData: '',
    concediNota: '',
    concediSostituisci: false,
    email: '',
    nickname: '',
    verificato: false,
    codiceSconto: '',
    // Recupero di un'affiliazione preesistente (vedi `inserisciAffiliazione`).
    affSala: '',
    affUsername: '',
    affUserId: '',
    affApprova: true,
  });

  /** I valori all'apertura: il metro contro cui si misura «sporco». */
  private readonly baseline = signal('');

  /**
   * ⚠️ `toSignal(valueChanges)` e NON `computed(() => this.form.value)`: un
   * `FormGroup` non è un signal, quindi un `computed` che ne legge il valore non
   * si ricalcolerebbe MAI. Resterebbe al primo valore, `sporco` sarebbe sempre
   * falso ed `Escape` butterebbe via il digitato — cioè il difetto che la
   * conferma di uscita esiste per prevenire, reintrodotto dal lato del
   * chiamante.
   * ⚠️ `initialValue` è obbligatorio: senza, il primo giro vale `undefined`.
   */
  private readonly valori = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as Record<string, unknown>,
  });

  protected readonly sporco = computed(
    () => JSON.stringify(this.valori()) !== this.baseline(),
  );

  // ── Caricamenti della modale ─────────────────────────────────────────────

  protected readonly storicoRichieste = signal<SubscriptionRequest[] | null>(
    null,
  );
  protected readonly storicoAudit = signal<AdminActionLogEntry[] | null>(null);
  protected readonly presenzeLive = signal<UserLiveAttendance[] | null>(null);
  protected readonly visteLezioni = signal<LessonViewSummary[] | null>(null);
  protected readonly affiliazioni = signal<AffiliationAdmin[] | null>(null);
  protected readonly codiciSconto = signal<DiscountCode[] | null>(null);
  /** Le sale, per il recupero manuale. Caricate una volta sola. */
  protected readonly saleDisponibili = signal<PokerRoomAdmin[] | null>(null);

  /**
   * ⚠️ Guardia anti-fuori-ordine: aprendo due iscritti in rapida successione, la
   * risposta lenta del primo arriverebbe DOPO quella del secondo e ne
   * sovrascriverebbe i dati. Sulle affiliazioni sarebbe un dato personale
   * mostrato sotto il nome sbagliato. Idioma di `shop.component.ts`.
   */
  private seq = 0;

  // ── Ricerca e filtri ─────────────────────────────────────────────────────

  protected readonly ricerca = this.fb.nonNullable.control('');
  private readonly query = signal('');
  protected readonly filtroRuolo = signal<Role | ''>('');
  protected readonly filtroScadenza = signal<number | null>(null);
  private readonly pagina = signal(1);

  protected readonly ruoli: readonly Role[] = ROLE_ORDER;
  protected readonly tiers: SubscriptionTier[] = ['PESCE_ROSSO', 'SQUALO'];
  protected readonly etichetteRuolo = ROLE_LABELS;
  protected readonly actionLabel = actionLabel;

  /** L'admin loggato: non può agire sul proprio account. */
  protected readonly ioStesso = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    this.ricerca.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.pagina.set(1);
        this.carica();
      });
    this.carica();
  }

  // ── Elenco ───────────────────────────────────────────────────────────────

  private carica(): void {
    this.loading.set(true);
    this.error.set(null);
    this.usersApi
      .list({
        q: this.query() || undefined,
        role: this.filtroRuolo() || undefined,
        expiring: this.filtroScadenza() ?? undefined,
        page: this.pagina(),
      })
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(
            apiErrorMessage(err, 'Caricamento iscritti non riuscito.'),
          );
        },
      });
  }

  protected impostaFiltroRuolo(value: string): void {
    this.filtroRuolo.set((value as Role) || '');
    this.pagina.set(1);
    this.feedback.set(null);
    this.carica();
  }

  protected impostaFiltroScadenza(value: string): void {
    this.filtroScadenza.set(value ? Number(value) : null);
    this.pagina.set(1);
    this.feedback.set(null);
    this.carica();
  }

  protected vaiAPagina(n: number): void {
    const totale = this.page()?.totalPages ?? 1;
    if (n < 1 || n > totale || n === this.pagina()) return;
    this.pagina.set(n);
    this.carica();
  }

  protected sonoIo(user: AdminUser): boolean {
    return user.id === this.ioStesso();
  }

  // ── Colonna «Sale» ───────────────────────────────────────────────────────

  /**
   * ⚠️ Il server garantisce una chiave per ogni iscritto della pagina, ma il
   * `?? []` resta: fra il deploy del backend e quello di questo file la chiave
   * può non esserci, e un `undefined.length` nel template è una pagina bianca.
   */
  protected sale(user: AdminUser): AffiliazioneCompatta[] {
    return this.page()?.affiliazioniPerUtente?.[user.id] ?? [];
  }

  /** Il contenuto della cella: sala e username, per esteso nel `title`. */
  protected saleTesto(user: AdminUser): string {
    return this.sale(user)
      .map((r) => `${r.roomName}: ${r.roomUsername ?? 'senza username'}`)
      .join(' · ');
  }

  // ── Colonna «Scadenza» ───────────────────────────────────────────────────

  /**
   * ⚠️ Legge il RUOLO per primo, non il campo: per chi è in staking, per un
   * coach e per un admin non esiste alcuna scadenza, e una cella vuota si legge
   * come un dato mancante, cioè come qualcosa da andare a sistemare. «Mai» è
   * un'informazione; il vuoto è un dubbio.
   */
  protected scadenzaTesto(user: AdminUser): string {
    if (!haScadenza(user.role)) return 'Mai';
    return user.subscriptionExpiresAt ? '' : 'Nessuna';
  }

  // ── Apertura e chiusura della modale ─────────────────────────────────────

  protected apri(user: AdminUser): void {
    this.feedback.set(null);
    this.error.set(null);
    this.seq += 1;
    const mio = this.seq;

    this.form.reset({
      ruolo: user.role,
      delta: null,
      motivo: '',
      scadenza: user.subscriptionExpiresAt
        ? this.aInput(new Date(user.subscriptionExpiresAt))
        : '',
      avvisa: false,
      concediTier: user.role === 'SQUALO' ? 'SQUALO' : 'PESCE_ROSSO',
      concediData: this.aInput(this.piuGiorni(new Date(), 30)),
      concediNota: '',
      concediSostituisci: false,
      email: user.email,
      nickname: user.nickname ?? '',
      verificato: user.verified,
      codiceSconto: '',
    });
    this.riallineaBaseline();

    this.storicoRichieste.set(null);
    this.storicoAudit.set(null);
    this.presenzeLive.set(null);
    this.visteLezioni.set(null);
    this.affiliazioni.set(null);
    this.apertoId.set(user.id);

    // Tutte insieme all'apertura: sono cinque GET indipendenti su un pannello
    // che si apre di rado, e caricarle a scatti farebbe comparire le sezioni una
    // per volta mentre si sta già leggendo.
    this.usersApi.subscriptionRequests(user.id).subscribe({
      next: (r) => this.seCorrente(mio, () => this.storicoRichieste.set(r)),
      error: () => this.seCorrente(mio, () => this.storicoRichieste.set([])),
    });
    this.usersApi.auditLog(user.id).subscribe({
      next: (r) => this.seCorrente(mio, () => this.storicoAudit.set(r)),
      error: () => this.seCorrente(mio, () => this.storicoAudit.set([])),
    });
    this.usersApi.liveAttendance(user.id).subscribe({
      next: (r) => this.seCorrente(mio, () => this.presenzeLive.set(r)),
      error: () => this.seCorrente(mio, () => this.presenzeLive.set([])),
    });
    this.usersApi.lessonViews(user.id).subscribe({
      next: (r) => this.seCorrente(mio, () => this.visteLezioni.set(r)),
      error: () => this.seCorrente(mio, () => this.visteLezioni.set([])),
    });
    this.affiliationsApi.forUser(user.id).subscribe({
      next: (r) => this.seCorrente(mio, () => this.affiliazioni.set(r)),
      error: () => this.seCorrente(mio, () => this.affiliazioni.set([])),
    });
    this.caricaCodici();
    this.caricaSale();
  }

  /** Applica la risposta solo se nessun'altra apertura l'ha superata. */
  private seCorrente(mio: number, fn: () => void): void {
    if (mio === this.seq) fn();
  }

  protected chiudi(): void {
    this.apertoId.set(null);
  }

  // ── Helper date ──────────────────────────────────────────────────────────

  private aInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const g = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${g}`;
  }

  private piuGiorni(d: Date, giorni: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + giorni);
    return out;
  }

  /** yyyy-MM-dd → ISO a fine giornata locale ("valido fino a"). */
  private aIso(value: string): string {
    return new Date(`${value}T23:59:59`).toISOString();
  }

  /** Aggiorna in place la riga nella pagina corrente (evita un ricaricamento). */
  private patchUser(updated: AdminUser): void {
    this.page.update((p) =>
      p
        ? {
            ...p,
            items: p.items.map((u) => (u.id === updated.id ? updated : u)),
          }
        : p,
    );
  }

  /**
   * Dopo un salvataggio i valori correnti diventano il nuovo metro: senza,
   * `sporco` resterebbe vero e la modale chiederebbe conferma per uscire da un
   * form appena salvato.
   */
  private riallineaBaseline(): void {
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
  }

  private esito(msg: string, updated?: AdminUser): void {
    this.salvando.set(false);
    if (updated) this.patchUser(updated);
    this.riallineaBaseline();
    this.feedback.set(msg);
  }

  private fallito(err: unknown, fallback: string): void {
    this.salvando.set(false);
    this.error.set(apiErrorMessage(err, fallback));
  }

  // ── Ruolo ────────────────────────────────────────────────────────────────

  protected ruoloCambiato(user: AdminUser): boolean {
    return this.form.controls.ruolo.value !== user.role;
  }

  /**
   * ⚠️ Pesce Rosso e Squalo NON sono assegnabili da qui: il server risponde 400
   * rimandando a «Concedi abbonamento», perché questa scrittura non chiede una
   * data e produrrebbe un abbonamento senza scadenza. Il pannello lo dice prima,
   * invece di lasciare che sia l'errore a spiegarlo.
   */
  protected ruoloVietato(role: Role): boolean {
    return haScadenza(role);
  }

  protected salvaRuolo(user: AdminUser): void {
    if (this.sonoIo(user) || this.salvando()) return;
    const ruolo = this.form.controls.ruolo.value;
    if (ruolo === user.role || this.ruoloVietato(ruolo)) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.updateRole(user.id, ruolo).subscribe({
      next: (updated) => {
        // Il server azzera la scadenza sui ruoli che non scadono: il campo del
        // form deve seguirlo, o la modale mostrerebbe una data che non c'è più.
        this.form.controls.scadenza.setValue(
          updated.subscriptionExpiresAt
            ? this.aInput(new Date(updated.subscriptionExpiresAt))
            : '',
        );
        this.esito(
          `Ruolo di ${user.email} aggiornato a ${ROLE_LABELS[ruolo]}.`,
          updated,
        );
      },
      error: (err: unknown) => this.fallito(err, 'Cambio ruolo non riuscito.'),
    });
  }

  // ── Punti ────────────────────────────────────────────────────────────────

  protected applicaPunti(user: AdminUser): void {
    const delta = this.form.controls.delta.value;
    const motivo = this.form.controls.motivo.value.trim();
    if (!delta || !motivo || this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.pointsApi.adjust(user.id, delta, motivo).subscribe({
      next: (res) => {
        this.form.patchValue({ delta: null, motivo: '' });
        this.esito(`Saldo di ${user.email} aggiornato a ${res.balance} punti.`, {
          ...user,
          points: res.balance,
        });
      },
      error: (err: unknown) =>
        this.fallito(err, 'Rettifica punti non riuscita.'),
    });
  }

  // ── Scadenza ─────────────────────────────────────────────────────────────

  protected sommaAScadenza(user: AdminUser, giorni: number): void {
    const attuale = this.form.controls.scadenza.value;
    let base: Date;
    if (attuale) base = new Date(`${attuale}T00:00:00`);
    else if (
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > new Date()
    )
      base = new Date(user.subscriptionExpiresAt);
    else base = new Date();
    this.form.controls.scadenza.setValue(
      this.aInput(this.piuGiorni(base, giorni)),
    );
  }

  protected salvaScadenza(user: AdminUser): void {
    const v = this.form.controls.scadenza.value;
    if (!v || this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi
      .setSubscriptionExpiry(
        user.id,
        this.aIso(v),
        this.form.controls.avvisa.value,
      )
      .subscribe({
        next: (updated) =>
          this.esito(`Scadenza di ${user.email} aggiornata.`, updated),
        error: (err: unknown) =>
          this.fallito(err, 'Aggiornamento scadenza non riuscito.'),
      });
  }

  protected rimuoviScadenza(user: AdminUser): void {
    if (this.salvando()) return;
    if (!confirm(`Rimuovere la scadenza abbonamento di ${user.email}?`)) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.setSubscriptionExpiry(user.id, null).subscribe({
      next: (updated) => {
        this.form.controls.scadenza.setValue('');
        this.esito(`Scadenza di ${user.email} rimossa.`, updated);
      },
      error: (err: unknown) =>
        this.fallito(err, 'Rimozione scadenza non riuscita.'),
    });
  }

  // ── Concessione manuale ──────────────────────────────────────────────────

  protected sommaAConcessione(giorni: number): void {
    const attuale = this.form.controls.concediData.value;
    const base = attuale ? new Date(`${attuale}T00:00:00`) : new Date();
    this.form.controls.concediData.setValue(
      this.aInput(this.piuGiorni(base, giorni)),
    );
  }

  protected concedi(user: AdminUser): void {
    const v = this.form.getRawValue();
    if (!v.concediData || this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi
      .grantSubscription(
        user.id,
        v.concediTier,
        this.aIso(v.concediData),
        v.concediNota.trim() || undefined,
        v.concediSostituisci,
      )
      .subscribe({
        next: (updated) => {
          this.form.patchValue({ ruolo: updated.role });
          this.esito(
            `Abbonamento ${ROLE_LABELS[updated.role]} concesso a ${user.email}.`,
            updated,
          );
        },
        error: (err: unknown) => this.fallito(err, 'Concessione non riuscita.'),
      });
  }

  // ── Profilo ──────────────────────────────────────────────────────────────

  protected salvaProfilo(user: AdminUser): void {
    if (this.salvando()) return;
    const v = this.form.getRawValue();
    const patch: { email?: string; nickname?: string; verified?: boolean } = {};
    const email = v.email.trim();
    const nick = v.nickname.trim();
    if (email && email !== user.email) patch.email = email;
    if (nick !== (user.nickname ?? '')) patch.nickname = nick;
    if (v.verificato !== user.verified) patch.verified = v.verificato;
    if (Object.keys(patch).length === 0) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.updateProfile(user.id, patch).subscribe({
      next: (updated) =>
        this.esito(`Dati di ${updated.email} aggiornati.`, updated),
      error: (err: unknown) => this.fallito(err, 'Modifica dati non riuscita.'),
    });
  }

  // ── Codice sconto ────────────────────────────────────────────────────────

  private caricaCodici(): void {
    if (this.codiciSconto() !== null) return;
    this.discountsApi
      .list({ audience: 'RESTRICTED', active: true, limit: 100 })
      .subscribe({
        next: (p) => this.codiciSconto.set(p.items),
        error: () => this.codiciSconto.set([]),
      });
  }

  protected assegnaCodice(user: AdminUser): void {
    const codeId = this.form.controls.codiceSconto.value;
    if (!codeId || this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.discountsApi.addEligibility(codeId, [user.id]).subscribe({
      next: (res) => {
        const code = this.codiciSconto()?.find((c) => c.id === codeId);
        this.form.controls.codiceSconto.setValue('');
        this.esito(
          res.added > 0
            ? `Codice ${code?.code ?? ''} assegnato a ${user.email}.`
            : `${user.email} era già abilitato a questo codice.`,
        );
      },
      error: (err: unknown) =>
        this.fallito(err, 'Assegnazione codice non riuscita.'),
    });
  }

  // ── Recupero di un'affiliazione preesistente ─────────────────────────────

  private caricaSale(): void {
    if (this.saleDisponibili() !== null) return;
    // ⚠️ TUTTE le sale, anche quelle tolte dalla vetrina: `active` governa
    // l'emissione di un link affiliato, e qui non se ne emette nessuno — una
    // sala non più attiva può benissimo avere giocatori storici da registrare.
    this.affiliationsApi.adminRooms({ limit: 100 }).subscribe({
      next: (p) => this.saleDisponibili.set(p.items),
      error: () => this.saleDisponibili.set([]),
    });
  }

  /** Le sale su cui questo iscritto non ha già una pratica tracciata. */
  protected saleSelezionabili(): PokerRoomAdmin[] {
    const gia = new Set(
      (this.affiliazioni() ?? [])
        .filter((a) => a.status === 'APPROVATO')
        .map((a) => a.roomId),
    );
    return (this.saleDisponibili() ?? []).filter((s) => !gia.has(s.id));
  }

  /**
   * Registra a mano un'affiliazione che esisteva già fuori dal sito.
   *
   * ⚠️ Non invia le due dichiarazioni dell'utente e il server non le
   * accetterebbe: sono dell'interessato, e la riga resta marcata come inserita
   * dall'amministratore. Nessuna email parte da qui.
   */
  protected inserisciAffiliazione(user: AdminUser): void {
    const v = this.form.getRawValue();
    const roomId = v.affSala;
    const roomUsername = v.affUsername.trim();
    if (!roomId || !roomUsername || this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.affiliationsApi
      .inserisciManuale({
        userId: user.id,
        roomId,
        roomUsername,
        roomUserId: v.affUserId.trim() || undefined,
        approva: v.affApprova,
      })
      .subscribe({
        next: (riga) => {
          this.salvando.set(false);
          // L'elenco della sezione si aggiorna subito: senza, la riga appena
          // creata comparirebbe solo riaprendo la scheda.
          this.affiliazioni.update((righe) => [riga, ...(righe ?? [])]);
          this.form.patchValue({ affSala: '', affUsername: '', affUserId: '' });
          this.riallineaBaseline();
          this.feedback.set(
            `${riga.roomName}: ${riga.roomUsername} registrato per ${user.email}.`,
          );
        },
        error: (err: unknown) =>
          this.fallito(err, 'Registrazione affiliazione non riuscita.'),
      });
  }

  // ── Azioni sull'account ──────────────────────────────────────────────────

  protected reinviaVerifica(user: AdminUser): void {
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.resendVerification(user.id).subscribe({
      next: () =>
        this.feedback.set(`Email di verifica reinviata a ${user.email}.`),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Reinvio non riuscito.')),
    });
  }

  protected elimina(user: AdminUser): void {
    if (
      !confirm(
        `Eliminare definitivamente l'account ${user.email}? L'operazione è irreversibile.`,
      )
    ) {
      return;
    }
    this.error.set(null);
    this.feedback.set(null);
    this.usersApi.remove(user.id).subscribe({
      next: () => {
        // ⚠️ La modale si chiude PRIMA del ricaricamento: restando aperta su un
        // account che non esiste più, ogni suo comando risponderebbe 404 e il
        // pulsante che l'aveva aperta non esisterebbe più per riprendere il
        // fuoco.
        this.chiudi();
        this.feedback.set(`Account ${user.email} eliminato.`);
        this.carica();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
