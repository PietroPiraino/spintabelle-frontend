import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CodaRedazione, NewsAdmin } from '../../../core/models/api.models';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import {
  MARKED_LOADER,
  type MarkdownRenderer,
} from '../../../shared/ui/markdown/marked-loader';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminRedazioneComponent } from './admin-redazione.component';

const API = environment.API_URL;

/** Stub sincrono: ChromeHeadless non deve importare il chunk vero di marked. */
const renderer: MarkdownRenderer = { render: (md) => `<p>${md}</p>` };

const ORA = Date.now();
const fra = (ms: number) => new Date(ORA + ms).toISOString();

const newsOf = (id: string, over: Partial<NewsAdmin> = {}): NewsAdmin => ({
  _id: id,
  title: `Titolo ${id}`,
  body: `Corpo di ${id}`,
  status: 'IN_REVISIONE',
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

/** Valore di un `<input type="date">`: giorno LOCALE, mai `toISOString()`. */
const giornoInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const codaOf = (
  items: NewsAdmin[],
  pausaFino: string | null = null,
): CodaRedazione => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  pausaFino,
});

/**
 * I soli membri protected che il test tocca da dentro.
 *
 * ⚠️ Corto di proposito: tutto ciò che l'utente fa con un dito (armare la
 * conferma, scrivere il titolo o la nota, pubblicare, rimandare, mettere in
 * pausa) si pilota **dal DOM**, perché è lì che vive metà del contratto. Qui
 * restano solo lo sfogliare la coda, la lettura dello stato della conferma e le
 * due guardie che devono reggere anche a metodo chiamato di forza.
 */
interface Testable {
  notaScarto: WritableSignal<string>;
  isConfirming(key: string): boolean;
  successivo(): void;
  pubblica(): void;
  scarta(): void;
  riprendi(): void;
}

describe('AdminRedazioneComponent', () => {
  let fixture: ComponentFixture<AdminRedazioneComponent>;
  let http: HttpTestingController;
  let comp: Testable;
  let pending: { refresh: jasmine.Spy };

  const isCoda = (r: { url: string }) => r.url === `${API}/admin/news`;

  const flushBoot = async (
    items: NewsAdmin[],
    pausaFino: string | null = null,
  ) => {
    http.expectOne(isCoda).flush(codaOf(items, pausaFino));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const testo = () =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ??
    '';

  const bottone = (selettore: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      selettore,
    );

  /**
   * ⚠️ Il titolo sta in un `<input>`: `textContent` non lo vede mai. Un
   * `expect(testo()).toContain('Titolo …')` fallirebbe su una card perfetta.
   */
  const titoloInput = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input.rz__titolo',
    )?.value ?? '';

  /**
   * Scrive in un campo come farebbe un dito: valore **e** evento `input`.
   *
   * ⚠️ Non si scrivono i signal a mano: il titolo corretto e la nota di scarto
   * arrivano dal template (`(input)="onTitolo($event)"`), e un binding staccato
   * lascerebbe passare ogni test che pilota il componente da dentro.
   */
  const scrivi = async (selettore: string, valore: string) => {
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      selettore,
    );
    if (!el) throw new Error(`Campo assente nel DOM: ${selettore}`);
    el.value = valore;
    el.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const scriviTitolo = (valore: string) => scrivi('input.rz__titolo', valore);
  const scriviNota = (valore: string) => scrivi('.rz__scarta input', valore);

  beforeEach(async () => {
    pending = jasmine.createSpyObj('AdminPendingService', ['refresh']);

    await TestBed.configureTestingModule({
      imports: [AdminRedazioneComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AdminPendingService, useValue: pending },
        { provide: MARKED_LOADER, useValue: () => Promise.resolve(renderer) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRedazioneComponent);
    http = TestBed.inject(HttpTestingController);
    comp = fixture.componentInstance as unknown as Testable;
  });

  afterEach(() => http.verify());

  it('chiede la coda da decidere: status esplicito, una pagina sola', async () => {
    const req = http.expectOne(isCoda);
    expect(req.request.params.get('status')).toBe('IN_REVISIONE');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(codaOf([newsOf('a1')]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(titoloInput()).toBe('Titolo a1');
    expect(testo()).toContain('1 di 1');
  });

  it("non riordina: l'evergreen resta DOPO il deperibile, comunque sia stato creato", async () => {
    // ⚠️ Scena costruita perché QUALSIASI riordino locale la rompa: il
    // deperibile sta **in mezzo** per data di creazione, quindi un sort per
    // `createdAt` porterebbe in cima l'evergreen nuovo in un verso e quello
    // vecchio nell'altro; un `sort({scadeIl})` ingenuo li porterebbe su
    // entrambi (in MQL i null vengono PRIMA — è la ragione del sentinella
    // `$ifNull` lato server) e un ordinamento per confidenza idem (D32:
    // `confidence` si mostra, non ordina). L'ordine è del server: la card lo
    // rispetta e basta, e la striscia dice perché.
    const deperibile = newsOf('urgente', {
      // 5 h e un minuto: il conto alla rovescia arrotonda per DIFETTO (una
      // scadenza millantata è l'errore che costa), quindi 5h netti direbbero 4.
      scadeIl: fra(5 * 60 * 60 * 1000 + 60_000),
      createdAt: new Date(ORA - 3_600_000).toISOString(),
      confidence: 0.4,
    });
    const evergreenVecchio = newsOf('vecchio', {
      createdAt: new Date(ORA - 86_400_000).toISOString(),
      confidence: 0.99,
    });
    const evergreenNuovo = newsOf('nuovo', {
      createdAt: new Date(ORA).toISOString(),
      confidence: 0.9,
    });
    await flushBoot([deperibile, evergreenVecchio, evergreenNuovo]);

    expect(titoloInput()).toBe('Titolo urgente');
    expect(testo()).toContain('Scade fra 5 h');
    expect(testo()).toContain('1 di 3');

    comp.successivo();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(titoloInput()).toBe('Titolo vecchio');
    expect(testo()).toContain('Evergreen');
    expect(testo()).toContain('2 di 3');
  });

  it('scadenza sotto le due ore: la striscia è marcata urgente', async () => {
    await flushBoot([newsOf('a1', { scadeIl: fra(45 * 60 * 1000) })]);

    const strip = (fixture.nativeElement as HTMLElement).querySelector(
      '.rz__strip',
    );
    expect(strip?.classList.contains('is-urgente')).toBeTrue();
    expect(testo()).toContain('Scade fra 45 min');
  });

  /**
   * ⚠️ La finestra fra i 59 e i 60 minuti è l'unico punto in cui il conto alla
   * rovescia poteva **annunciare una scadenza non ancora arrivata**: i minuti
   * si arrotondano per eccesso (60, quindi il ramo dei minuti non scatta) e le
   * ore si arrotondavano per difetto **su `mancano`** (0). "Scade fra 0 h" su
   * un'ora intera di margine è la bugia peggiore su questa striscia, perché la
   * striscia è l'unica cosa che dice perché questa card è la prima.
   */
  it('59 minuti e mezzo: mai "0 h" (le ore si derivano dai minuti)', async () => {
    await flushBoot([newsOf('a1', { scadeIl: fra(59.5 * 60 * 1000) })]);

    expect(testo()).not.toContain('0 h');
    expect(testo()).toContain('Scade fra 1 h');
  });

  it('rimandare un pezzo che scade prima: il costo è detto PRIMA del tocco', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    // Scade fra 40 minuti: le due ore del rimando arrivano dopo la spazzata.
    await flushBoot([newsOf('a1', { scadeIl: fra(40 * 60 * 1000) })]);

    expect(testo()).toContain('Rimandare costa');

    bottone('.rz__bar .btn--ghost')!.click();
    http.expectOne(`${API}/admin/news/a1/snooze`).flush(newsOf('a1'));
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();

    // Non "torna in coda fra due ore": quella riga non tornerà affatto.
    expect(toast.calls.mostRecent().args[0]).toContain('scaduto');
  });

  it('rimando normale: nessun avviso e nessuna minaccia inventata', async () => {
    const toast = spyOn(TestBed.inject(ToastService), 'success');
    await flushBoot([newsOf('a1', { scadeIl: fra(20 * 60 * 60 * 1000) })]);

    expect(testo()).not.toContain('Rimandare costa');

    bottone('.rz__bar .btn--ghost')!.click();
    http.expectOne(`${API}/admin/news/a1/snooze`).flush(newsOf('a1'));
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();

    expect(toast.calls.mostRecent().args[0]).not.toContain('scaduto');
  });

  /**
   * ⚠️ La coda arriva da un'`aggregate`, che **non applica i default di
   * Mongoose**: una riga scritta prima della Fase 0 (articolo storico ritirato
   * e rimesso in revisione) non ha il campo. Leggerlo senza rete faceva
   * esplodere l'intera card — una coda che dichiara 1 articolo e uno schermo
   * vuoto al posto suo.
   */
  it('riga senza complianceFlags: la card si disegna comunque', async () => {
    const senzaCampo = newsOf('a1');
    delete (senzaCampo as Partial<NewsAdmin>).complianceFlags;
    await flushBoot([senzaCampo]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__card'),
    ).not.toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__rischi'),
    ).toBeNull();
  });

  /**
   * Specchio del cancello copertina del backend (D57): senza questo, "Pubblica"
   * resta acceso e promette una pubblicazione che il server rifiuta con un 400
   * — e la card non mostra la provenienza dell'immagine da nessun'altra parte.
   */
  it('copertina licenziata senza credito: Pubblica spento e motivo in chiaro', async () => {
    await flushBoot([
      newsOf('a1', { imageSource: 'LICENZIATA', imageCredit: '  ' }),
    ]);

    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeTrue();
    expect(testo()).toContain('Copertina licenziata senza credito o licenza');

    // Anche forzando il metodo non parte nessuna chiamata.
    comp.pubblica();
    http.expectNone(`${API}/admin/news/a1/approve`);
  });

  it('copertina licenziata completa: si pubblica normalmente', async () => {
    await flushBoot([
      newsOf('a1', {
        imageSource: 'LICENZIATA',
        imageCredit: 'Foto: Esempio',
        imageLicense: 'CC BY 4.0',
      }),
    ]);

    expect(testo()).not.toContain('Copertina licenziata senza credito');
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeFalse();
  });

  it('scarta: due tocchi, nota obbligatoria e MAI un confirm() nativo', async () => {
    const nativo = spyOn(window, 'confirm');
    await flushBoot([newsOf('a1')]);

    // ⚠️ Primo tocco **dal DOM**, non chiamando `askConfirm()`: il contratto
    // "due tocchi" vive nel binding del pulsante, e un `(click)="scarta()"`
    // cablato per sbaglio non lo vedrebbe nessun test che salta il template.
    bottone('.rz__bar .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(comp.isConfirming('scarta')).toBeTrue();
    // ⚠️ Il campo si cerca nel DOM, non nel testo: "Motivo dello scarto" è un
    // placeholder, e `textContent` non vede mai gli attributi.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__scarta input'),
    ).not.toBeNull();
    // Il primo tocco non ha deciso niente.
    http.expectNone((r) => r.url.endsWith('/reject'));

    // Nota vuota e nota troppo corta: pulsante spento e nessuna chiamata
    // nemmeno forzando il metodo (specchio client di `@MinLength(3)`).
    expect(bottone('.rz__bar .btn--danger-solid')?.disabled).toBeTrue();
    comp.scarta();
    await scriviNota('ab');
    expect(bottone('.rz__bar .btn--danger-solid')?.disabled).toBeTrue();
    comp.scarta();
    http.expectNone((r) => r.url.endsWith('/reject'));

    await scriviNota('  fonte non attendibile  ');
    expect(bottone('.rz__bar .btn--danger-solid')?.disabled).toBeFalse();
    bottone('.rz__bar .btn--danger-solid')!.click();
    const post = http.expectOne(`${API}/admin/news/a1/reject`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ note: 'fonte non attendibile' });
    post.flush(newsOf('a1', { status: 'SCARTATO' }));

    // Dopo la decisione: badge forzato e coda riletta (avanzamento automatico).
    expect(pending.refresh).toHaveBeenCalledWith(true);
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();

    expect(nativo).not.toHaveBeenCalled();
  });

  it('la conferma si arma e si disarma dal DOM, portandosi via la nota', async () => {
    await flushBoot([newsOf('a1')]);

    // Arma.
    bottone('.rz__bar .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(comp.isConfirming('scarta')).toBeTrue();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__scarta'),
    ).not.toBeNull();
    await scriviNota('roba scritta e poi ripensata');

    // Disarma: il pannello sparisce e la nota non sopravvive: ripresentarla
    // già compilata al tocco successivo suggerirebbe una decisione già presa.
    bottone('.rz__scarta .btn--ghost')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.isConfirming('scarta')).toBeFalse();
    expect(comp.notaScarto()).toBe('');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__scarta'),
    ).toBeNull();
    // E il pulsante Scarta è tornato al suo posto, pronto al primo tocco.
    expect(bottone('.rz__bar .btn--danger')).not.toBeNull();
  });

  it('titolo intatto: nessun campo nel corpo dell approvazione', async () => {
    await flushBoot([newsOf('a1')]);

    // ⚠️ Un `title` mandato sempre farebbe passare OGNI approvazione dal ramo
    // "correzione", che lato server è quello ri-controllato contro la lista
    // dell'art. 9: il corpo vuoto è il contratto, non un dettaglio.
    bottone('.rz__bar .btn--primary')!.click();
    const post = http.expectOne(`${API}/admin/news/a1/approve`);
    expect(post.request.body).toEqual({});
    post.flush(newsOf('a1', { status: 'PUBBLICATO' }));
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();
  });

  it('⚠️ la barra resta spenta finché la coda non è tornata, non alla risposta', async () => {
    await flushBoot([newsOf('a1'), newsOf('a2')]);

    bottone('.rz__bar .btn--primary')!.click();
    const post = http.expectOne(`${API}/admin/news/a1/approve`);
    post.flush(newsOf('a1', { status: 'PUBBLICATO' }));
    await fixture.whenStable();
    fixture.detectChanges();

    // ⚠️ Qui la decisione è già andata a buon fine ma la card a schermo è
    // ANCORA quella appena pubblicata: la coda non è tornata. Con i pulsanti
    // già vivi, il secondo tocco di un doppio tap sul telefono ridecide la
    // stessa riga — e la risposta è un 409 rosso al posto di un avanzamento.
    expect(titoloInput()).toBe('Titolo a1');
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeTrue();
    expect(bottone('.rz__bar .btn--ghost')?.disabled).toBeTrue();
    expect(bottone('.rz__bar .btn--danger')?.disabled).toBeTrue();
    comp.pubblica();
    http.expectNone((r) => r.url.endsWith('/approve'));

    // Tornata la coda, la card è un'altra e la barra è di nuovo usabile.
    http.expectOne(isCoda).flush(codaOf([newsOf('a2')]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(titoloInput()).toBe('Titolo a2');
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeFalse();
  });

  it("l'etichetta nomina l'azione VERA: durante un Rimanda non dice «Pubblico…»", async () => {
    await flushBoot([newsOf('a1'), newsOf('a2')]);

    bottone('.rz__bar .btn--ghost')!.click();
    http.expectOne(`${API}/admin/news/a1/snooze`).flush(newsOf('a1'));
    await fixture.whenStable();
    fixture.detectChanges();

    // ⚠️ Qui la barra è spenta e la coda non è ancora tornata: è la finestra in
    // cui il pulsante primario annunciava «Pubblico…» durante un rimando —
    // nominando un'azione che non stava avvenendo, sulla schermata dove una
    // persona conferma le pubblicazioni. Disabilitato non basta: quello che
    // c'è scritto dev'essere vero.
    expect(bottone('.rz__bar .btn--primary')!.textContent).not.toContain(
      'Pubblico',
    );
    expect(bottone('.rz__bar .btn--ghost')!.textContent).toContain('Rimando');

    // Chiude il ciclo: la ricarica della coda è ciò che riaccende la barra.
    http.expectOne(isCoda).flush(codaOf([newsOf('a2')]));
    await fixture.whenStable();
  });

  it('anche con la ricarica in errore la barra torna usabile', async () => {
    await flushBoot([newsOf('a1')]);

    bottone('.rz__bar .btn--ghost')!.click();
    http.expectOne(`${API}/admin/news/a1/snooze`).flush(newsOf('a1'));
    http.expectOne(isCoda).flush('ko', { status: 500, statusText: 'Server' });
    await fixture.whenStable();
    fixture.detectChanges();

    // La decisione precedente è passata: lasciare la barra spenta murerebbe la
    // pagina su un guasto di rete che non la riguarda.
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeFalse();
    expect(testo()).toContain('Riprova');
  });

  it('titolo corretto: viaggia trimmato dentro l approvazione', async () => {
    await flushBoot([newsOf('a1')]);

    await scriviTitolo('   Titolo corretto a mano   ');
    bottone('.rz__bar .btn--primary')!.click();
    const post = http.expectOne(`${API}/admin/news/a1/approve`);
    expect(post.request.body).toEqual({ title: 'Titolo corretto a mano' });
    post.flush(newsOf('a1', { status: 'PUBBLICATO' }));
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();
  });

  it('i rilievi si stampano verbatim; senza rilievi il riquadro non esiste', async () => {
    const flag = 'Cita una sala affiliata nel corpo: verificare art. 9';
    await flushBoot([newsOf('a1', { complianceFlags: [flag] })]);

    expect(testo()).toContain(flag);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__rischi'),
    ).not.toBeNull();
  });

  it('nessun rilievo: nessun riquadro vuoto', async () => {
    await flushBoot([newsOf('a1', { complianceFlags: [] })]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__rischi'),
    ).toBeNull();
  });

  it('senza fonti non si pubblica: avviso bloccante e Pubblica spento', async () => {
    await flushBoot([newsOf('a1', { sourceUrls: [], sourceOutlets: [] })]);

    expect(testo()).toContain('Nessuna fonte');
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeTrue();

    // E anche forzando la mano non parte nulla: la guardia è nel metodo.
    comp.pubblica();
    http.expectNone((r) => r.url.endsWith('/approve'));
  });

  it('le fonti sono link veri, in scheda nuova e senza referrer al mittente', async () => {
    await flushBoot([
      newsOf('a1', {
        sourceUrls: ['https://esempio.it/uno'],
        sourceOutlets: ['Esempio Poker'],
      }),
    ]);

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.rz__fonti a',
    );
    expect(link?.getAttribute('href')).toBe('https://esempio.it/uno');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.textContent).toContain('Esempio Poker');
  });

  it('pausa nel futuro: banner presente e azioni COMUNQUE attive', async () => {
    await flushBoot([newsOf('a1')], fra(3 * 86_400_000));

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__pausa'),
    ).not.toBeNull();
    expect(testo()).toContain('Generazione in pausa');

    // ⚠️ La pausa ferma la MACCHINA, non la persona: tutti e tre i pulsanti
    // restano vivi. Una coda congelata insieme alla generazione è il modo più
    // rapido per far scadere in pausa ciò che era già stato prodotto.
    expect(bottone('.rz__bar .btn--primary')?.disabled).toBeFalse();
    expect(bottone('.rz__bar .btn--ghost')?.disabled).toBeFalse();
    expect(bottone('.rz__bar .btn--danger')?.disabled).toBeFalse();

    // E non è solo l'aspetto: la decisione parte davvero.
    bottone('.rz__bar .btn--ghost')!.click();
    http.expectOne(`${API}/admin/news/a1/snooze`).flush(newsOf('a1'));
    http.expectOne(isCoda).flush(codaOf([newsOf('a1')], fra(3 * 86_400_000)));
    await fixture.whenStable();
  });

  it('pausa già scaduta: nessun banner (la data la spegne da sola)', async () => {
    await flushBoot([newsOf('a1')], fra(-3600_000));

    expect(testo()).not.toContain('Generazione in pausa');
  });

  it('riprendi: manda pausaFino a null e rilegge la coda', async () => {
    await flushBoot([newsOf('a1')], fra(86_400_000));

    comp.riprendi();
    const put = http.expectOne(`${API}/admin/news/settings`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ pausaFino: null });
    put.flush({ pausaFino: null });
    http.expectOne(isCoda).flush(codaOf([newsOf('a1')]));
    await fixture.whenStable();
  });

  it('metti in pausa: la data vale fino a TUTTO quel giorno; una passata è rifiutata', async () => {
    await flushBoot([newsOf('a1')]);

    bottone('.rz__pausa-apri')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // ⚠️ Una data già passata non ferma nulla: si rifiuta prima di partire,
    // altrimenti il banner non comparirebbe e sembrerebbe un guasto del salvataggio.
    await scrivi('.rz__pausa-data', giornoInput(new Date(ORA - 2 * 86_400_000)));
    bottone('.rz__pausa-form .btn--primary')!.click();
    http.expectNone((r) => r.url.endsWith('/admin/news/settings'));

    const scelto = new Date(ORA + 2 * 86_400_000);
    await scrivi('.rz__pausa-data', giornoInput(scelto));
    bottone('.rz__pausa-form .btn--primary')!.click();

    const put = http.expectOne(`${API}/admin/news/settings`);
    expect(put.request.method).toBe('PUT');
    // ⚠️ «in pausa fino al 25» significa il 25 COMPRESO: si manda la fine di
    // quella giornata locale, non la mezzanotte che la apre — che tornerebbe
    // la redazione un giorno prima del previsto.
    const fino = new Date(put.request.body.pausaFino as string);
    expect(fino.getFullYear()).toBe(scelto.getFullYear());
    expect(fino.getMonth()).toBe(scelto.getMonth());
    expect(fino.getDate()).toBe(scelto.getDate());
    expect(fino.getHours()).toBe(23);
    expect(fino.getMinutes()).toBe(59);

    put.flush({ pausaFino: fino.toISOString() });
    http.expectOne(isCoda).flush(codaOf([newsOf('a1')], fino.toISOString()));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(testo()).toContain('Generazione in pausa');
  });

  it('coda vuota: stato vuoto sereno, non una card fantasma', async () => {
    await flushBoot([]);

    expect(testo()).toContain('Nessun articolo in coda');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__card'),
    ).toBeNull();
  });

  it('errore di rete: banda con riprova, MAI uno stato vuoto', async () => {
    http.expectOne(isCoda).flush('ko', { status: 500, statusText: 'Server' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(testo()).toContain('Riprova');
    expect(testo()).not.toContain('Nessun articolo in coda');

    // La riprova rifà davvero la chiamata.
    bottone('.rz__errore .btn')?.click();
    http.expectOne(isCoda).flush(codaOf([newsOf('a1')]));
    await fixture.whenStable();
  });

  it('409: la riga non è più in coda → ricarica invece di restare su un fantasma', async () => {
    await flushBoot([newsOf('a1')]);

    comp.pubblica();
    http
      .expectOne(`${API}/admin/news/a1/approve`)
      .flush(
        { message: 'Questo articolo non è più in coda: ricarica la redazione.' },
        { status: 409, statusText: 'Conflict' },
      );
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();
    fixture.detectChanges();

    // ⚠️ La ricarica sopra E' gia una verifica (`expectOne` fallisce se non
    // parte), ma senza un `expect` l'esito VISIBILE non lo controlla nessuno —
    // e Jasmine avvisa che la spec non asserisce nulla. Quello che conta per
    // chi guarda lo schermo e' che dopo un 409 non resti li a decidere una
    // riga che non e' piu decidibile.
    expect(testo()).toContain('Nessun articolo in coda');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rz__card'),
    ).toBeNull();
  });

  /**
   * ⚠️ Il gemello del 409, e per la stessa ragione: `conflittoRicaricato`
   * risponde **404** quando la riga è stata cancellata dal form News mentre la
   * card era aperta. Fermandosi al 409, la coda continuerebbe a mostrare — e a
   * contare — un articolo che non esiste più, con "Pubblica" acceso sopra.
   */
  it('404: la riga è stata cancellata altrove → ricarica, non card fantasma', async () => {
    await flushBoot([newsOf('a1')]);

    comp.pubblica();
    http
      .expectOne(`${API}/admin/news/a1/approve`)
      .flush(
        { message: 'News non trovata' },
        { status: 404, statusText: 'Not Found' },
      );
    http.expectOne(isCoda).flush(codaOf([]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(testo()).toContain('Nessun articolo in coda');
  });

  it("la pausa dichiara l'ANNO: un 2036 al posto del 2026 dev'essere visibile", async () => {
    // ⚠️ L'unica data che l'owner SCEGLIE. Senza l'anno, «fino al 25 agosto»
    // e' la stessa identica stringa per una pausa di tre giorni e per una di
    // dieci anni: il banner direbbe il vero e la redazione sarebbe ferma. La
    // forma a data garantisce che la pausa finisca da sola SOLO se il valore
    // scelto si legge per intero.
    const lontano = new Date(ORA);
    lontano.setFullYear(lontano.getFullYear() + 10);
    await flushBoot([newsOf('a1')], lontano.toISOString());

    expect(testo()).toContain(String(lontano.getFullYear()));
  });
});
