import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DrillAnswerResult,
  DrillConfigPayload,
  DrillHistory,
  DrillNextQuestion,
  DrillQuestion,
  DrillSessionsPage,
  DrillSessionView,
  DrillStats,
} from '../models/api.models';

const API = environment.API_URL;

/** Una risposta data, con la domanda che l'ha generata (riepilogo di sessione). */
export interface DrillAnswerLog {
  question: DrillQuestion;
  result: DrillAnswerResult;
}

export type DrillPhase =
  | 'idle'
  | 'loading'
  | 'answering'
  | 'feedback'
  | 'finished';

/**
 * Stato della sessione di allenamento. Vive nel service (root) perché le tre
 * schermate (config / runner / risultati) sono route lazy distinte: lo stato
 * deve sopravvivere ai cambi di rotta. Le chiamate ai nodi NON passano da qui
 * (la domanda arriva redatta da /drills/*); il reveal post-risposta usa il
 * PreflopService come il viewer.
 */
@Injectable({ providedIn: 'root' })
export class DrillService {
  private readonly http = inject(HttpClient);

  readonly config = signal<DrillConfigPayload | null>(null);
  readonly sessionId = signal<string | null>(null);
  readonly total = signal(0);
  readonly served = signal(0);
  readonly question = signal<DrillQuestion | null>(null);
  readonly phase = signal<DrillPhase>('idle');
  readonly lastResult = signal<DrillAnswerResult | null>(null);
  readonly answers = signal<DrillAnswerLog[]>([]);
  readonly errorMsg = signal<string | null>(null);
  /** true mentre l'invio della risposta è in corso (blocca il doppio click). */
  readonly submitting = signal(false);

  readonly hasSession = computed(() => this.sessionId() !== null);
  readonly answeredCount = computed(() => this.answers().length);

  // ── chiamate REST ─────────────────────────────────────────────────────────

  private startSession(payload: DrillConfigPayload): Observable<DrillSessionView> {
    return this.http.post<DrillSessionView>(`${API}/drills/sessions`, payload);
  }

  private fetchNext(id: string): Observable<DrillNextQuestion> {
    return this.http.get<DrillNextQuestion>(`${API}/drills/sessions/${id}/next`);
  }

  private postAnswer(
    id: string,
    questionId: string,
    chosenCode: string,
  ): Observable<DrillAnswerResult> {
    return this.http.post<DrillAnswerResult>(
      `${API}/drills/sessions/${id}/answer`,
      { questionId, chosenCode },
    );
  }

  endSession(id: string): Observable<DrillSessionView> {
    return this.http.post<DrillSessionView>(
      `${API}/drills/sessions/${id}/end`,
      {},
    );
  }

  getStats(): Observable<DrillStats> {
    return this.http.get<DrillStats>(`${API}/drills/stats`);
  }

  getHistory(page = 1, limit = 20, format?: string): Observable<DrillHistory> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (format) params = params.set('format', format);
    return this.http.get<DrillHistory>(`${API}/drills/history`, { params });
  }

  getSessions(page = 1, limit = 50): Observable<DrillSessionsPage> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<DrillSessionsPage>(`${API}/drills/sessions`, { params });
  }

  // ── orchestrazione ────────────────────────────────────────────────────────

  /** Avvia una nuova sessione con la config scelta e carica la prima domanda. */
  begin(payload: DrillConfigPayload): void {
    this.reset();
    this.config.set(payload);
    this.phase.set('loading');
    this.startSession(payload).subscribe({
      next: (s) => {
        this.sessionId.set(s.id);
        this.total.set(s.questionsPerSession);
        this.loadNext();
      },
      error: (err) => {
        this.phase.set('idle');
        // il backend rifiuta le config senza spot con un 400 + messaggio chiaro
        this.errorMsg.set(
          err?.error?.message ?? 'Impossibile avviare la sessione. Riprova.',
        );
      },
    });
  }

  /** Chiede la prossima domanda; se la sessione è finita passa a 'finished'. */
  loadNext(): void {
    const id = this.sessionId();
    if (!id) return;
    this.phase.set('loading');
    this.lastResult.set(null);
    this.fetchNext(id).subscribe({
      next: (r) => {
        this.served.set(r.served);
        this.total.set(r.total);
        if (r.finished || !r.question) {
          this.phase.set('finished');
          return;
        }
        this.question.set(r.question);
        this.phase.set('answering');
      },
      error: (err) => {
        // 503 = config senza spot allenabili (usa il messaggio del backend);
        // altro = problema di rete/server
        this.errorMsg.set(
          err?.status === 503
            ? (err?.error?.message ??
                'Nessuno spot allenabile per questa configurazione.')
            : 'Errore di rete nel caricare la domanda. Riprova.',
        );
        this.phase.set('idle');
      },
    });
  }

  /** Invia la risposta; al ritorno mostra il feedback. */
  answer(chosenCode: string): void {
    const id = this.sessionId();
    const q = this.question();
    if (!id || !q || this.phase() !== 'answering' || this.submitting()) return;
    this.submitting.set(true);
    this.errorMsg.set(null);
    this.postAnswer(id, q.questionId, chosenCode).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.lastResult.set(res);
        this.answers.update((a) => [...a, { question: q, result: res }]);
        this.phase.set('feedback');
      },
      error: () => {
        this.submitting.set(false);
        this.errorMsg.set('Errore nel salvataggio della risposta. Riprova.');
      },
    });
  }

  /** Avanza dopo il feedback: true se la sessione è conclusa. */
  advance(): boolean {
    if (this.lastResult()?.finished) {
      this.phase.set('finished');
      return true;
    }
    this.loadNext();
    return false;
  }

  reset(): void {
    this.sessionId.set(null);
    this.question.set(null);
    this.lastResult.set(null);
    this.answers.set([]);
    this.served.set(0);
    this.total.set(0);
    this.phase.set('idle');
    this.errorMsg.set(null);
    this.submitting.set(false);
  }
}
