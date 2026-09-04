import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MsOpzione, MultiSelectComponent } from './multi-select.component';

describe('MultiSelectComponent', () => {
  let fixture: ComponentFixture<MultiSelectComponent>;
  let el: HTMLElement;

  const OPZIONI: MsOpzione[] = [
    { valore: 'BTN', etichetta: 'BTN' },
    { valore: 'SB', etichetta: 'SB' },
    {
      valore: 'BB',
      etichetta: 'BB',
      disabilitata: true,
      motivo: 'Nessuno spot con la situazione Risposta al 3-bet.',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiSelectComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiSelectComponent);
    fixture.componentRef.setInput('etichetta', 'La tua posizione');
    fixture.componentRef.setInput('idPannello', 'ms-test');
    fixture.componentRef.setInput('opzioni', OPZIONI);
    fixture.componentRef.setInput('tuttiLabel', 'tutte le posizioni');
    fixture.componentRef.setInput('nomePlurale', 'posizioni');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  const trigger = () => el.querySelector<HTMLButtonElement>('.ms__trigger')!;
  const pannello = () => el.querySelector<HTMLElement>('.ms__panel')!;
  const caselle = () =>
    Array.from(el.querySelectorAll<HTMLInputElement>('.ms__list input'));

  it('⚠️ chiuso, il pannello è NASCOSTO ma resta nel DOM', () => {
    // Con un `@if` l'ultimo Tab in avanti rimuoverebbe il pannello mentre il
    // fuoco lo sta attraversando, e il fuoco finirebbe su `<body>`.
    expect(pannello()).not.toBeNull();
    expect(pannello().hidden).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-controls')).toBe('ms-test');
  });

  it('⚠️ aperto, il pannello GALLEGGIA: non spinge in basso ciò che sta sotto', () => {
    // La prima stesura lo teneva in flusso: aprendo una tendina della prima
    // riga di assi, TUTTO il resto della pagina (l'altra riga, difficoltà,
    // numero di mani, riepilogo) scendeva di colpo di ~380px. È un salto che
    // nessuna guardia misura, perché avviene dopo un clic e non al caricamento.
    trigger().click();
    fixture.detectChanges();
    expect(pannello().hidden).toBe(false);

    const stile = getComputedStyle(pannello());
    expect(stile.position).toBe('absolute');
    // ⚠️ Sopra le celle sorelle (in tutto il progetto non si supera il 5) e
    // SOTTO l'header, che è `fixed` a 50: un pannello che lo scavalca copre la
    // navigazione.
    expect(Number(stile.zIndex)).toBeGreaterThan(5);
    expect(Number(stile.zIndex)).toBeLessThan(50);
  });

  it('il trigger dice il valore corrente in chiaro: è la ragione per cui esiste', () => {
    expect(trigger().textContent).toContain('tutte le posizioni');

    fixture.componentRef.setInput('selezione', new Set(['BTN']));
    fixture.detectChanges();
    expect(trigger().textContent).toContain('BTN');

    fixture.componentRef.setInput('selezione', new Set(['BTN', 'SB']));
    fixture.detectChanges();
    expect(trigger().textContent).toContain('BTN e SB');
  });

  it('oltre tre voci il trigger conta invece di elencare', () => {
    fixture.componentRef.setInput('opzioni', [
      ...OPZIONI,
      { valore: 'X', etichetta: 'X' },
      { valore: 'Y', etichetta: 'Y' },
    ]);
    fixture.componentRef.setInput('selezione', new Set(['BTN', 'SB', 'X', 'Y']));
    fixture.detectChanges();
    expect(trigger().textContent).toContain('4 posizioni');
  });

  it('`valoreTesto` vince: è come «da 8 a 15 bb» arriva sul trigger', () => {
    fixture.componentRef.setInput('selezione', new Set(['BTN', 'SB']));
    fixture.componentRef.setInput('valoreTesto', 'da 8 a 15 bb');
    fixture.detectChanges();
    expect(trigger().textContent).toContain('da 8 a 15 bb');
    expect(trigger().textContent).not.toContain('BTN e SB');
  });

  it('dichiara quante voci sono davvero disponibili, e solo quando qualcosa è spento', () => {
    expect(trigger().textContent).toContain('2 di 3 disponibili');
    fixture.componentRef.setInput(
      'opzioni',
      OPZIONI.map((o) => ({ ...o, disabilitata: false, motivo: undefined })),
    );
    fixture.detectChanges();
    expect(trigger().textContent).not.toContain('disponibili');
  });

  it('⚠️ una voce non disponibile resta AL SUO POSTO, spenta, col MOTIVO leggibile', () => {
    trigger().click();
    fixture.detectChanges();

    // terza voce, non riordinata e non rimossa
    expect(caselle().length).toBe(3);
    expect(caselle()[2].disabled).toBe(true);
    const idMotivo = caselle()[2].getAttribute('aria-describedby');
    expect(idMotivo).toBe('ms-test-motivo-BB');
    expect(el.querySelector(`#${idMotivo}`)!.textContent).toContain(
      'Risposta al 3-bet',
    );
  });

  it('un clic su una voce spenta non cambia niente', () => {
    trigger().click();
    fixture.detectChanges();
    caselle()[2].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.selezione().size).toBe(0);
  });

  it('⚠️ la riga «tutte» è indeterminata a selezione parziale (proprietà, non attributo)', () => {
    // `[attr.indeterminate]` compila e non fa niente: la casella direbbe
    // «nessuna» avendo una selezione attiva.
    trigger().click();
    fixture.componentRef.setInput('selezione', new Set(['BTN']));
    fixture.detectChanges();
    const tutte = el.querySelector<HTMLInputElement>('.ms__opt--tutte input')!;
    expect(tutte.indeterminate).toBe(true);
    expect(tutte.checked).toBe(false);

    fixture.componentRef.setInput('selezione', new Set<string>());
    fixture.detectChanges();
    expect(tutte.indeterminate).toBe(false);
    expect(tutte.checked).toBe(true);
  });

  it('«tutte» azzera la selezione: insieme VUOTO = «qualunque» per il backend', () => {
    const sel = signal<ReadonlySet<string>>(new Set(['BTN', 'SB']));
    fixture.componentRef.setInput('selezione', sel());
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();

    el.querySelector<HTMLInputElement>('.ms__opt--tutte input')!.dispatchEvent(
      new Event('change'),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.selezione().size).toBe(0);
  });

  it('senza riga «tutte» il trigger mostra l’invito, non una frase vuota', () => {
    fixture.componentRef.setInput('tuttiLabel', null);
    fixture.componentRef.setInput('invito', 'scegli almeno un formato');
    fixture.detectChanges();
    expect(trigger().textContent).toContain('scegli almeno un formato');
    expect(el.querySelector('.ms__opt--tutte')).toBeNull();
  });

  it('si chiude quando il fuoco esce, e resta aperto passando fra le caselle', () => {
    trigger().click();
    fixture.detectChanges();
    expect(pannello().hidden).toBe(false);

    // fuoco da una casella all'altra: NON deve chiudersi
    el.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: caselle()[1] }),
    );
    fixture.detectChanges();
    expect(pannello().hidden).toBe(false);

    // fuoco fuori dal componente: si chiude
    const fuori = document.createElement('button');
    document.body.appendChild(fuori);
    el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: fuori }));
    fixture.detectChanges();
    expect(pannello().hidden).toBe(true);
    fuori.remove();
  });
});
