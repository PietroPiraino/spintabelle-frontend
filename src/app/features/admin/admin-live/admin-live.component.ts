import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LESSON_CATEGORIES,
  LESSON_CATEGORY_LABELS,
  LessonCategory,
  LessonStakes,
  LiveMode,
  LiveSession,
  LiveSessionPayload,
} from '../../../core/models/api.models';
import { LessonsService } from '../../../core/services/lessons.service';
import { LiveService } from '../../../core/services/live.service';
import { TagPickerComponent } from '../../../shared/ui/tag-picker/tag-picker.component';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  orologio,
  quandoManca,
  statoSessione,
  StatoSessione,
} from '../../../shared/live/stato-sessione';

@Component({
  selector: 'app-admin-live',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    TagPickerComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './admin-live.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLiveComponent {
  private readonly fb = inject(FormBuilder);
  private readonly liveApi = inject(LiveService);
  private readonly lessonsApi = inject(LessonsService);

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);

  /** L'orologio condiviso con la pagina pubblica. */
  private readonly adesso = orologio();

  protected stato(s: LiveSession): StatoSessione {
    return statoSessione(s, this.adesso());
  }

  protected quando(s: LiveSession): string {
    return quandoManca(s, this.adesso());
  }

  /**
   * Le sessioni in programma e in corso, dalla più IMMINENTE.
   *
   * ⚠️ Il server ordina `{startsAt: -1}` quando l'admin chiede `includePast`,
   * cioè le passate finivano SOPRA le future: aprendo la sezione si vedeva
   * l'archivio e bisognava scorrere per trovare la prossima live. Qui l'ordine
   * si ricompone lato client perché «prima le future crescenti, poi le passate
   * decrescenti» non è esprimibile in un solo `.sort()` di Mongo — servirebbero
   * due query o un'aggregazione, per un elenco che il server tronca comunque a
   * 200 righe.
   */
  protected readonly prossime = computed(() =>
    (this.sessions() ?? [])
      .filter((s) => this.stato(s) !== 'terminata')
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
  );

  /**
   * Le passate, dalla più recente, in un blocco richiudibile.
   *
   * ⚠️ Richiuse ma NON nascoste dietro un filtro: è da qui che si pubblicano i
   * VOD, e con un filtro segmentato una registrazione pronta non si vedrebbe
   * finché non si cambia vista. Il conteggio nel riassunto è ciò che dice se
   * vale la pena aprirlo.
   */
  protected readonly passate = computed(() =>
    (this.sessions() ?? [])
      .filter((s) => this.stato(s) === 'terminata')
      .sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      ),
  );

  /** Quante passate hanno una registrazione pronta da pubblicare. */
  protected readonly daPubblicare = computed(
    () => this.passate().filter((s) => s.recordingState === 'READY').length,
  );

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    description: ['', [Validators.maxLength(2000)]],
    // ⚠️ Precompilata su «Sessioni dal vivo» ma modificabile: è la categoria in
    // cui gli studenti cercano una registrazione, anche quando la sessione
    // parlava di preflop. Il backend applica lo stesso ripiego se non arriva.
    categoria: ['sessioni-live' as LessonCategory, Validators.required],
    stakes: ['LOW' as LessonStakes, Validators.required],
    startsAt: ['', Validators.required],
    durationMin: [60],
    platform: ['', [Validators.maxLength(80)]],
    mode: ['EXTERNAL' as LiveMode, Validators.required],
    recordingEnabled: [false],
    joinUrl: [
      '',
      [Validators.required, Validators.pattern(/^https?:\/\/.+/)],
    ],
  });

  /**
   * ⚠️ `sporco` da `toSignal(valueChanges)` e mai da un `computed` che legge
   * `form.value`: un FormGroup non è un signal, quindi quel computed non si
   * ricalcola mai e resterebbe `false` per sempre — Escape butterebbe via il
   * digitato, cioè il difetto che l'input previene.
   */
  private readonly baseline = signal('');
  private readonly valori = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as Record<string, unknown>,
  });
  protected readonly sporco = computed(
    () => JSON.stringify(this.valori()) !== this.baseline(),
  );

  /** La modale del form è aperta: `null` chiusa, `''` creazione, id modifica. */
  protected readonly formAperto = signal<string | null>(null);

  /**
   * La sessione in modifica e quella in pubblicazione, RILETTE dall'elenco.
   *
   * ⚠️ Mai una copia congelata: dopo un salvataggio `load()` sostituisce
   * l'array, e una copia mostrerebbe lo stato di prima sotto il titolo nuovo —
   * qui pesa doppio, perché `recordingState` decide quali comandi compaiono.
   */
  protected readonly sessioneAperta = computed(() => {
    const id = this.editingId();
    if (!id) return null;
    return this.sessions()?.find((s) => s.id === id) ?? null;
  });

  protected readonly sessionePub = computed(() => {
    const id = this.publishPanelId();
    if (!id) return null;
    return this.sessions()?.find((s) => s.id === id) ?? null;
  });

  protected creaNuova(): void {
    this.editingId.set(null);
    this.form.reset({
      stakes: 'LOW',
      durationMin: 60,
      mode: 'EXTERNAL',
      recordingEnabled: false,
    });
    this.setJoinUrlValidators('EXTERNAL');
    this.error.set(null);
    this.feedback.set(null);
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
    this.formAperto.set('');
  }

  constructor() {
    this.load();
  }

  /** joinUrl è obbligatorio solo per le sessioni EXTERNAL; LIVEKIT lo ignora. */
  private setJoinUrlValidators(mode: LiveMode): void {
    const c = this.form.controls.joinUrl;
    c.setValidators(
      mode === 'EXTERNAL'
        ? [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
        : [],
    );
    c.updateValueAndValidity();
  }

  protected onModeChange(): void {
    this.setJoinUrlValidators(this.form.controls.mode.value);
  }

  private load(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    // includePast: l'admin vede e gestisce anche le sessioni passate
    this.liveApi.getSessions(true).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.listLoading.set(false);
      },
      error: (err: unknown) => {
        this.listLoading.set(false);
        this.listError.set(
          apiErrorMessage(err, 'Caricamento sessioni non riuscito.'),
        );
      },
    });
  }

  /** ISO → valore per input[type=datetime-local] in ora LOCALE. */
  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  protected edit(session: LiveSession): void {
    this.editingId.set(session.id);
    this.feedback.set(null);
    this.error.set(null);
    this.form.patchValue({
      title: session.title,
      description: session.description ?? '',
      categoria: 'sessioni-live',
      stakes: session.stakes,
      startsAt: this.toLocalInput(session.startsAt),
      durationMin: session.durationMin ?? 60,
      platform: session.platform ?? '',
      mode: session.mode,
      recordingEnabled: session.recordingEnabled ?? false,
      joinUrl: session.joinUrl ?? '',
    });
    this.setJoinUrlValidators(session.mode);
    // ⚠️ La baseline si scrive DOPO il patch, o la modale nasce già sporca e
    // il primo Escape chiede conferma senza che si sia digitato nulla.
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
    this.formAperto.set(session.id);
  }

  protected cancelEdit(): void {
    this.formAperto.set(null);
    this.confermaElimina.set(false);
    this.editingId.set(null);
    this.form.reset({
      stakes: 'LOW',
      durationMin: 60,
      mode: 'EXTERNAL',
      recordingEnabled: false,
    });
    this.setJoinUrlValidators('EXTERNAL');
    this.error.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);

    const v = this.form.getRawValue();
    const payload: LiveSessionPayload = {
      title: v.title,
      description: v.description.trim() || undefined,
      stakes: v.stakes,
      // datetime-local (ora locale) → ISO UTC
      startsAt: new Date(v.startsAt).toISOString(),
      durationMin: v.durationMin || undefined,
      platform: v.platform.trim() || undefined,
      mode: v.mode,
      // joinUrl solo per EXTERNAL; LIVEKIT genera la stanza on-site lato backend
      joinUrl: v.mode === 'EXTERNAL' ? v.joinUrl : undefined,
      // registrazione solo per LIVEKIT
      recordingEnabled: v.mode === 'LIVEKIT' ? v.recordingEnabled : undefined,
    };

    const id = this.editingId();
    const request$ = id
      ? this.liveApi.update(id, payload)
      : this.liveApi.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        // ⚠️ Prima si chiude, poi si scrive: la banda di successo vive nella
        // PAGINA, e scriverla col dialog aperto la metterebbe dietro il
        // fondale (il `<dialog>` è in top layer).
        this.cancelEdit();
        this.feedback.set(id ? 'Sessione aggiornata.' : 'Sessione creata.');
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  /**
   * ⚠️ Conferma IN LINEA al posto del `confirm()` nativo: quello è un riquadro
   * di sistema che non si stila, non si legge nel contesto della modale, e su
   * alcune configurazioni il browser lo sopprime — nel qual caso il ramo
   * «annulla» non è raggiungibile e la sessione sparisce al primo clic.
   */
  protected readonly confermaElimina = signal(false);

  protected remove(session: LiveSession): void {
    this.confermaElimina.set(false);
    this.saving.set(true);
    this.liveApi.remove(session.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelEdit();
        this.feedback.set('Sessione eliminata.');
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.'));
      },
    });
  }

  /** Etichetta leggibile dello stato registrazione. */
  protected recLabel(state: string | undefined): string {
    return (
      {
        STARTING: 'in avvio',
        ACTIVE: 'in corso',
        PROCESSING: 'in elaborazione',
        READY: 'pronta da pubblicare',
        DONE: 'pubblicata',
        FAILED: 'fallita',
      }[state ?? ''] ?? state ?? ''
    );
  }

  /** Riprocessa una registrazione fallita (rifà ingest dal file su R2). */
  protected retryRecording(session: LiveSession): void {
    this.feedback.set(null);
    this.error.set(null);
    this.liveApi.retryRecording(session.id).subscribe({
      next: () => {
        this.feedback.set('Riprocessamento avviato.');
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Riprocessamento non riuscito.')),
    });
  }

  // ── Pubblicazione della registrazione come lezione ──────────────────────--
  //
  // Pannello inline (idioma .admin-panel di admin-users): il titolo e la
  // descrizione della live diventano quelli della lezione quasi mai tali e
  // quali, e i tag prima non erano proponibili affatto. Precompilare qui
  // sostituisce il giro "modifica live → salva → pubblica → tab Lezioni →
  // modifica per i tag".

  /** Sessione con il pannello di pubblicazione aperto (una alla volta). */
  protected readonly publishPanelId = signal<string | null>(null);
  protected readonly categorie = LESSON_CATEGORIES;
  protected readonly categoryLabels = LESSON_CATEGORY_LABELS;
  protected readonly knownTags = signal<string[]>([]);
  protected readonly selectedTags = signal<string[]>([]);

  protected readonly publishForm = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    description: ['', [Validators.maxLength(2000)]],
    // ⚠️ Precompilata su «Sessioni dal vivo» ma modificabile: è la categoria in
    // cui gli studenti cercano una registrazione, anche quando la sessione
    // parlava di preflop. Il backend applica lo stesso ripiego se non arriva.
    categoria: ['sessioni-live' as LessonCategory, Validators.required],
    stakes: ['LOW' as LessonStakes, Validators.required],
    freePreview: [false],
    videoDate: ['', Validators.required],
    // avvisa = @everyone su Discord + email agli abbonati del tier
    notify: [true],
  });

  protected openPublish(session: LiveSession): void {
    this.feedback.set(null);
    this.error.set(null);
    this.publishForm.reset({
      title: session.title,
      description: session.description ?? '',
      categoria: 'sessioni-live',
      stakes: session.stakes,
      freePreview: false,
      // data della live: nella grande maggioranza dei casi è già quella giusta
      videoDate: session.startsAt.slice(0, 10),
      notify: true,
    });
    // 'live' è il marcatore di sistema: il backend lo aggiunge comunque, qui è
    // pre-selezionato perché si veda che ci sarà.
    this.selectedTags.set(['live']);
    this.publishPanelId.set(session.id);
    if (this.knownTags().length === 0)
      this.lessonsApi.getTags().subscribe({
        next: (tags) => this.knownTags.set(tags),
      });
  }

  protected closePublish(): void {
    this.publishPanelId.set(null);
  }

  /** Pubblica la registrazione con le correzioni del pannello. */
  protected confirmPublish(session: LiveSession): void {
    if (this.publishing()) return;
    if (this.publishForm.invalid) {
      this.publishForm.markAllAsTouched();
      return;
    }
    this.publishing.set(true);
    this.feedback.set(null);
    this.error.set(null);

    const v = this.publishForm.getRawValue();
    this.liveApi
      .publishRecording(session.id, {
        title: v.title.trim(),
        description: v.description.trim() || undefined,
        categoria: v.categoria,
        stakes: v.stakes,
        freePreview: v.freePreview,
        videoDate: v.videoDate,
        // il marcatore 'live' lo aggiunge il backend: non serve rimandarlo
        tags: this.selectedTags().filter((t) => t !== 'live'),
        notify: v.notify,
      })
      .subscribe({
        next: () => {
          this.publishing.set(false);
          this.closePublish();
          this.feedback.set(
            v.notify
              ? `Pubblicata come lezione: "${v.title.trim()}". Avviso inviato.`
              : `Pubblicata come lezione: "${v.title.trim()}" (senza avvisi).`,
          );
          this.load();
        },
        error: (err: unknown) => {
          this.publishing.set(false);
          this.error.set(apiErrorMessage(err, 'Pubblicazione non riuscita.'));
        },
      });
  }
}
