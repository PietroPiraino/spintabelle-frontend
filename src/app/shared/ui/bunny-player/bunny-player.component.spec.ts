import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BunnyPlayerComponent,
  type BunnyProgress,
} from './bunny-player.component';

const BUNNY = 'https://iframe.mediadelivery.net';

/** Messaggio Player.js come lo manda davvero l'iframe (vedi prove-bunny-player §8). */
const msg = (payload: unknown, origin = BUNNY) =>
  new MessageEvent('message', { origin, data: JSON.stringify(payload) });

describe('BunnyPlayerComponent — avanzamento (protocollo Player.js)', () => {
  let fixture: ComponentFixture<BunnyPlayerComponent>;
  let eventi: BunnyProgress[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BunnyPlayerComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(BunnyPlayerComponent);
    fixture.componentRef.setInput('url', `${BUNNY}/embed/1/abc`);
    eventi = [];
    fixture.componentInstance.progress.subscribe((p) => eventi.push(p));
    fixture.detectChanges();
  });

  it('emette posizione e durata da un timeupdate', () => {
    window.dispatchEvent(
      msg({
        context: 'player.js',
        event: 'timeupdate',
        value: { seconds: 17.82, duration: 22.65 },
      }),
    );
    expect(eventi).toEqual([{ seconds: 17.82, duration: 22.65 }]);
  });

  it('ignora i messaggi di altre origini (non ci si fida del mittente)', () => {
    window.dispatchEvent(
      msg(
        {
          context: 'player.js',
          event: 'timeupdate',
          value: { seconds: 99, duration: 100 },
        },
        'https://sito-malevolo.example',
      ),
    );
    expect(eventi).toEqual([]);
  });

  it('ignora messaggi non-Player.js e valori non numerici', () => {
    window.dispatchEvent(msg({ context: 'altro', event: 'timeupdate' }));
    window.dispatchEvent(
      msg({
        context: 'player.js',
        event: 'timeupdate',
        value: { seconds: 'x', duration: 0 },
      }),
    );
    window.dispatchEvent(new MessageEvent('message', { origin: BUNNY, data: 'non-json' }));
    expect(eventi).toEqual([]);
  });

  it('smette di ascoltare quando il player viene smontato (click-to-load: si monta e si smonta spesso)', () => {
    fixture.destroy();
    window.dispatchEvent(
      msg({
        context: 'player.js',
        event: 'timeupdate',
        value: { seconds: 5, duration: 10 },
      }),
    );
    expect(eventi).toEqual([]);
  });
});
