import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EsitoImport,
  HandUploadPreview,
  HandVetrinaOrdine,
  HandView,
} from '../../core/models/api.models';
import { roleSatisfies } from '../../core/models/roles';
import { AuthService } from '../../core/services/auth.service';
import { HandsService, formatBui, formatImporto } from '../../core/services/hands.service';
import { SeoService } from '../../core/services/seo.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PlayingCardComponent } from './hand-replay/playing-card.component';
import { HeroCardsComponent } from '../../shared/ui/hero-cards/hero-cards.component';

/** Le estensioni che si possono trascinare. Il `.zip` si apre nel browser. */
const ESTENSIONI = ['.txt', '.xml', '.log', '.zip'];

/**
 * ⚠️ **Tetti dello scompattamento, e non sono pignoleria.** Un archivio può
 * dichiarare poche decine di kB e contenerne gigabyte una volta aperto (è la
 * «zip bomb»): senza un limite sul *risultato* si blocca la scheda di chi
 * carica, e nessun controllo sulla dimensione del file caricato lo intercetta.
 */
const ZIP_MAX_FILE = 200;
const ZIP_MAX_BYTE = 20 * 1024 * 1024;

/** Oltre questo, il server risponde `TROPPO_GRANDE`: meglio dirlo prima. */
const MAX_KB = 2048;

interface FileInCoda {
  nome: string;
  byte: number;
  testo: string;
  /** Valorizzato quando il file non si è potuto leggere: la riga lo dice. */
  errore?: string;
}

/**
 * `/replayer` — caricamento delle mani, e sotto la vetrina pubblica.
 *
 * ⚠️ **Rotta PRERENDERIZZATA e senza `authGuard`**, ed è una scelta obbligata,
 * non una preferenza: una rotta guardata **non è prerenderizzabile**, perché il
 * guard aspetta `ready$` che in Node non emette mai. Il gate vive quindi nel
 * componente, e i dati restano protetti comunque perché è il backend a
 * guardarli.
 *
 * ⚠️ **Il ramo da gattare è `isAuthenticated()`, MAI `ready()`.** `auth.ready()`
 * non è **mai** `true` durante il prerender: un template gattato su quello
 * emetterebbe nell'HTML statico soltanto il ramo «sto verificando la sessione»,
 * ed è esattamente com'è finita `/tabelle` — prerenderizzata, in sitemap,
 * canonical giusto, e tre parole dentro.
 *
 * ⚠️ **La prosa e le FAQ stanno FUORI dai rami di autenticazione.** Prima
 * esistevano solo nel ramo anonimo: chi era collegato vedeva una pagina quasi
 * vuota, ed era la vera differenza percepita fra i due stati. Sono anche le
 * ~960 parole su cui poggia il pavimento di 700 imposto da
 * `scripts/check-prerender-content.mjs`: toglierle ferma il build.
 */
@Component({
  selector: 'app-replayer',
  imports: [DatePipe, FormsModule, IconComponent, PlayingCardComponent, RouterLink, HeroCardsComponent],
  templateUrl: './replayer.component.html',
  styleUrl: './replayer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayerComponent {
  protected readonly auth = inject(AuthService);

  /**
   * ⚠️ Chi ha gia' il tetto massimo non deve leggere «Alza il limite».
   *
   * Sopra Squalo non c'e' niente da comprare, e Stakato e Coach — che hanno lo
   * STESSO rango — cliccando arriverebbero su /abbonati, dove ogni pulsante e'
   * spento perche' il server rifiuta comunque l'acquisto. Mandare qualcuno a
   * comprare una cosa che non esiste e' peggio che non dirgli niente.
   *
   * ⚠️ Rango e non uguaglianza (`role === 'SQUALO'`): la quota lato server la
   * decide `roleSatisfies(ruolo, SQUALO)`, e con l'uguaglianza i due ruoli a
   * rango pari — cioe' esattamente il caso che questo blocco esiste per
   * coprire — ricadrebbero nel ramo sbagliato.
   */
  protected readonly tettoMassimo = computed(() =>
    roleSatisfies(this.auth.user()?.role, 'SQUALO'),
  );
  private readonly router = inject(Router);
  private readonly hands = inject(HandsService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly destroy = inject(DestroyRef);

  // ── la vetrina ────────────────────────────────────────────────────────

  /**
   * La vetrina. ⚠️ **Aperta a chiunque** (decisione D10 del 25/08/2026): non
   * serve un account per sfogliarla. Ci finiscono però **solo** le mani per cui
   * chi le ha caricate ha spuntato la casella — il predefinito resta *fuori*, ed
   * è l'opt-in a portare il peso della tutela, non un cancello d'accesso.
   */
  protected readonly vetrina = signal<HandView[]>([]);
  protected readonly vetrinaCaricando = signal(true);
  /**
   * ⚠️ **L'errore ora si vede.** Prima era ingoiato in silenzio e il signal di
   * caricamento non era mai letto nel template: quando la vetrina è vuota — che
   * è il caso **normale**, essendo opt-in — la pagina si riduceva a una card e
   * sembrava rotta. È esattamente ciò che ha fatto chiedere al titolare «ma dove
   * si trova questa vetrina?».
   */
  protected readonly vetrinaErrore = signal(false);

  // ── il caricamento ────────────────────────────────────────────────────

  protected testo = '';
  protected inVetrina = false;
  protected readonly coda = signal<FileInCoda[]>([]);
  protected readonly sopraLaZona = signal(false);
  protected readonly analizzando = signal(false);
  protected readonly importando = signal(false);
  protected readonly anteprima = signal<HandUploadPreview | null>(null);
  protected readonly estensioni = ESTENSIONI.join(',');

  /**
   * L'esito dell'ultima importazione, che **resta a schermo** finché non si
   * ricomincia.
   *
   * ⚠️ Prima c'era solo un toast, che sparisce da sé: chi caricava un torneo
   * intero vedeva il modulo tornare vuoto e non sapeva più né dove fossero
   * finite le mani né che cosa fare dopo. Un esito che si può leggere con calma
   * è anche l'unico punto in cui offrire le due strade vere — guardare quello
   * che si è appena caricato, o caricare ancora.
   */
  protected readonly esito = signal<EsitoImport | null>(null);

  /**
   * L'ordine della vetrina.
   *
   * ⚠️ Il predefinito era «punteggio decrescente», e con i voti quasi tutti a
   * zero degenerava in «più recenti» **senza che si vedesse perché** — il
   * titolare l'ha letto come «ordinate un po' a casaccio». Ora l'ordine è
   * dichiarato, si può cambiare, e sulle card compare la data: così si spiega
   * da sé.
   */
  protected readonly ordine = signal<HandVetrinaOrdine>('recenti');

  protected readonly ORDINI: readonly {
    chiave: HandVetrinaOrdine;
    etichetta: string;
  }[] = [
    { chiave: 'recenti', etichetta: 'Più recenti' },
    { chiave: 'apprezzate', etichetta: 'Più apprezzate' },
  ];

  constructor() {
    // ⚠️ Nessuna guardia su `auth`: la vetrina è pubblica e la chiamata non
    // richiede un token. Attendere `ready$` qui ritarderebbe la pagina per
    // niente — e in prerender non emetterebbe mai.
    this.caricaVetrina();

    /**
     * ⚠️ **Il JSON-LD `FAQPage` era promesso da un commento e non esisteva.**
     * `/replayer` era l'unica pagina prerenderizzata con FAQ visibili priva di
     * dati strutturati. Si rimuove alla distruzione, o resterebbe attaccato alle
     * pagine visitate dopo — in una SPA i `<script>` iniettati sopravvivono alla
     * navigazione. Idioma di `lessons.component.ts`.
     */
    this.seo.setJsonLd('replayer-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    this.destroy.onDestroy(() => this.seo.removeJsonLd('replayer-faq'));
  }

  // ── vetrina: resa ─────────────────────────────────────────────────────

  protected carteEroe(m: HandView): string[] {
    return m.players.find((p) => p.isHero)?.carte ?? [];
  }

  protected pot(m: HandView): string {
    return (
      formatBui(m.potFinale, m.bigBlind) ??
      formatImporto(m.potFinale, m.decimali)
    );
  }

  // ── caricamento: file ─────────────────────────────────────────────────

  /**
   * Il testo da mandare al server: ciò che è stato incollato più il contenuto
   * di ogni file in coda.
   *
   * ⚠️ Si concatena con una riga vuota di mezzo: i due parser separano le mani
   * su righe vuote, e attaccare due file senza stacco fonderebbe l'ultima mano
   * dell'uno con la prima dell'altro.
   */
  protected testoCompleto(): string {
    const pezzi = [this.testo.trim(), ...this.coda().filter((f) => !f.errore).map((f) => f.testo)];
    return pezzi.filter(Boolean).join('\n\n');
  }

  protected pesoKb(): number {
    return Math.round(new Blob([this.testoCompleto()]).size / 1024);
  }

  protected troppoGrande(): boolean {
    return this.pesoKb() > MAX_KB;
  }

  protected puoAnalizzare(): boolean {
    return Boolean(this.testoCompleto()) && !this.analizzando() && !this.troppoGrande();
  }

  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.sopraLaZona.set(true);
  }

  protected onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.sopraLaZona.set(false);
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.sopraLaZona.set(false);
    await this.accoda([...(e.dataTransfer?.files ?? [])]);
  }

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    await this.accoda([...(input.files ?? [])]);
    // ⚠️ Si azzera l'input, o riscegliere lo stesso file non emette `change`.
    input.value = '';
  }

  protected togliFile(nome: string): void {
    this.coda.update((c) => c.filter((f) => f.nome !== nome));
    this.anteprima.set(null);
  }

  /** Legge i file caricati, aprendo gli archivi. */
  private async accoda(files: File[]): Promise<void> {
    const nuovi: FileInCoda[] = [];
    for (const f of files) {
      const nome = f.name;
      const est = nome.slice(nome.lastIndexOf('.')).toLowerCase();
      if (!ESTENSIONI.includes(est)) {
        nuovi.push({ nome, byte: f.size, testo: '', errore: 'formato non supportato' });
        continue;
      }
      try {
        if (est === '.zip') nuovi.push(...(await this.apriZip(f)));
        else nuovi.push({ nome, byte: f.size, testo: await f.text() });
      } catch (err) {
        nuovi.push({
          nome,
          byte: f.size,
          testo: '',
          errore: err instanceof Error ? err.message : 'non leggibile',
        });
      }
    }
    // Dedup per nome: ritrascinare lo stesso file non deve raddoppiarne le mani.
    this.coda.update((c) => {
      const visti = new Set(c.map((f) => f.nome));
      return [...c, ...nuovi.filter((f) => !visti.has(f.nome))];
    });
    this.anteprima.set(null);
  }

  /**
   * Apre un archivio **nel browser**.
   *
   * ⚠️ `fflate` si carica **pigramente**: è ~8KB gzip che servono a chi trascina
   * uno zip e a nessun altro, e questa pagina è prerenderizzata — ciò che sta
   * nel pacchetto principale lo scarica anche chi arriva da una ricerca e legge
   * soltanto le FAQ. È l'idioma che il progetto usa già per three.js e LiveKit.
   */
  private async apriZip(f: File): Promise<FileInCoda[]> {
    const { unzipSync, strFromU8 } = await import('fflate');
    const dati = new Uint8Array(await f.arrayBuffer());
    const dentro = unzipSync(dati);
    const out: FileInCoda[] = [];
    let byte = 0;
    for (const [nome, contenuto] of Object.entries(dentro)) {
      if (nome.endsWith('/')) continue; // le cartelle non sono file
      const est = nome.slice(nome.lastIndexOf('.')).toLowerCase();
      if (!['.txt', '.xml', '.log'].includes(est)) continue;
      if (out.length >= ZIP_MAX_FILE) {
        out.push({
          nome: `${f.name} — altri file`,
          byte: 0,
          testo: '',
          errore: `l’archivio contiene più di ${ZIP_MAX_FILE} file: ho letto i primi`,
        });
        break;
      }
      byte += contenuto.length;
      if (byte > ZIP_MAX_BYTE) {
        out.push({
          nome: `${f.name} — troppo grande`,
          byte,
          testo: '',
          errore: 'l’archivio aperto supera i 20 MB',
        });
        break;
      }
      out.push({
        nome: `${f.name} › ${nome.split('/').pop()}`,
        byte: contenuto.length,
        testo: strFromU8(contenuto),
      });
    }
    if (!out.length) {
      return [{ nome: f.name, byte: f.size, testo: '', errore: 'nessun file di mani dentro' }];
    }
    return out;
  }

  protected peso(byte: number): string {
    if (byte < 1024) return `${byte} B`;
    if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} kB`;
    return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  // ── caricamento: anteprima e importazione ─────────────────────────────

  /**
   * ⚠️ **Due passi, e il primo non scrive niente.** L'anteprima dice quante mani
   * ci sono, quante sono già in libreria e quante entrano nella quota: è ciò che
   * rende leggibile un caricamento da duecento mani prima di farlo, e non
   * consuma quota.
   */
  protected analizza(): void {
    const testo = this.testoCompleto();
    if (!testo || this.analizzando()) return;
    this.analizzando.set(true);
    this.hands.preview(testo).subscribe({
      next: (a) => {
        this.anteprima.set(a);
        this.analizzando.set(false);
      },
      error: () => {
        this.analizzando.set(false);
        this.toast.error('Non sono riuscito a leggere il testo. Riprova fra poco.');
      },
    });
  }

  protected importa(): void {
    const testo = this.testoCompleto();
    if (!testo || this.importando()) return;
    this.importando.set(true);
    this.hands.importa(testo, this.inVetrina).subscribe({
      next: (r) => {
        this.importando.set(false);
        this.anteprima.set(null);
        this.testo = '';
        this.coda.set([]);
        // ⚠️ Torna spenta: la vetrina è opt-in per caricamento, e ricordare la
        // scelta sarebbe l'opt-out che la decisione D5 ha rifiutato.
        const messaInVetrina = this.inVetrina;
        this.inVetrina = false;
        this.esito.set({ ids: r.publicIds, inVetrina: messaInVetrina });
        // ⚠️ **Solo se la mano è finita in vetrina**, e non a ogni importazione:
        // altrimenti si paga una chiamata per una lista che non è cambiata. Con
        // la casella spuntata invece la ricarica è obbligatoria — senza, la mano
        // appena condivisa non compariva finché non si ricaricava la pagina, ed
        // è il difetto che il titolare ha segnalato.
        if (messaInVetrina) this.caricaVetrina();
      },
      error: () => {
        this.importando.set(false);
        this.toast.error('Importazione non riuscita. Riprova fra poco.');
      },
    });
  }

  /**
   * ⚠️ **Ricarica anche i voti**, non solo le mani: senza, il cuore parte
   * spento su una mano che l'utente ha già votato, e il primo clic **toglie**
   * un voto che non ricorda di aver messo. È una sola chiamata per l'intera
   * pagina, non una per card.
   */
  protected caricaVetrina(): void {
    this.vetrinaCaricando.set(true);
    this.vetrinaErrore.set(false);
    this.hands.vetrina(1, 12, this.ordine()).subscribe({
      next: (r) => {
        this.vetrina.set(r.items);
        this.vetrinaCaricando.set(false);
        this.caricaMieiVoti(r.items.map((m) => m.publicId));
      },
      error: () => {
        this.vetrinaCaricando.set(false);
        this.vetrinaErrore.set(true);
      },
    });
  }

  protected cambiaOrdine(o: HandVetrinaOrdine): void {
    if (this.ordine() === o) return;
    this.ordine.set(o);
    this.caricaVetrina();
  }

  private caricaMieiVoti(ids: readonly string[]): void {
    if (!ids.length || !this.auth.isAuthenticated()) return;
    this.hands.mieiVoti(ids).subscribe({
      // Best-effort: senza i voti le card restano leggibili e votabili, solo
      // senza lo stato iniziale. Un errore qui non deve svuotare la vetrina.
      next: (r) => this.voti.set(new Map(Object.entries(r.voti))),
      error: () => undefined,
    });
  }

  protected readonly voti = signal(new Map<string, number>());

  protected mioVoto(id: string): number {
    return this.voti().get(id) ?? 0;
  }

  /**
   * ⚠️ **Ottimistico, con ritorno indietro sull'errore.** Il conteggio si
   * aggiorna prima della risposta: su una lista, aspettare la rete per un cuore
   * si legge come un pulsante che non funziona.
   */
  protected vota(m: HandView, valore: 1 | -1): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], {
        queryParams: { redirect: '/replayer' },
      });
      return;
    }
    const prima = this.mioVoto(m.publicId);
    const nuovo = prima === valore ? 0 : valore;
    this.applicaVoto(m.publicId, nuovo, prima);
    this.hands.vota(m.publicId, nuovo).subscribe({
      next: (r) => {
        this.vetrina.update((v) =>
          v.map((x) =>
            x.publicId === m.publicId
              ? { ...x, likes: r.likes, dislikes: r.dislikes }
              : x,
          ),
        );
      },
      error: () => {
        this.applicaVoto(m.publicId, prima, nuovo);
        this.toast.error('Voto non registrato. Riprova fra poco.');
      },
    });
  }

  private applicaVoto(id: string, nuovo: number, prima: number): void {
    this.voti.update((v) => {
      const m = new Map(v);
      if (nuovo === 0) m.delete(id);
      else m.set(id, nuovo);
      return m;
    });
    const dLike = (nuovo === 1 ? 1 : 0) - (prima === 1 ? 1 : 0);
    const dDis = (nuovo === -1 ? 1 : 0) - (prima === -1 ? 1 : 0);
    if (!dLike && !dDis) return;
    this.vetrina.update((v) =>
      v.map((x) =>
        x.publicId === id
          ? {
              ...x,
              likes: Math.max(0, (x.likes ?? 0) + dLike),
              dislikes: Math.max(0, (x.dislikes ?? 0) + dDis),
            }
          : x,
      ),
    );
  }

  /** Ricomincia da capo: è la seconda strada offerta dal pannello d'esito. */
  protected caricaAncora(): void {
    this.esito.set(null);
  }

  protected annulla(): void {
    this.anteprima.set(null);
  }

  /**
   * ⚠️ **Una sola fonte per le FAQ**: questo array alimenta sia il testo a
   * schermo sia il JSON-LD `FAQPage`. Testo visibile e dati strutturati che
   * dicono cose diverse sono un segnale di spam.
   *
   * ⚠️ E il contenuto è vincolato dall'**art. 9 DL 87/2018**: taglio didattico,
   * nessun nome di operatore, nessun bonus, nessun link a piattaforme di gioco,
   * mai un inquadramento del tipo «guadagnerai». Si nominano i **formati**
   * (Spin & Go, Twister) e i **circuiti**, che sono liberi — mai le sale.
   */
  protected readonly faq = [
    {
      q: 'Che cos’è il replayer delle mani?',
      a: 'Uno strumento per rivedere una mano che hai giocato, azione per azione e strada per strada, come se fossi di nuovo al tavolo. Incolli il resoconto che il tuo client di poker salva a ogni mano e il sito lo trasforma in una mano navigabile, con le fiche, le posizioni e il piatto che crescono a ogni decisione.',
    },
    /**
     * ⚠️ **Le quattro domande qui sotto ERANO la prosa evergreen** che stava in
     * un `.seo-block` fra la vetrina e le FAQ. Spostarle qui è una richiesta del
     * titolare — quel blocco «spezzava troppo la vista della pagina» — e non
     * costa nulla al conteggio parole della guardia di build: `<details>` chiuso
     * o aperto, l'estrattore legge il testo comunque (è la stessa proprietà su
     * cui poggiano le FAQ dell'intero sito).
     *
     * ⚠️ Restano **testo semplice**: alimentano anche il JSON-LD `FAQPage`, e la
     * regola del progetto è che testo a schermo e dati strutturati abbiano
     * un'unica sede — due versioni che divergono sono un segnale di spam.
     */
    {
      q: 'Perché rivedere una mano che è già finita?',
      a: 'Al tavolo si decide in pochi secondi e con le informazioni che si hanno in quel momento. Rivedere la stessa mano a mente fredda è un esercizio diverso: si guarda la struttura — chi era in posizione, quanto era profondo lo stack effettivo, che cosa diceva la dimensione della puntata — invece di rincorrere il ricordo di com’è finita. Negli hyper turbo tre giocatori la profondità cambia a ogni livello, e la stessa mano vale una cosa a venti grandi bui e un’altra a otto: il replayer rimette sotto gli occhi le fiche che c’erano davvero, non quelle che si ricordano. È il motivo per cui qui il piatto si vede crescere strada per strada invece di comparire come numero finale.',
    },
    {
      q: 'Che cosa devo guardare mentre rivedo?',
      a: 'Il rapporto fra la puntata e il piatto, prima di tutto. «Ventidue grandi bui» non dice niente da solo; «ventidue grandi bui, il doppio del piatto» dice tutto, perché fissa quante volte bisogna avere ragione perché la chiamata sia in pari. Le mani caricate qui riportano quel rapporto a ogni decisione, insieme a quanto manca da chiamare e all’equity minima che serve.',
    },
    {
      q: 'Perché le carte degli avversari restano coperte fino allo showdown?',
      a: 'Non è un limite tecnico: è la condizione che rende l’esercizio utile. Chi rivede una mano sapendo già la risposta smette di chiedersi «che cosa faccio qui» e comincia a giustificare ciò che è successo — che è il modo più rapido per imparare male. Le carte si scoprono quando si sarebbero scoperte al tavolo.',
    },
    {
      q: 'Conviene di più caricare una mano o un torneo intero?',
      a: 'Una mano isolata racconta un episodio; un torneo intero racconta una tendenza. Caricando la sessione completa si vedono le decisioni ricorrenti — le difese del grande buio, gli spot di spingi-o-passa a stack corto, i piatti che si lasciano andare troppo presto — e sono quelle a spostare il risultato nel lungo periodo, non la singola mano che si ricorda perché è andata male.',
    },
    {
      q: 'Quali formati posso caricare?',
      a: 'Spin & Go e Twister — cioè i tornei tre giocatori hyper turbo su cui è tarata la scuola — ma anche cash game, sit & go, heads-up e tornei multi-tavolo. Il sito riconosce il formato da solo e te lo mostra sulla mano: non devi indicarlo tu.',
    },
    {
      q: 'Da dove prendo il resoconto di una mano?',
      a: 'Ogni client di poker salva le mani giocate in una cartella sul computer, e la maggior parte permette di copiare la mano appena finita con un comando dal tavolo. Se usi un programma di analisi come PokerTracker puoi copiare il testo direttamente da lì e incollarlo qui: funziona in entrambi i modi. In alternativa puoi trascinare qui il file, o anche un archivio con dentro le mani di una serata.',
    },
    {
      q: 'Posso caricare un torneo intero in una volta?',
      a: 'Sì, ed è il modo previsto: incolli il file del torneo, o lo trascini, e il sito separa le mani da sé mantenendo l’ordine in cui sono state giocate. Prima di scrivere qualcosa ti dice quante mani ha trovato, quante sono già nella tua libreria e quante entrano nel tuo limite, così sai che cosa stai per fare.',
    },
    {
      q: 'Quante mani posso tenere?',
      a: 'Con un account gratuito ne tieni duecento, che bastano per un torneo intero. Con un abbonamento il limite sale, e in ogni momento puoi cancellare le mani che non ti servono più o svuotare del tutto la libreria.',
    },
    {
      q: 'Chi può vedere le mani che carico?',
      a: 'Chi ha il collegamento: ogni mano ha un indirizzo suo che puoi mandare a chi vuoi, e chi lo riceve la vede anche senza essere iscritto. Le pagine delle mani non finiscono nei motori di ricerca. Se vuoi che una mano compaia anche nella vetrina del sito devi spuntarlo tu al caricamento: di norma non ci finisce.',
    },
    {
      q: 'Nelle mani compaiono i nomi degli altri giocatori?',
      a: 'Sì, il resoconto li contiene e vengono mostrati. Puoi però sostituirli con le sole posizioni al tavolo in qualunque momento, su una mano o su un intero caricamento, e la mano resta perfettamente leggibile per chi studia. In fondo a ogni mano c’è anche un comando per segnalarla, che funziona senza account.',
    },
    {
      q: 'Le mani restano per sempre?',
      a: 'No: si cancellano da sole dopo ventiquattro mesi dal caricamento, e da quel momento il collegamento che hai condiviso non funziona più. Puoi cancellarle prima quando vuoi.',
    },
  ];
}
