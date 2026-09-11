import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CASSE,
  Cassa,
  CategoriaEntrata,
  FONTI_BACK,
  FonteBack,
  RigaStakato,
  RigaStakatoPayload,
  SKIN,
  Skin,
  Stakato,
  StakatoPayload,
  CategoriaUscita,
  CategoriaVoce,
  ContoRakeback,
  DestinazioneMargine,
  DettaglioMese,
  Incassante,
  MeseContabile,
  MetodoMovimento,
  RigaAbbonamento,
  RigaRakebackPayload,
  SpesaRicorrente,
  VersoVoce,
  VoceMese,
} from '../../../core/models/api.models';
import { AdminConteggiService } from '../../../core/services/admin-conteggi.service';
import { SubscriptionsService } from '../../../core/services/subscriptions.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TonoStato } from '../admin-stato';
import { formattaBp, formattaCent, parseImportoInCent } from '../denaro';
import {
  cassaLabel,
  fonteBackLabel,
  skinLabel,
  incassanteLabel,
  metodoPagamentoLabel,
  motivoSenzaCassa,
} from '../metodo-pagamento';

type Vista =
  | 'riepilogo'
  | 'rakeback'
  | 'abbonamenti'
  | 'stakati'
  | 'voci'
  | 'anagrafiche';

/** La bozza di una riga di conteggio: quattro campi di testo, come il rakeback. */
interface BozzaStakato {
  rake: string;
  poolEv: string;
  diff: string;
  fee: string;
  altro: string;
}

/** Quello che si sta digitando nella colonna del rakeback, prima di salvare. */
interface BozzaRiga {
  rake: string;
  pagato: string;
  metodo: MetodoMovimento | '';
  nota: string;
}

const CATEGORIE_USCITA: readonly CategoriaUscita[] = [
  'COACH',
  'INFRASTRUTTURA',
  'MARKETING',
  'COMMISSIONI',
  'ALTRO',
];
// ⚠️ L'ORDINE è quello delle `<option>` nel select, e ricalca a mano la tupla
// di `backend/src/conteggi/conteggi.types.ts`: i due repo non condividono nulla
// e nessuna guardia segnala una divergenza. `ALTRO` resta ultimo — è il ripiego.
const CATEGORIE_ENTRATA: readonly CategoriaEntrata[] = [
  'COMMISSIONI_AGENTE',
  'CONTENUTI',
  'COACHING',
  'STAKING',
  'ALTRO',
];
const METODI: readonly MetodoMovimento[] = [
  'BONIFICO',
  'PAYPAL',
  'SKRILL',
  'CONTANTI',
  'TICKET',
  'ALTRO',
];

/**
 * I conteggi mensili della scuola: spese, entrate, commissioni di rakeback e il
 * conto economico del mese.
 *
 * ⚠️ Il client NON calcola NIENTE di questa schermata. Rake, scaglioni, margini,
 * totali e ripartizione col socio arrivano già fatti dal server, e ogni
 * salvataggio restituisce il mese ricalcolato per intero: righe, totali e conto
 * economico nascono da una lettura sola e quindi non possono dissentire. Una
 * copia dell'aritmetica del denaro qui sarebbe la cosa che questo progetto
 * vieta più esplicitamente (`conteggi.types.ts`, `stakings.types.ts`).
 *
 * ⚠️ Gli unici euro che esistono qui sono quelli digitati e quelli mostrati: la
 * conversione da e verso i centesimi interi vive in `../denaro.ts`, in un punto
 * solo.
 *
 * ⚠️ `styleUrls` PLURALE con i tre fogli condivisi. Col solo foglio locale
 * `.admin-barra`, `.admin-ico`, `.admin-nota`, `.admin-stato` e la tabella non
 * sarebbero nemmeno raggiungibili — è il difetto che aveva isolato
 * `/admin/replayer`, dove l'h2 era più grande dell'h1 di pagina e dieci comandi
 * su dodici stavano sotto i 44px.
 */
@Component({
  selector: 'app-admin-conteggi-mensili',
  imports: [
    ReactiveFormsModule,
    IconComponent,
    ModalComponent,
    SchedeComponent,
  ],
  templateUrl: './admin-conteggi-mensili.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    './admin-conteggi-mensili.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConteggiMensiliComponent {
  private readonly api = inject(AdminConteggiService);
  private readonly abbonamentiApi = inject(SubscriptionsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly mesi = signal<MeseContabile[] | null>(null);
  protected readonly dett = signal<DettaglioMese | null>(null);
  protected readonly conti = signal<ContoRakeback[] | null>(null);
  protected readonly ricorrenti = signal<SpesaRicorrente[] | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly salvando = signal(false);
  /** Errore mostrato DENTRO la modale aperta: un toast lì sarebbe invisibile. */
  protected readonly erroreModale = signal<string | null>(null);

  /**
   * L'errore di VALIDAZIONE della colonna, separato da quello di caricamento.
   *
   * ⚠️⚠️ Erano lo stesso signal, ed era un difetto grave: la banda di
   * `error()` offre «Riprova», che chiama `carica()` → `scegliMese` →
   * `applica` → **riscrive la bozza**. Chi digitava quindici righe, sbagliava
   * un importo e premeva il pulsante che gli era stato offerto COME LA
   * RIPARAZIONE, le perdeva tutte. È la stessa regola già scritta per le
   * modali: l'errore che compare mentre la superficie di lavoro è aperta non
   * deve portare via il pulsante di riparazione.
   *
   * ⚠️ E si mostra ACCANTO a «Salva la colonna», non in cima alla pagina: la
   * banda di caricamento sta sopra le schede, cioè fuori schermo mentre si
   * compila la quindicesima riga.
   */
  protected readonly erroreValidazione = signal<string | null>(null);

  protected readonly vista = signal<Vista>('riepilogo');
  protected readonly conferma = signal<string | null>(null);

  protected readonly CATEGORIE_USCITA = CATEGORIE_USCITA;
  protected readonly CATEGORIE_ENTRATA = CATEGORIE_ENTRATA;
  protected readonly METODI = METODI;
  protected readonly INCASSANTI: readonly Incassante[] = ['PIETRO', 'EXIVEZZZ'];
  protected readonly CASSE = CASSE;
  protected readonly SKIN = SKIN;
  protected readonly FONTI_BACK = FONTI_BACK;

  protected readonly stakati = signal<Stakato[] | null>(null);
  protected readonly bozzaStakati = signal<Record<string, BozzaStakato>>({});
  protected readonly stakatoAperto = signal<Stakato | 'nuovo' | null>(null);

  protected readonly metodoPagamentoLabel = metodoPagamentoLabel;
  protected readonly incassanteLabel = incassanteLabel;
  protected readonly motivoSenzaCassa = motivoSenzaCassa;
  protected readonly cassaLabel = cassaLabel;

  // ── Le schede ────────────────────────────────────────────────────────────

  /**
   * ⚠️ `app-schede` e non `app-filtro`: cambia il GENERE di cosa si vede (il
   * conto economico, la tabella del rakeback, le spese, le anagrafiche), non
   * l'elenco di cose dello stesso genere. Una scheda promette un pannello
   * raggiungibile da tastiera, ed è quello che il template dichiara.
   */
  protected readonly viste = computed<readonly VoceScheda<Vista>[]>(() => {
    const d = this.dett();
    return [
      { valore: 'riepilogo', etichetta: 'Riepilogo' },
      {
        valore: 'rakeback',
        etichetta: 'Rakeback',
        conteggio: d?.righe.length ?? null,
      },
      {
        valore: 'abbonamenti',
        etichetta: 'Abbonamenti',
        conteggio: d?.abbonamenti.length ?? null,
      },
      {
        valore: 'stakati',
        etichetta: 'Stakati',
        conteggio: d?.stakati.length ?? null,
      },
      {
        valore: 'voci',
        etichetta: 'Spese ed entrate',
        conteggio: d?.voci.length ?? null,
      },
      { valore: 'anagrafiche', etichetta: 'Anagrafiche' },
    ];
  });

  // ── Il mese scelto ───────────────────────────────────────────────────────

  protected readonly mese = computed(() => this.dett()?.mese ?? null);
  protected readonly aperto = computed(() => this.mese()?.stato === 'APERTO');

  protected readonly tonoMese = computed<TonoStato>(() =>
    this.aperto() ? 'attesa' : 'concluso',
  );

  /**
   * Il titolo della barra nomina il PANNELLO, non la sezione.
   *
   * ⚠️ La topbar della shell stampa già «Conteggi mensili» (`ADMIN_NAV` →
   * `admin.component.html`): ripeterlo qui lo scriveva due volte nella stessa
   * schermata. Su sedici sezioni quattordici differenziano — «Lezioni
   * pubblicate», «Archivio news», «Codici sconto», «Registro staking» — e in
   * una sezione a schede il livello due deve dire in quale scheda si è.
   *
   * ⚠️ Il ramo `anagrafiche` non è oggi stampato da nessuna parte, e non è una
   * svista: quel pannello non ha una barra sola: ne ha DUE, una per elenco
   * («Conti rakeback», «Spese ricorrenti»), perché lì il mese non c'entra e il
   * `+` di ciascuna crea la riga della propria tabella. Lo `switch` resta
   * esaustivo perché è così che TypeScript impedisce di aggiungere una quinta
   * scheda senza deciderne il nome.
   */
  protected readonly titoloPannello = computed(() => {
    switch (this.vista()) {
      case 'riepilogo':
        return 'Riepilogo del mese';
      case 'rakeback':
        return 'Rakeback';
      case 'abbonamenti':
        return 'Abbonamenti';
      case 'stakati':
        return 'Stakati';
      case 'voci':
        return 'Spese ed entrate';
      case 'anagrafiche':
        return 'Anagrafiche';
    }
  });

  /**
   * Che cosa sta sommando la striscia dei totali.
   *
   * ⚠️ Non è decorazione: sopra un elenco, un totale che non nomina il proprio
   * insieme si legge come «tutto», qualunque cosa ci sia in tabella. È il
   * precedente di `ambito()` in `/admin/stakings`, e prima ancora la nota
   * scritta in `admin-participation.component.html`.
   */
  protected readonly ambito = computed(() => {
    const n = this.dett()?.righe.length ?? 0;
    const mese = this.mese()?.etichetta ?? '';
    return `su ${n} ${n === 1 ? 'conto' : 'conti'} di ${mese}`;
  });

  /**
   * L'ambito della striscia degli abbonamenti.
   *
   * ⚠️ Nomina DUE insiemi e non uno: quanti abbonamenti ci sono e quanti non
   * portano cassa. Il totale sopra somma solo i secondi, quindi senza la
   * seconda metà della frase si legge come «quattro abbonamenti hanno fatto
   * 80 €» — che è falso: uno solo li ha fatti.
   */
  protected readonly ambitoAbbonamenti = computed(() => {
    const righe = this.dett()?.abbonamenti ?? [];
    const mese = this.mese()?.etichetta ?? '';
    const senza = righe.filter((r) => !r.portaCassa).length;
    const base = `su ${righe.length} ${righe.length === 1 ? 'abbonamento' : 'abbonamenti'} di ${mese}`;
    return senza ? `${base}, ${senza} senza cassa` : base;
  });

  // ── La colonna del rakeback ──────────────────────────────────────────────

  /**
   * Quello che si sta digitando, per riga. Si semina a ogni lettura del mese.
   *
   * ⚠️ Un signal e non una `FormArray`: i campi sono due per riga su quindici
   * righe, e l'unica domanda che si fa a questo stato è «cosa è cambiato
   * rispetto a quello che il server mi ha appena dato». Con una `FormArray`
   * quella domanda richiederebbe comunque un confronto a mano, più il ciclo di
   * vita dei controlli da tenere allineato a una tabella che si ridisegna dopo
   * ogni salvataggio.
   */
  protected readonly bozza = signal<Record<string, BozzaRiga>>({});

  /**
   * ⚠️ Confronta i CENTESIMI e non le stringhe: «30» e «30,00» sono lo stesso
   * importo, e un pulsante «Salva» acceso perché qualcuno ha aggiunto uno zero
   * insegna a premerlo senza motivo.
   */
  protected readonly sporcoRakeback = computed(() => {
    const d = this.dett();
    if (!d) return false;
    const b = this.bozza();
    return d.righe.some((r) => {
      const v = b[r.contoId];
      if (!v) return false;
      return (
        (parseImportoInCent(v.rake) ?? 0) !== r.rakeGeneratoCent ||
        (parseImportoInCent(v.pagato) ?? 0) !== r.pagatoAlPlayerCent ||
        (v.metodo || undefined) !== r.metodoPagamento ||
        (v.nota || undefined) !== r.nota
      );
    });
  });

  /** Le righe con un importo digitato che non è un importo. */
  protected readonly righeNonValide = computed(() => {
    const b = this.bozza();
    return Object.entries(b)
      .filter(
        ([, v]) =>
          (v.rake.trim() !== '' && parseImportoInCent(v.rake) === null) ||
          (v.pagato.trim() !== '' && parseImportoInCent(v.pagato) === null),
      )
      .map(([id]) => id);
  });

  // ── Form ─────────────────────────────────────────────────────────────────

  protected readonly formVoce = this.fb.nonNullable.group({
    verso: ['USCITA' as VersoVoce, Validators.required],
    categoria: ['ALTRO' as CategoriaVoce, Validators.required],
    descrizione: ['', [Validators.required, Validators.minLength(2)]],
    controparte: [''],
    importo: ['', Validators.required],
    metodo: ['' as MetodoMovimento | ''],
    cassa: ['' as Cassa | ''],
  });

  protected readonly formConto = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(2)]],
    nomeReale: [''],
    backAgente: ['57', Validators.required],
    backPlayer: ['45', Validators.required],
    scaglioneBase: ['45', Validators.required],
    scaglionePasso: ['22,50', Validators.required],
    destinazione: ['SCUOLA' as DestinazioneMargine, Validators.required],
    attivo: [true],
    ordine: [100],
    nota: [''],
  });

  protected readonly formRicorrente = this.fb.nonNullable.group({
    descrizione: ['', [Validators.required, Validators.minLength(2)]],
    categoria: ['INFRASTRUTTURA' as CategoriaUscita, Validators.required],
    controparte: [''],
    cassa: ['' as Cassa | ''],
    importo: ['', Validators.required],
    attiva: [true],
    nota: [''],
  });

  /**
   * ⚠️ `toSignal(valueChanges)` e MAI un `computed` che legge `form.value`: un
   * `FormGroup` non è un signal, quindi quel computed non si ricalcolerebbe MAI
   * e `sporco` resterebbe falso — cioè Escape butterebbe via il digitato senza
   * chiedere, che è esattamente il difetto che questo input esiste per
   * prevenire.
   */
  private readonly voceVal = toSignal(this.formVoce.valueChanges, {
    initialValue: this.formVoce.getRawValue(),
  });
  private readonly contoVal = toSignal(this.formConto.valueChanges, {
    initialValue: this.formConto.getRawValue(),
  });
  private readonly ricorrenteVal = toSignal(this.formRicorrente.valueChanges, {
    initialValue: this.formRicorrente.getRawValue(),
  });

  /** La baseline si scrive DOPO il patch dei campi, o la modale nasce sporca. */
  private readonly baseVoce = signal('');
  private readonly baseConto = signal('');
  private readonly baseRicorrente = signal('');

  protected readonly voceSporca = computed(
    () => JSON.stringify(this.voceVal()) !== this.baseVoce(),
  );
  protected readonly contoSporco = computed(
    () => JSON.stringify(this.contoVal()) !== this.baseConto(),
  );
  protected readonly ricorrenteSporca = computed(
    () => JSON.stringify(this.ricorrenteVal()) !== this.baseRicorrente(),
  );

  // ── Modali ───────────────────────────────────────────────────────────────

  protected readonly voceAperta = signal<VoceMese | 'nuova' | null>(null);
  protected readonly contoAperto = signal<ContoRakeback | 'nuovo' | null>(null);
  protected readonly ricorrenteAperta = signal<
    SpesaRicorrente | 'nuova' | null
  >(null);
  protected readonly apriMeseAperto = signal(false);

  /** La riga di abbonamento aperta nella scheda di correzione. */
  protected readonly abbonamentoAperto = signal<RigaAbbonamento | null>(null);

  /**
   * ⚠️ `motivo` è l'unico campo OBBLIGATORIO, e non è burocrazia: la correzione
   * è in place, quindi senza la coppia before/after dell'audit «quanto c'era
   * scritto prima» sarebbe perduto per sempre — e su un contante non esiste
   * alcun estratto conto da cui ricostruirlo.
   */
  protected readonly formCorrezione = this.fb.nonNullable.group({
    importo: [''],
    incassatoDa: ['' as Incassante | ''],
    paymentReference: [''],
    dataIncasso: [''],
    motivo: ['', [Validators.required, Validators.minLength(3)]],
  });


  protected readonly formMese = this.fb.nonNullable.group({
    anno: [new Date().getFullYear(), Validators.required],
    mese: [new Date().getMonth() + 1, Validators.required],
  });

  constructor() {
    this.carica();

    /**
     * Cambiando VERSO, una categoria rimasta dell'altro verso torna ad «Altro».
     *
     * ⚠️⚠️ Senza, il difetto è muto in pagina e rumoroso al salvataggio: il
     * `<select>` non ha più un'`<option>` con quel valore, quindi **si mostra
     * VUOTO** — «non ho ancora scelto» —, ma il `FormControl` conserva il
     * valore vecchio e il server risponde 400 «La categoria «COACH» non è
     * ammessa per un'entrata». Misurato: scegli Spesa → «Compensi ai coach»,
     * poi cambi in Entrata, e prendi un errore su una cosa che a schermo non
     * c'era.
     *
     * ⚠️ Un `effect` e non una sottoscrizione a `verso.valueChanges`: quella
     * scatta DENTRO il `setValue` di `apriVoce`, cioè quando `categoria` porta
     * ancora il valore della modale precedente, e la correttezza dipenderebbe
     * dall'ordine delle chiavi dell'oggetto passato. L'effetto gira dopo, su
     * uno stato già coerente: aprendo una voce esistente non tocca niente e la
     * modale non nasce «sporca».
     *
     * ⚠️ Si torna ad «Altro» — l'unica categoria valida in ENTRAMBI i versi —
     * e non alla prima dell'elenco nuovo: scegliere d'ufficio una categoria che
     * significa qualcosa metterebbe in bocca all'utente una classificazione che
     * non ha chiesto.
     */
    effect(() => {
      const { verso, categoria } = this.voceVal();
      const ammesse: readonly string[] =
        verso === 'USCITA' ? CATEGORIE_USCITA : CATEGORIE_ENTRATA;
      if (categoria && !ammesse.includes(categoria)) {
        this.formVoce.patchValue({ categoria: 'ALTRO' });
      }
    });
  }

  // ── Lettura ──────────────────────────────────────────────────────────────

  protected carica(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listMesi().subscribe({
      next: (mesi) => {
        this.mesi.set(mesi);
        this.loading.set(false);
        if (mesi.length) this.scegliMese(mesi[0].id);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(err, 'Non riesco a leggere i mesi contabili.'),
        );
      },
    });
    this.caricaAnagrafiche();
  }

  private caricaAnagrafiche(): void {
    this.api.listConti().subscribe({
      next: (c) => this.conti.set(c),
      error: () => this.conti.set(null),
    });
    this.api.listRicorrenti().subscribe({
      next: (r) => this.ricorrenti.set(r),
      error: () => this.ricorrenti.set(null),
    });
    this.listStakati();
  }

  protected scegliMese(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.dettaglio(id).subscribe({
      next: (d) => this.applica(d),
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Non riesco a leggere il mese.'));
      },
    });
  }

  /** Applica il dettaglio e RISEMINA la bozza: il server è l'autorità. */
  private applica(d: DettaglioMese): void {
    this.dett.set(d);
    this.loading.set(false);
    const b: Record<string, BozzaRiga> = {};
    for (const r of d.righe) {
      b[r.contoId] = {
        rake: r.rakeGeneratoCent ? this.euro(r.rakeGeneratoCent) : '',
        pagato: r.pagatoAlPlayerCent ? this.euro(r.pagatoAlPlayerCent) : '',
        metodo: r.metodoPagamento ?? '',
        nota: r.nota ?? '',
      };
    }
    this.bozza.set(b);
  }

  /** Euro nudi per un campo di input: «1250,50», mai «1.250,50 €». */
  private euro(cent: number): string {
    return (cent / 100).toFixed(2).replace('.', ',');
  }

  // ── Formattazione ────────────────────────────────────────────────────────

  protected readonly eur = (cent: number | undefined | null): string =>
    formattaCent(cent ?? 0);
  protected readonly pct = (bp: number): string => formattaBp(bp);

  protected categoriaLabel(c: CategoriaVoce): string {
    switch (c) {
      case 'COACH':
        return 'Compensi ai coach';
      case 'INFRASTRUTTURA':
        return 'Infrastruttura e servizi';
      case 'MARKETING':
        return 'Marketing';
      case 'COMMISSIONI':
        return 'Commissioni e provvigioni';
      case 'COMMISSIONI_AGENTE':
        return 'Commissioni da agente';
      case 'CONTENUTI':
        return 'Contenuti e canali';
      case 'COACHING':
        return 'Coaching individuale';
      case 'STAKING':
        return 'Staking';
      case 'ALTRO':
        return 'Altro';
    }
  }

  protected metodoLabel(m: MetodoMovimento): string {
    switch (m) {
      case 'BONIFICO':
        return 'Bonifico';
      case 'PAYPAL':
        return 'PayPal';
      case 'SKRILL':
        return 'Skrill';
      case 'CONTANTI':
        return 'Contanti';
      case 'TICKET':
        return 'Ticket';
      case 'ALTRO':
        return 'Altro';
    }
  }

  /** Le categorie ammesse dal verso scelto nel form. */
  protected readonly categorieDelVerso = computed<readonly CategoriaVoce[]>(
    () =>
      this.voceVal().verso === 'USCITA' ? CATEGORIE_USCITA : CATEGORIE_ENTRATA,
  );

  /**
   * L'esempio nel campo descrizione segue il VERSO.
   *
   * ⚠️ Era fisso su «es. LiveKit» — che è una **spesa**, sempre e solo — anche
   * quando il tipo è Entrata. In una modale dove a distinguere un'entrata da
   * un'uscita c'è una sola tendina, l'esempio è metà del segnale: suggerirne
   * uno del verso sbagliato è il modo più rapido per far registrare un incasso
   * come un costo.
   *
   * ⚠️ Il segnaposto della modale delle **spese ricorrenti** resta «es. LiveKit»
   * e non va toccato: quel form accetta le sole `CATEGORIE_USCITA`, quindi là
   * l'esempio è giusto per costruzione.
   */
  protected readonly esempioDescrizione = computed(() =>
    this.voceVal().verso === 'USCITA'
      ? 'es. LiveKit'
      : 'es. Commissione Grinderlab',
  );

  /**
   * ⚠️ L'etichetta della cassa SEGUE IL VERSO, ed è la correzione di un difetto
   * uscito in produzione il 10/09/2026: il campo diceva «Chi ha pagato» anche
   * su un'ENTRATA, dove chi ha pagato è l'abbonato — non il socio che ha
   * incassato. È lo stesso difetto del segnaposto «es. LiveKit» qui sopra
   * (giusto per una spesa, falso davanti a un'entrata), sul campo successivo.
   *
   * ⚠️ Il campo è UNO SOLO e il valore non cambia significato: dice sempre da
   * quale portafoglio il denaro si muove. A cambiare è la sola direzione, e
   * quindi la sola parola.
   */
  /**
   * I conti dell'anagrafica ATTIVI che non hanno una riga in questo mese.
   *
   * ⚠️⚠️ Esiste perché l'istruzione per farli entrare viveva SOLO nello stato
   * vuoto della tabella: con almeno una riga in tabella non c'era piu' niente,
   * in nessuna schermata, che dicesse come aggiungere gli altri — e l'owner c'e'
   * rimasto bloccato (11/09/2026). È lo stesso difetto già pagato su /lezioni,
   * dove «Azzera i filtri» compariva solo dopo aver trovato zero risultati:
   * un'istruzione che si vede solo quando non serve più.
   *
   * ⚠️ Solo gli ATTIVI: un conto disattivato non deve entrare nei mesi nuovi,
   * ed elencarlo qui proporrebbe un'azione che la sincronizzazione non farà.
   */
  protected readonly contiFuoriDalMese = computed(() => {
    const anagrafica = this.conti() ?? [];
    const nelMese = new Set((this.dett()?.righe ?? []).map((r) => r.contoId));
    return anagrafica.filter((c) => c.attivo && !nelMese.has(c.id));
  });

  /** Gemella della precedente, per le spese fisse sul pannello delle voci. */
  protected readonly ricorrentiFuoriDalMese = computed(() => {
    const anagrafica = this.ricorrenti() ?? [];
    const nelMese = new Set(
      (this.dett()?.voci ?? [])
        .map((v) => v.ricorrenteId)
        .filter((x): x is string => !!x),
    );
    return anagrafica.filter((r) => r.attiva && !nelMese.has(r.id));
  });

  /**
   * I nomi di chi manca, non solo quanti.
   *
   * ⚠️ Un comando che non dichiara il proprio effetto su dati contabili non si
   * preme volentieri: «sincronizza» da solo non dice CHE COSA entrera'. Oltre i
   * quattro si tronca, o la riga diventa un muro di testo.
   */
  protected readonly nomiFuoriDalMese = computed(() => {
    const n = this.contiFuoriDalMese().map((c) => c.username);
    return n.length <= 4
      ? n.join(', ')
      : `${n.slice(0, 4).join(', ')} e altri ${n.length - 4}`;
  });

  /**
   * Le righe «dal conto» che stanno calcolando su una back di ZERO, perché il
   * rake del mese non è ancora stato scritto nella scheda Rakeback.
   *
   * ⚠️⚠️ Senza questo avviso il pannello dava un risultato PIÙ NEGATIVO del
   * vero e proponeva di portarlo a recupero: il pool non veniva compensato da
   * alcuna back. Il calcolo era giusto e i dati incompleti — la distinzione
   * più difficile da vedere e la più facile da dire. Rilevata dall'owner in
   * produzione su agosto 2026.
   *
   * ⚠️ Esclude `contoFuoriMese`: quelle righe hanno la loro diagnosi in
   * tabella («fuori dal mese») e una strada diversa — scrivere il rake non le
   * aiuterebbe, il conto va prima sincronizzato nel mese.
   *
   * ⚠️ E esclude le righe `MANUALE`: là il rake si digita in questa stessa
   * tabella, quindi lo zero è già davanti agli occhi di chi lo deve correggere.
   */
  protected readonly stakatiSenzaBack = computed(() =>
    (this.dett()?.stakati ?? []).filter(
      // ⚠️ Esclude ENTRAMBE le altre due diagnosi, non una: con la sola
      // `contoFuoriMese` una riga non collegata cadeva in tutti e due gli
      // avvisi, che si contraddicono («scrivi il rake» / «non c'è un conto da
      // cui leggerlo»). Preso da una spec, non a occhio.
      (r) =>
        r.fonteBack === 'CONTO' &&
        !r.contoFuoriMese &&
        !r.contoNonCollegato &&
        !r.rakeLettoCent,
    ),
  );

  /**
   * Le righe che la back non la possono proprio leggere: il conto non è nel
   * mese, oppure non è collegato affatto.
   *
   * ⚠️ SEPARATE da `stakatiSenzaBack` perché il rimedio è un altro: là si
   * scrive il rake, qui si sincronizza o si collega il conto. Un avviso solo
   * per tre cause manderebbe due volte su tre a fare la cosa sbagliata.
   */
  protected readonly stakatiSenzaConto = computed(() =>
    (this.dett()?.stakati ?? []).filter(
      (r) =>
        r.fonteBack === 'CONTO' && (r.contoFuoriMese || r.contoNonCollegato),
    ),
  );

  /** I nomi, non solo quanti: gemella di `nomiFuoriDalMese`. */
  protected readonly nomiSenzaBack = computed(() =>
    this.elenca(this.stakatiSenzaBack().map((r) => r.nome)),
  );

  protected readonly nomiSenzaConto = computed(() =>
    this.elenca(this.stakatiSenzaConto().map((r) => r.nome)),
  );

  private elenca(n: string[]): string {
    return n.length <= 4
      ? n.join(', ')
      : `${n.slice(0, 4).join(', ')} e altri ${n.length - 4}`;
  }

  protected readonly etichettaCassa = computed(() =>
    this.voceVal().verso === 'USCITA' ? 'Chi ha pagato' : 'Chi ha incassato',
  );

  // ── Il mese: apri, chiudi, riapri, sincronizza ───────────────────────────

  protected apriModaleMese(): void {
    const oggi = new Date();
    this.formMese.setValue({
      anno: oggi.getFullYear(),
      mese: oggi.getMonth() + 1,
    });
    this.erroreModale.set(null);
    this.apriMeseAperto.set(true);
  }

  protected confermaApriMese(): void {
    const { anno, mese } = this.formMese.getRawValue();
    this.salvando.set(true);
    this.erroreModale.set(null);
    this.api.apriMese(anno, mese).subscribe({
      next: (d) => {
        this.salvando.set(false);
        this.apriMeseAperto.set(false);
        this.applica(d);
        this.api.listMesi().subscribe((m) => this.mesi.set(m));
        // ⚠️ Toast SOLO a modale chiusa: `showModal()` mette il dialog nel top
        // layer, sopra qualunque `position: fixed`, e `<app-toast/>` è montato
        // in `app-root` — con la modale aperta il messaggio parte, il signal si
        // popola, i test restano verdi e nessuno lo legge.
        this.toast.success(`${d.mese.etichetta} è pronto.`);
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco ad aprire il mese.'),
        );
      },
    });
  }

  protected sincronizza(): void {
    const m = this.mese();
    if (!m) return;
    this.api.sincronizza(m.id).subscribe({
      next: (r) => {
        this.scegliMese(m.id);
        this.caricaAnagrafiche();
        this.toast.success(
          r.vociCreate || r.righeCreate
            ? `Aggiunte ${r.vociCreate} spese ricorrenti e ${r.righeCreate} righe di rakeback.`
            : 'Il mese era già allineato: niente da aggiungere.',
        );
      },
      error: (err) =>
        this.error.set(
          apiErrorMessage(err, 'Non riesco a sincronizzare il mese.'),
        ),
    });
  }

  protected chiudiMese(): void {
    const m = this.mese();
    if (!m) return;
    this.api.chiudiMese(m.id).subscribe({
      next: (d) => {
        this.applica(d);
        this.conferma.set(null);
        this.api.listMesi().subscribe((x) => this.mesi.set(x));
        this.toast.success(`${d.mese.etichetta} è chiuso e i numeri congelati.`);
      },
      error: (err) =>
        this.error.set(apiErrorMessage(err, 'Non riesco a chiudere il mese.')),
    });
  }

  protected riapriMese(): void {
    const m = this.mese();
    if (!m) return;
    this.api.riapriMese(m.id).subscribe({
      next: (d) => {
        this.applica(d);
        this.conferma.set(null);
        this.api.listMesi().subscribe((x) => this.mesi.set(x));
        this.toast.success(`${d.mese.etichetta} è di nuovo aperto.`);
      },
      error: (err) =>
        this.error.set(apiErrorMessage(err, 'Non riesco a riaprire il mese.')),
    });
  }

  // ── Rakeback ─────────────────────────────────────────────────────────────

  protected scriviRake(contoId: string, valore: string): void {
    this.bozza.update((b) => ({
      ...b,
      [contoId]: { ...b[contoId], rake: valore },
    }));
  }

  protected scriviPagato(contoId: string, valore: string): void {
    this.bozza.update((b) => ({
      ...b,
      [contoId]: { ...b[contoId], pagato: valore },
    }));
  }

  protected scriviMetodo(contoId: string, valore: string): void {
    this.bozza.update((b) => ({
      ...b,
      [contoId]: { ...b[contoId], metodo: valore as MetodoMovimento | '' },
    }));
  }

  protected scriviNota(contoId: string, valore: string): void {
    this.bozza.update((b) => ({
      ...b,
      [contoId]: { ...b[contoId], nota: valore },
    }));
  }

  /**
   * La scheda di una riga: metodo di pagamento, nota e il dettaglio del calcolo.
   *
   * ⚠️ Il selettore del metodo stava DENTRO la cella, accanto all'importo, e si
   * e' visto sbagliato guardando la pagina: due controlli in una cella
   * portavano la riga a 62px (il tetto del pannello e' 46) e la tabella a
   * sfondare di 119px a 1024. Qui il metodo e' informazione secondaria — non
   * serve a far tornare i conti del mese — e la scheda e' la grammatica che
   * tutte le altre tabelle del pannello usano gia'.
   *
   * ⚠️ Scrive nella STESSA bozza della colonna: il salvataggio resta uno solo,
   * la PUT di tutta la tabella. Una seconda strada di scrittura vorrebbe dire
   * due punti in cui la riga puo' cambiare, e uno dei due dimenticato.
   */
  protected readonly rigaAperta = signal<string | null>(null);

  protected readonly rigaInScheda = computed(() => {
    const id = this.rigaAperta();
    if (!id) return null;
    // ⚠️ La condizione e' la RIGA riletta dalla pagina e non l'id: se la
    // tabella si ricarica e quella riga non c'e' piu', la scheda si chiude da
    // se' invece di restare aperta su un'entita' che non esiste.
    return this.dett()?.righe.find((r) => r.contoId === id) ?? null;
  });

  protected apriRiga(r: { contoId: string }): void {
    this.rigaAperta.set(r.contoId);
  }

  protected salvaRakeback(): void {
    const m = this.mese();
    const d = this.dett();
    if (!m || !d) return;
    const rotte = this.righeNonValide();
    if (rotte.length) {
      // ⚠️ Il messaggio NOMINA le righe: `righeNonValide()` ha già gli id, e
      // «ci sono importi illeggibili» su quindici righe manda a cercarli a mano.
      const nomi = d.righe
        .filter((r) => rotte.includes(r.contoId))
        .map((r) => r.username)
        .join(', ');
      this.erroreValidazione.set(
        `Non riesco a leggere l’importo di ${nomi}: correggilo prima di salvare.`,
      );
      return;
    }
    const b = this.bozza();
    const righe: RigaRakebackPayload[] = d.righe.map((r) => {
      const v = b[r.contoId];
      return {
        contoId: r.contoId,
        rakeGeneratoCent: parseImportoInCent(v?.rake ?? '') ?? 0,
        pagatoAlPlayerCent: parseImportoInCent(v?.pagato ?? '') ?? 0,
        ...(v?.metodo ? { metodoPagamento: v.metodo } : {}),
        ...(v?.nota?.trim() ? { nota: v.nota.trim() } : {}),
      };
    });
    this.salvando.set(true);
    this.erroreValidazione.set(null);
    this.api.salvaRakeback(m.id, righe).subscribe({
      next: (nuovo) => {
        this.salvando.set(false);
        this.applica(nuovo);
        this.toast.success('Colonna salvata.');
      },
      error: (err) => {
        this.salvando.set(false);
        // ⚠️ Anche l'errore di rete del salvataggio va nella banda ACCANTO al
        // pulsante, non in quella di caricamento: là ci sarebbe «Riprova», che
        // ricaricherebbe buttando via la colonna.
        this.erroreValidazione.set(
          apiErrorMessage(err, 'Non riesco a salvare la colonna.'),
        );
      },
    });
  }

  // ── Stakati ──────────────────────────────────────────────────────────────

  protected readonly skinLabel = skinLabel;
  protected readonly fonteBackLabel = fonteBackLabel;

  /**
   * ⚠️ Nomina l'insieme che somma, come la striscia del rakeback: sopra un
   * elenco, un totale che non dice cosa sta sommando si legge come «tutto
   * l'archivio» qualunque cosa ci sia sotto.
   */
  protected readonly ambitoStakati = computed(() => {
    const d = this.dett();
    if (!d) return '';
    const n = d.stakati.length;
    const daReg = d.stakati.filter((r) => !r.registrato && r.aRecuperoCent !== 0)
      .length;
    const base = `su ${n} stakato${n === 1 ? '' : 'i'} di ${d.mese.etichetta}`;
    return daReg
      ? `${base}, ${daReg} da portare sul registro staking`
      : base;
  });

  protected readonly totaleDaRegolare = computed(() =>
    (this.dett()?.stakati ?? []).reduce((t, r) => t + r.daRegolareCent, 0),
  );

  protected scriviStakato(
    id: string,
    campo: keyof BozzaStakato,
    valore: string,
  ): void {
    this.bozzaStakati.update((b) => ({
      ...b,
      [id]: { ...(b[id] ?? this.bozzaVuota()), [campo]: valore },
    }));
  }

  private bozzaVuota(): BozzaStakato {
    return { rake: '', poolEv: '', diff: '', fee: '', altro: '' };
  }

  /** Il valore salvato, per il ramo a mese CHIUSO (dove non si rende un input). */
  protected valoreCongelato(r: RigaStakato, campo: keyof BozzaStakato): number {
    switch (campo) {
      case 'rake':
        return r.rakeLordoCent ?? 0;
      case 'poolEv':
        return r.poolEvCent;
      case 'diff':
        return r.diffCent;
      case 'fee':
        return r.feeCent;
      case 'altro':
        return r.altroCent;
    }
  }

  protected valoreStakato(r: RigaStakato, campo: keyof BozzaStakato): string {
    const b = this.bozzaStakati()[r.id];
    if (b) return b[campo];
    switch (campo) {
      case 'rake':
        return r.rakeLordoCent === undefined ? '' : this.euro(r.rakeLordoCent);
      case 'poolEv':
        return this.euro(r.poolEvCent);
      case 'diff':
        return this.euro(r.diffCent);
      case 'fee':
        return this.euro(r.feeCent);
      case 'altro':
        return this.euro(r.altroCent);
    }
  }

  /**
   * ⚠️ I quattro del pool si digitano CON SEGNO, quindi `parseImportoInCent`
   * deve poter tornare un negativo. Un campo vuoto vale zero — su un pool che
   * spesso ha «Altro» a zero, obbligare a scrivere «0» sarebbe attrito puro.
   */
  private centDaCampo(v: string | undefined): number | null {
    const t = (v ?? '').trim();
    if (!t) return 0;
    const neg = t.startsWith('-') || t.startsWith('\u2212');
    const cent = parseImportoInCent(neg ? t.slice(1).trim() : t);
    if (cent === null) return null;
    return neg ? -cent : cent;
  }

  protected readonly righeStakatiNonValide = computed(() => {
    const d = this.dett();
    if (!d) return [] as string[];
    const b = this.bozzaStakati();
    return d.stakati
      .filter((r) => {
        const v = b[r.id];
        if (!v) return false;
        const campi: (keyof BozzaStakato)[] = ['poolEv', 'diff', 'fee', 'altro'];
        if (r.fonteBack === 'MANUALE') campi.push('rake');
        return campi.some((c) => this.centDaCampo(v[c]) === null);
      })
      .map((r) => r.id);
  });

  protected readonly sporcoStakati = computed(() => {
    const d = this.dett();
    if (!d) return false;
    const b = this.bozzaStakati();
    return d.stakati.some((r) => {
      const v = b[r.id];
      if (!v) return false;
      return (
        this.centDaCampo(v.poolEv) !== r.poolEvCent ||
        this.centDaCampo(v.diff) !== r.diffCent ||
        this.centDaCampo(v.fee) !== r.feeCent ||
        this.centDaCampo(v.altro) !== r.altroCent ||
        (r.fonteBack === 'MANUALE' &&
          this.centDaCampo(v.rake) !== (r.rakeLordoCent ?? 0))
      );
    });
  });

  protected salvaStakati(): void {
    const m = this.mese();
    const d = this.dett();
    if (!m || !d) return;
    const rotte = this.righeStakatiNonValide();
    if (rotte.length) {
      const nomi = d.stakati
        .filter((r) => rotte.includes(r.id))
        .map((r) => r.nome)
        .join(', ');
      this.erroreValidazione.set(
        `Non riesco a leggere i numeri di ${nomi}: correggili prima di salvare.`,
      );
      return;
    }
    const b = this.bozzaStakati();
    const righe: RigaStakatoPayload[] = d.stakati.map((r) => {
      const v = b[r.id];
      const leggi = (c: keyof BozzaStakato, fallback: number) =>
        v ? (this.centDaCampo(v[c]) ?? 0) : fallback;
      return {
        id: r.id,
        poolEvCent: leggi('poolEv', r.poolEvCent),
        diffCent: leggi('diff', r.diffCent),
        feeCent: leggi('fee', r.feeCent),
        altroCent: leggi('altro', r.altroCent),
        ...(r.fonteBack === 'MANUALE'
          ? { rakeLordoCent: leggi('rake', r.rakeLordoCent ?? 0) }
          : {}),
      };
    });
    this.salvando.set(true);
    this.erroreValidazione.set(null);
    this.api.salvaStakati(m.id, righe).subscribe({
      next: (nuovo) => {
        this.salvando.set(false);
        this.applica(nuovo);
        this.bozzaStakati.set({});
        this.toast.success('Conteggio salvato.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreValidazione.set(
          apiErrorMessage(err, 'Non riesco a salvare il conteggio.'),
        );
      },
    });
  }

  /**
   * ⚠️ La risposta è il mese RICALCOLATO e si ridisegna da quella: dopo la
   * scrittura il debito EV è cambiato, e tenere a schermo la ripartizione di
   * prima mostrerebbe una divisione che non esiste più.
   */
  protected registraStakato(r: RigaStakato): void {
    this.salvando.set(true);
    this.erroreValidazione.set(null);
    this.api.registraStakato(r.id).subscribe({
      next: (nuovo) => {
        this.salvando.set(false);
        this.applica(nuovo);
        this.toast.success(`Conteggio di ${r.nome} portato sul registro.`);
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreValidazione.set(
          apiErrorMessage(err, 'Non riesco a registrare il conteggio.'),
        );
      },
    });
  }

  // ── Stakati: anagrafica ──────────────────────────────────────────────────

  protected readonly formStakato = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    deal: ['35', Validators.required],
    fonteBack: ['CONTO' as FonteBack, Validators.required],
    contoId: [''],
    skin: ['' as Skin | ''],
    back: [''],
    attivo: [true],
    nota: [''],
  });

  protected readonly stakatoVal = toSignal(this.formStakato.valueChanges, {
    initialValue: this.formStakato.getRawValue(),
  });

  /** ⚠️ I campi dell'altra fonte si nascondono: chiederli entrambi invita a
   * compilarne uno che poi il server butta via. */
  protected readonly fonteConto = computed(
    () => this.stakatoVal().fonteBack === 'CONTO',
  );

  protected readonly baseStakato = signal('');
  protected readonly stakatoSporco = computed(
    () => JSON.stringify(this.stakatoVal()) !== this.baseStakato(),
  );

  protected apriStakato(st: Stakato | 'nuovo'): void {
    this.erroreModale.set(null);
    this.conferma.set(null);
    if (st === 'nuovo') {
      this.formStakato.reset({
        nome: '',
        deal: '35',
        fonteBack: 'CONTO',
        contoId: '',
        skin: '',
        back: '',
        attivo: true,
        nota: '',
      });
    } else {
      this.formStakato.setValue({
        nome: st.nome,
        deal: this.pctGrezza(st.dealScuolaBp),
        fonteBack: st.fonteBack,
        contoId: st.contoId ?? '',
        skin: st.skin ?? '',
        back: st.backBp === undefined ? '' : this.pctGrezza(st.backBp),
        attivo: st.attivo,
        nota: st.nota ?? '',
      });
    }
    // ⚠️ La baseline DOPO il patch, o la modale nasce già sporca.
    this.baseStakato.set(JSON.stringify(this.formStakato.getRawValue()));
    this.stakatoAperto.set(st);
  }

  private pctGrezza(bp: number): string {
    return String(bp / 100).replace('.', ',');
  }

  protected eliminaStakato(st: Stakato): void {
    this.api.eliminaStakato(st.id).subscribe({
      next: () => {
        this.stakatoAperto.set(null);
        this.conferma.set(null);
        this.caricaAnagrafiche();
        this.toast.success('Stakato rimosso.');
      },
      // ⚠️ L'errore resta NELLA modale: un toast emesso con un `<dialog>`
      // aperto dipinge dietro il fondale e non lo legge nessuno. E qui il 409
      // («compare già in N mesi») è proprio il messaggio che serve.
      //
      // ⚠️⚠️ E la conferma si DISARMA: quel 409 non è transitorio — finché
      // quei mesi esistono la risposta sarà la stessa —, quindi lasciare
      // «Rimuovi davvero» sotto il dito invita una seconda pressione che non
      // può che fallire. Preso da una spec.
      error: (err) => {
        this.conferma.set(null);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a rimuovere questo giocatore.'),
        );
      },
    });
  }

  protected salvaStakato(): void {
    const aperto = this.stakatoAperto();
    if (!aperto) return;
    const f = this.formStakato.getRawValue();
    const deal = parseImportoInCent(f.deal);
    if (deal === null || deal < 0 || deal > 10_000) {
      this.erroreModale.set('La quota della scuola non è valida.');
      return;
    }
    if (f.fonteBack === 'CONTO' && !f.contoId) {
      this.erroreModale.set('Scegli il conto rakeback da cui leggere la back.');
      return;
    }
    const back = f.fonteBack === 'MANUALE' ? parseImportoInCent(f.back) : null;
    if (f.fonteBack === 'MANUALE' && (!f.skin || back === null)) {
      this.erroreModale.set(
        'Con il rake a mano servono la skin e la percentuale di back.',
      );
      return;
    }
    const body: StakatoPayload = {
      nome: f.nome.trim(),
      dealScuolaBp: deal,
      fonteBack: f.fonteBack,
      ...(f.fonteBack === 'CONTO' ? { contoId: f.contoId } : {}),
      ...(f.fonteBack === 'MANUALE' && f.skin ? { skin: f.skin } : {}),
      ...(f.fonteBack === 'MANUALE' && back !== null ? { backBp: back } : {}),
      attivo: f.attivo,
      ...(f.nota.trim() ? { nota: f.nota.trim() } : {}),
    };
    this.salvando.set(true);
    this.erroreModale.set(null);
    const chiamata =
      aperto === 'nuovo'
        ? this.api.creaStakato(body)
        : this.api.aggiornaStakato(aperto.id, body);
    chiamata.subscribe({
      next: () => {
        this.salvando.set(false);
        this.stakatoAperto.set(null);
        this.listStakati();
        const m = this.mese();
        if (m) this.scegliMese(m.id);
        this.toast.success('Stakato salvato.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a salvare lo stakato.'),
        );
      },
    });
  }

  protected listStakati(): void {
    this.api.listStakati().subscribe({
      next: (r) => this.stakati.set(r),
      error: () => this.stakati.set([]),
    });
  }

  // ── Voci ─────────────────────────────────────────────────────────────────

  protected apriVoce(v: VoceMese | 'nuova'): void {
    this.erroreModale.set(null);
    // ⚠️ La conferma distruttiva NON sopravvive a un'altra apertura: senza,
    // chi apre «Elimina», preme Escape e riapre un'ALTRA riga trova la sezione
    // già in stato «Elimina davvero» — il passaggio di conferma saltato,
    // sull'unica azione irreversibile della sezione.
    this.conferma.set(null);
    if (v === 'nuova') {
      this.formVoce.reset({
        verso: 'USCITA',
        categoria: 'ALTRO',
        descrizione: '',
        controparte: '',
        importo: '',
        metodo: '',
        cassa: '',
      });
    } else {
      this.formVoce.setValue({
        verso: v.verso,
        categoria: v.categoria,
        descrizione: v.descrizione,
        controparte: v.controparte ?? '',
        importo: this.euro(v.importoCent),
        metodo: v.metodo ?? '',
        cassa: v.cassa ?? '',
      });
    }
    // ⚠️ La baseline DOPO il patch, o la modale nasce già sporca e il primo
    // Escape chiede conferma senza che nessuno abbia digitato niente.
    this.baseVoce.set(JSON.stringify(this.formVoce.getRawValue()));
    this.voceAperta.set(v);
  }

  protected salvaVoce(): void {
    const m = this.mese();
    const aperta = this.voceAperta();
    if (!m || !aperta) return;
    const f = this.formVoce.getRawValue();
    const importoCent = parseImportoInCent(f.importo);
    if (importoCent === null || importoCent <= 0) {
      this.erroreModale.set('L’importo non è valido.');
      return;
    }
    const body = {
      verso: f.verso,
      categoria: f.categoria,
      descrizione: f.descrizione.trim(),
      ...(f.controparte.trim() ? { controparte: f.controparte.trim() } : {}),
      importoCent,
      ...(f.metodo ? { metodo: f.metodo } : {}),
      // ⚠️ Si manda solo se scelta, come `metodo`: `forbidNonWhitelisted` non
      // c'entra (il campo esiste), ma una stringa vuota NON è un valore di
      // `CASSE` e il DTO risponderebbe 400 sull'intera chiamata.
      ...(f.cassa ? { cassa: f.cassa } : {}),
    };
    this.salvando.set(true);
    this.erroreModale.set(null);
    const chiamata =
      aperta === 'nuova'
        ? this.api.creaVoce(m.id, body)
        : this.api.aggiornaVoce(aperta.id, body);
    chiamata.subscribe({
      next: () => {
        this.salvando.set(false);
        this.voceAperta.set(null);
        this.scegliMese(m.id);
        this.toast.success('Voce salvata.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a salvare la voce.'),
        );
      },
    });
  }

  protected eliminaVoce(v: VoceMese): void {
    const m = this.mese();
    if (!m) return;
    this.api.eliminaVoce(v.id).subscribe({
      next: () => {
        this.voceAperta.set(null);
        this.conferma.set(null);
        this.scegliMese(m.id);
        this.toast.success('Voce eliminata.');
      },
      error: (err) =>
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a eliminare la voce.'),
        ),
    });
  }

  // ── Conti ────────────────────────────────────────────────────────────────

  protected apriConto(c: ContoRakeback | 'nuovo'): void {
    this.erroreModale.set(null);
    this.conferma.set(null);
    if (c === 'nuovo') {
      this.formConto.reset({
        username: '',
        nomeReale: '',
        backAgente: '57',
        backPlayer: '45',
        scaglioneBase: '45',
        scaglionePasso: '22,50',
        destinazione: 'SCUOLA',
        attivo: true,
        ordine: 100,
        nota: '',
      });
    } else {
      this.formConto.setValue({
        username: c.username,
        nomeReale: c.nomeReale ?? '',
        backAgente: String(c.backAgenteBp / 100).replace('.', ','),
        backPlayer: String(c.backPlayerBp / 100).replace('.', ','),
        scaglioneBase: String(c.scaglioneBaseBp / 100).replace('.', ','),
        scaglionePasso: this.euro(c.scaglionePassoCent),
        destinazione: c.destinazione,
        attivo: c.attivo,
        ordine: c.ordine,
        nota: c.nota ?? '',
      });
    }
    this.baseConto.set(JSON.stringify(this.formConto.getRawValue()));
    this.contoAperto.set(c);
  }

  protected salvaConto(): void {
    const aperto = this.contoAperto();
    if (!aperto) return;
    const f = this.formConto.getRawValue();
    const bp = (s: string): number | null => {
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
    };
    const agente = bp(f.backAgente);
    const player = bp(f.backPlayer);
    const base = bp(f.scaglioneBase);
    const passo = parseImportoInCent(f.scaglionePasso);
    if (agente === null || player === null || base === null) {
      this.erroreModale.set('Le percentuali devono stare fra 0 e 100.');
      return;
    }
    if (passo === null || passo <= 0) {
      this.erroreModale.set('Il taglio dello scaglione non è valido.');
      return;
    }
    const body = {
      agente: 'LOTTOMATICA' as const,
      username: f.username.trim(),
      ...(f.nomeReale.trim() ? { nomeReale: f.nomeReale.trim() } : {}),
      backAgenteBp: agente,
      backPlayerBp: player,
      scaglioneBaseBp: base,
      scaglionePassoCent: passo,
      destinazione: f.destinazione,
      attivo: f.attivo,
      ordine: Number(f.ordine) || 100,
      ...(f.nota.trim() ? { nota: f.nota.trim() } : {}),
    };
    this.salvando.set(true);
    this.erroreModale.set(null);
    const chiamata =
      aperto === 'nuovo'
        ? this.api.creaConto(body)
        : this.api.aggiornaConto(aperto.id, body);
    chiamata.subscribe({
      next: () => {
        this.salvando.set(false);
        this.contoAperto.set(null);
        this.caricaAnagrafiche();
        this.toast.success('Conto salvato. Sincronizza il mese per usarlo.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a salvare il conto.'),
        );
      },
    });
  }

  protected eliminaConto(c: ContoRakeback): void {
    this.api.eliminaConto(c.id).subscribe({
      next: () => {
        this.contoAperto.set(null);
        this.conferma.set(null);
        this.caricaAnagrafiche();
        this.toast.success('Conto rimosso.');
      },
      // ⚠️ Stesso disarmo dello stakato, e per la stessa ragione: il 409
      // «compare in N mesi» non cambia riprovando.
      error: (err) => {
        this.conferma.set(null);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a rimuovere il conto.'),
        );
      },
    });
  }

  // ── Spese ricorrenti ─────────────────────────────────────────────────────

  protected apriRicorrente(r: SpesaRicorrente | 'nuova'): void {
    this.erroreModale.set(null);
    this.conferma.set(null);
    if (r === 'nuova') {
      this.formRicorrente.reset({
        descrizione: '',
        categoria: 'INFRASTRUTTURA',
        controparte: '',
        cassa: '',
        importo: '',
        attiva: true,
        nota: '',
      });
    } else {
      this.formRicorrente.setValue({
        descrizione: r.descrizione,
        categoria: r.categoria,
        controparte: r.controparte ?? '',
        cassa: r.cassaPredefinita ?? '',
        importo: this.euro(r.importoCentPredefinito),
        attiva: r.attiva,
        nota: r.nota ?? '',
      });
    }
    this.baseRicorrente.set(JSON.stringify(this.formRicorrente.getRawValue()));
    this.ricorrenteAperta.set(r);
  }

  protected salvaRicorrente(): void {
    const aperta = this.ricorrenteAperta();
    if (!aperta) return;
    const f = this.formRicorrente.getRawValue();
    const importo = parseImportoInCent(f.importo);
    if (importo === null || importo <= 0) {
      this.erroreModale.set('L’importo non è valido.');
      return;
    }
    const body = {
      descrizione: f.descrizione.trim(),
      categoria: f.categoria,
      ...(f.controparte.trim() ? { controparte: f.controparte.trim() } : {}),
      ...(f.cassa ? { cassaPredefinita: f.cassa } : {}),
      importoCentPredefinito: importo,
      attiva: f.attiva,
      ...(f.nota.trim() ? { nota: f.nota.trim() } : {}),
    };
    this.salvando.set(true);
    this.erroreModale.set(null);
    const chiamata =
      aperta === 'nuova'
        ? this.api.creaRicorrente(body)
        : this.api.aggiornaRicorrente(aperta.id, body);
    chiamata.subscribe({
      next: () => {
        this.salvando.set(false);
        this.ricorrenteAperta.set(null);
        this.caricaAnagrafiche();
        this.toast.success('Spesa ricorrente salvata.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a salvare la spesa.'),
        );
      },
    });
  }

  protected eliminaRicorrente(r: SpesaRicorrente): void {
    this.api.eliminaRicorrente(r.id).subscribe({
      next: () => {
        this.ricorrenteAperta.set(null);
        this.conferma.set(null);
        this.caricaAnagrafiche();
        this.toast.success('Spesa ricorrente rimossa.');
      },
      error: (err) =>
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a rimuovere la spesa.'),
        ),
    });
  }

  // ── Conferme in linea ────────────────────────────────────────────────────

  /**
   * ⚠️ Conferme in linea e mai `confirm()` nativo: quel riquadro è di sistema,
   * non si stila, non si legge nel contesto della modale e su alcune
   * configurazioni il browser lo SOPPRIME — nel qual caso il ramo «annulla» non
   * è raggiungibile e la riga sparisce al primo clic.
   */
  protected chiedi(chiave: string): void {
    this.conferma.set(chiave);
  }

  protected annulla(): void {
    this.conferma.set(null);
  }

  // ── Abbonamenti: la correzione dell'incasso ──────────────────────────────

  protected apriAbbonamento(r: RigaAbbonamento): void {
    this.erroreModale.set(null);
    this.conferma.set(null);
    this.formCorrezione.reset({
      // ⚠️ Precompilato con quello che c'è: una correzione parte dal valore
      // esistente, non da un campo vuoto che invita a riscrivere tutto.
      importo: r.portaCassa ? this.euro(r.importoCent) : '',
      incassatoDa: r.incassatoDa ?? '',
      paymentReference: r.paymentReference ?? '',
      dataIncasso: r.decidedAt ? r.decidedAt.slice(0, 10) : '',
      // ⚠️ Il motivo NON si precompila: è la sola cosa che chi corregge deve
      // scrivere di suo, e un valore suggerito lo farebbe accettare com'è.
      motivo: '',
    });
    this.abbonamentoAperto.set(r);
  }

  /** ⚠️ L'importo si corregge SOLO sui contanti: il server risponde 409 sugli altri. */
  protected readonly importoCorreggibile = computed(
    () => this.abbonamentoAperto()?.metodo === 'contanti',
  );

  protected salvaCorrezione(): void {
    const r = this.abbonamentoAperto();
    const m = this.mese();
    if (!r || !m) return;
    const v = this.formCorrezione.getRawValue();

    const patch: {
      importoEur?: number;
      incassatoDa?: Incassante;
      paymentReference?: string;
      dataIncasso?: string;
    } = {};

    if (this.importoCorreggibile() && v.importo.trim()) {
      const cent = parseImportoInCent(v.importo);
      if (cent === null) {
        this.erroreModale.set('Non riesco a leggere l’importo.');
        return;
      }
      if (cent <= 0) {
        // Il server lo rifiuta comunque; dirlo qui evita un giro di rete per
        // sapere una cosa che si sa già.
        this.erroreModale.set('L’importo incassato dev’essere maggiore di zero.');
        return;
      }
      patch.importoEur = cent / 100;
    }
    if (v.incassatoDa) patch.incassatoDa = v.incassatoDa;
    if (v.paymentReference.trim()) {
      patch.paymentReference = v.paymentReference.trim();
    }
    if (v.dataIncasso) patch.dataIncasso = v.dataIncasso;

    if (!Object.keys(patch).length) {
      this.erroreModale.set('Non c’è niente da correggere.');
      return;
    }

    this.salvando.set(true);
    this.erroreModale.set(null);
    this.abbonamentiApi.correggiIncasso(r.id, patch, v.motivo.trim()).subscribe({
      next: () => {
        this.salvando.set(false);
        this.abbonamentoAperto.set(null);
        // ⚠️ Si RICARICA il mese, non si toppa la riga: l'importo cambia i
        // totali e la data può spostare la riga in un ALTRO mese — toccare solo
        // la riga lascerebbe a schermo un elenco che non le contiene più.
        this.scegliMese(m.id);
        this.toast.success('Incasso corretto.');
      },
      error: (err) => {
        this.salvando.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non riesco a correggere l’incasso.'),
        );
      },
    });
  }
}
