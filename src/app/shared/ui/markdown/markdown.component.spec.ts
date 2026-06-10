import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownComponent } from './markdown.component';
import { MARKED_LOADER, type MarkdownRenderer } from './marked-loader';

// Stub sincrono: stesso contratto del loader reale. Passa l'HTML così com'è
// (incluso un eventuale <script>) per dimostrare che la sanitizzazione di
// Angular su [innerHTML] è attiva. Evita di caricare il chunk reale di marked
// (come THREE_LOADER viene stubbato per non aprire un contesto WebGL).
const stub: MarkdownRenderer = {
  render: (md) =>
    md
      .replace(/^## (.+)$/m, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, ' '),
};

function setup(): ComponentFixture<MarkdownComponent> {
  TestBed.configureTestingModule({
    imports: [MarkdownComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MARKED_LOADER, useValue: () => Promise.resolve(stub) },
    ],
  });
  return TestBed.createComponent(MarkdownComponent);
}

describe('MarkdownComponent', () => {
  it('renderizza h2 e strong dal markdown', async () => {
    const fixture = setup();
    fixture.componentRef.setInput('markdown', '## Ciao\n\nTesto **forte**');
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Ciao');
    expect(el.querySelector('strong')?.textContent).toContain('forte');
  });

  it('non lascia sopravvivere uno <script> (sanitizzazione di [innerHTML])', async () => {
    const fixture = setup();
    fixture.componentRef.setInput(
      'markdown',
      'prima <script>(globalThis).__xss = 1</script> dopo',
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('script')).toBeNull();
    expect((globalThis as Record<string, unknown>)['__xss']).toBeUndefined();
  });

  it('input vuoto non rompe il rendering', async () => {
    const fixture = setup();
    fixture.componentRef.setInput('markdown', '');
    await fixture.whenStable();
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
