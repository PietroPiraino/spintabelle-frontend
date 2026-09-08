import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  CodaRedazione,
  NewsAdmin,
  NewsStatus,
} from '../../../core/models/api.models';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import {
  MARKED_LOADER,
  type MarkdownRenderer,
} from '../../../shared/ui/markdown/marked-loader';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminNewsComponent } from './admin-news.component';

const API = environment.API_URL;

/** Stub sincrono: ChromeHeadless non deve importare il chunk vero di marked. */
const renderer: MarkdownRenderer = { render: (md) => `<p>${md}</p>` };

const ORA = Date.now();

/**
 * Una targa social qualsiasi. ⚠️ La **cartella** è chiavata sull'`_id` e non
 * sullo slug (uno slug conteso faceva sovrascrivere la copertina viva di un
 * altro articolo), e il **nome porta una versione**, perché il pull zone teneva
 * il percorso in cache trenta giorni. Da qui la forma `cover-<versione>.png`: è
 * quella che il backend scrive, e ogni rigenerazione ne conia una nuova.
 */
const URL_TARGA =
  'https://cdn.bestfishforever.it/news/652f00000000000000000001/cover-a1b2c3d4.png';

/**
 * La foto **vera** di un articolo: `coverImageUrl`, cioè l'immagine che si vede
 * dentro la pagina. ⚠️ È anche l'anteprima social finché non c'è una targa —
 * l'`og:image` è la catena `ogImageUrl || coverImageUrl || og.png` — e sono
 * esattamente i tre articoli storici a stare in quel mezzo.
 */
const URL_FOTO = 'https://cdn.bestfishforever.it/news/foto-licenziata.jpg';

const newsOf = (
  id: string,
  status: NewsStatus,
  over: Partial<NewsAdmin> = {},
): NewsAdmin => ({
  _id: id,
  title: `Titolo ${id}`,
  body: `Corpo di ${id}`,
  status,
  categoria: 'online',
  tags: [],
  slugStorici: [],
  sourceUrls: ['https://esempio.it/articolo'],
  sourceOutlets: ['Esempio Poker'],
  complianceFlags: [],
  autore: 'Pietro Piraino',
  rettifiche: [],
  imageSource: 'GENERATA',
  createdAt: new Date(ORA).toISOString(),
  ...over,
});

/**
 * La riga che il backend garantisce di poter consegnare: un articolo storico
 * che `migraArticoliLegacy` non ha toccato (il suo catch NON rilancia, o
 * cadrebbe il boot dell'intera API). Il campo è **assente**, non `undefined`
 * dichiarato: è così che arriva da `.lean()`, che non applica i default.
 */
const senzaStato = (id = 'legacy'): NewsAdmin => {
  const r = newsOf(id, 'BOZZA');
  delete (r as { status?: NewsStatus }).status;
  return r;
};

const codaOf = (
  items: NewsAdmin[],
  over: Partial<CodaRedazione> = {},
): CodaRedazione => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: Math.max(1, Math.ceil(items.length / 25)),
  pausaFino: null,
  ...over,
});

/**
 * Spec del tab **News** = l'archivio completo.
 *
 * ⚠️ Perché queste asserzioni e non altre: fino a questo lotto un articolo
 * `SCARTATO` o `SCADUTO` non era raggiungibile da nessuna schermata (la coda
 * mostra solo `IN_REVISIONE`, questo elenco chiamava la lista **pubblica**, che
 * proietta solo i `PUBBLICATO`). Il backend garantisce che «ogni stato terminale
 * ha una via di ritorno»: qui si verifica che quella porta esista davvero nella
 * UI, che sia **solo** quella ammessa dalla macchina a stati, e che non sia
 * stata rimessa una decisione (approva/scarta) fuori dalla Redazione.
 *
 * Tutto si pilota **dal DOM**: un test che chiama i metodi protected passerebbe
 * anche con il pulsante scollegato dal template, cioè con la porta murata.
 */
describe('AdminNewsComponent', () => {
  let fixture: ComponentFixture<AdminNewsComponent>;
  let http: HttpTestingController;
  let pending: { refresh: jasmine.Spy };
  let confirmSpy: jasmine.Spy;

  const isLista = (r: { url: string }) => r.url === `${API}/admin/news`;

  const root = () => fixture.nativeElement as HTMLElement;

  const testo = (el: Element | null = root()) =>
    el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const tutti = <T extends Element>(sel: string, scope: Element = root()) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const uno = <T extends Element>(sel: string, scope: Element = root()) =>
    scope.querySelector<T>(sel);

  const stabilizza = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Risponde alla GET dell'archivio e lascia il DOM aggiornato. */
  const rispondi = async (
    items: NewsAdmin[],
    over: Partial<CodaRedazione> = {},
  ) => {
    http.expectOne(isLista).flush(codaOf(items, over));
    await stabilizza();
  };

  /**
   * ⚠️ Dall'08/09/2026 l'elenco è una TABELLA, non più una lista di card: la
   * riga porta identità, stato e data, e ogni comando vive nella scheda che si
   * apre col `⋮`. Questo selettore è il solo punto da cambiare — `riga()` e
   * `righe()` sono usate 63 volte e si adeguano tutte da qui.
   */
  const righe = () => tutti<HTMLElement>('table.admin-table tbody tr');

  /** La riga dell'articolo con quel titolo: le asserzioni sono per-riga. */
  const riga = (titolo: string): HTMLElement => {
    const trovata = righe().find((r) => testo(r).includes(titolo));
    if (!trovata) throw new Error(`Riga assente nel DOM: ${titolo}`);
    return trovata;
  };

  /**
   * Pillola di filtro per etichetta visibile (l'utente clicca quella).
   *
   * ⚠️ Dall'08/09/2026 il gruppo è `app-filtro`: `role="radio"` dentro un
   * `role="radiogroup"`, non più una fila di `badge--tag` in un `role="group"`.
   */
  const pillola = (etichetta: string): HTMLButtonElement => {
    const p = tutti<HTMLButtonElement>('[role="radio"]').find(
      (b) => testo(b) === etichetta,
    );
    if (!p) throw new Error(`Pillola assente nel DOM: ${etichetta}`);
    return p;
  };

  const clicca = async (el: HTMLElement) => {
    el.click();
    await stabilizza();
  };

  /**
   * Apre la SCHEDA di un articolo e la restituisce.
   *
   * ⚠️ I comandi non stanno più sulla riga: erano fino a sei pulsanti di testo
   * affiancati, e ora vivono qui dentro. Le asserzioni che cercano un comando
   * si scopano su questa, quelle che guardano il contenuto della riga restano
   * su `riga()`.
   */
  const scheda = async (titolo: string): Promise<HTMLElement> => {
    const gia = uno<HTMLElement>('dialog .admin-modale');
    if (gia && testo(uno<HTMLElement>('.mo__titolo')).includes(titolo)) return gia;
    if (gia) await clicca(uno<HTMLButtonElement>('.mo__chiudi')!);
    await clicca(uno<HTMLButtonElement>('.admin-ico', riga(titolo))!);
    const aperta = uno<HTMLElement>('dialog .admin-modale');
    if (!aperta) throw new Error(`Scheda non aperta per: ${titolo}`);
    return aperta;
  };

  /**
   * Apre la modale del form, se non è già aperta.
   *
   * ⚠️ Dall'08/09/2026 il form non è più la colonna sinistra di una griglia,
   * sempre a vista: si apre col `+` (creazione) o con la matita (modifica).
   */
  const apriForm = async () => {
    if (uno('#news-title')) return;
    uno<HTMLButtonElement>('[aria-label="Scrivi un nuovo articolo"]')!.click();
    await stabilizza();
  };

  /** Scrive in un campo del form reattivo come farebbe una persona. */
  const scrivi = async (sel: string, valore: string) => {
    await apriForm();
    const campo = uno<HTMLInputElement | HTMLTextAreaElement>(sel)!;
    campo.value = valore;
    campo.dispatchEvent(new Event('input'));
    await stabilizza();
  };

  beforeEach(async () => {
    // ⚠️ Senza stub il servizio vero spara tre chiamate (richieste, affiliazioni,
    // pending-count) e `http.verify()` fallisce su richieste mai attese.
    pending = jasmine.createSpyObj('AdminPendingService', ['refresh']);
    // ⚠️ Spia globale, armata PRIMA di ogni test: la regola «niente confirm()
    // nativo» va pinnata su tutti i flussi, non solo su quello dedicato.
    confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [AdminNewsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AdminPendingService, useValue: pending },
        { provide: MARKED_LOADER, useValue: () => Promise.resolve(renderer) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNewsComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Vale per ogni test: nessun dialog nativo, mai (idioma inline-confirm).
    expect(confirmSpy).not.toHaveBeenCalled();
    http.verify();
  });

  // ── 1. L'archivio è davvero l'archivio ───────────────────────────────────

  it('«Tutti» chiede la lista ADMIN con la sentinella, e mostra stati diversi', async () => {
    const req = http.expectOne(isLista);
    // ⚠️ `status` esplicito anche su «Tutti»: ometterlo significa `IN_REVISIONE`
    // (il default del server), cioè ricostruire il punto cieco che il lotto
    // rimuove. E la sentinella è MAIUSCOLA: il `@IsIn` del DTO fa 400 su 'tutti'.
    expect(req.request.params.get('status')).toBe('TUTTI');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');

    req.flush(
      codaOf([
        newsOf('b', 'BOZZA'),
        newsOf('r', 'IN_REVISIONE'),
        newsOf('p', 'PUBBLICATO'),
        newsOf('s', 'SCARTATO'),
        newsOf('x', 'SCADUTO'),
      ]),
    );
    await stabilizza();

    // I cinque stati sono TUTTI raggiungibili da qui: è il punto del lotto.
    expect(righe().length).toBe(5);
    // ⚠️ Questo assert leggeva le cinque classi `an-chip--<stato>`, cioè
    // congelava il MECCANISMO invece dell'intento. Il chip di stato è ora
    // `.admin-stato` col tono in un attributo, e i toni non sono cinque perché
    // due stati possono condividerne uno: quello che va pinnato è che ogni
    // stato ARRIVI a schermo con un tono dichiarato, non quale.
    for (const tono of ['spento', 'attesa', 'ok', 'allarme', 'neutro']) {
      expect(uno(`.admin-stato[data-tono="${tono}"]`))
        .withContext(tono)
        .not.toBeNull();
    }

    // Lo stato è scritto in italiano, non è l'enum del backend.
    expect(testo(riga('Titolo s'))).toContain('Scartato');
    expect(testo(riga('Titolo r'))).toContain('In revisione');
    expect(testo()).not.toContain('IN_REVISIONE');

    // L'elenco dice sempre a quale filtro si riferisce il conteggio.
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '5 articoli · filtro: Tutti',
    );

    // Cambio filtro: nuova richiesta, con QUELLO stato e da pagina 1.
    await clicca(pillola('Scartato'));
    const dopo = http.expectOne(isLista);
    expect(dopo.request.params.get('status')).toBe('SCARTATO');
    expect(dopo.request.params.get('page')).toBe('1');
    dopo.flush(codaOf([newsOf('s', 'SCARTATO')]));
    await stabilizza();

    expect(righe().length).toBe(1);
    // ⚠️ `aria-checked` e non `aria-pressed`: quest'ultimo è la grammatica dei
    // toggle INDIPENDENTI, e su cinque pillole di cui una sempre accesa
    // annunciava «cinque interruttori, uno premuto» invece di «radio 2 di 5».
    // L'intento dell'asserzione non cambia — cambia il nome dell'attributo.
    expect(pillola('Scartato').getAttribute('aria-checked')).toBe('true');
    expect(pillola('Tutti').getAttribute('aria-checked')).toBe('false');
    // Mai entrambi insieme: ogni screen reader risolve la contraddizione a
    // modo suo.
    expect(pillola('Scartato').getAttribute('aria-pressed')).toBeNull();
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '1 articolo · filtro: Scartato',
    );
  });

  it('⚠️ una riga SENZA `status` non rompe l’archivio: si vede, si legge, non si muove', async () => {
    // ⚠️ Non è un caso di laboratorio: `listAdmin` con «TUTTI» filtra `{}` e
    // NON un `$in` sui cinque stati, proprio perché una riga non migrata resti
    // visibile nell'unica schermata che serve a ritrovare ciò che non si vede
    // (il backend lo pinna con un test suo). Prima di questa correzione
    // `status.toLowerCase()` lanciava dentro il binding: l'elenco si
    // interrompeva sulla riga che esiste per farsi ritrovare.
    await rispondi([senzaStato(), newsOf('p', 'PUBBLICATO')]);

    expect(righe().length).toBe(2);
    const r = riga('Titolo legacy');

    // Detta in italiano, non lasciata in bianco: una riga senza etichetta si
    // legge come un guasto del pannello.
    expect(testo(uno('.admin-stato', r))).toBe('Senza stato');
    // ⚠️ Tono DIVERSO da quelli dei cinque stati: prima il nome della classe
    // veniva interpolato dallo stato, quindi qui usciva `an-chip--undefined` —
    // che nessun foglio dichiara, cioè un chip senza colore né bordo. Ora il
    // `switch` di `tono()` ha un `default`, e il tono `ignoto` si disegna col
    // bordo tratteggiato: non uno stato in più, la sua assenza.
    expect(uno('.admin-stato[data-tono="ignoto"]', r)).not.toBeNull();

    // Nessun pulsante di ritorno: da «nessuno stato» ogni transizione è un 409
    // (`ALLOWED_TRANSITIONS` non ha una riga per l'assenza di stato).
    const schLegacy = await scheda('Titolo legacy');
    expect(uno('.admin-news__ritorno', schLegacy)).toBeNull();
    // …ma la via d'uscita vera è scritta. ⚠️ Nella scheda: è un paragrafo di
    // prosa, e in una cella di tabella non ci sta.
    expect(testo(schLegacy)).toContain('migrazione');
    expect(testo(schLegacy)).toContain('riavvio');
    await clicca(uno<HTMLButtonElement>('.mo__chiudi')!);

    // Le altre righe non sono state travolte: l'elenco è integro.
    expect(
      uno('.admin-stato[data-tono="ok"]', riga('Titolo p')),
    ).not.toBeNull();
  });

  // ── 2. La porta che non esisteva ─────────────────────────────────────────

  it('SCARTATO: "Rimetti in coda" esiste e chiama riapri (poi ricarica e forza il badge)', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await rispondi([
      newsOf('s', 'SCARTATO', { decisionNote: 'Fonte non citata' }),
    ]);

    // Il motivo dello scarto è a schermo: senza, «rimetti in coda» è al buio.
    // ⚠️ Nella SCHEDA e non più nella riga: è testo libero scritto da chi ha
    // scartato, e in una cella di tabella o si taglia o allarga la colonna.
    const sch = await scheda('Titolo s');
    expect(testo(sch)).toContain('Motivo dello scarto: Fonte non citata');

    const ritorno = uno<HTMLButtonElement>('.admin-news__ritorno', sch);
    expect(ritorno).not.toBeNull();
    expect(testo(ritorno)).toBe('Rimetti in coda');

    ritorno!.click();
    await stabilizza();

    // In volo: l'etichetta lo dice e l'intera lista è bloccata (niente doppio tocco).
    expect(testo(uno('.admin-news__ritorno'))).toBe('Rimetto…');
    // ⚠️ `aria-disabled` e NON `disabled`: in un gruppo a roving tabindex
    // disabilitare il bottone che porta il `tabindex="0"` fa uscire il fuoco
    // dal gruppo senza poterci rientrare con Tab finché il caricamento non
    // finisce. Il gruppo resta raggiungibile e annunciato come non
    // disponibile; a fermare l'azione è la guardia nel click.
    expect(pillola('Tutti').disabled).toBeFalse();
    expect(pillola('Tutti').getAttribute('aria-disabled')).toBe('true');

    const req = http.expectOne(`${API}/admin/news/s/riapri`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(newsOf('s', 'IN_REVISIONE'));
    await stabilizza();

    // ⚠️ Ricarica completa: la riga cambia stato, quindi con un filtro attivo
    // esce dall'elenco e `total` cambia con lei.
    await rispondi([newsOf('s', 'IN_REVISIONE')]);
    expect(toast).toHaveBeenCalled();
    // ⚠️ `force`: la coda è cresciuta di uno, il badge non deve mentire.
    expect(pending.refresh).toHaveBeenCalledWith(true);
  });

  it('SCADUTO: stessa porta di ritorno (riapri), non una diversa', async () => {
    await rispondi([newsOf('x', 'SCADUTO')]);

    const ritorno = uno<HTMLButtonElement>(
      '.admin-news__ritorno',
      await scheda('Titolo x'),
    );
    expect(testo(ritorno)).toBe('Rimetti in coda');

    await clicca(ritorno!);
    http
      .expectOne(`${API}/admin/news/x/riapri`)
      .flush(newsOf('x', 'IN_REVISIONE'));
    await stabilizza();
    await rispondi([]);
  });

  it('BOZZA: la via di ritorno è "Manda in revisione", su in-revisione', async () => {
    await rispondi([newsOf('b', 'BOZZA')]);

    const ritorno = uno<HTMLButtonElement>(
      '.admin-news__ritorno',
      await scheda('Titolo b'),
    );
    expect(testo(ritorno)).toBe('Manda in revisione');

    await clicca(ritorno!);
    const req = http.expectOne(`${API}/admin/news/b/in-revisione`);
    expect(req.request.method).toBe('POST');
    req.flush(newsOf('b', 'IN_REVISIONE'));
    await stabilizza();
    await rispondi([]);
    expect(pending.refresh).toHaveBeenCalledWith(true);
  });

  // ── 3. Solo le transizioni ammesse ───────────────────────────────────────

  it('PUBBLICATO: niente "Rimetti in coda" (transizione non ammessa), ma "Ritira"', async () => {
    await rispondi([
      newsOf('p', 'PUBBLICATO', { publishedAt: new Date(ORA).toISOString() }),
    ]);

    const azioni = await scheda('Titolo p');
    const ritorno = uno<HTMLButtonElement>('.admin-news__ritorno', azioni);
    // ⚠️ Un pulsante che propone una transizione non ammessa è una bugia che
    // finisce in un 409: da PUBBLICATO si torna in BOZZA, non in coda.
    expect(testo(ritorno)).toBe('Ritira');
    expect(testo(azioni)).not.toContain('Rimetti in coda');

    // Il ritiro toglie qualcosa dal pubblico: due tocchi, e il primo non chiama nulla.
    await clicca(ritorno!);
    http.expectNone(`${API}/admin/news/p/ritira`);
    const conferma = uno<HTMLElement>(
      '.admin-news__conferma',
      await scheda('Titolo p'),
    );
    expect(conferma).not.toBeNull();

    // ⚠️ Solo spazi nel motivo = nessun motivo: una stringa vuota finirebbe
    // nell'audit come «motivo del ritiro».
    const campo = uno<HTMLInputElement>('input.input', conferma!)!;
    campo.value = '   ';
    campo.dispatchEvent(new Event('input'));
    await stabilizza();

    await clicca(uno<HTMLButtonElement>('.admin-news__conferma-si', conferma!)!);
    const req = http.expectOne(`${API}/admin/news/p/ritira`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(newsOf('p', 'BOZZA'));
    await stabilizza();
    await rispondi([newsOf('p', 'BOZZA')]);

    // Il ritiro non tocca la coda (PUBBLICATO → BOZZA): niente refresh forzato.
    expect(pending.refresh).not.toHaveBeenCalled();
  });

  it('ritiro con motivo: la nota viaggia nel corpo', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__ritorno', await scheda('Titolo p'))!,
    );
    const conferma = uno<HTMLElement>('.admin-news__conferma')!;
    const campo = uno<HTMLInputElement>('input.input', conferma)!;
    campo.value = 'Dato sbagliato';
    campo.dispatchEvent(new Event('input'));
    await stabilizza();

    await clicca(uno<HTMLButtonElement>('.admin-news__conferma-si', conferma)!);
    const req = http.expectOne(`${API}/admin/news/p/ritira`);
    expect(req.request.body).toEqual({ note: 'Dato sbagliato' });
    req.flush(newsOf('p', 'BOZZA'));
    await stabilizza();
    await rispondi([newsOf('p', 'BOZZA')]);
  });

  // ── 4. La decisione resta in Redazione ───────────────────────────────────

  it('IN_REVISIONE: nessuna decisione qui, solo il rimando alla coda', async () => {
    await rispondi([newsOf('r', 'IN_REVISIONE')]);

    // ⚠️ Lo scope è la SCHEDA intera: i comandi non hanno più un involucro
    // proprio, e cercarli in tutta la scheda è anche l'asserzione più forte —
    // «in nessun punto di questa card si decide».
    const azioni = await scheda('Titolo r');

    // ⚠️ Nessun pulsante di ritorno: da qui si DECIDE, e si decide in Redazione.
    expect(uno('.admin-news__ritorno', azioni)).toBeNull();
    // ⚠️ E nessuna decisione duplicata: approve/reject sdoppierebbero il cancello
    // umano dell'art. 50(4) AI Act su due schermate.
    // ⚠️ Si guardano le ETICHETTE DEI COMANDI e non il testo della card: la
    // scheda spiega a parole che si decide in Redazione, quindi cercare
    // «Pubblica» nella prosa colpisce la spiegazione invece del pulsante. È
    // anche l'asserzione più fedele all'intento — «qui non c'è un comando che
    // decide», non «qui non compare quella parola».
    const comandi = tutti<HTMLElement>('button, a.btn', azioni).map((b) =>
      testo(b),
    );
    expect(comandi).not.toContain('Pubblica');
    expect(comandi).not.toContain('Scarta');
    expect(comandi).not.toContain('Rimetti in coda');

    // ⚠️ Ancorato dentro le azioni della riga: il link alla Redazione compare
    // anche nell'occhiello sopra l'elenco, e cercarlo a livello di pagina
    // passerebbe pure con la riga senza alcun rimando.
    const link = uno<HTMLAnchorElement>('a[href="/admin/redazione"]', azioni);
    expect(link).not.toBeNull();
    expect(testo(link)).toContain('Decidi in Redazione');

    // Nessuna chiamata di decisione parte da questa schermata.
    http.expectNone((r) => r.url.startsWith(`${API}/admin/news/r/`));
  });

  // ── 5. Niente dialog nativi ──────────────────────────────────────────────

  it('eliminare passa da un inline-confirm: window.confirm mai invocata', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await rispondi([newsOf('p', 'PUBBLICATO')]);

    // Primo tocco: apre la conferma, nomina l'articolo e non chiama niente.
    await clicca(
      uno<HTMLButtonElement>('.admin-news__elimina', await scheda('Titolo p'))!,
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    http.expectNone((r) => r.method === 'DELETE');

    const conferma = uno<HTMLElement>('.admin-news__conferma')!;
    expect(testo(conferma)).toContain('Titolo p');

    // Ripensarci non deve costare niente.
    await clicca(uno<HTMLButtonElement>('.admin-news__conferma-no', conferma)!);
    expect(uno('.admin-news__conferma')).toBeNull();
    http.expectNone((r) => r.method === 'DELETE');

    // Secondo giro, fino in fondo.
    await clicca(
      uno<HTMLButtonElement>('.admin-news__elimina', await scheda('Titolo p'))!,
    );
    await clicca(
      uno<HTMLButtonElement>(
        '.admin-news__conferma-si',
        uno<HTMLElement>('.admin-news__conferma')!,
      )!,
    );
    const req = http.expectOne(`${API}/news/p`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
    await stabilizza();
    await rispondi([]);

    expect(toast).toHaveBeenCalled();
    // La spia globale è ri-verificata anche in afterEach, per ogni flusso.
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // ── 6. Un guasto non è un archivio vuoto ─────────────────────────────────

  it('errore di rete: banda con "Riprova", e le righe restano a schermo', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO'), newsOf('s', 'SCARTATO')]);
    expect(righe().length).toBe(2);

    await clicca(pillola('Scartato'));
    http.expectOne(isLista).error(new ProgressEvent('error'));
    await stabilizza();

    const banda = uno<HTMLElement>('.admin-news__errore');
    expect(banda).not.toBeNull();
    expect(banda!.getAttribute('role')).toBe('alert');
    expect(testo(uno('span', banda!))).toContain(
      'Impossibile raggiungere il server',
    );

    // ⚠️ Il cuore del caso: la lista già caricata NON si azzera. Prima di questo
    // lotto un guasto di rete faceva `items.set([])`, e si leggeva come «non c'è
    // nessuna news» — cioè come un archivio perso.
    expect(righe().length).toBe(2);
    expect(uno('.empty-state')).toBeNull();
    expect(testo()).not.toContain('Nessuna news');

    // «Riprova» rifà la stessa domanda, non torna al filtro precedente.
    const riprova = tutti<HTMLButtonElement>('button', banda!).find(
      (b) => testo(b) === 'Riprova',
    );
    expect(riprova).toBeDefined();
    await clicca(riprova!);

    const req = http.expectOne(isLista);
    expect(req.request.params.get('status')).toBe('SCARTATO');
    req.flush(codaOf([newsOf('s', 'SCARTATO')]));
    await stabilizza();

    expect(uno('.admin-news__errore')).toBeNull();
    expect(righe().length).toBe(1);
  });

  it('⚠️ dopo un cambio filtro fallito l’intestazione nomina il filtro CARICATO', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO'), newsOf('b', 'BOZZA')]);
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '2 articoli · filtro: Tutti',
    );

    await clicca(pillola('Scartato'));
    http.expectOne(isLista).error(new ProgressEvent('error'));
    await stabilizza();

    // ⚠️ Il cuore del caso: le righe a schermo sono ancora quelle di «Tutti»
    // (giustamente conservate), quindi il conteggio deve dire «Tutti». Prima
    // leggeva `filtro()` — la domanda — e annunciava «2 articoli · filtro:
    // Scartato» sopra un pubblicato e una bozza.
    expect(righe().length).toBe(2);
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '2 articoli · filtro: Tutti',
    );
    // La pillola premuta resta accesa: è la domanda, ed è ciò che «Riprova» rifà.
    expect(pillola('Scartato').getAttribute('aria-checked')).toBe('true');

    // ⚠️ E ricliccare la pillola già attiva DEVE riprovare: prima la guardia
    // «è già il filtro attivo» la rendeva un controllo acceso e inerte, con
    // l'unica via d'uscita nel «Riprova» della banda.
    await clicca(pillola('Scartato'));
    const ri = http.expectOne(isLista);
    expect(ri.request.params.get('status')).toBe('SCARTATO');
    ri.flush(codaOf([]));
    await stabilizza();

    // Ora il vuoto e il conteggio parlano dello stesso filtro delle righe.
    expect(testo(uno('.empty-state'))).toContain('Scartato');
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '0 articoli · filtro: Scartato',
    );
  });

  it('⚠️ dopo un caricamento di pagina fallito il pager resta VIVO', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO')], {
      total: 60,
      page: 1,
      totalPages: 3,
    });

    const avanti = () =>
      tutti<HTMLButtonElement>('.admin-users__pager button').find(
        (b) => testo(b) === 'Successive →',
      )!;

    await clicca(avanti());
    const ko = http.expectOne(isLista);
    expect(ko.request.params.get('page')).toBe('2');
    ko.error(new ProgressEvent('error'));
    await stabilizza();

    // Il pager mostra la pagina VERA (quella a schermo), non quella chiesta.
    expect(testo(uno('.admin-users__pager'))).toContain('Pagina 1 di 3');
    expect(avanti().disabled).toBeFalse();

    // ⚠️ Prima: `pageNum()` valeva 2, il pager richiedeva la 2 e la guardia la
    // scartava come «sei già lì» — pulsante abilitato e morto, «Precedenti»
    // disabilitato perché la pagina mostrata è la prima: un pager intero senza
    // un solo controllo vivo.
    await clicca(avanti());
    const ok = http.expectOne(isLista);
    expect(ok.request.params.get('page')).toBe('2');
    ok.flush(codaOf([newsOf('s', 'SCARTATO')], { total: 60, page: 2, totalPages: 3 }));
    await stabilizza();

    expect(testo(uno('.admin-users__pager'))).toContain('Pagina 2 di 3');
  });

  it('⚠️ vince l’ultima richiesta CHIESTA, non l’ultima che atterra', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO')]);

    // Prima GET in volo (cambio filtro).
    await clicca(pillola('Bozza'));
    // …e mentre è in volo un salvataggio ne accoda una seconda: il form non è
    // bloccato dal caricamento dell'elenco, quindi due GET convivono davvero.
    await scrivi('#news-title', 'Un titolo qualunque');
    await scrivi('#news-body', 'Un corpo qualunque.');
    // ⚠️ Il submit sta nel PIEDE della modale, cioè FUORI dal <form>: ci
    // arriva con `form="news-form"`. Senza quell'attributo il clic non
    // invierebbe niente, e non lo segnalerebbe nessuno.
    await clicca(uno<HTMLButtonElement>('.mo__piede button[type="submit"]')!);
    http.expectOne(`${API}/news`).flush(newsOf('n', 'PUBBLICATO'));
    await stabilizza();

    const [prima, dopo] = http.match(isLista);
    expect(prima).withContext('due liste in volo insieme').toBeDefined();
    expect(dopo).toBeDefined();

    // La PRIMA risponde per SECONDA: è sorpassata e va buttata.
    prima.flush(codaOf([newsOf('sorpassata', 'BOZZA')]));
    await stabilizza();
    expect(testo()).not.toContain('Titolo sorpassata');
    // …e l'elenco continua a dichiararsi in aggiornamento, perché lo è.
    expect(uno('.admin-news__aggiorno')).not.toBeNull();

    dopo.flush(codaOf([newsOf('buona', 'BOZZA')]));
    await stabilizza();

    expect(testo(riga('Titolo buona'))).toContain('Bozza');
    expect(righe().length).toBe(1);
    expect(uno('.admin-news__aggiorno')).toBeNull();
  });

  it('⚠️ un salvataggio che il filtro nasconde dice dov’è finito l’articolo', async () => {
    await rispondi([]);
    await clicca(pillola('Scartato'));
    await rispondi([]);

    await scrivi('#news-title', 'Nuovo pezzo');
    await scrivi('#news-body', 'Corpo del nuovo pezzo.');
    // ⚠️ Il submit sta nel PIEDE della modale, cioè FUORI dal <form>: ci
    // arriva con `form="news-form"`. Senza quell'attributo il clic non
    // invierebbe niente, e non lo segnalerebbe nessuno.
    await clicca(uno<HTMLButtonElement>('.mo__piede button[type="submit"]')!);

    const post = http.expectOne(`${API}/news`);
    expect(post.request.method).toBe('POST');
    // ⚠️ Lo stato risultante lo dice la RISPOSTA: se un domani `POST /news`
    // facesse nascere una bozza, il messaggio si corregge da solo.
    post.flush(newsOf('n', 'PUBBLICATO'));
    await stabilizza();

    // Sotto non si muove una riga (l'articolo è PUBBLICATO, il filtro è
    // SCARTATO): senza questa frase il salvataggio si legge come non riuscito.
    const ok = testo(uno('.form-feedback.is-success'));
    expect(ok).toContain('News pubblicata.');
    expect(ok).toContain('Non compare');
    expect(ok).toContain('Pubblicato');
    expect(ok).toContain('Scartato');

    await rispondi([]);
    expect(righe().length).toBe(0);
  });

  it('⚠️ un articolo RITIRATO porta con sé la sua storia pubblica', async () => {
    const online = new Date(ORA - 90 * 86_400_000).toISOString();
    await rispondi([
      newsOf('r', 'BOZZA', { publishedAt: online, slug: 'pezzo-ritirato' }),
      newsOf('mai', 'BOZZA'),
    ]);

    // ⚠️ `ritira` riporta in BOZZA conservando data, slug e slugStorici: senza
    // questa riga un articolo online da mesi era a schermo identico a una bozza
    // mai vista da nessuno — e si decide di cancellarlo su quella base.
    expect(testo(riga('Titolo r'))).toContain('già pubblicato il');
    expect(testo(riga('Titolo mai'))).not.toContain('già pubblicato');

    await clicca(uno<HTMLButtonElement>('.admin-news__elimina', await scheda('Titolo r'))!);
    expect(testo(uno('.admin-news__conferma'))).toContain('già stato online');
    await clicca(uno<HTMLButtonElement>('.admin-news__conferma-no', uno<HTMLElement>('.admin-news__conferma')!)!);

    // Sulla bozza mai pubblicata la stessa frase sarebbe una minaccia inventata.
    await clicca(uno<HTMLButtonElement>('.admin-news__elimina', await scheda('Titolo mai'))!);
    const conferma = testo(uno('.admin-news__conferma'));
    expect(conferma).toContain('mai stata pubblicata');
    // ⚠️ Niente perdita promessa dove non c'è nulla da perdere: la frase
    // dell'articolo già uscito NON deve comparire su una bozza.
    expect(conferma).not.toContain('già stato online');
  });

  it('⚠️ la cancellazione in corso lo dice: «Elimino…» è raggiungibile', async () => {
    await rispondi([newsOf('p', 'PUBBLICATO')]);

    await clicca(uno<HTMLButtonElement>('.admin-news__elimina', await scheda('Titolo p'))!);
    await clicca(
      uno<HTMLButtonElement>('.admin-news__conferma-si', uno<HTMLElement>('.admin-news__conferma')!)!,
    );

    // ⚠️ `esegui()` chiude la conferma nello STESSO istante in cui parte la
    // richiesta: l'etichetta dentro il blocco di conferma è irraggiungibile, e
    // l'unica azione irreversibile restava senza alcun segno su rete lenta.
    expect(uno('.admin-news__conferma')).toBeNull();
    expect(testo(uno('.admin-news__elimina', await scheda('Titolo p')))).toBe('Elimino…');

    http.expectOne(`${API}/news/p`).flush({});
    await stabilizza();
    await rispondi([]);
  });

  // ── 7. Il vuoto dice sempre di quale vuoto si tratta ─────────────────────

  it('elenco vuoto: il messaggio nomina il filtro attivo', async () => {
    await rispondi([]);

    const vuoto = uno<HTMLElement>('.empty-state')!;
    expect(testo(vuoto)).toContain('Nessuna news in archivio');
    // Con «Tutti» non c'è nessun filtro da togliere: niente invito.
    expect(uno('.admin-nota', vuoto)).toBeNull();

    await clicca(pillola('Scaduto'));
    await rispondi([]);

    const vuotoFiltrato = uno<HTMLElement>('.empty-state')!;
    // ⚠️ Un elenco vuoto muto si legge come «ho perso gli articoli»: il testo
    // deve dire QUALE filtro sta nascondendo il resto.
    expect(testo(vuotoFiltrato)).toContain('Nessuna news nello stato');
    expect(testo(vuotoFiltrato)).toContain('Scaduto');
    expect(testo(vuotoFiltrato)).not.toContain('in archivio');
    // …e come uscirne.
    expect(testo(uno('.admin-nota', vuotoFiltrato))).toContain('Tutti');
    expect(testo(uno('.admin-news__conteggio'))).toBe(
      '0 articoli · filtro: Scaduto',
    );
  });

  // ── 10. L'annuncio su Discord: il marcatore e il comando ─────────────────

  it('«Non annunciato» c’è dove l’annuncio manca e NON dove c’è', async () => {
    await rispondi([
      newsOf('muto', 'PUBBLICATO'),
      newsOf('detto', 'PUBBLICATO', {
        discordPostedAt: new Date(ORA).toISOString(),
      }),
      newsOf('boz', 'BOZZA'),
    ]);

    expect(uno('.admin-news__non-annunciato', riga('Titolo muto'))).not.toBeNull();
    expect(uno('.admin-news__non-annunciato', riga('Titolo detto'))).toBeNull();
    // Fuori da PUBBLICATO non c'è niente da annunciare: il server fa 409.
    expect(uno('.admin-news__non-annunciato', riga('Titolo boz'))).toBeNull();
  });

  it('il comando segue il marcatore: c’è sui muti, non su chi è già uscito', async () => {
    await rispondi([
      newsOf('muto', 'PUBBLICATO'),
      newsOf('detto', 'PUBBLICATO', {
        discordPostedAt: new Date(ORA).toISOString(),
      }),
    ]);

    expect(uno('.admin-news__discord', await scheda('Titolo muto'))).not.toBeNull();
    // ⚠️ Su chi è già nel canale il pulsante NON c'è: il server risponde 409
    // perché un secondo post non si ritira, e un pulsante che finisce in 409 è
    // una bugia (stessa regola della copertina fuori da PUBBLICATO).
    expect(uno('.admin-news__discord', await scheda('Titolo detto'))).toBeNull();
  });

  it('annuncia: chiama la rotta e ricarica l’elenco', async () => {
    await rispondi([newsOf('muto', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__discord', await scheda('Titolo muto'))!,
    );
    const req = http.expectOne(`${API}/admin/news/muto/discord`);
    expect(req.request.method).toBe('POST');
    req.flush(
      newsOf('muto', 'PUBBLICATO', {
        discordPostedAt: new Date(ORA).toISOString(),
      }),
    );
    await stabilizza();
    // ⚠️ Qui la ricarica ci vuole (a differenza della storia): la riga è
    // cambiata, e il marcatore deve sparire.
    await rispondi([
      newsOf('muto', 'PUBBLICATO', {
        discordPostedAt: new Date(ORA).toISOString(),
      }),
    ]);
    expect(uno('.admin-news__non-annunciato', riga('Titolo muto'))).toBeNull();
  });

  /**
   * ⚠️ **La spec portante di questa sezione, e il motivo per cui il comando
   * esiste.** Il gancio automatico assorbe i rifiuti — deve, perché una
   * pubblicazione non può fallire per un annuncio — e per questo il difetto del
   * canale Forum è rimasto invisibile un giorno intero: l'unico segnale era un
   * warning nei log di Render. Qui il rifiuto di Discord deve arrivare
   * **verbatim** sotto gli occhi di chi ha premuto, non riassunto in
   * «Operazione non riuscita».
   */
  it('⚠️ un rifiuto di Discord si legge PAROLA PER PAROLA nel toast', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'error');
    await rispondi([newsOf('muto', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__discord', await scheda('Titolo muto'))!,
    );
    http.expectOne(`${API}/admin/news/muto/discord`).flush(
      {
        message:
          'Discord ha rifiutato l’annuncio: HTTP 400 {"message":"Webhooks posted to forum channels must have a thread_name or thread_id","code":220001}',
      },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await stabilizza();

    const messaggio = String(toast.calls.mostRecent().args[0]);
    expect(messaggio).toContain('thread_name');
    expect(messaggio).not.toBe('Operazione non riuscita.');
  });

  // ── 9. La storia Instagram: un download, non una mutazione ───────────────

  /**
   * Evita che il browser tenti davvero un salvataggio e permette di asserire la
   * pulizia dell'URL temporaneo. ⚠️ Senza lo spy su `click`, ChromeHeadless
   * apre un download vero a ogni esecuzione della suite.
   */
  function intercettaDownload(): { creati: string[]; revocati: string[] } {
    const creati: string[] = [];
    const revocati: string[] = [];
    spyOn(URL, 'createObjectURL').and.callFake(() => {
      const u = `blob:finto/${creati.length}`;
      creati.push(u);
      return u;
    });
    spyOn(URL, 'revokeObjectURL').and.callFake((u: string) => {
      revocati.push(u);
    });
    spyOn(HTMLAnchorElement.prototype, 'click');
    return { creati, revocati };
  }

  it('il comando «Storia IG» c’è sui pubblicati e NON sulle bozze', async () => {
    // ⚠️ Stessa condizione della copertina: fuori da `PUBBLICATO` il server
    // risponde 409, e un pulsante che finisce in 409 è una bugia.
    await rispondi([
      newsOf('pub', 'PUBBLICATO'),
      newsOf('boz', 'BOZZA'),
    ]);

    expect(uno('.admin-news__storia', await scheda('Titolo pub'))).not.toBeNull();
    expect(uno('.admin-news__storia', await scheda('Titolo boz'))).toBeNull();
  });

  it('scarica il PNG dalla rotta della storia e ripulisce l’URL temporaneo', async () => {
    const spie = intercettaDownload();
    await rispondi([newsOf('s', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__storia', await scheda('Titolo s'))!,
    );
    const req = http.expectOne(`${API}/admin/news/s/storia-ig`);
    expect(req.request.method).toBe('GET');
    // ⚠️ Deve chiedere un blob: col default (`json`) Angular prova a fare il
    // parse del PNG e la chiamata fallisce con un errore che parla di JSON,
    // mandando a cercare il guasto sul server.
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    await stabilizza();

    expect(spie.creati.length).toBe(1);
    expect(spie.revocati).toEqual(spie.creati);
  });

  /**
   * ⚠️ **La spec portante di questa sezione.** Ogni altra azione del pannello
   * passa da `esegui()`, che al successo ricarica l'elenco perché la riga è
   * cambiata. Questa non cambia niente: ricaricare venticinque righe a ogni
   * download sarebbe lavoro inutile e farebbe saltare la posizione di
   * scorrimento a chi sta lavorando. Il difetto è invisibile a occhio — il
   * pannello funziona lo stesso — quindi lo tiene solo questa asserzione.
   */
  it('⚠️ NON ricarica l’elenco: non è una mutazione', async () => {
    intercettaDownload();
    await rispondi([newsOf('s', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__storia', await scheda('Titolo s'))!,
    );
    http
      .expectOne(`${API}/admin/news/s/storia-ig`)
      .flush(new Blob([new Uint8Array([1])], { type: 'image/png' }));
    await stabilizza();

    http.expectNone((r) => r.url.endsWith('/admin/news'));
  });

  it('l’esito dice che lo sticker del link va messo a mano', async () => {
    // ⚠️ Non è cortesia: l'API di Meta non sa aggiungere sticker interattivi,
    // quindi una storia caricata e basta è **muta**. Se il messaggio non lo
    // dice, il link non ci finisce mai e il comando non serve a niente.
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    intercettaDownload();
    await rispondi([newsOf('s', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__storia', await scheda('Titolo s'))!,
    );
    http
      .expectOne(`${API}/admin/news/s/storia-ig`)
      .flush(new Blob([new Uint8Array([1])], { type: 'image/png' }));
    await stabilizza();

    expect(String(toast.calls.mostRecent().args[0])).toContain('sticker');
  });

  // ── 8. La copertina social: marcatore e comando ──────────────────────────

  /**
   * ⚠️ Il sotto-testo della riga è composto DUE VOLTE: come elementi nel
   * template (i marcatori portano il colore rame che li fa saltare all'occhio)
   * e come stringa piatta in `sotto()`, che finisce nel `title`. Due
   * composizioni della stessa riga possono divergere al primo ritocco, e un
   * tooltip che smentisce il testo che copre non lo nota nessuno: qui si
   * verifica che dicano la stessa cosa.
   */
  it('⚠️ il `title` del sotto-testo dice ESATTAMENTE quello che c’è scritto', async () => {
    await rispondi([
      newsOf('p', 'PUBBLICATO', { publishedAt: new Date(ORA).toISOString() }),
    ]);

    const sub = uno<HTMLElement>('.admin-table__sub', riga('Titolo p'))!;
    expect(sub).not.toBeNull();
    // Normalizzati entrambi: il template va a capo, la stringa no.
    expect(testo(sub)).toBe(sub.getAttribute('title')!.replace(/\s+/g, ' ').trim());
    // …e non è vuoto, o l'asserzione sopra passerebbe senza controllare niente.
    expect(testo(sub).length).toBeGreaterThan(5);
  });

  it('il marcatore «Senza copertina» c’è dove la targa manca e NON dove c’è', async () => {
    await rispondi([
      newsOf('nuda', 'PUBBLICATO'),
      newsOf('vestita', 'PUBBLICATO', { ogImageUrl: URL_TARGA }),
      // ⚠️ Terza riga di proposito: da una BOZZA il comando non parte. Il
      // marcatore è un FATTO sulla riga («condivisa mostrerebbe l'immagine
      // predefinita»), non lo stato di un pulsante — legarlo a `PUBBLICATO` lo
      // renderebbe co-estensivo al pulsante, cioè inutile: chi apre questo
      // pannello è entrato per un'altra ragione, e il problema deve saltargli
      // all'occhio da solo.
      newsOf('bozza', 'BOZZA'),
    ]);

    expect(uno('.admin-news__senza-copertina', riga('Titolo nuda'))).not.toBeNull();
    expect(uno('.admin-news__senza-copertina', riga('Titolo bozza'))).not.toBeNull();
    // ⚠️ La direzione che conta davvero: su una riga che la targa ce l'ha, il
    // marcatore è una bugia — e manderebbe a rigenerare copertine sane.
    expect(uno('.admin-news__senza-copertina', riga('Titolo vestita'))).toBeNull();

    // Scritto in italiano sulla riga, non nascosto in una classe.
    expect(testo(riga('Titolo nuda'))).toContain('Senza copertina');
    expect(testo(riga('Titolo vestita'))).not.toContain('Senza copertina');
  });

  /**
   * ⚠️ **La riga che ha una FOTO vera non è «senza copertina».** L'`og:image` è
   * una catena — `ogImageUrl || coverImageUrl || og.png` — e i tre articoli
   * storici stanno nel mezzo: `coverImageUrl` valorizzato, `ogImageUrl` assente.
   * La loro anteprima social **è già la loro foto**, quindi il marcatore (che
   * promette «condivisa mostrerebbe l'immagine predefinita del sito») su quelle
   * righe era una bugia, e per giunta una bugia che invita a un clic che
   * peggiora le cose.
   */
  it('⚠️ riga con una FOTO vera: niente marcatore, la sua anteprima è già la foto', async () => {
    await rispondi([
      newsOf('storico', 'PUBBLICATO', { coverImageUrl: URL_FOTO }),
      newsOf('nuda', 'PUBBLICATO'),
    ]);

    expect(uno('.admin-news__senza-copertina', riga('Titolo storico'))).toBeNull();
    expect(testo(riga('Titolo storico'))).not.toContain('Senza copertina');
    // Il controllo in negativo: la riga davvero nuda il marcatore ce l'ha.
    expect(uno('.admin-news__senza-copertina', riga('Titolo nuda'))).not.toBeNull();
  });

  /**
   * ⚠️ **Generare su una riga con la foto SOTTRAE**, e da nessuna schermata si
   * torna indietro: `ogImageUrl` vince la catena, nessun DTO lo dichiara
   * (`update()` non lo tocca) e non esiste un comando che lo svuoti. Quindi due
   * tocchi con la conseguenza scritta, idioma «Ritira»/«Elimina» di questa
   * stessa schermata — e la prima pressione **non deve chiamare niente**.
   */
  it('⚠️ dove c’è una foto, il comando chiede conferma e dice cosa toglie', async () => {
    await rispondi([newsOf('storico', 'PUBBLICATO', { coverImageUrl: URL_FOTO })]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__copertina', await scheda('Titolo storico'))!,
    );

    // Nessuna chiamata alla prima pressione: si è aperta la conferma.
    http.expectNone((r) => r.url.endsWith('/copertina'));
    const conferma = uno('.admin-news__conferma', await scheda('Titolo storico'));
    expect(conferma).not.toBeNull();
    expect(testo(conferma)).toContain('sostituisce');
    expect(testo(conferma)).toContain('tornare indietro');

    // Il secondo tocco parte davvero.
    const vai = tutti<HTMLButtonElement>(
      '.admin-news__conferma-si',
      await scheda('Titolo storico'),
    )[0];
    await clicca(vai);
    const req = http.expectOne(`${API}/admin/news/storico/copertina`);
    req.flush(
      newsOf('storico', 'PUBBLICATO', {
        coverImageUrl: URL_FOTO,
        ogImageUrl: URL_TARGA,
      }),
    );
    await stabilizza();
    await rispondi([
      newsOf('storico', 'PUBBLICATO', {
        coverImageUrl: URL_FOTO,
        ogImageUrl: URL_TARGA,
      }),
    ]);
  });

  /**
   * ⚠️ **Questa spec asseriva l'OPPOSTO fino al 22/08/2026, e pinnava un
   * messaggio diventato falso.** Diceva che rigenerando «l'URL non cambia»,
   * quindi che promettere un aggiornamento sarebbe stato una bugia: vero col
   * nome di file fisso, falso da quando il nome porta una versione. Una spec che
   * congela una frase sbagliata è peggio di nessuna spec — la rende la
   * definizione di corretto, e chi legge il codice si ferma lì.
   *
   * ⚠️ Le due direzioni che il messaggio deve tenere, e sono **entrambe**
   * necessarie: le condivisioni **nuove** si aggiornano (e vanno promesse, o
   * l'owner non ricontrolla un comando che ha funzionato), quelle **già
   * inviate** no (e non vanno promesse, perché nessuna rigenerazione può
   * raggiungere un messaggio già spedito).
   */
  it('⚠️ rigenerando, l’esito distingue le condivisioni nuove da quelle già inviate', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await rispondi([newsOf('v', 'PUBBLICATO', { ogImageUrl: URL_TARGA })]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__copertina', await scheda('Titolo v'))!,
    );
    http
      .expectOne(`${API}/admin/news/v/copertina`)
      .flush(newsOf('v', 'PUBBLICATO', { ogImageUrl: URL_TARGA }));
    await stabilizza();
    await rispondi([newsOf('v', 'PUBBLICATO', { ogImageUrl: URL_TARGA })]);

    const messaggio = String(toast.calls.mostRecent().args[0]);
    // Le nuove si aggiornano: va detto, altrimenti nessuno va a ricontrollare.
    expect(messaggio).toContain('entro un minuto');
    // ⚠️ E le già inviate no: è l'unica cosa che una rigenerazione NON può fare.
    expect(messaggio).toContain('già inviate');
  });

  /**
   * ⚠️ La finestra di un minuto vale per **entrambi** i messaggi, ed è la
   * ragione per cui questa asserzione è cambiata insieme all'altra: la pagina
   * dell'articolo la compone la Pages Function con `s-maxage=60`, quindi anche
   * alla prima generazione il bordo può dichiarare per un minuto l'`og:image`
   * precedente. Il «da ora» che stava qui prometteva un istante che non esiste.
   */
  it('alla PRIMA generazione l’esito promette la targa, senza parlare di già inviate', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await rispondi([newsOf('n', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__copertina', await scheda('Titolo n'))!,
    );
    http
      .expectOne(`${API}/admin/news/n/copertina`)
      .flush(newsOf('n', 'PUBBLICATO', { ogImageUrl: URL_TARGA }));
    await stabilizza();
    await rispondi([newsOf('n', 'PUBBLICATO', { ogImageUrl: URL_TARGA })]);

    const messaggio = String(toast.calls.mostRecent().args[0]);
    expect(messaggio).toContain('entro un minuto');
    // ⚠️ Alla prima generazione non c'è nessuna anteprima precedente da
    // distinguere: nominare le «già inviate» qui confonderebbe e basta.
    expect(messaggio).not.toContain('già inviate');
  });

  it('⚠️ il comando c’è ANCHE dove la targa esiste già: etichetta «Rigenera»', async () => {
    await rispondi([
      newsOf('nuda', 'PUBBLICATO'),
      newsOf('vestita', 'PUBBLICATO', { ogImageUrl: URL_TARGA }),
    ]);

    // ⚠️ La riga che una copertina ce l'ha già è ESATTAMENTE quella per cui il
    // comando esiste: «Modifica» corregge il titolo dopo la pubblicazione, la
    // targa quel titolo lo stampa, e questa è l'unica strada che la riscrive
    // (nessun DTO accetta `ogImageUrl`). Nasconderlo lì chiuderebbe a chiave
    // l'unica via d'uscita — ed è la deviazione voluta dal piano, non una
    // dimenticanza da «correggere».
    const rigenera = uno<HTMLButtonElement>(
      '.admin-news__copertina',
      await scheda('Titolo vestita'),
    );
    expect(rigenera).not.toBeNull();
    expect(testo(rigenera)).toBe('Rigenera copertina');

    // Dove manca, l'etichetta dice l'altra delle due cose che possono succedere.
    expect(testo(uno('.admin-news__copertina', await scheda('Titolo nuda')))).toBe(
      'Genera copertina',
    );
  });

  it('riga non pubblicata: nessun comando copertina (finirebbe in 409), ma il marcatore resta', async () => {
    await rispondi([
      newsOf('b', 'BOZZA'),
      newsOf('r', 'IN_REVISIONE'),
      newsOf('s', 'SCARTATO'),
      newsOf('x', 'SCADUTO'),
      senzaStato(),
    ]);

    for (const t of [
      'Titolo b',
      'Titolo r',
      'Titolo s',
      'Titolo x',
      'Titolo legacy',
    ]) {
      // ⚠️ `PUBBLICATO` è l'unico stato con lo slug congelato, cioè con una
      // pagina vera da condividere: altrove il server risponde 409, e un
      // pulsante che finisce in 409 è una bugia (stessa regola di `ritorno()`).
      expect(uno('.admin-news__copertina', riga(t))).withContext(t).toBeNull();
      // …e il marcatore resta comunque: è ciò che rende il problema trovabile
      // anche dove il comando non arriva.
      expect(uno('.admin-news__senza-copertina', riga(t)))
        .withContext(t)
        .not.toBeNull();
    }

    // Nessuna chiamata parte da righe che il comando non può servire.
    http.expectNone((r) => r.url.endsWith('/copertina'));
  });

  it('il comando POSTa senza corpo, lo dice mentre gira e poi RICARICA l’elenco', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await rispondi([newsOf('p', 'PUBBLICATO')]);

    await clicca(
      uno<HTMLButtonElement>('.admin-news__copertina', await scheda('Titolo p'))!,
    );

    const req = http.expectOne(`${API}/admin/news/p/copertina`);
    expect(req.request.method).toBe('POST');
    // ⚠️ Corpo vuoto: la rotta non dichiara alcun DTO, e `forbidNonWhitelisted`
    // farebbe 400 sull'INTERA chiamata al primo campo di troppo (idioma di
    // `snooze`).
    expect(req.request.body).toEqual({});

    // Disegno + caricamento non sono istantanei: il pulsante lo dice.
    expect(testo(uno('.admin-news__copertina', await scheda('Titolo p')))).toBe(
      'Genero…',
    );

    req.flush(newsOf('p', 'PUBBLICATO', { ogImageUrl: URL_TARGA }));
    await stabilizza();

    // ⚠️ Ricarica e non modifica in posto, come ogni azione di questa
    // schermata: la risposta porta la riga intera, ma `total`/`totalPages` e il
    // filtro attivo li conosce solo l'elenco.
    await rispondi([newsOf('p', 'PUBBLICATO', { ogImageUrl: URL_TARGA })]);

    expect(toast).toHaveBeenCalled();
    // Il marcatore sparisce, il pulsante resta e cambia mestiere.
    expect(uno('.admin-news__senza-copertina', riga('Titolo p'))).toBeNull();
    expect(testo(uno('.admin-news__copertina', await scheda('Titolo p')))).toBe(
      'Rigenera copertina',
    );
    // ⚠️ Lo stato dell'articolo non cambia: il badge «Redazione» della sidebar
    // non ha nulla da rileggere, e forzarlo sarebbe una chiamata a ogni tocco.
    expect(pending.refresh).not.toHaveBeenCalled();
  });
});
