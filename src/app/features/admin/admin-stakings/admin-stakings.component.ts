import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ElencoStakings,
  StakingMovimento,
  StakingRow,
  StakingStato,
  StakingTipo,
} from '../../../core/models/api.models';
import { CASSE } from '../../../core/models/api.models';
import type { Cassa } from '../../../core/models/api.models';
// ⚠️ `cassaLabel` vive in `features/admin/metodo-pagamento.ts` insieme alle
// altre etichette del pannello, non nei modelli: i modelli sono il contratto
// con l'API, le etichette sono come le mostriamo.
import { cassaLabel } from '../metodo-pagamento';
import { AdminStakingsService } from '../../../core/services/admin-stakings.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';
import {
  formattaCent,
  parseImportoInCent,
  testoEv,
} from './staking-format';

type FiltroStato = StakingStato | 'TUTTI';

/**
 * Il registro degli staking: chi gioca con fondi della scuola, quanto ha a
 * disposizione e quanto EV deve ancora recuperare.
 *
 * ⚠️ Le righe NON si creano da qui: nascono quando l'admin assegna il ruolo
 * «Stakato» dal pannello Iscritti, e si chiudono quando glielo toglie. Un
 * secondo modo di crearle vorrebbe dire due sorgenti di verità su chi è in
 * staking — e la prima domanda che si fa a questa schermata è proprio «chi».
 */
@Component({
  selector: 'app-admin-stakings',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ModalComponent,
    IconComponent,
    FiltroComponent,
  ],
  templateUrl: './admin-stakings.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    './admin-stakings.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStakingsComponent {
  private readonly api = inject(AdminStakingsService);
  private readonly fb = inject(FormBuilder);

  protected readonly page = signal<ElencoStakings | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly salvando = signal(false);

  protected readonly filtro = signal<FiltroStato>('APERTO');

  /** Le tre voci del filtro, per `app-filtro`. */
  protected readonly vociFiltro: readonly VoceFiltro<FiltroStato>[] = [
    { valore: 'APERTO', etichetta: 'In corso' },
    { valore: 'CHIUSO', etichetta: 'Chiusi' },
    { valore: 'TUTTI', etichetta: 'Tutti' },
  ];
  private readonly pagina = signal(1);

  // ── Totali ───────────────────────────────────────────────────────────────

  /**
   * I due totali dell'insieme filtrato, così come li ha calcolati il server.
   *
   * ⚠️ NON si sommano `items`: quella somma coprirebbe le 25 righe della
   * pagina, cioè sarebbe esatta finché i giocatori finanziati stanno in una
   * pagina e sbagliata dal 26° in poi — su una cifra di denaro, senza che
   * niente si rompa.
   * ⚠️ `?? null` e non `?? {fondiCent: 0, evCent: 0}`: contro un backend che
   * non li manda ancora (la finestra fra i due deploy) inventare degli zeri
   * significherebbe stampare «nessun fondo in giro» al posto di non dire
   * niente. Il template salta la striscia e la tabella resta intatta.
   */
  protected readonly totali = computed(() => this.page()?.totali ?? null);

  /**
   * La frase che dice COSA si sta sommando.
   *
   * ⚠️ Non è decorazione: senza, la stessa cifra si legge come «tutto il
   * registro» qualunque filtro sia attivo. È il precedente scritto in
   * `admin-participation.component.html` — sopra un elenco filtrato, un totale
   * che non nomina il proprio insieme non corrisponde a niente di ciò che si ha
   * davanti.
   */
  protected readonly ambito = computed(() => {
    const totale = this.page()?.total ?? 0;
    const uno = totale === 1;
    const nome = uno ? 'registro' : 'registri';
    switch (this.filtro()) {
      case 'APERTO':
        return `su ${totale} ${nome} in corso`;
      case 'CHIUSO':
        // ⚠️ «chiuso» concorda, «in corso» e «in tutto» no: con un aggettivo
        // appeso al plurale si legge «su 1 registro chiusi». Trovato da una
        // spec, non a occhio.
        return `su ${totale} ${nome} ${uno ? 'chiuso' : 'chiusi'}`;
      case 'TUTTI':
        return `su ${totale} ${nome} in tutto`;
    }
  });

  // ── Modale ───────────────────────────────────────────────────────────────

  protected readonly apertoId = signal<string | null>(null);
  protected readonly movimenti = signal<StakingMovimento[] | null>(null);

  /**
   * La riga aperta, RILETTA dalla pagina: dopo un movimento `patchRiga()`
   * aggiorna l'elenco, e una copia congelata all'apertura mostrerebbe ancora il
   * saldo di prima mentre la tabella dietro mostra quello nuovo.
   */
  protected readonly rigaAperta = computed<StakingRow | null>(() => {
    const id = this.apertoId();
    if (!id) return null;
    return this.page()?.items.find((r) => r.id === id) ?? null;
  });

  /** Guardia anti-fuori-ordine sui dettagli (idioma di `admin-users`). */
  private seq = 0;

  /**
   * La stessa guardia sull'ELENCO.
   *
   * ⚠️ Serve da quando `carica()` non è più chiamata solo da filtro e
   * paginazione ma anche dalle tre mutazioni: due chiamate sovrapposte possono
   * far vincere la risposta più vecchia, e qui la risposta porta con sé i
   * totali — cioè si tornerebbe a mostrare una cifra di denaro già superata,
   * senza alcun errore.
   */
  private seqElenco = 0;

  protected readonly form = this.fb.nonNullable.group({
    tipo: 'FONDI' as StakingTipo,
    // ⚠️ Da quale portafoglio esce il denaro. Obbligatoria sui soli movimenti
    // di FONDI: il server la RIFIUTA con un 400 sugli altri due assi, perché
    // non muovono un centesimo da nessuna tasca.
    cassa: 'PIETRO' as Cassa,
    importo: '',
    causale: '',
    nota: '',
  });

  protected readonly CASSE = CASSE;
  protected readonly cassaLabel = cassaLabel;

  /**
   * La tasca scelta per ciascun movimento storico ancora da attribuire.
   *
   * ⚠️ Una mappa e non un singolo `signal<Cassa>`: i movimenti da completare
   * sono più d'uno e di solito escono da tasche diverse, quindi un valore
   * condiviso farebbe cambiare la scelta sotto le righe che non si stanno
   * guardando. Chi manca vale `PIETRO`, che è il caso di gran lunga più
   * frequente ma resta modificabile — non è un default scritto sul dato: il
   * dato lo scrive solo il pulsante.
   */
  private readonly cassaPerMovimento = signal<Record<string, Cassa>>({});

  protected cassaDi(movimentoId: string): Cassa {
    return this.cassaPerMovimento()[movimentoId] ?? 'PIETRO';
  }

  protected scegliCassa(movimentoId: string, cassa: string): void {
    this.cassaPerMovimento.update((m) => ({
      ...m,
      [movimentoId]: cassa as Cassa,
    }));
  }

  /**
   * Quanti movimenti di fondi non dicono ancora da quale tasca sono usciti.
   *
   * ⚠️ È la coda di lavoro, e va NOMINATA sopra l'elenco: finché è > 0 quel
   * denaro non entra nel credito di nessuno dei due soci, e nel conguaglio
   * compare come «uscito da una tasca che nessuno ha dichiarato» — cioè un
   * avviso su un'ALTRA schermata, che da qui non si vede.
   */
  protected readonly fondiSenzaCassa = computed(
    () =>
      (this.movimenti() ?? []).filter(
        (m) => m.tipo === 'FONDI' && !m.cassa,
      ).length,
  );

  /**
   * Completa l'annotazione di un movimento storico.
   *
   * ⚠️ **Una volta sola**: il server guarda la scrittura su `cassa` assente e
   * risponde 409 se qualcuno l'ha già attribuita. Non è una correzione — se si
   * sbaglia tasca la via d'uscita è una coppia di movimenti compensativi, non
   * una seconda chiamata.
   *
   * ⚠️ Aggiorna il movimento IN PLACE invece di rileggere l'elenco: rileggendo,
   * le scelte già fatte sulle altre righe resterebbero nella mappa ma il
   * `<select>` tornerebbe al primo valore, e su sei righe da completare di
   * fila si perderebbe il segno di dove si era arrivati.
   */
  protected attribuisci(m: StakingMovimento): void {
    if (this.salvando() || m.cassa) return;
    const cassa = this.cassaDi(m.id);
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.attribuisciCassa(m.id, cassa).subscribe({
      next: (agg) => {
        this.salvando.set(false);
        this.movimenti.update((righe) =>
          (righe ?? []).map((r) => (r.id === m.id ? agg : r)),
        );
        this.feedback.set(
          `Movimento attribuito a ${cassaLabel(cassa)}: ora entra nel suo credito.`,
        );
      },
      error: (err: unknown) =>
        this.fallito(err, 'Attribuzione della tasca non riuscita.'),
    });
  }

  /**
   * L'asse scelto muove denaro vero, quindi chiede la tasca.
   *
   * ⚠️ Un `computed` sul valore del form e non una lettura diretta: in zoneless
   * il template non si ridisegna leggendo `form.controls.x.value`, e il campo
   * della cassa resterebbe visibile anche passando a «EV» — cioè si manderebbe
   * al server proprio la coppia che lui rifiuta.
   */
  /**
   * L'asse scelto adesso.
   *
   * ⚠️ Legge `valori()` per la DIPENDENZA e poi il controllo per il VALORE:
   * `valori` è tipizzato `Record<string, unknown>`, quindi leggerne la chiave
   * darebbe `unknown`; e leggere solo il controllo non creerebbe alcuna
   * dipendenza, cioè il computed non si ricalcolerebbe mai — in zoneless il
   * campo della tasca resterebbe visibile anche passando a «EV», e si
   * manderebbe al server proprio la coppia che lui rifiuta.
   */
  protected readonly tipoScelto = computed<StakingTipo>(() => {
    this.valori();
    return this.form.controls.tipo.value;
  });

  protected readonly chiedeCassa = computed(
    () => this.tipoScelto() === 'FONDI',
  );

  private readonly baseline = signal('');

  /**
   * ⚠️ `toSignal(valueChanges)` e non un `computed` che legge `form.value`: un
   * `FormGroup` non è un signal, quindi un computed non si ricalcolerebbe mai —
   * l'anteprima del saldo e lo stato del pulsante resterebbero congelati al
   * primo valore, e `sporco` sarebbe sempre falso.
   */
  private readonly valori = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as Record<string, unknown>,
  });

  protected readonly sporco = computed(
    () => JSON.stringify(this.valori()) !== this.baseline(),
  );

  /** I centesimi digitati, o null se il campo non è un importo. */
  protected readonly importoCent = computed(() => {
    void this.valori();
    return parseImportoInCent(this.form.controls.importo.value);
  });

  /**
   * Perché il movimento non si può registrare, o null se si può.
   *
   * ⚠️ Il vincolo «≤ 0» vale SOLO sul ramo EV: applicato anche ai fondi,
   * nessun bilancio sarebbe registrabile — cioè metà della funzione.
   * ⚠️ L'autorità resta il server: qui si anticipa il suo rifiuto perché non
   * arrivi a sorpresa dopo il clic.
   */
  protected readonly bloccoMovimento = computed<string | null>(() => {
    void this.valori();
    const riga = this.rigaAperta();
    if (!riga) return null;
    if (riga.stato !== 'APERTO')
      return 'La riga è chiusa: riaprila per registrare un movimento.';
    const cent = this.importoCent();
    if (cent === null) return null; // campo vuoto o incompleto: niente errore
    if (cent === 0) return "L'importo non può essere zero.";
    if (this.form.controls.tipo.value !== 'EV') return null;
    const dopo = riga.saldoEvCent + cent;
    if (dopo > 0) {
      // ⚠️ Due messaggi e non uno: a debito zero il ramo generico direbbe «al
      // massimo −0,00 €», perché `Intl` formatta lo zero negativo col segno. Una
      // cifra così fa dubitare del conto invece che dell'importo digitato.
      return riga.saldoEvCent === 0
        ? "L'EV è già in pari: non c'è niente da recuperare."
        : `Puoi recuperare al massimo ${formattaCent(-riga.saldoEvCent)}: l'EV da recuperare non può salire sopra zero.`;
    }
    return null;
  });

  /**
   * L'anteprima del saldo dopo questo movimento.
   *
   * ⚠️ `void this.valori()` in testa, benché legga già `importoCent()`: un
   * `computed` che dipende solo da altri `computed` NON si ricalcola quando
   * quelli restituiscono un valore uguale. Cambiando l'asse da Fondi a EV
   * l'importo resta lo stesso, quindi senza questa riga l'anteprima
   * continuerebbe a mostrare il saldo dei fondi con «EV» selezionato.
   */
  protected readonly anteprima = computed<string | null>(() => {
    void this.valori();
    const riga = this.rigaAperta();
    const cent = this.importoCent();
    if (!riga || cent === null || this.bloccoMovimento()) return null;
    return this.form.controls.tipo.value === 'EV'
      ? testoEv(riga.saldoEvCent + cent)
      : formattaCent(riga.saldoFondiCent + cent);
  });

  /**
   * ⚠️ Legge `valori()` per PRIMO, e non è ridondante: i signal di Angular
   * memoizzano per uguaglianza, quindi un `computed` che dipende solo da
   * `importoCent()` e `bloccoMovimento()` non si ricalcola finché quei due
   * restituiscono lo stesso valore. Digitando la causale — che nessuno dei due
   * guarda — l'importo resta 250 e il blocco resta `null`: il pulsante
   * resterebbe SPENTO per sempre, senza un errore e senza dire perché. Trovato
   * da una spec, non a occhio.
   */
  protected readonly puoRegistrare = computed(() => {
    void this.valori();
    return (
      this.importoCent() !== null &&
      this.form.controls.causale.value.trim().length >= 3 &&
      !this.bloccoMovimento()
    );
  });

  protected readonly formattaCent = formattaCent;
  protected readonly testoEv = testoEv;

  constructor() {
    this.carica();
  }

  // ── Elenco ───────────────────────────────────────────────────────────────

  private carica(): void {
    this.loading.set(true);
    this.error.set(null);
    const f = this.filtro();
    this.seqElenco += 1;
    const mio = this.seqElenco;
    this.api
      .list({
        stato: f === 'TUTTI' ? undefined : f,
        page: this.pagina(),
      })
      .subscribe({
        next: (p) => {
          if (mio !== this.seqElenco) return;
          this.page.set(p);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (mio !== this.seqElenco) return;
          this.loading.set(false);
          this.error.set(
            apiErrorMessage(err, 'Caricamento del registro non riuscito.'),
          );
        },
      });
  }

  /**
   * Rilegge l'elenco dopo una mutazione, perché righe e TOTALI tornino da una
   * lettura sola.
   *
   * ⚠️ L'alternativa — applicare al totale lo stesso delta che `patchRiga`
   * applica alla riga — è stata scartata: metterebbe la stessa aritmetica del
   * denaro in due punti che devono concordare, ed è così che un totale comincia
   * a scostarsi senza che nessuno se ne accorga. `patchRiga` resta perché
   * aggiorna la riga (e i saldi in testa alla modale) SUBITO: la striscia si
   * allinea un round-trip dopo.
   *
   * ⚠️ Conseguenza voluta: chiudendo un registro col filtro «In corso» la riga
   * esce dall'insieme, `rigaAperta()` diventa `null` e la modale si chiude da
   * sé — la conferma è renderizzata fuori dalla modale, quindi resta leggibile.
   * Il comportamento segue il filtro, che è ciò che il filtro promette.
   */
  private ricaricaTotali(): void {
    this.carica();
  }

  protected impostaFiltro(f: FiltroStato): void {
    if (f === this.filtro()) return;
    this.filtro.set(f);
    // ⚠️ Torna a pagina 1: senza, restando alla pagina 3 di un filtro con due
    // pagine si otterrebbe un elenco vuoto — e l'elenco vuoto è la bugia più
    // costosa di questa schermata, perché si legge come «non c'è nessuno in
    // staking».
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

  protected chi(r: StakingRow): string {
    if (r.anonimizzato) return 'Account cancellato';
    return r.userNickname || r.userEmail || '—';
  }

  // ── Modale ───────────────────────────────────────────────────────────────

  protected apri(r: StakingRow): void {
    this.feedback.set(null);
    this.error.set(null);
    this.seq += 1;
    const mio = this.seq;
    this.form.reset({
      tipo: 'FONDI',
      cassa: 'PIETRO',
      importo: '',
      causale: '',
      nota: r.nota ?? '',
    });
    this.riallineaBaseline();
    this.movimenti.set(null);
    this.apertoId.set(r.id);
    this.api.dettaglio(r.id).subscribe({
      next: (d) => {
        if (mio !== this.seq) return;
        this.movimenti.set(d.movimenti);
        this.patchRiga(d.riga);
      },
      error: () => {
        if (mio === this.seq) this.movimenti.set([]);
      },
    });
  }

  protected chiudiModale(): void {
    this.apertoId.set(null);
  }

  private patchRiga(agg: StakingRow): void {
    this.page.update((p) =>
      p ? { ...p, items: p.items.map((r) => (r.id === agg.id ? agg : r)) } : p,
    );
  }

  private riallineaBaseline(): void {
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
  }

  private fallito(err: unknown, fallback: string): void {
    this.salvando.set(false);
    this.error.set(apiErrorMessage(err, fallback));
  }

  // ── Movimenti ────────────────────────────────────────────────────────────

  protected registra(r: StakingRow): void {
    const cent = this.importoCent();
    const causale = this.form.controls.causale.value.trim();
    if (cent === null || !causale || this.salvando() || !this.puoRegistrare()) {
      return;
    }
    this.salvando.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api
      .aggiungiMovimento(r.id, {
        tipo: this.form.controls.tipo.value,
        importoCent: cent,
        causale,
        // ⚠️ Si manda SOLO dove serve: su «EV» e «Capitale perso» il server
        // risponde 400 se gliela si passa, e omettere la chiave è diverso da
        // mandarla vuota — `@IsIn` rifiuterebbe la stringa vuota.
        ...(this.form.controls.tipo.value === 'FONDI'
          ? { cassa: this.form.controls.cassa.value }
          : {}),
      })
      .subscribe({
        next: (res) => {
          this.salvando.set(false);
          // ⚠️ Sia la RIGA della tabella sia lo storico: senza il primo, dietro
          // la modale resterebbero i soldi vecchi; senza il secondo, il
          // movimento appena registrato non comparirebbe finché non si
          // riapre.
          this.patchRiga(res.riga);
          this.movimenti.update((m) => [res.movimento, ...(m ?? [])]);
          this.form.patchValue({ importo: '', causale: '' });
          this.riallineaBaseline();
          this.feedback.set('Movimento registrato.');
          this.ricaricaTotali();
        },
        error: (err: unknown) =>
          this.fallito(err, 'Registrazione del movimento non riuscita.'),
      });
  }

  // ── Stato della riga ─────────────────────────────────────────────────────

  protected chiudiRiga(r: StakingRow): void {
    if (this.salvando()) return;
    // ⚠️ Chiudere con un saldo diverso da zero è LECITO: il rapporto può
    // finire con dei conti aperti, e vietarlo impedirebbe di declassare
    // qualcuno finché non si è sistemato tutto. Si avvisa, non si blocca.
    const avviso =
      r.saldoFondiCent !== 0 || r.saldoEvCent !== 0
        ? `\n\nAttenzione: restano ${formattaCent(r.saldoFondiCent)} di fondi e ${testoEv(r.saldoEvCent).toLowerCase()}.`
        : '';
    if (!confirm(`Chiudere il registro di ${this.chi(r)}?${avviso}`)) return;
    this.salvando.set(true);
    this.api.chiudi(r.id).subscribe({
      next: (agg) => {
        this.salvando.set(false);
        this.patchRiga(agg);
        this.feedback.set('Registro chiuso.');
        this.ricaricaTotali();
      },
      error: (err: unknown) => this.fallito(err, 'Chiusura non riuscita.'),
    });
  }

  protected riapriRiga(r: StakingRow): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.api.riapri(r.id).subscribe({
      next: (agg) => {
        this.salvando.set(false);
        this.patchRiga(agg);
        this.feedback.set('Registro riaperto.');
        this.ricaricaTotali();
      },
      error: (err: unknown) => this.fallito(err, 'Riapertura non riuscita.'),
    });
  }

  protected salvaNota(r: StakingRow): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.error.set(null);
    this.api.nota(r.id, this.form.controls.nota.value.trim()).subscribe({
      next: (agg) => {
        this.salvando.set(false);
        this.patchRiga(agg);
        this.riallineaBaseline();
        this.feedback.set('Nota salvata.');
      },
      error: (err: unknown) => this.fallito(err, 'Salvataggio nota non riuscito.'),
    });
  }
}
