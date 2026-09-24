import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LiveService } from '../../core/services/live.service';
import { LIVEKIT_LOADER } from '../../shared/sdk/livekit-loader';
import { LiveRoomComponent } from './live-room.component';

// Fake Room: nessuna connessione reale. `on()` è concatenabile come nel SDK.
class FakeRoom {
  numParticipants = 0;
  canPlaybackAudio = true;
  isRecording = false;
  remoteParticipants = new Map();
  localParticipant = {
    name: 'Io',
    identity: 'me',
    permissions: { canPublish: true },
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
  Track: { Source: { Microphone: 'microphone' } },
  // ⚠️ Il valore non conta, conta che sia lo STESSO che portano i partecipanti
  // finti: il filtro del recorder confronta `rp.kind` con questo.
  ParticipantKind: { STANDARD: 0, EGRESS: 2 },
};

/** Un partecipante remoto finto, quel tanto che basta a `rebuildRoster()`. */
const partecipante = (over: Record<string, unknown> = {}) => ({
  identity: 'u1',
  name: 'fishkiller',
  metadata: undefined as string | undefined,
  kind: 0,
  permissions: { canPublish: false },
  attributes: {} as Record<string, string>,
  connectionQuality: 'excellent',
  getTrackPublication: () => undefined,
  ...over,
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r));
};

type Probe = { state: () => string; role: () => string };
type RosterProbe = {
  rebuildRoster: () => void;
  roster: () => { identity: string; name: string; nick: string | null }[];
  room: { remoteParticipants: Map<string, unknown> } | null;
};
type RecProbe = {
  applyRecording: (active: boolean, anchorIso?: string | null) => void;
  recElapsed: () => string;
};

describe('LiveRoomComponent', () => {
  function configure(
    getRoomToken: jasmine.Spy,
    extra: Record<string, jasmine.Spy> = {},
  ): jasmine.Spy {
    const loadSpy = jasmine
      .createSpy('loadLiveKit')
      .and.resolveTo(fakeLiveKit);
    TestBed.configureTestingModule({
      imports: [LiveRoomComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: LIVEKIT_LOADER, useValue: loadSpy },
        { provide: LiveService, useValue: { getRoomToken, ...extra } },
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
    expect(tok).toHaveBeenCalledWith('sess-1', false);
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

  it('REC: con ancora (entrato a registrazione in corso) il timer parte dall’inizio reale', async () => {
    const tok = jasmine.createSpy('getRoomToken').and.returnValue(
      of({
        token: 't',
        url: 'wss://x.livekit.cloud',
        role: 'audience',
        recordingEnabled: true,
        recordingStartedAt: null,
      }),
    );
    configure(tok);
    const fixture = create();
    await flush();
    const probe = fixture.componentInstance as unknown as RecProbe;
    // registrazione iniziata 125s fa lato server → 02:05 (non 00:00 dal join)
    probe.applyRecording(true, new Date(Date.now() - 125_000).toISOString());
    expect(probe.recElapsed()).toBe('02:05');
    fixture.destroy(); // ngOnDestroy ferma il setInterval
  });

  it('REC: senza ancora (transizione dal vivo) il timer parte da 00:00', async () => {
    const tok = jasmine.createSpy('getRoomToken').and.returnValue(
      of({
        token: 't',
        url: 'wss://x.livekit.cloud',
        role: 'coach',
        recordingEnabled: true,
        recordingStartedAt: null,
      }),
    );
    configure(tok);
    const fixture = create();
    await flush();
    const probe = fixture.componentInstance as unknown as RecProbe;
    probe.applyRecording(true);
    expect(probe.recElapsed()).toBe('00:00');
    fixture.destroy();
  });

  describe('una sola registrazione per sessione (23/09/2026)', () => {
    const tokenCoach = (over: Record<string, unknown> = {}) =>
      jasmine.createSpy('getRoomToken').and.returnValue(
        of({
          token: 't',
          url: 'wss://x.livekit.cloud',
          role: 'coach',
          recordingEnabled: true,
          recordingStartedAt: null,
          ...over,
        }),
      );
    const bottoneRec = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        /Registra|Ferma/.test(b.textContent ?? ''),
      );
    const testoConclusa = (el: HTMLElement) =>
      el.querySelector('.live-room__rec-fatta')?.textContent?.trim();

    async function apri(
      over: Record<string, unknown> = {},
      extra: Record<string, jasmine.Spy> = {},
    ) {
      configure(tokenCoach(over), extra);
      const fixture = create();
      await flush();
      fixture.detectChanges();
      return fixture;
    }

    it('registrazione già fatta (token) → niente «Registra», c’è «Registrazione conclusa»', async () => {
      const fixture = await apri({ recordingAvviabile: false });
      const el = fixture.nativeElement as HTMLElement;
      expect(bottoneRec(el)).toBeUndefined();
      expect(testoConclusa(el)).toBe('Registrazione conclusa');
    });

    it('backend vecchio (campo assente) → «Registra» resta come oggi', async () => {
      const fixture = await apri();
      const el = fixture.nativeElement as HTMLElement;
      expect(bottoneRec(el)?.textContent).toContain('Registra');
      expect(testoConclusa(el)).toBeUndefined();
    });

    it('stop osservato in sala → il pulsante non torna', async () => {
      const fixture = await apri({ recordingAvviabile: true });
      const el = fixture.nativeElement as HTMLElement;
      const probe = fixture.componentInstance as unknown as RecProbe;
      probe.applyRecording(true);
      fixture.detectChanges();
      expect(bottoneRec(el)?.textContent).toContain('Ferma');
      probe.applyRecording(false);
      fixture.detectChanges();
      expect(bottoneRec(el)).toBeUndefined();
      expect(testoConclusa(el)).toBe('Registrazione conclusa');
      fixture.destroy();
    });

    it('409 all’avvio → il pulsante sparisce', async () => {
      const startRecording = jasmine
        .createSpy('startRecording')
        .and.returnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { message: 'già stata fatta' },
              }),
          ),
        );
      const fixture = await apri(
        { recordingAvviabile: true },
        { startRecording },
      );
      const el = fixture.nativeElement as HTMLElement;
      bottoneRec(el)!.click();
      fixture.detectChanges();
      expect(startRecording).toHaveBeenCalledWith('sess-1');
      expect(bottoneRec(el)).toBeUndefined();
      expect(testoConclusa(el)).toBe('Registrazione conclusa');
    });
  });

  describe('elenco dei presenti', () => {
    /** Connette la stanza e mette dentro i partecipanti finti. */
    async function conPartecipanti(
      ps: ReturnType<typeof partecipante>[],
    ): Promise<RosterProbe> {
      const tok = jasmine
        .createSpy('getRoomToken')
        .and.returnValue(
          of({ token: 't', url: 'wss://x.livekit.cloud', role: 'coach' }),
        );
      configure(tok);
      const fixture = create();
      await flush();
      const probe = fixture.componentInstance as unknown as RosterProbe;
      for (const p of ps) probe.room!.remoteParticipants.set(p.identity, p);
      probe.rebuildRoster();
      return probe;
    }

    it('⚠️ il nickname compare SOLO se differisce dal nome mostrato', async () => {
      // Chi non ha impostato un nome in sala ha nome e nick uguali: stamparli
      // entrambi significherebbe la stessa stringa due volte, una sotto
      // l'altra.
      const probe = await conPartecipanti([
        partecipante({
          identity: 'a',
          name: 'Mario Rossi',
          metadata: JSON.stringify({ role: 'audience', nick: 'fishkiller' }),
        }),
        partecipante({
          identity: 'b',
          name: 'zorro',
          metadata: JSON.stringify({ role: 'audience', nick: 'zorro' }),
        }),
      ]);
      const mario = probe.roster().find((p) => p.identity === 'a')!;
      expect(mario.name).toBe('Mario Rossi');
      expect(mario.nick).toBe('fishkiller');
      const zorro = probe.roster().find((p) => p.identity === 'b')!;
      expect(zorro.nick).toBeNull();
    });

    it('metadata assenti o illeggibili: nessun nick e nessuna eccezione', async () => {
      // I metadata sono una stringa che arriva dalla rete: un `JSON.parse` che
      // lancia qui svuoterebbe l'elenco a metà ricostruzione.
      const probe = await conPartecipanti([
        partecipante({ identity: 'a', metadata: undefined }),
        partecipante({ identity: 'b', name: 'x', metadata: 'non-un-json{' }),
      ]);
      expect(probe.roster()).toHaveSize(2);
      expect(probe.roster().every((p) => p.nick === null)).toBeTrue();
    });

    it('⚠️ il recorder non compare fra i presenti', async () => {
      // Il Room Composite della registrazione entra in stanza COME
      // partecipante: senza il filtro, ogni live registrata mostrava uno
      // studente fantasma col suo identity tecnico.
      const probe = await conPartecipanti([
        partecipante({ identity: 'a', name: 'Mario' }),
        partecipante({ identity: 'EG_xyz', name: '', kind: 2 }),
      ]);
      expect(probe.roster()).toHaveSize(1);
      expect(probe.roster()[0].identity).toBe('a');
    });

    it('l’ordine è alfabetico e regge gli accenti', async () => {
      // Da quando il nome porta accenti e spazi, un confronto di code unit
      // metterebbe «Álvaro» dopo «Zoe».
      const probe = await conPartecipanti([
        partecipante({ identity: 'z', name: 'Zoe' }),
        partecipante({ identity: 'a', name: 'Álvaro' }),
        partecipante({ identity: 'm', name: 'mario' }),
      ]);
      expect(probe.roster().map((p) => p.name)).toEqual([
        'Álvaro',
        'mario',
        'Zoe',
      ]);
    });
  });
});
