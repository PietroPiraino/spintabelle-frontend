import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

@Component({
  imports: [ModalComponent],
  template: `
    <button type="button" #apri>Apri</button>
    @if (visibile()) {
      <app-modal
        titolo="Gestisci iscritto"
        sottotitolo="mario@bff.it"
        [sporco]="sporco()"
        (chiusa)="visibile.set(false)"
      >
        <input type="text" class="dentro" />
      </app-modal>
    }
  `,
})
class Ospite {
  readonly visibile = signal(true);
  readonly sporco = signal(false);
}

describe('app-modal', () => {
  let fixture: ComponentFixture<Ospite>;
  let ospite: Ospite;

  const dialog = () =>
    fixture.nativeElement.querySelector('dialog') as HTMLDialogElement | null;

  /** `afterNextRender` non gira con la sola detectChanges. */
  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Ospite] }).compileComponents();
    fixture = TestBed.createComponent(Ospite);
    ospite = fixture.componentInstance;
    await stabilizza();
  });

  afterEach(() => {
    document.documentElement.classList.remove('is-modale');
  });

  it('si apre come dialog MODALE, non come riquadro in pagina', () => {
    // ⚠️ `showModal()` e non `show()`: è la differenza fra avere il focus-trap,
    // il top-layer e `::backdrop` gratis e doverli scrivere a mano. Il modo di
    // distinguerli è che solo `showModal()` mette l'elemento in top-layer, e
    // `:modal` è vero solo lì.
    const d = dialog()!;
    expect(d.open).toBe(true);
    expect(d.matches(':modal')).toBe(true);
  });

  it('è CENTRATA nel viewport, non nell’angolo', () => {
    // ⚠️ Il browser centra un <dialog> con `margin: auto` sul suo `inset: 0`, e
    // il reset globale del progetto (`* { margin: 0 }`) glielo cancella. Il
    // difetto è muto: la modale si apre, intrappola il fuoco, oscura la pagina
    // e passa ogni altro test — sta solo nell'angolo in alto a sinistra.
    const d = dialog()!;
    const r = d.getBoundingClientRect();
    const scartoX = Math.abs(r.left - (window.innerWidth - r.width) / 2);
    expect(scartoX).toBeLessThan(2);
  });

  it('il fuoco entra nella modale, non resta sul pulsante che l’ha aperta', () => {
    const d = dialog()!;
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it('blocca DAVVERO lo scorrimento della pagina sotto', () => {
    // ⚠️ Misurato, non dedotto: `body` porta `overflow-x: hidden` in
    // `_reset.scss`, quindi non è ovvio quale elemento propaghi lo scorrimento
    // al viewport. Se la regola fosse scritta sull'elemento sbagliato non
    // succederebbe nulla di visibile — la pagina scorrerebbe dietro la modale.
    expect(document.documentElement.classList.contains('is-modale')).toBe(true);
    const alto = document.createElement('div');
    alto.style.height = '4000px';
    document.body.appendChild(alto);
    try {
      window.scrollTo(0, 800);
      expect(window.scrollY).toBe(0);
    } finally {
      alto.remove();
      window.scrollTo(0, 0);
    }
  });

  it('alla distruzione toglie il blocco e rimette il fuoco su chi l’ha aperta', async () => {
    // ⚠️ L'ordine conta: la modale aperta da `beforeEach` va CHIUSA prima di
    // dare il fuoco al pulsante, altrimenti è la sua stessa chiusura a
    // riportare il fuoco dove stava (il body) e il test misurerebbe il
    // contrario di quello che vuole.
    ospite.visibile.set(false);
    await stabilizza();

    const apri = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    apri.focus();
    expect(document.activeElement).toBe(apri);

    ospite.visibile.set(true);
    await stabilizza();
    // il fuoco è entrato nella modale: è da lì che deve tornare indietro
    expect(document.activeElement).not.toBe(apri);

    ospite.visibile.set(false);
    await stabilizza();

    expect(document.documentElement.classList.contains('is-modale')).toBe(false);
    expect(document.activeElement).toBe(apri);
  });

  describe('Escape', () => {
    it('con il form pulito chiude', async () => {
      dialog()!.dispatchEvent(new Event('cancel', { cancelable: true }));
      await stabilizza();
      expect(ospite.visibile()).toBe(false);
    });

    it('con il form SPORCO non chiude: chiede conferma', async () => {
      // ⚠️ È il difetto che l'input `sporco` esiste per prevenire, ed è muto:
      // se il chiamante passa un `computed()` costruito su `FormControl.value`
      // (che non è un signal e non si ricalcola mai) `sporco` resta false per
      // sempre ed Escape butta via quello che si stava scrivendo.
      ospite.sporco.set(true);
      await stabilizza();

      const ev = new Event('cancel', { cancelable: true });
      dialog()!.dispatchEvent(ev);
      await stabilizza();

      expect(ev.defaultPrevented).toBe(true);
      expect(ospite.visibile()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain(
        'modifiche non salvate',
      );
    });

    it('dalla conferma si può comunque uscire', async () => {
      ospite.sporco.set(true);
      await stabilizza();
      dialog()!.dispatchEvent(new Event('cancel', { cancelable: true }));
      await stabilizza();

      const chiudi = [
        ...fixture.nativeElement.querySelectorAll('button'),
      ].find((b: HTMLButtonElement) =>
        b.textContent?.includes('Chiudi senza salvare'),
      ) as HTMLButtonElement;
      chiudi.click();
      await stabilizza();

      expect(ospite.visibile()).toBe(false);
    });
  });

  describe('clic sul fondale', () => {
    /** Il fondale è il dialog stesso: un clic su di lui è "fuori dalla scatola". */
    const clicFuori = (premiSulFondale = true) => {
      const d = dialog()!;
      const bersaglio = premiSulFondale
        ? d
        : (d.querySelector('.dentro') as HTMLElement);
      d.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true }),
      );
      // il mousedown va rilanciato dal bersaglio giusto
      bersaglio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      d.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };

    it('chiude quando il tasto è stato premuto sul fondale', async () => {
      clicFuori(true);
      await stabilizza();
      expect(ospite.visibile()).toBe(false);
    });

    it('NON chiude se il tasto è stato premuto dentro e rilasciato fuori', async () => {
      // ⚠️ Selezionando del testo in un campo e rilasciando il mouse fuori
      // dalla scatola, il `click` arriva comunque sul dialog: senza il
      // controllo sul `mousedown` la modale chiuderebbe buttando via il
      // digitato, e sembrerebbe casuale.
      clicFuori(false);
      await stabilizza();
      expect(ospite.visibile()).toBe(true);
    });
  });

  it('il titolo è annunciato: aria-labelledby punta a un id che esiste', () => {
    const d = dialog()!;
    const id = d.getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    expect(d.querySelector(`#${id}`)?.textContent).toContain(
      'Gestisci iscritto',
    );
  });
});
