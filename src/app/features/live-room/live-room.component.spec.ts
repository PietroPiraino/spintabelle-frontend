import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LiveService } from '../../core/services/live.service';
import { LIVEKIT_LOADER } from '../../shared/sdk/livekit-loader';
import { LiveRoomComponent } from './live-room.component';

// Fake Room: nessuna connessione reale. `on()` è concatenabile come nel SDK.
class FakeRoom {
  numParticipants = 0;
  canPlaybackAudio = true;
  localParticipant = {
    name: 'Io',
    publishData: jasmine.createSpy('publishData'),
    setCameraEnabled: jasmine.createSpy('setCameraEnabled').and.resolveTo(undefined),
    setMicrophoneEnabled: jasmine.createSpy('setMic').and.resolveTo(undefined),
    setScreenShareEnabled: jasmine.createSpy('setScreen').and.resolveTo(undefined),
  };
  connect = jasmine.createSpy('connect').and.resolveTo(undefined);
  disconnect = jasmine.createSpy('disconnect').and.resolveTo(undefined);
  startAudio = jasmine.createSpy('startAudio').and.resolveTo(undefined);
  on(): this {
    return this;
  }
}

// RoomEvent: qualunque chiave usata dal componente diventa una stringa.
const fakeLiveKit = {
  Room: FakeRoom,
  RoomEvent: new Proxy({}, { get: (_t, p) => p }),
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r));
};

type Probe = { state: () => string; role: () => string };

describe('LiveRoomComponent', () => {
  function configure(getRoomToken: jasmine.Spy): jasmine.Spy {
    const loadSpy = jasmine
      .createSpy('loadLiveKit')
      .and.resolveTo(fakeLiveKit);
    TestBed.configureTestingModule({
      imports: [LiveRoomComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: LIVEKIT_LOADER, useValue: loadSpy },
        { provide: LiveService, useValue: { getRoomToken } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'sess-1' } } },
        },
      ],
    });
    return loadSpy;
  }

  function create(): ComponentFixture<LiveRoomComponent> {
    const fixture = TestBed.createComponent(LiveRoomComponent);
    fixture.detectChanges(); // innesca afterNextRender → init()
    return fixture;
  }

  it('403 dal token → stato "denied", non carica il client', async () => {
    const tok = jasmine
      .createSpy('getRoomToken')
      .and.returnValue(throwError(() => ({ status: 403 })));
    const loadSpy = configure(tok);
    const fixture = create();
    await flush();
    expect(tok).toHaveBeenCalledWith('sess-1');
    expect((fixture.componentInstance as unknown as Probe).state()).toBe('denied');
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('400 → stato "error" (sessione non on-site)', async () => {
    const tok = jasmine
      .createSpy('getRoomToken')
      .and.returnValue(throwError(() => ({ status: 400 })));
    configure(tok);
    const fixture = create();
    await flush();
    expect((fixture.componentInstance as unknown as Probe).state()).toBe('error');
  });

  it('token ok → connette la stanza e va in "connected"', async () => {
    const tok = jasmine
      .createSpy('getRoomToken')
      .and.returnValue(
        of({ token: 't', url: 'wss://x.livekit.cloud', role: 'coach' }),
      );
    const loadSpy = configure(tok);
    const fixture = create();
    await flush();
    fixture.detectChanges();
    const probe = fixture.componentInstance as unknown as Probe;
    expect(loadSpy).toHaveBeenCalled();
    expect(probe.state()).toBe('connected');
    expect(probe.role()).toBe('coach');
  });
});
