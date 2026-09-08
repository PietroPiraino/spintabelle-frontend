import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { DocumentResource, Paginated } from '../../../core/models/api.models';
import { AdminDocumentsComponent } from './admin-documents.component';

const API = environment.API_URL;

const docOf = (id: string): DocumentResource => ({
  id,
  title: `Doc ${id}`,
  description: 'descrizione',
  category: 'PT4_FILTER',
  visibility: 'PESCE_ROSSO',
  fileName: `${id}.xml`,
  fileExt: 'xml',
  mimeType: 'application/xml',
  sizeBytes: 2048,
  downloadCount: 0,
  locked: false,
  createdAt: '2026-06-01T00:00:00.000Z',
});

const pageOf = (
  items: DocumentResource[],
  total: number,
  page = 1,
  limit = 25,
): Paginated<DocumentResource> => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Accesso ai membri protected che il test deve pilotare. */
interface Testable {
  form: FormGroup;
  selectedFile: WritableSignal<File | null>;
  submit(): void;
}

describe('AdminDocumentsComponent', () => {
  let fixture: ComponentFixture<AdminDocumentsComponent>;
  let http: HttpTestingController;
  let comp: Testable;
  const isList = (r: { url: string }) => r.url === `${API}/documents`;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Risponde alla GET dell'elenco e stabilizza. */
  const rispondi = async (p: Paginated<DocumentResource>) => {
    http.expectOne(isList).flush(p);
    await stabilizza();
  };

  const fillValidForm = () =>
    comp.form.setValue({
      title: 'Filtro 3-bet',
      description: 'descrizione valida',
      category: 'PT4_FILTER',
      visibility: 'PESCE_ROSSO',
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDocumentsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDocumentsComponent);
    http = TestBed.inject(HttpTestingController);
    comp = fixture.componentInstance as unknown as Testable;
  });

  afterEach(() => http.verify());

  it('carica pagina 1 con limit 25 e mostra la lista', async () => {
    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(pageOf([docOf('a')], 1));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Doc a');
  });

  it('in creazione senza file: errore e nessun POST', async () => {
    http.expectOne(isList).flush(pageOf([], 0));
    await fixture.whenStable();

    fillValidForm();
    comp.submit();
    fixture.detectChanges();

    // nessuna richiesta in volo (niente POST verso /documents)
    http.verify();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Seleziona un file',
    );
  });

  it('con file valido invia POST multipart e ricarica la lista', async () => {
    http.expectOne(isList).flush(pageOf([], 0));
    await fixture.whenStable();

    fillValidForm();
    comp.selectedFile.set(
      new File(['x'], 'filtro.xml', { type: 'application/xml' }),
    );
    comp.submit();

    const post = http.expectOne(
      (r) => r.url === `${API}/documents` && r.method === 'POST',
    );
    const body = post.request.body as FormData;
    expect(body.get('title')).toBe('Filtro 3-bet');
    expect(body.get('file')).toBeInstanceOf(File);
    post.flush(docOf('new'));
    await fixture.whenStable();

    // dopo la creazione ricarica la lista (pagina 1)
    http.expectOne(isList).flush(pageOf([docOf('new')], 1));
    await fixture.whenStable();
  });

  describe('la modale', () => {
    const bottone = (etichetta: string): HTMLButtonElement | undefined =>
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) =>
          b.getAttribute('aria-label') === etichetta ||
          b.textContent?.trim() === etichetta,
      ) as HTMLButtonElement | undefined;

    it('⚠️ il form NON è a vista: si apre col «+»', async () => {
      // Era la colonna sinistra di una griglia, sempre presente anche quando
      // non si stava creando nulla — cioè quasi sempre.
      await rispondi(pageOf([docOf('d1')], 1));
      expect(fixture.nativeElement.querySelector('#doc-form')).toBeFalsy();
      bottone('Carica un nuovo materiale')!.click();
      await stabilizza();
      const d = fixture.nativeElement.querySelector(
        'dialog',
      ) as HTMLDialogElement;
      expect(d.matches(':modal')).toBe(true);
      expect(fixture.nativeElement.querySelector('#doc-form')).toBeTruthy();
    });

    it('⚠️ il submit vive nel PIEDE e punta al form con `form=`', async () => {
      // Il bottone sta fuori dal `<form>`: senza l'attributo il clic non invia
      // niente e non lo segnala nessuno — un «Salva» che non fa nulla.
      await rispondi(pageOf([docOf('d1')], 1));
      bottone('Carica un nuovo materiale')!.click();
      await stabilizza();
      const piede = fixture.nativeElement.querySelector(
        '.mo__piede',
      ) as HTMLElement;
      const salva = piede.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      expect(salva).toBeTruthy();
      expect(salva.getAttribute('form')).toBe('doc-form');
      // E il form NON è dentro il piede: sono due sottoalberi diversi.
      expect(piede.querySelector('#doc-form')).toBeFalsy();
    });

    it('la matita apre la scheda del materiale scelto', async () => {
      await rispondi(pageOf([{ ...docOf('d1'), title: 'Filtro 3-bet' }], 1));
      bottone('Modifica Filtro 3-bet')!.click();
      await stabilizza();
      expect(fixture.nativeElement.textContent).toContain('Modifica materiale');
      const titolo = fixture.nativeElement.querySelector(
        '#title',
      ) as HTMLInputElement;
      expect(titolo.value).toBe('Filtro 3-bet');
    });

    it('⚠️ l’elenco dei formati e l’`accept` vengono dalla STESSA fonte', async () => {
      // La riga di aiuto era una frase scritta a mano che copiava l'allowlist
      // del server a memoria: aggiungendo un formato al backend,
      // l'amministratore continuava a leggere che non era ammesso. E l'input
      // non aveva alcun `accept`, unico dei tre upload del pannello.
      await rispondi(pageOf([docOf('d1')], 1));
      bottone('Carica un nuovo materiale')!.click();
      await stabilizza();
      const file = fixture.nativeElement.querySelector(
        '#file',
      ) as HTMLInputElement;
      const accept = file.getAttribute('accept')!;
      expect(accept).toContain('.html');
      expect(accept).toContain('.zip');
      const aiuto = fixture.nativeElement.textContent as string;
      for (const ext of accept.split(',')) {
        expect(aiuto).toContain(ext.slice(1));
      }
    });

    it('⚠️ la cancellazione ha una conferma IN LINEA, non un confirm() nativo', async () => {
      // Il riquadro di sistema non si stila, non si legge nel contesto della
      // modale, e su alcune configurazioni il browser lo sopprime: in quel caso
      // il ramo «annulla» non è raggiungibile e il materiale sparisce al primo
      // clic.
      await rispondi(pageOf([{ ...docOf('d1'), title: 'Filtro 3-bet' }], 1));
      bottone('Modifica Filtro 3-bet')!.click();
      await stabilizza();
      bottone('Elimina')!.click();
      await stabilizza();
      // Il primo clic non cancella niente: arma soltanto.
      http.expectNone((r) => r.method === 'DELETE');
      expect(bottone('Confermo, elimina')).toBeTruthy();
      bottone('Confermo, elimina')!.click();
      const req = http.expectOne((r) => r.method === 'DELETE');
      expect(req.request.url).toContain('/documents/d1');
      req.flush({});
      await rispondi(pageOf([], 0));
      expect(fixture.nativeElement.querySelector('dialog')).toBeFalsy();
    });
  });
});
