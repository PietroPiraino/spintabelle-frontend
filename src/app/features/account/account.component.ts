import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../core/services/account.service';
import { AdminConteggiService } from '../../core/services/admin-conteggi.service';
import { AuthService } from '../../core/services/auth.service';
import { PointsService } from '../../core/services/points.service';
import { SubscriptionsService } from '../../core/services/subscriptions.service';
import {
  MyPoints,
  MySubscription,
  Percorso,
  ProspettoMese,
} from '../../core/models/api.models';
import { apiErrorMessage } from '../../core/utils/http-error';
import { SchedeComponent, VoceScheda } from '../../shared/ui/schede/schede.component';
import { AccountAcquistiComponent } from './account-acquisti/account-acquisti.component';
import { AccountConteggiComponent } from './account-conteggi/account-conteggi.component';
import { AccountPanoramicaComponent } from './account-panoramica/account-panoramica.component';
import { AccountProfiloComponent } from './account-profilo/account-profilo.component';
import {
  CARICO,
  Carico,
  ETICHETTE_VISTE,
  VistaAccount,
  errore,
  isVistaAccount,
  ok,
} from './account.types';

/**
 * «Il mio account» — la SHELL: testata, schede, `?vista=`, e le letture che
 * servono a più schede insieme. Riscritta il 14/09/2026 (PLAN-account.md):
 * prima erano undici card uguali in una colonna da 640px.
 *
 * ⚠️ Le schede cambiano il GENERE di cosa si vede (Panoramica · Acquisti e
 * punti · Conteggi · Profilo e sicurezza), quindi `app-schede` e non
 * `app-filtro`; una rotta sola, con `?vista=` come deep-link (l'email del
 * prospetto atterra su `?vista=conteggi`). Niente sotto-rotte: ognuna
 * vorrebbe una riga in `_redirects` E in `_headers`.
 *
 * ⚠️ Quattro letture qui, ognuna nel suo `Carico`: l'abbonamento (`/subscriptions/me`,
 * che la card «Il tuo accesso» legge per la richiesta in attesa — fino al
 * 14/09/2026 la pagina non la chiamava e diceva «Nessun abbonamento» a chi
 * aveva già pagato), i punti (pagina 1: la Panoramica mostra il saldo, la
 * scheda Acquisti i movimenti), il prospetto (decide se la scheda Conteggi
 * ESISTE) e il percorso (Panoramica e Profilo). Le affiliazioni le carica la
 * Panoramica da sé, buoni e ordini la scheda Acquisti al primo ingresso.
 *
 * ⚠️ Punti e Conteggi restano due schede diverse e nessun `computed` li
 * incrocia (`gdpr/valutazione-prospetto-e-punti.md` §D/§H).
 */
@Component({
  selector: 'app-account',
  imports: [
    DatePipe,
    RouterLink,
    SchedeComponent,
    AccountPanoramicaComponent,
    AccountAcquistiComponent,
    AccountConteggiComponent,
    AccountProfiloComponent,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account-shared.scss', './account.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly subscriptionsApi = inject(SubscriptionsService);
  private readonly pointsApi = inject(PointsService);
  private readonly conteggiApi = inject(AdminConteggiService);
  private readonly accountApi = inject(AccountService);

  protected readonly user = this.auth.user;
  protected readonly verified = computed(() => this.user()?.verified ?? false);

  /**
   * Il `?vista=` del deep-link. ⚠️ `isVistaAccount` e non un cast: arriva
   * dall'URL come stringa qualunque. `withComponentInputBinding()` è già
   * attivo in `app.config.ts`.
   */
  readonly vistaIniziale = input<string | undefined>(undefined, {
    alias: 'vista',
  });
  protected readonly vista = signal<VistaAccount>('panoramica');
  protected readonly titoloScheda = computed(() => ETICHETTE_VISTE[this.vista()]);

  // ── Le quattro letture della shell ─────────────────────────────────────────
  protected readonly sub = signal<Carico<MySubscription>>(CARICO);
  protected readonly punti = signal<Carico<MyPoints>>(CARICO);
  protected readonly prospetto = signal<Carico<ProspettoMese[]>>(CARICO);
  protected readonly percorso = signal<Carico<Percorso>>(CARICO);

  /**
   * La scheda Conteggi esiste solo con un prospetto — o mentre il prospetto è
   * in carico e il deep-link la chiede: chi arriva dall'email deve atterrare
   * su uno scheletro, non sulla Panoramica.
   */
  protected readonly haConteggi = computed(() => {
    const p = this.prospetto();
    return p.stato === 'ok' && p.dati.length > 0;
  });

  protected readonly voci = computed<readonly VoceScheda<VistaAccount>[]>(() => {
    const conteggiVisibile =
      this.haConteggi() ||
      (this.prospetto().stato === 'carico' && this.vista() === 'conteggi');
    const tutte: VistaAccount[] = ['panoramica', 'acquisti', 'conteggi', 'profilo'];
    return tutte
      .filter((v) => v !== 'conteggi' || conteggiVisibile)
      .map((v) => ({ valore: v, etichetta: ETICHETTE_VISTE[v] }));
  });

  constructor() {
    // ⚠️ In un effect e non nel costruttore: gli input sono legati DOPO la
    // costruzione (idioma di admin-stats). Non riscrive l'URL: un clic sulle
    // schede cambia `vista`, non l'input, quindi l'effect non rientra.
    effect(() => {
      const v = this.vistaIniziale();
      if (isVistaAccount(v)) untracked(() => this.vista.set(v));
    });

    this.caricaSub();
    this.caricaPunti();
    this.caricaProspetto();
    this.caricaPercorso();

    // Il deep-link a Conteggi senza un prospetto ricade sulla Panoramica —
    // dopo la risposta, non prima.
    effect(() => {
      const p = this.prospetto();
      if (this.vista() === 'conteggi' && p.stato !== 'carico' && !this.haConteggi()) {
        this.vista.set('panoramica');
      }
    });
  }

  protected setVista(v: VistaAccount): void {
    this.vista.set(v);
  }

  protected caricaSub(): void {
    this.sub.set(CARICO);
    this.subscriptionsApi.mySubscription().subscribe({
      next: (s) => this.sub.set(ok(s)),
      error: (err: unknown) =>
        this.sub.set(errore(apiErrorMessage(err, 'Stato dell’abbonamento non disponibile.'))),
    });
  }

  protected caricaPunti(): void {
    this.punti.set(CARICO);
    this.pointsApi.myPoints().subscribe({
      next: (p) => this.punti.set(ok(p)),
      error: (err: unknown) =>
        this.punti.set(errore(apiErrorMessage(err, 'Saldo punti non disponibile.'))),
    });
  }

  protected caricaProspetto(): void {
    this.prospetto.set(CARICO);
    this.conteggiApi.mioProspetto().subscribe({
      next: (p) => this.prospetto.set(ok(p)),
      error: (err: unknown) =>
        this.prospetto.set(errore(apiErrorMessage(err, 'Conteggi non disponibili.'))),
    });
  }

  protected caricaPercorso(): void {
    this.percorso.set(CARICO);
    this.accountApi.percorso().subscribe({
      next: (p) => this.percorso.set(ok(p)),
      error: (err: unknown) =>
        this.percorso.set(errore(apiErrorMessage(err, 'Percorso non disponibile.'))),
    });
  }
}
