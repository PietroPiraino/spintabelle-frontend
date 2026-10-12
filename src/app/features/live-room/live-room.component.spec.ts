import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
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

  describe('uscire, chiudere per tutti, riaprire (incidente del 12/10/2026)', () => {
    type SalaProbe = {
      state: { (): string; set: (s: string) => void };
      participants: { set: (n: number) => void };
      recording: { set: (b: boolean) => void };
      ricarica: () => void;
    };

    /** Entra in sala col token indicato, con `presenti` persone dentro (sé compreso). */
    async function entra(
      tokenOver: Record<string, unknown>,
      presenti = 1,
      extra: Record<string, jasmine.Spy> = {},
    ) {
      const tok = jasmine.createSpy('getRoomToken').and.returnValue(
        of({ token: 't', url: 'wss://x.livekit.cloud', ...tokenOver }),
      );
      configure(tok, extra);
      const router = TestBed.inject(Router);
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      const fixture = create();
      await flush();
      const probe = fixture.componentInstance as unknown as SalaProbe;
      probe.participants.set(presenti);
      const ricarica = spyOn(probe, 'ricarica');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, probe, navigate, ricarica };
    }

    const bottone = (el: HTMLElement, testo: RegExp) =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        testo.test(b.textContent ?? ''),
      );
    const chiudi = (el: HTMLElement) => bottone(el, /Chiudi la live per tutti/);

    it('⚠️ un COACH ospite modera ma NON vede «Chiudi la live per tutti»', async () => {
      const { el } = await entra({ role: 'coach', puoChiudere: false }, 5);
      expect(chiudi(el)).toBeUndefined();
      expect(bottone(el, /Muta tutti/)).toBeDefined();
      // e nemmeno il vecchio «Termina» con l'icona di uscita
      expect(bottone(el, /^\s*Termina\s*$/)).toBeUndefined();
    });

    it('chi può chiudere lo vede; il backend vecchio (campo assente) lo dà al coach', async () => {
      const conduce = await entra({ role: 'coach', puoChiudere: true });
      expect(chiudi(conduce.el)).toBeDefined();
      conduce.fixture.destroy();
      TestBed.resetTestingModule();

      const vecchio = await entra({ role: 'coach' });
      expect(chiudi(vecchio.el)).toBeDefined();
    });

    it('la conferma conta chi resta fuori, e «Annulla» è l’ultimo pulsante', async () => {
      const { el, fixture, probe } = await entra(
        { role: 'coach', puoChiudere: true },
        5,
      );
      probe.recording.set(true);
      chiudi(el)!.click();
      fixture.detectChanges();
      const gruppo = el.querySelector(
        '[aria-label="Conferma chiusura della live"]',
      )!;
      expect(gruppo.textContent).toContain('Chiudere la live per tutti?');
      expect(gruppo.textContent).toContain(
        '4 persone verranno disconnesse e la registrazione si fermerà.',
      );
      // La conferma prende il posto del pulsante: un doppio clic deve finire
      // su «Annulla», non sulla chiusura.
      const bottoni = gruppo.querySelectorAll('button');
      expect(bottoni[bottoni.length - 1].textContent?.trim()).toBe('Annulla');
      fixture.destroy();
    });

    it('chiudere chiama il server e RESTA sulla schermata finale con «Riapri la sala»', async () => {
      const endLive = jasmine.createSpy('endLive').and.returnValue(of({}));
      const { el, fixture, probe, navigate } = await entra(
        { role: 'coach', puoChiudere: true },
        3,
        { endLive },
      );
      chiudi(el)!.click();
      fixture.detectChanges();
      bottone(el, /Chiudi per tutti/)!.click();
      fixture.detectChanges();
      expect(endLive).toHaveBeenCalledWith('sess-1');
      expect(probe.state()).toBe('ended');
      expect(navigate).not.toHaveBeenCalled();
      expect(bottone(el, /Riapri la sala/)).toBeDefined();
    });

    it('uno studente esce subito, senza conferme', async () => {
      const { el, fixture, navigate } = await entra({ role: 'audience' }, 6);
      bottone(el, /Esci dalla sala/)!.click();
      fixture.detectChanges();
      expect(navigate).toHaveBeenCalledWith(['/live']);
      expect(el.querySelector('[aria-label="Conferma uscita"]')).toBeNull();
    });

    it('chi può chiudere e lascia altri dentro riceve una conferma che lo dice', async () => {
      const { el, fixture, navigate } = await entra(
        { role: 'coach', puoChiudere: true },
        5,
      );
      bottone(el, /Esci dalla sala/)!.click();
      fixture.detectChanges();
      const gruppo = el.querySelector('[aria-label="Conferma uscita"]')!;
      expect(gruppo.textContent).toContain('Esci solo tu?');
      expect(gruppo.textContent).toContain('4 altre persone');
      expect(navigate).not.toHaveBeenCalled();
      bottone(el, /^\s*Esci\s*$/)!.click();
      expect(navigate).toHaveBeenCalledWith(['/live']);
    });

    it('chi può chiudere ed è solo in sala esce subito', async () => {
      const { el, navigate } = await entra({ role: 'coach', puoChiudere: true }, 1);
      bottone(el, /Esci dalla sala/)!.click();
      expect(navigate).toHaveBeenCalledWith(['/live']);
    });

    it('schermata finale: lo studente ha «Rientra», che ricarica la sala', async () => {
      const { el, fixture, probe, ricarica } = await entra({ role: 'audience' });
      probe.state.set('ended');
      fixture.detectChanges();
      expect(bottone(el, /Riapri la sala/)).toBeUndefined();
      bottone(el, /Rientra/)!.click();
      expect(ricarica).toHaveBeenCalled();
    });

    it('«Riapri la sala» riapre e rientra; un 409 (già riaperta) rientra lo stesso', async () => {
      const reopenLive = jasmine.createSpy('reopenLive').and.returnValue(of({}));
      const ok = await entra(
        { role: 'coach', puoChiudere: true },
        1,
        { reopenLive },
      );
      ok.probe.state.set('ended');
      ok.fixture.detectChanges();
      bottone(ok.el, /Riapri la sala/)!.click();
      expect(reopenLive).toHaveBeenCalledWith('sess-1');
      expect(ok.ricarica).toHaveBeenCalled();
      ok.fixture.destroy();
      TestBed.resetTestingModule();

      const gia = jasmine
        .createSpy('reopenLive')
        .and.returnValue(
          throwError(() => new HttpErrorResponse({ status: 409 })),
        );
      const conflitto = await entra(
        { role: 'coach', puoChiudere: true },
        1,
        { reopenLive: gia },
      );
      conflitto.probe.state.set('ended');
      conflitto.fixture.detectChanges();
      bottone(conflitto.el, /Riapri la sala/)!.click();
      expect(conflitto.ricarica).toHaveBeenCalled();
    });

    it('un altro errore alla riapertura NON ricarica', async () => {
      const reopenLive = jasmine
        .createSpy('reopenLive')
        .and.returnValue(
          throwError(() => new HttpErrorResponse({ status: 500 })),
        );
      const { el, fixture, probe, ricarica } = await entra(
        { role: 'coach', puoChiudere: true },
        1,
        { reopenLive },
      );
      probe.state.set('ended');
      fixture.detectChanges();
      bottone(el, /Riapri la sala/)!.click();
      fixture.detectChanges();
      expect(ricarica).not.toHaveBeenCalled();
      expect(bottone(el, /Riapri la sala/)).toBeDefined();
    });
  });
});
