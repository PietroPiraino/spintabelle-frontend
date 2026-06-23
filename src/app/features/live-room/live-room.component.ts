import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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

type RoomState = 'connecting' | 'connected' | 'denied' | 'error';
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
}

/**
 * Sala live on-site (LIVEKIT). Recupera il token via XHR (gate per tier lato
 * backend → 403 se non hai il tier), poi connette la stanza con il core
 * livekit-client caricato lazy. Il pubblico guarda + chatta; il coach trasmette
 * camera/microfono/schermo. Moderazione (alza-mano, dai/togli parola) = Fase 2.
 */
@Component({
  selector: 'app-live-room',
  imports: [RouterLink],
  templateUrl: './live-room.component.html',
  styleUrl: './live-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveRoomComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly liveApi = inject(LiveService);
  private readonly loadLiveKit = inject(LIVEKIT_LOADER);

  private readonly stageRef =
    viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly audioRef =
    viewChild<ElementRef<HTMLDivElement>>('audioSink');

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
  // rifiniture: identità locale, chi sta parlando, presenza di uno schermo condiviso
  protected readonly myIdentity = signal('');
  protected readonly speaking = signal<Set<string>>(new Set());
  protected readonly hasScreen = signal(false);

  private room: Room | null = null;
  private lk: typeof import('livekit-client') | null = null;
  private disposed = false;
  private krispDone = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.id.set(id);
    afterNextRender(() => void this.init(id));
  }

  private async init(id: string): Promise<void> {
    if (!id) {
      this.fail('Sessione non valida.');
      return;
    }
    try {
      const tok = await firstValueFrom(this.liveApi.getRoomToken(id));
      this.role.set(tok.role);
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
          (track: Track, _pub: unknown, p: { identity: string }) =>
            this.attach(track, p.identity),
        )
        .on(LK.RoomEvent.TrackUnsubscribed, (track: Track) => this.detach(track))
        .on(LK.RoomEvent.LocalTrackPublished, (pub) => {
          if (!pub.track) return;
          if (pub.track.kind === 'video') {
            this.attach(pub.track, room.localParticipant.identity);
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
        .on(LK.RoomEvent.ParticipantAttributesChanged, () =>
          this.rebuildRoster(),
        )
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
            // se cambiano i MIEI permessi (microfono tolto/ridato), aggiorna i controlli
            if (participant?.identity === room.localParticipant.identity) {
              this.canPublishNow.set(!!room.localParticipant.permissions?.canPublish);
            }
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
        .on(LK.RoomEvent.Disconnected, () => {
          if (this.disposed) return;
          this.fail('Disconnesso dalla sala live.');
        });

      await room.connect(tok.url, tok.token);
      if (this.disposed) {
        void room.disconnect();
        return;
      }
      this.state.set('connected');
      this.myIdentity.set(room.localParticipant.identity);
      this.refreshCount();
      this.rebuildRoster();
      // il pubblico nasce con il permesso microfono (tavola rotonda); il coach
      // può revocarlo → questo flag pilota la visibilità del bottone microfono.
      this.canPublishNow.set(!!room.localParticipant.permissions?.canPublish);
    } catch (err: unknown) {
      if (this.disposed) return;
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        this.state.set('denied');
        return;
      }
      if (status === 400) {
        this.fail('Questa sessione non usa la sala on-site.');
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

  private attach(track: Track, identity: string): void {
    const el = track.attach();
    if (track.kind === 'video') {
      const isScreen = track.source === this.lk?.Track.Source.ScreenShare;
      el.classList.add('live-room__video', isScreen ? 'is-screen' : 'is-cam');
      el.dataset['identity'] = identity;
      el.dataset['sid'] = track.sid ?? '';
      if (this.speaking().has(identity)) el.classList.add('is-speaking');
      this.stageRef()?.nativeElement.appendChild(el);
      this.hasVideo.set(true);
      if (isScreen) this.hasScreen.set(true);
    } else {
      this.audioRef()?.nativeElement.appendChild(el);
    }
  }

  private detach(track: Track): void {
    // track.detach() può restituire vuoto se l'SDK ha già staccato il media
    // all'unsubscribe/unpublish (lasciando però l'elemento NEL DOM, nero):
    // rimuovo anche per sid così il tile sparisce sempre (schermo, webcam, remoti).
    track.detach().forEach((el) => el.remove());
    const sid = track.sid;
    if (sid) {
      this.stageRef()
        ?.nativeElement.querySelectorAll(`[data-sid="${sid}"]`)
        .forEach((el) => el.remove());
    }
    if (track.kind === 'video') this.recomputeStage();
  }

  /** Ricalcola la presenza di video / schermo (solo i tile VISIBILI). */
  private recomputeStage(): void {
    const stage = this.stageRef()?.nativeElement;
    this.hasVideo.set(
      !!stage && stage.querySelector('video:not([hidden])') !== null,
    );
    this.hasScreen.set(
      !!stage && stage.querySelector('.is-screen:not([hidden])') !== null,
    );
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
      ?.nativeElement.querySelectorAll<HTMLElement>(`video[data-sid="${sid}"]`)
      .forEach((el) => (el.hidden = muted));
    this.recomputeStage();
  }

  /** Chi sta parlando: aggiorna il set + il bordo sui tile video. */
  private onActiveSpeakers(speakers: { identity: string }[]): void {
    const set = new Set(speakers.map((s) => s.identity));
    this.speaking.set(set);
    const stage = this.stageRef()?.nativeElement;
    stage?.querySelectorAll('.live-room__video').forEach((el) => {
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
      const video = (stage.querySelector('.is-screen') ??
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
      };
      if (parsed?.t === 'chat' && typeof parsed.m === 'string') {
        const from = participant?.name || participant?.identity || 'Utente';
        this.messages.update((l) => [
          ...l,
          { from, text: parsed.m as string, me: false },
        ]);
      }
    } catch {
      // payload non-chat: ignora
    }
  }

  protected sendChat(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text || !this.room) return;
    const data = new TextEncoder().encode(JSON.stringify({ t: 'chat', m: text }));
    void this.room.localParticipant.publishData(data, { reliable: true });
    this.messages.update((l) => [
      ...l,
      { from: this.room?.localParticipant.name || 'Tu', text, me: true },
    ]);
    input.value = '';
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
        // contentHint 'detail' = priorità alla nitidezza (testo/tavoli) sulla fluidità
        await lp.setScreenShareEnabled(on, { audio: true, contentHint: 'detail' });
        this.screenOn.set(on);
      }
    } catch {
      this.error.set(
        'Permesso negato: consenti fotocamera/microfono/schermo per trasmettere.',
      );
    }
  }

  protected async enableAudio(): Promise<void> {
    await this.room?.startAudio();
    this.needAudioGesture.set(false);
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
      });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    this.roster.set(list);
  }

  /** Mostra i controlli di pubblicazione: coach, o pubblico promosso dal coach. */
  protected canPublish(): boolean {
    return this.role() === 'coach' || this.canPublishNow();
  }

  /** Ridà il microfono a uno studente a cui era stato revocato. */
  protected promote(identity: string): void {
    this.liveApi
      .promote(this.id(), { targetUserId: identity, sources: ['mic'] })
      .subscribe({
        error: () => this.error.set('Impossibile ridare il microfono.'),
      });
  }

  protected demote(identity: string): void {
    this.liveApi.demote(this.id(), identity).subscribe({
      error: () => this.error.set('Impossibile revocare la parola.'),
    });
  }

  protected muteParticipant(identity: string): void {
    const rp = this.room?.remoteParticipants.get(identity);
    const sid = this.lk
      ? rp?.getTrackPublication(this.lk.Track.Source.Microphone)?.trackSid
      : undefined;
    if (!sid) {
      this.error.set('Nessuna traccia audio da mutare per questo partecipante.');
      return;
    }
    this.liveApi.mute(this.id(), { targetUserId: identity, trackSid: sid }).subscribe({
      error: () => this.error.set('Mute non riuscito.'),
    });
  }

  protected kick(identity: string): void {
    if (!confirm('Espellere questo partecipante dalla stanza?')) return;
    this.liveApi.kick(this.id(), identity).subscribe({
      error: () => this.error.set('Impossibile espellere.'),
    });
  }

  protected leave(): void {
    void this.router.navigate(['/live']);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    void this.room?.disconnect();
    this.room = null;
  }
}
