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

  private room: Room | null = null;
  private disposed = false;

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

      const room = new LK.Room({ adaptiveStream: true, dynacast: true });
      this.room = room;

      room
        .on(LK.RoomEvent.TrackSubscribed, (track: Track) => this.attach(track))
        .on(LK.RoomEvent.TrackUnsubscribed, (track: Track) => this.detach(track))
        .on(LK.RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.track) this.attach(pub.track);
        })
        .on(LK.RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.track) this.detach(pub.track);
        })
        .on(LK.RoomEvent.ParticipantConnected, () => this.refreshCount())
        .on(LK.RoomEvent.ParticipantDisconnected, () => this.refreshCount())
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
      this.refreshCount();
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
    if (this.room) this.participants.set(this.room.numParticipants + 1);
  }

  private attach(track: Track): void {
    const el = track.attach();
    if (track.kind === 'video') {
      el.classList.add('live-room__video');
      this.stageRef()?.nativeElement.appendChild(el);
      this.hasVideo.set(true);
    } else {
      this.audioRef()?.nativeElement.appendChild(el);
    }
  }

  private detach(track: Track): void {
    track.detach().forEach((el) => el.remove());
    if (track.kind === 'video') {
      const stage = this.stageRef()?.nativeElement;
      this.hasVideo.set(!!stage && stage.querySelector('video') !== null);
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
        await lp.setCameraEnabled(on);
        this.camOn.set(on);
      } else if (what === 'mic') {
        const on = !this.micOn();
        await lp.setMicrophoneEnabled(on);
        this.micOn.set(on);
      } else {
        const on = !this.screenOn();
        await lp.setScreenShareEnabled(on, { audio: true });
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

  protected leave(): void {
    void this.router.navigate(['/live']);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    void this.room?.disconnect();
    this.room = null;
  }
}
