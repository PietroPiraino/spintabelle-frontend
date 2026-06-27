import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  LocalAudioTrack,
  Room,
  RemoteParticipant,
  Track,
} from 'livekit-client';
import { LiveService } from '../../core/services/live.service';
import { LIVEKIT_LOADER } from '../../shared/sdk/livekit-loader';
import { apiErrorMessage } from '../../core/utils/http-error';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

type RoomState =
  | 'connecting'
  | 'connected'
  | 'denied'
  | 'error'
  | 'ended'
  | 'consent';
interface ChatMessage {
  from: string;
  text: string;
  me: boolean;
}
/** Un partecipante remoto, per la lista presenti / moderazione. */
interface RosterEntry {
  identity: string;
  name: string;
  canPublish: boolean;
  micActive: boolean; // microfono pubblicato e non mutato
  canScreen: boolean; // il coach gli ha concesso lo schermo (attributo presenter)
  quality: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown'; // qualità connessione
}

/**
 * Sala live on-site (LIVEKIT). Recupera il token via XHR (gate per tier lato
 * backend → 403 se non hai il tier), poi connette la stanza con il core
 * livekit-client caricato lazy. Il pubblico guarda + chatta; il coach trasmette
 * camera/microfono/schermo. Moderazione (alza-mano, dai/togli parola) = Fase 2.
 */
@Component({
  selector: 'app-live-room',
  imports: [RouterLink, IconComponent],
  templateUrl: './live-room.component.html',
  styleUrl: './live-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocClick($event)' },
})
export class LiveRoomComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly liveApi = inject(LiveService);
  private readonly loadLiveKit = inject(LIVEKIT_LOADER);
  private readonly toast = inject(ToastService);

  private readonly stageRef =
    viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly audioRef =
    viewChild<ElementRef<HTMLDivElement>>('audioSink');
  private readonly messagesRef =
    viewChild<ElementRef<HTMLDivElement>>('msgList');
  private readonly pipRef = viewChild<ElementRef<HTMLDivElement>>('pip');

  protected readonly id = signal('');
  protected readonly state = signal<RoomState>('connecting');
  protected readonly error = signal<string | null>(null);
  protected readonly role = signal<'coach' | 'audience'>('audience');
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly participants = signal(1);
  protected readonly reconnecting = signal(false);
  protected readonly hasVideo = signal(false);
  protected readonly needAudioGesture = signal(false);
  // stato pubblicazione coach
  protected readonly camOn = signal(false);
  protected readonly micOn = signal(false);
  protected readonly screenOn = signal(false);
  // moderazione (Fase 2)
  protected readonly roster = signal<RosterEntry[]>([]);
  // il pubblico può pubblicare il microfono (true di default; il coach può revocarlo)
  protected readonly canPublishNow = signal(false);
  // il coach mi ha concesso la condivisione schermo (attributo presenter)
  protected readonly canScreenShare = signal(false);
  // rifiniture: identità locale, chi sta parlando, presenza di uno schermo condiviso
  protected readonly myIdentity = signal('');
  protected readonly speaking = signal<Set<string>>(new Set());
  protected readonly hasScreen = signal(false);
  // registrazione (Fase 3)
  protected readonly recordingEnabled = signal(false); // la sessione è registrabile
  protected readonly recording = signal(false); // egress attivo ora (room.isRecording)
  protected readonly recElapsed = signal(''); // durata REC (mm:ss / h:mm:ss)
  protected readonly recAnnounce = signal(''); // annuncio sr-only avvio/stop REC
  protected readonly endingLive = signal(false); // "Termina live" in corso
  // inline-confirm azioni distruttive (chiave attiva, es. 'muteAll'/'endLive'/'kick:<id>') o null
  protected readonly confirming = signal<string | null>(null);
  protected readonly recPending = signal(false); // avvio/stop registrazione in corso
  protected readonly muteAllPending = signal(false); // "muta tutti" in corso
  // Fase 3 — "alza la mano" + avvisi
  // coach: identità → richieste in sospeso ('mic'=parola, 'screen'=schermo)
  protected readonly raisedHands = signal<Map<string, Set<'mic' | 'screen'>>>(
    new Map(),
  );
  protected readonly myHandMic = signal(false); // studente: ha chiesto la parola
  protected readonly myHandScreen = signal(false); // studente: ha chiesto lo schermo
  protected readonly chatUnread = signal(0); // messaggi non letti (tab in background)
  private readonly pageHidden = signal(document.hidden); // pagina in secondo piano
  protected readonly handAnnounce = signal(''); // annuncio sr-only nuova mano alzata
  // Fase 4 — mobile: tab attiva (sotto 880px) + non letti per il badge "Chat"
  protected readonly mobileTab = signal<'video' | 'chat' | 'people'>('video');
  protected readonly mobileChatUnread = signal(0);
  protected readonly rosterMenu = signal<string | null>(null); // riga col menu azioni aperto
  // coach: avviso sonoro delle mani alzate (preferenza persistita, default on)
  protected readonly soundOn = signal(
    (() => {
      try {
        return localStorage.getItem('bff-live-sound') !== '0';
      } catch {
        return true;
      }
    })(),
  );
  private consentGiven = false;
  // Testo del consenso fornito dal backend (versionato, GDPR art. 7); fallback se assente.
  protected readonly consentText = signal(
    'Questa sessione può essere registrata. Entrando acconsenti alla registrazione di audio, video ed eventuale schermo che condividi.',
  );
  private recTimer: ReturnType<typeof setInterval> | null = null;
  private recStartMs = 0;
  private audioCtx: AudioContext | null = null;
  private titleBase = ''; // titolo originale della tab (per il prefisso conteggio)
  private readonly onVisibility = (): void => {
    this.pageHidden.set(document.hidden);
    if (!document.hidden) this.chatUnread.set(0);
  };

  private room: Room | null = null;
  // Tile video per traccia → rimozione robusta in detach, indipendente dal sid
  // (un sid assente lascerebbe altrimenti un riquadro orfano sullo stage).
  private readonly tiles = new Map<Track, HTMLElement>();
  private lk: typeof import('livekit-client') | null = null;
  private disposed = false;
  private krispDone = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.id.set(id);
    // Chat: scrolla in fondo all'arrivo/invio di un messaggio. Zoneless → il
    // render del nuovo messaggio è schedulato: rinvio lo scroll a un rAF.
    effect(() => {
      this.messages();
      const el = this.messagesRef()?.nativeElement;
      if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    });
    // Titolo della tab: SOLO quando la pagina è in secondo piano prefigge il
    // numero di richieste in attesa (mani alzate per il coach + chat non letta),
    // così il coach che lavora in un'altra app se ne accorge dalla taskbar.
    effect(() => {
      const hands =
        this.role() === 'coach' && this.pageHidden()
          ? this.raisedHands().size
          : 0;
      const n = hands + this.chatUnread();
      if (this.titleBase) {
        document.title = n > 0 ? `(${n}) ${this.titleBase}` : this.titleBase;
      }
    });
    afterNextRender(() => void this.init(id));
  }

  private async init(id: string): Promise<void> {
    if (!id) {
      this.fail('Sessione non valida.');
      return;
    }
    try {
      const tok = await firstValueFrom(
        this.liveApi.getRoomToken(id, this.consentGiven),
      );
      this.role.set(tok.role);
      this.recordingEnabled.set(tok.recordingEnabled);
      const LK = await this.loadLiveKit();
      if (this.disposed) return;
      this.lk = LK;

      const room = new LK.Room({
        adaptiveStream: true,
        dynacast: true,
        // Filtri audio del browser espliciti (sono i default dell'SDK, ma così
        // sono documentati e pronti per agganciare Krisp sul mic locale).
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: true,
        },
      });
      this.room = room;

      room
        .on(
          LK.RoomEvent.TrackSubscribed,
          (
            track: Track,
            pub: { isMuted?: boolean },
            p: { identity: string; name?: string },
          ) =>
            this.attach(
              track,
              p.identity,
              p.name || p.identity,
              false,
              !!pub?.isMuted,
            ),
        )
        .on(LK.RoomEvent.TrackUnsubscribed, (track: Track) => this.detach(track))
        .on(LK.RoomEvent.LocalTrackPublished, (pub) => {
          if (!pub.track) return;
          if (pub.track.kind === 'video') {
            this.attach(
              pub.track,
              room.localParticipant.identity,
              room.localParticipant.name || 'Tu',
              true,
              !!pub.isMuted,
            );
          } else if (pub.source === LK.Track.Source.Microphone) {
            // NON aggancio l'audio locale (eviti di riascoltarti); applico Krisp al mic
            void this.applyKrisp(pub.track);
          }
        })
        .on(LK.RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.track) this.detach(pub.track);
        })
        .on(LK.RoomEvent.ParticipantConnected, () => this.onRosterChange())
        .on(LK.RoomEvent.ParticipantDisconnected, () => this.onRosterChange())
        .on(
          LK.RoomEvent.ParticipantAttributesChanged,
          (_changed: unknown, participant?: { identity: string }) => {
            // il coach mi ha concesso/revocato lo schermo (attributo presenter)
            if (participant?.identity === room.localParticipant.identity)
              this.refreshLocalGrants();
            this.rebuildRoster();
          },
        )
        // qualità connessione nel roster (pallino verde/giallo/rosso)
        .on(LK.RoomEvent.ConnectionQualityChanged, () => this.rebuildRoster())
        // mute/unmute: aggiorna la lista (microfono) e nascondi/mostra il tile
        // video (la camera off MUTA la traccia, non la de-pubblica → resterebbe nero)
        .on(LK.RoomEvent.TrackMuted, (pub: { trackSid?: string }) =>
          this.onTrackMuteChange(pub, true),
        )
        .on(LK.RoomEvent.TrackUnmuted, (pub: { trackSid?: string }) =>
          this.onTrackMuteChange(pub, false),
        )
        .on(LK.RoomEvent.TrackPublished, () => this.rebuildRoster())
        .on(LK.RoomEvent.TrackUnpublished, () => this.rebuildRoster())
        // chi sta parlando
        .on(
          LK.RoomEvent.ActiveSpeakersChanged,
          (speakers: { identity: string }[]) =>
            this.onActiveSpeakers(speakers),
        )
        .on(
          LK.RoomEvent.ParticipantPermissionsChanged,
          (_prev: unknown, participant: { identity: string }) => {
            // se cambiano i MIEI permessi (microfono/schermo), aggiorna i controlli
            if (participant?.identity === room.localParticipant.identity)
              this.refreshLocalGrants();
            this.rebuildRoster();
          },
        )
        .on(
          LK.RoomEvent.DataReceived,
          (payload: Uint8Array, participant?: RemoteParticipant) =>
            this.onData(payload, participant),
        )
        .on(LK.RoomEvent.Reconnecting, () => this.reconnecting.set(true))
        .on(LK.RoomEvent.Reconnected, () => this.reconnecting.set(false))
        .on(LK.RoomEvent.AudioPlaybackStatusChanged, () =>
          this.needAudioGesture.set(!room.canPlaybackAudio),
        )
        // REC: egress attivo sulla stanza (LiveKit lo segnala a tutti)
        .on(LK.RoomEvent.RecordingStatusChanged, (active: boolean) =>
          this.applyRecording(active),
        )
        .on(LK.RoomEvent.Disconnected, (reason?: unknown) => {
          if (this.disposed) return;
          // se il coach ha terminato la live, la stanza viene eliminata → messaggio dedicato
          if (reason === LK.DisconnectReason.ROOM_DELETED) {
            this.state.set('ended');
          } else {
            this.fail('Disconnesso dalla sala live.');
          }
        });

      await room.connect(tok.url, tok.token);
      if (this.disposed) {
        void room.disconnect();
        return;
      }
      this.state.set('connected');
      this.myIdentity.set(room.localParticipant.identity);
      // Se la registrazione è GIÀ in corso al nostro ingresso, ancora il timer
      // all'inizio reale dal backend (non al momento del join). Le transizioni
      // osservate dal vivo in stanza arrivano poi via RecordingStatusChanged
      // (senza ancora → Date.now(), che lì è corretto).
      this.applyRecording(room.isRecording, tok.recordingStartedAt);
      this.refreshCount();
      this.rebuildRoster();
      // il pubblico nasce con il permesso microfono (tavola rotonda); il coach
      // può revocarlo → questi flag pilotano la visibilità di mic/schermo.
      this.refreshLocalGrants();
      // titolo tab + reset "non letti" quando la pagina torna in primo piano
      this.titleBase = document.title;
      document.addEventListener('visibilitychange', this.onVisibility);
    } catch (err: unknown) {
      if (this.disposed) return;
      const status = (err as { status?: number })?.status;
      const body = (err as {
        error?: { code?: string; consentText?: string };
      })?.error;
      // 403 con codice consenso → mostra il modale di consenso (non "negato")
      if (status === 403 && body?.code === 'CONSENT_REQUIRED') {
        if (body.consentText) this.consentText.set(body.consentText);
        this.state.set('consent');
        return;
      }
      if (status === 403) {
        this.state.set('denied');
        return;
      }
      if (status === 400) {
        // messaggio dal server: "La live è terminata" oppure "non usa la sala on-site"
        this.fail(apiErrorMessage(err, 'Questa sessione non è più disponibile.'));
        return;
      }
      this.fail(apiErrorMessage(err, 'Impossibile entrare nella sala live.'));
    }
  }

  private fail(msg: string): void {
    this.state.set('error');
    this.error.set(msg);
  }

  private refreshCount(): void {
    // remoteParticipants = solo i remoti → +1 per sé. (room.numParticipants è il
    // totale del server e include GIÀ il locale: usarlo darebbe un +1 di troppo.)
    if (this.room) this.participants.set(this.room.remoteParticipants.size + 1);
  }

  private attach(
    track: Track,
    identity: string,
    name: string,
    isLocal: boolean,
    mutedAtAttach = false,
  ): void {
    const el = track.attach();
    if (track.kind !== 'video') {
      this.audioRef()?.nativeElement.appendChild(el);
      return;
    }
    const isScreen = track.source === this.lk?.Track.Source.ScreenShare;
    el.classList.add('live-room__video');
    // Ogni traccia video vive in un tile con targhetta nome (chi è chi sul palco).
    const tile = document.createElement('div');
    tile.className = `live-room__tile ${isScreen ? 'is-screen' : 'is-cam'}`;
    tile.dataset['identity'] = identity;
    tile.dataset['sid'] = track.sid ?? '';
    if (this.speaking().has(identity)) tile.classList.add('is-speaking');
    tile.appendChild(el);

    const plate = document.createElement('div');
    plate.className = 'live-room__nameplate';
    const label = document.createElement('span');
    label.className = 'live-room__nameplate-name';
    const who = isLocal ? 'Tu' : name;
    label.textContent = isScreen ? `${who} · schermo` : who;
    plate.appendChild(label);
    if (isLocal && this.role() === 'coach') {
      const role = document.createElement('span');
      role.className = 'live-room__nameplate-role';
      role.textContent = 'Coach';
      plate.appendChild(role);
    }
    tile.appendChild(plate);

    // Se la traccia è già mutata al join (es. coach con camera spenta), il tile
    // nasce nascosto → niente riquadro nero; TrackUnmuted lo rivelerà.
    if (mutedAtAttach) tile.hidden = true;

    this.tiles.set(track, tile);
    this.stageRef()?.nativeElement.appendChild(tile);
    this.recomputeStage();
  }

  private detach(track: Track): void {
    // track.detach() stacca il <video>; rimuovo il TILE wrapper (targhetta
    // compresa) via la mappa per-traccia → mai un riquadro orfano/nero residuo,
    // anche se il sid è assente in fase di teardown.
    track.detach().forEach((el) => el.remove());
    const tile = this.tiles.get(track);
    if (tile) {
      tile.remove();
      this.tiles.delete(track);
    }
    if (track.kind === 'video') this.recomputeStage();
  }

  /** Ricalcola la presenza di video / schermo (solo i tile VISIBILI). */
  private recomputeStage(): void {
    const stage = this.stageRef()?.nativeElement;
    this.hasVideo.set(
      !!stage &&
        stage.querySelector('.live-room__tile:not([hidden])') !== null,
    );
    this.hasScreen.set(
      !!stage &&
        stage.querySelector('.live-room__tile.is-screen:not([hidden])') !==
          null,
    );
    this.relayoutTiles();
  }

  /**
   * In modalità schermo le webcam vanno nel contenitore PiP (impilate in colonna,
   * niente sovrapposizione anche con più presenter); in modalità normale tornano
   * nel flusso flex dello stage. I tile schermo restano sempre nello stage.
   */
  private relayoutTiles(): void {
    const stage = this.stageRef()?.nativeElement;
    const pip = this.pipRef()?.nativeElement;
    if (!stage || !pip) return;
    const target = this.hasScreen() ? pip : stage;
    const cams = [
      ...Array.from(
        stage.querySelectorAll<HTMLElement>(':scope > .live-room__tile.is-cam'),
      ),
      ...Array.from(
        pip.querySelectorAll<HTMLElement>('.live-room__tile.is-cam'),
      ),
    ];
    for (const t of cams) {
      if (t.parentElement !== target) target.appendChild(t);
    }
  }

  /**
   * Mute/unmute di una traccia (remota). Nascondo il tile video relativo (per sid)
   * invece di lasciarlo nero; all'unmute lo rimostro. Aggiorna anche la lista
   * presenti (stato microfono).
   */
  private onTrackMuteChange(pub: { trackSid?: string }, muted: boolean): void {
    this.rebuildRoster();
    const sid = pub?.trackSid;
    if (!sid) return;
    this.stageRef()
      ?.nativeElement.querySelectorAll<HTMLElement>(
        `.live-room__tile[data-sid="${sid}"]`,
      )
      .forEach((el) => (el.hidden = muted));
    this.recomputeStage();
  }

  /** Chi sta parlando: aggiorna il set + il bordo sui tile video. */
  private onActiveSpeakers(speakers: { identity: string }[]): void {
    const set = new Set(speakers.map((s) => s.identity));
    this.speaking.set(set);
    const stage = this.stageRef()?.nativeElement;
    stage?.querySelectorAll('.live-room__tile').forEach((el) => {
      const id = (el as HTMLElement).dataset['identity'];
      (el as HTMLElement).classList.toggle('is-speaking', !!id && set.has(id));
    });
  }

  protected isSpeaking(identity: string): boolean {
    return this.speaking().has(identity);
  }

  protected selfSpeaking(): boolean {
    return this.speaking().has(this.myIdentity());
  }

  /** Porta il riquadro video a tutto schermo (Esc per uscire). */
  protected async toggleFullscreen(): Promise<void> {
    const stage = this.stageRef()?.nativeElement;
    if (!stage) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (typeof stage.requestFullscreen === 'function') {
        await stage.requestFullscreen();
        return;
      }
      // iOS Safari non supporta requestFullscreen su un <div>: ripiego sul
      // fullscreen NATIVO del video (schermo condiviso se c'è, altrimenti il primo).
      const video = (stage.querySelector('.is-screen video') ??
        stage.querySelector('video')) as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | null;
      video?.webkitEnterFullscreen?.();
    } catch {
      /* il browser può rifiutare la richiesta: nessun crash */
    }
  }

  private onData(payload: Uint8Array, participant?: RemoteParticipant): void {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
        t?: string;
        m?: string;
        kind?: string;
        on?: boolean;
      };
      if (parsed?.t === 'chat' && typeof parsed.m === 'string') {
        const from = participant?.name || participant?.identity || 'Utente';
        this.messages.update((l) => [
          ...l,
          { from, text: parsed.m as string, me: false },
        ]);
        if (document.hidden) this.chatUnread.update((n) => n + 1);
        // badge non-letti della tab Chat: solo in vista mobile (su desktop la chat
        // è sempre visibile → niente conteggio fantasma).
        if (this.isMobileView() && this.mobileTab() !== 'chat') {
          this.mobileChatUnread.update((n) => n + 1);
        }
        return;
      }
      // "alza la mano": lo gestisce SOLO il coach (badge nel roster + suono)
      if (parsed?.t === 'hand' && this.role() === 'coach') {
        const id = participant?.identity;
        if (!id) return;
        const kind = parsed.kind === 'screen' ? 'screen' : 'mic';
        const map = new Map(this.raisedHands());
        const set = new Set(map.get(id) ?? []);
        if (parsed.on) {
          const isNew = !set.has(kind);
          set.add(kind);
          map.set(id, set);
          this.raisedHands.set(map);
          if (isNew) {
            this.playPing();
            const who =
              participant?.name || participant?.identity || 'Un partecipante';
            this.handAnnounce.set(
              kind === 'screen'
                ? `${who} chiede di condividere lo schermo`
                : `${who} chiede la parola`,
            );
          }
        } else {
          set.delete(kind);
          if (set.size) map.set(id, set);
          else map.delete(id);
          this.raisedHands.set(map);
        }
      }
    } catch {
      // payload non valido: ignora
    }
  }

  /** Invia un messaggio dati affidabile (chat / "alza la mano"). */
  private sendData(obj: Record<string, unknown>): void {
    if (!this.room) return;
    const data = new TextEncoder().encode(JSON.stringify(obj));
    void this.room.localParticipant.publishData(data, { reliable: true });
  }

  protected sendChat(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text || !this.room) return;
    this.ensureAudio(); // anche l'invio in chat è un gesto: sblocca l'audio
    this.sendData({ t: 'chat', m: text });
    this.messages.update((l) => [
      ...l,
      { from: this.room?.localParticipant.name || 'Tu', text, me: true },
    ]);
    input.value = '';
  }

  /** Mobile: cambia tab (Video / Chat / Persone); aprendo Chat azzera i non letti. */
  protected setTab(tab: 'video' | 'chat' | 'people'): void {
    // il tap su una tab è un gesto utente: sblocca l'audio anche da Chat/Persone
    // (dove l'overlay "abilita audio" sul video non è visibile).
    this.ensureAudio();
    this.mobileTab.set(tab);
    if (tab === 'chat') this.mobileChatUnread.set(0);
    // tornando al Video ri-aggancio le tracce: su Chat/Persone lo stage va in
    // display:none → l'adaptiveStream mette in pausa e l'elemento resterebbe NERO.
    // setTimeout(0) → dopo il change-detection (stage di nuovo visibile).
    if (tab === 'video') setTimeout(() => this.reattachVideos(), 0);
  }

  /** Ri-aggancia le tracce video ai loro tile: ripristina il render dopo un display:none. */
  private reattachVideos(): void {
    this.tiles.forEach((tile, track) => {
      if (track.kind !== 'video') return;
      const el = tile.querySelector('video') as HTMLVideoElement | null;
      if (!el) return;
      try {
        track.attach(el);
        void el.play?.();
      } catch {
        /* il browser può rifiutare il play automatico: nessun crash */
      }
    });
  }

  /** Vista mobile (sotto 880px): la barra tab è attiva. */
  private isMobileView(): boolean {
    return window.matchMedia('(max-width: 880px)').matches;
  }

  /** Studente: alza/abbassa la mano per la parola (mic) o lo schermo. */
  protected toggleHand(kind: 'mic' | 'screen'): void {
    if (!this.room) return;
    const sig = kind === 'mic' ? this.myHandMic : this.myHandScreen;
    const on = !sig();
    sig.set(on);
    this.sendData({ t: 'hand', kind, on });
  }

  protected async toggleCam(): Promise<void> {
    await this.publish('camera');
  }
  protected async toggleMic(): Promise<void> {
    await this.publish('mic');
  }
  protected async toggleScreen(): Promise<void> {
    await this.publish('screen');
  }

  private async publish(what: 'camera' | 'mic' | 'screen'): Promise<void> {
    if (!this.room) return;
    this.ensureAudio(); // un click su "Parla" sblocca anche la riproduzione audio
    const lp = this.room.localParticipant;
    try {
      if (what === 'camera') {
        const on = !this.camOn();
        if (on) {
          await lp.setCameraEnabled(true);
        } else {
          // De-pubblico la camera (come lo screen-share) così il tile sparisce
          // dal percorso LocalTrackUnpublished→detach già funzionante.
          // setCameraEnabled(false) si limiterebbe a MUTARE → resterebbe nero.
          const pub = this.lk
            ? lp.getTrackPublication(this.lk.Track.Source.Camera)
            : undefined;
          if (pub?.track) await lp.unpublishTrack(pub.track, true);
          else await lp.setCameraEnabled(false);
        }
        this.camOn.set(on);
      } else if (what === 'mic') {
        const on = !this.micOn();
        await lp.setMicrophoneEnabled(on);
        this.micOn.set(on);
      } else {
        const on = !this.screenOn();
        // contentHint 'detail' = priorità alla nitidezza (testo/tavoli) sulla
        // fluidità. Cattura + pubblica a 1080p30 con bitrate alto così l'egress
        // registra una sorgente nitida (senza, anche con egress a 1080p,
        // ricomprimerebbe un 720p). Vedi livekit.service.startRecording.
        await lp.setScreenShareEnabled(
          on,
          {
            audio: true,
            contentHint: 'detail',
            resolution: { width: 1920, height: 1080, frameRate: 30 },
          },
          { screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 30 } },
        );
        this.screenOn.set(on);
      }
    } catch {
      this.toast.error(
        'Permesso negato: consenti fotocamera/microfono/schermo per trasmettere.',
      );
    }
  }

  protected async enableAudio(): Promise<void> {
    await this.room?.startAudio();
    this.needAudioGesture.set(false);
  }

  /**
   * Sblocca la riproduzione audio sfruttando un gesto utente già in corso (click su
   * "Parla", invio chat, ecc.): così chi interagisce non deve premere anche
   * "Abilita audio". Va chiamato per PRIMO nell'handler, prima di altri await,
   * per restare dentro la finestra di user-activation del browser.
   */
  private ensureAudio(): void {
    if (!this.needAudioGesture() || !this.room) return;
    this.room
      .startAudio()
      .then(() => this.needAudioGesture.set(false))
      .catch(() => {
        /* resta disponibile il bottone "Abilita audio" */
      });
  }

  /**
   * Cancellazione rumore AI (Krisp) sul microfono locale: rimuove tastiera, ventola,
   * voci d'ambiente. Caricato lazy (chunk WASM pesante). Degrada in silenzio se il
   * browser non lo supporta o se il piano LiveKit non lo abilita → l'audio resta normale.
   */
  private async applyKrisp(track: Track): Promise<void> {
    if (this.krispDone) return;
    try {
      const mod = await import('@livekit/krisp-noise-filter');
      if (this.disposed || !mod.isKrispNoiseFilterSupported()) return;
      await (track as LocalAudioTrack).setProcessor(mod.KrispNoiseFilter());
      this.krispDone = true;
    } catch {
      // non supportato / piano non abilitato → microfono senza filtro AI
    }
  }

  // ----- Moderazione (Fase 2) -----

  private onRosterChange(): void {
    this.refreshCount();
    this.rebuildRoster();
    // pulisci le mani alzate di chi è uscito dalla stanza
    if (this.raisedHands().size && this.room) {
      const present = new Set(this.room.remoteParticipants.keys());
      const map = new Map(
        [...this.raisedHands()].filter(([id]) => present.has(id)),
      );
      if (map.size !== this.raisedHands().size) this.raisedHands.set(map);
    }
  }

  private rebuildRoster(): void {
    if (!this.room) return;
    const list: RosterEntry[] = [];
    this.room.remoteParticipants.forEach((rp) => {
      const micPub = this.lk
        ? rp.getTrackPublication(this.lk.Track.Source.Microphone)
        : undefined;
      list.push({
        identity: rp.identity,
        name: rp.name || rp.identity,
        canPublish: !!rp.permissions?.canPublish,
        micActive: !!micPub && !micPub.isMuted,
        canScreen: rp.attributes?.['presenter'] === 'true',
        quality: this.normQuality(rp.connectionQuality),
      });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    this.roster.set(list);
  }

  /** Normalizza la qualità di connessione dell'SDK in un'etichetta stabile. */
  private normQuality(q: unknown): RosterEntry['quality'] {
    const v = String(q ?? '').toLowerCase();
    if (v === 'excellent' || v === 'good' || v === 'poor' || v === 'lost')
      return v;
    return 'unknown';
  }

  /** Etichetta italiana della qualità connessione (per lo screen reader). */
  protected qualityLabel(q: RosterEntry['quality']): string {
    switch (q) {
      case 'excellent':
        return 'ottima';
      case 'good':
        return 'buona';
      case 'poor':
        return 'scarsa';
      case 'lost':
        return 'persa';
      default:
        return 'sconosciuta';
    }
  }

  /** Ricalcola i permessi LOCALI (microfono + schermo concesso) per i controlli. */
  private refreshLocalGrants(): void {
    const lp = this.room?.localParticipant;
    const canPub = !!lp?.permissions?.canPublish;
    const canScr = lp?.attributes?.['presenter'] === 'true';
    this.canPublishNow.set(canPub);
    this.canScreenShare.set(canScr);
    // se il coach ha concesso e la mano era alzata, abbassala E avvisa: così
    // TUTTI i coach (config multi-coach) tolgono il badge, non solo chi concede.
    if (canPub && this.myHandMic()) {
      this.myHandMic.set(false);
      this.sendData({ t: 'hand', kind: 'mic', on: false });
    }
    if (canScr && this.myHandScreen()) {
      this.myHandScreen.set(false);
      this.sendData({ t: 'hand', kind: 'screen', on: false });
    }
  }

  /** Mostra i controlli di pubblicazione: coach, o pubblico promosso dal coach. */
  protected canPublish(): boolean {
    return this.role() === 'coach' || this.canPublishNow();
  }

  /** Ridà il microfono a uno studente a cui era stato revocato. */
  protected promote(identity: string): void {
    this.rosterMenu.set(null);
    this.liveApi
      .promote(this.id(), { targetUserId: identity, sources: ['mic'] })
      .subscribe({
        next: () => {
          this.toast.success('Microfono restituito');
          this.clearHand(identity, 'mic');
        },
        error: () => this.toast.error('Impossibile ridare il microfono.'),
      });
  }

  protected demote(identity: string): void {
    this.rosterMenu.set(null);
    this.liveApi.demote(this.id(), identity).subscribe({
      next: () => this.toast.success('Microfono revocato'),
      error: () => this.toast.error('Impossibile revocare la parola.'),
    });
  }

  protected muteParticipant(identity: string): void {
    this.rosterMenu.set(null);
    const rp = this.room?.remoteParticipants.get(identity);
    const sid = this.lk
      ? rp?.getTrackPublication(this.lk.Track.Source.Microphone)?.trackSid
      : undefined;
    if (!sid) {
      this.toast.error(
        'Nessuna traccia audio da mutare per questo partecipante.',
      );
      return;
    }
    this.liveApi.mute(this.id(), { targetUserId: identity, trackSid: sid }).subscribe({
      next: () => this.toast.success('Partecipante mutato'),
      error: () => this.toast.error('Mute non riuscito.'),
    });
  }

  /** Inline-confirm delle azioni distruttive (niente confirm() nativi). */
  protected isConfirming(key: string): boolean {
    return this.confirming() === key;
  }
  protected askConfirm(key: string): void {
    this.confirming.set(key);
  }
  protected cancelConfirm(): void {
    this.confirming.set(null);
  }

  /** Coach: apre/chiude il menu azioni di un partecipante (uno per volta). */
  protected toggleRosterMenu(id: string): void {
    this.rosterMenu.update((cur) => (cur === id ? null : id));
  }
  /** Chiude il menu azioni cliccando fuori da una riga del roster. */
  protected onDocClick(e: MouseEvent): void {
    if (this.rosterMenu() === null) return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest('.live-room__roster-row')) this.rosterMenu.set(null);
  }

  // ----- Fase 3: mani alzate + avviso sonoro (coach) -----

  /** Coach: true se il partecipante ha una richiesta in sospeso. */
  protected hasHand(id: string): boolean {
    return this.raisedHands().has(id);
  }
  /** Coach: etichetta della richiesta (parola / schermo / entrambi). */
  protected handLabel(id: string): string {
    const set = this.raisedHands().get(id);
    if (!set) return '';
    const mic = set.has('mic');
    const screen = set.has('screen');
    if (mic && screen) return 'vuole parlare e condividere';
    if (screen) return 'vuole condividere lo schermo';
    return 'vuole parlare';
  }
  /** Coach: rimuove una richiesta (quando concede, o il partecipante la annulla). */
  private clearHand(id: string, kind: 'mic' | 'screen'): void {
    const map = new Map(this.raisedHands());
    const set = new Set(map.get(id) ?? []);
    if (!set.has(kind)) return;
    set.delete(kind);
    if (set.size) map.set(id, set);
    else map.delete(id);
    this.raisedHands.set(map);
  }

  /** Avviso sonoro (coach) all'arrivo di una mano alzata. Web Audio, solo locale. */
  private playPing(): void {
    if (!this.soundOn()) return;
    try {
      const ctx = (this.audioCtx ??= new AudioContext());
      const beep = (): void => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1175, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.34);
      };
      // Un AudioContext creato fuori da un gesto parte 'suspended' (currentTime
      // congelato): aspetto il resume PRIMA di schedulare, così anche il primo
      // ping non viene perso.
      if (ctx.state === 'suspended') void ctx.resume().then(beep).catch(() => {});
      else beep();
    } catch {
      /* audio non disponibile */
    }
  }

  /** Coach: attiva/disattiva l'avviso sonoro delle mani alzate (persistito). */
  protected toggleSound(): void {
    const on = !this.soundOn();
    this.soundOn.set(on);
    try {
      localStorage.setItem('bff-live-sound', on ? '1' : '0');
    } catch {
      /* storage non disponibile */
    }
    // attivandolo (gesto utente) preparo/riprendo l'AudioContext, così il primo
    // ping successivo non resta muto per la policy autoplay.
    if (on) {
      try {
        const ctx = (this.audioCtx ??= new AudioContext());
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        /* audio non disponibile */
      }
    }
  }

  /** Coach: espelle un partecipante (dopo conferma inline). */
  protected doKick(identity: string): void {
    this.cancelConfirm();
    this.rosterMenu.set(null);
    this.liveApi.kick(this.id(), identity).subscribe({
      next: () => this.toast.success('Partecipante espulso'),
      error: () => this.toast.error('Impossibile espellere.'),
    });
  }

  /** Coach: concede/revoca la condivisione schermo (+webcam) a uno studente. */
  protected grantScreen(identity: string, on: boolean): void {
    this.rosterMenu.set(null);
    this.liveApi.grantScreen(this.id(), identity, on).subscribe({
      next: () => {
        this.toast.success(on ? 'Schermo concesso' : 'Schermo revocato');
        if (on) this.clearHand(identity, 'screen');
      },
      error: () =>
        this.toast.error(
          on
            ? 'Impossibile concedere lo schermo.'
            : 'Impossibile revocare lo schermo.',
        ),
    });
  }

  /** Coach: toglie il microfono a tutti (dopo conferma inline + stato pending). */
  protected doMuteAll(): void {
    this.cancelConfirm();
    this.muteAllPending.set(true);
    this.liveApi.muteAll(this.id()).subscribe({
      next: () => {
        this.muteAllPending.set(false);
        this.toast.success('Microfono tolto a tutti');
      },
      error: () => {
        this.muteAllPending.set(false);
        this.toast.error('Operazione "muta tutti" non riuscita.');
      },
    });
  }

  /** Mostra il bottone "Condividi schermo": coach, o studente a cui è stato concesso. */
  protected canShareScreen(): boolean {
    return this.role() === 'coach' || this.canScreenShare();
  }

  /** L'utente accetta il consenso alla registrazione → riprova l'ingresso. */
  protected consentAccept(): void {
    this.consentGiven = true;
    this.error.set(null);
    this.state.set('connecting');
    void this.init(this.id());
  }

  /** Coach: avvia/ferma la registrazione (lo stato REC arriva poi via evento). */
  protected toggleRecording(): void {
    if (this.recPending()) return;
    this.recPending.set(true);
    const id = this.id();
    const req$ = this.recording()
      ? this.liveApi.stopRecording(id)
      : this.liveApi.startRecording(id);
    req$.subscribe({
      next: () => this.recPending.set(false),
      error: () => {
        this.recPending.set(false);
        this.toast.error('Operazione di registrazione non riuscita.');
      },
    });
  }

  /**
   * Aggiorna lo stato REC e il timer di durata. `anchorIso` (dal backend) è
   * l'inizio REALE della registrazione: usato quando si entra a registrazione già
   * in corso, così il timer non riparte dall'ingresso. Per le transizioni
   * osservate dal vivo in stanza l'ancora è assente → si usa Date.now().
   */
  private applyRecording(active: boolean, anchorIso?: string | null): void {
    const was = this.recording();
    this.recording.set(active);
    // annuncio sr-only solo sulle transizioni reali (non il conteggio al secondo)
    if (active && !was) this.recAnnounce.set('Registrazione avviata');
    else if (!active && was) this.recAnnounce.set('Registrazione terminata');
    if (active) {
      if (!this.recTimer) {
        const anchorMs = anchorIso ? Date.parse(anchorIso) : NaN;
        this.recStartMs = Number.isFinite(anchorMs) ? anchorMs : Date.now();
        this.tickRec();
        this.recTimer = setInterval(() => this.tickRec(), 1000);
      }
    } else if (this.recTimer) {
      clearInterval(this.recTimer);
      this.recTimer = null;
      this.recElapsed.set('');
    }
  }

  private tickRec(): void {
    // clamp a 0: un'ancora di pochi secondi nel futuro (skew di clock col server)
    // non deve produrre un tempo negativo.
    const s = Math.max(0, Math.floor((Date.now() - this.recStartMs) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    this.recElapsed.set(
      h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`,
    );
  }

  /** Coach: termina la live per tutti (chiude la stanza), poi torna alla lista. */
  protected doEndLive(): void {
    this.cancelConfirm();
    if (this.endingLive()) return;
    this.endingLive.set(true);
    this.liveApi.endLive(this.id()).subscribe({
      next: () => void this.router.navigate(['/live']),
      error: () => {
        this.endingLive.set(false);
        this.toast.error('Impossibile terminare la live.');
      },
    });
  }

  protected leave(): void {
    void this.router.navigate(['/live']);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.recTimer) clearInterval(this.recTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.titleBase) document.title = this.titleBase;
    void this.audioCtx?.close();
    this.tiles.clear();
    void this.room?.disconnect();
    this.room = null;
  }
}
