import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { DiscountCode, Paginated } from '../../../core/models/api.models';
import { AdminDiscountsComponent } from './admin-discounts.component';

const API = environment.API_URL;

const codice = (over: Partial<DiscountCode> = {}): DiscountCode => ({
  id: 'd1',
  code: 'STACKING',
  kind: 'PERCENT',
  value: 20,
  audience: 'RESTRICTED',
  tiers: [],
  scope: 'SUBSCRIPTION',
  reusable: false,
  active: true,
  redeemedCount: 0,
  eligibleCount: 5,
  ...over,
});

const pagina = (items: DiscountCode[]): Paginated<DiscountCode> => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
});

describe('AdminDiscountsComponent', () => {
  let fixture: ComponentFixture<AdminDiscountsComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rispondi = async (p: Paginated<DiscountCode>) => {
    http.expectOne((r) => r.url === `${API}/admin/discounts`).flush(p);
    await stabilizza();
  };

  const bottone = (etichetta: string): HTMLButtonElement | undefined =>
    [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim() === etichetta,
    ) as HTMLButtonElement | undefined;

  /**
   * Apre la scheda del codice.
   *
   * ⚠️ I comandi di stato non stanno più nella riga: dall'08/09/2026 la riga ha
   * un comando solo (la matita) e stato, cancellazione e utenti ammessi vivono
   * nella scheda. La matita si cerca per NOME ACCESSIBILE, mai per classe.
   */
  const pillola = (etichetta: string): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('[role="radio"]')].find(
      (b: HTMLElement) => b.textContent?.trim() === etichetta,
    ) as HTMLButtonElement;

  const apriScheda = async (codice = 'STACKING') => {
    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) =>
          b.getAttribute('aria-label') === `Modifica il codice ${codice}`,
      ) as HTMLButtonElement
    ).click();
    await stabilizza();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscountsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminDiscountsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  describe('⚠️ il comando attiva/disattiva', () => {
    /**
     * IL DIFETTO CHE QUESTA SPEC ESISTE PER PREVENIRE, segnalato dall'owner il
     * 07/09/2026 su un codice reale riscattato: l'etichetta del pulsante era
     * legata a `redeemedCount > 0`, cioè a QUANTE VOLTE il codice è stato
     * usato — un numero che spegnere il codice non cambia. Su un codice già
     * riscattato diceva «Disattiva» per sempre, disattivato compreso: si
     * premeva, funzionava, e il pulsante restava identico. Sembrava rotto e
     * non lo era.
     */
    it('su un codice GIÀ DISATTIVATO dice «Riattiva», anche se è stato usato', async () => {
      await rispondi(pagina([codice({ active: false, redeemedCount: 3 })]));
      await apriScheda();
      expect(bottone('Riattiva')).toBeTruthy();
      expect(bottone('Disattiva')).toBeFalsy();
    });

    it('su un codice attivo dice «Disattiva»', async () => {
      await rispondi(pagina([codice({ active: true, redeemedCount: 3 })]));
      await apriScheda();
      expect(bottone('Disattiva')).toBeTruthy();
      expect(bottone('Riattiva')).toBeFalsy();
    });

    it('manda una PATCH sullo stato, non la DELETE', async () => {
      // ⚠️ Prima passava dalla DELETE, che sul server DEGRADA a `active:false`
      // per i codici riscattati: funzionava per un effetto collaterale, e
      // spegnere non era esprimibile in nessun altro modo.
      await rispondi(pagina([codice({ active: true, redeemedCount: 3 })]));
      await apriScheda();
      bottone('Disattiva')!.click();
      const req = http.expectOne((r) => r.url === `${API}/admin/discounts/d1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: false });
      req.flush(codice({ active: false, redeemedCount: 3 }));
      await rispondi(pagina([codice({ active: false, redeemedCount: 3 })]));
      expect(testo()).toContain('non è più spendibile');
    });
  });

  describe('⚠️ «Elimina» promette solo ciò che il server mantiene', () => {
    it('NON compare su un codice già riscattato, e la riga dice perché', async () => {
      // Il server cancella davvero solo a `redeemedCount === 0`; altrimenti
      // degrada a spegnimento. Un pulsante «Elimina» lì è una promessa che non
      // può mantenere — ed è esattamente ciò che l'owner ha provato a fare.
      await rispondi(pagina([codice({ redeemedCount: 3 })]));
      await apriScheda();
      expect(bottone('Elimina')).toBeFalsy();
      expect(testo()).toContain('Non è eliminabile');
    });

    it('compare su un codice mai riscattato', async () => {
      await rispondi(pagina([codice({ redeemedCount: 0 })]));
      await apriScheda();
      expect(bottone('Elimina')).toBeTruthy();
      expect(testo()).not.toContain('non eliminabile');
    });
  });

  describe('il filtro di stato', () => {
    it('chiede al server i soli disattivati, e riparte da pagina 1', async () => {
      // ⚠️ È ciò che rende utile lo spegnimento: senza, la riga di un codice
      // dismesso resta nella griglia per sempre e «disattiva» non toglie
      // niente di mezzo.
      await rispondi(pagina([codice()]));
      pillola('Solo disattivati').click();
      await stabilizza();
      const req = http.expectOne((r) => r.url === `${API}/admin/discounts`);
      expect(req.request.params.get('active')).toBe('false');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(pagina([]));
      await stabilizza();
    });

    it('«Tutti» non scrive affatto la chiave', async () => {
      // In MQL un `active` scritto male filtrerebbe righe che devono restare:
      // il ramo «nessun filtro» non deve mandare il parametro.
      await rispondi(pagina([codice()]));
      pillola('Solo attivi').click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/admin/discounts`)
        .flush(pagina([codice()]));
      await stabilizza();
      pillola('Tutti').click();
      await stabilizza();
      const req = http.expectOne((r) => r.url === `${API}/admin/discounts`);
      expect(req.request.params.has('active')).toBe(false);
      req.flush(pagina([codice()]));
      await stabilizza();
    });
  });
});
