import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LiveAttendanceReport,
  LiveRoomToken,
  LiveSession,
  LiveSessionPayload,
  PublishRecordingPayload,
} from '../models/api.models';

const API = environment.API_URL;

/** Sessioni live: lettura per tutti gli autenticati, mutazioni ADMIN. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly http = inject(HttpClient);

  /**
   * Sessioni: di default solo imminenti/in corso (vista utente). Con
   * includePast l'admin riceve anche le passate (per gestirle).
   */
  getSessions(includePast = false): Observable<LiveSession[]> {
    let params = new HttpParams();
    if (includePast) params = params.set('includePast', 'true');
    return this.http.get<LiveSession[]>(`${API}/live`, { params });
  }

  /**
   * Token per entrare in una stanza on-site (solo sessioni LIVEKIT). Va richiesto
   * via XHR (l'interceptor allega il Bearer): l'access-token in memoria non può
   * cavalcare una navigation, quindi NON si naviga a un URL del backend.
   */
  getRoomToken(id: string, consent = false): Observable<LiveRoomToken> {
    const params = consent
      ? new HttpParams().set('consent', 'true')
      : undefined;
    return this.http.get<LiveRoomToken>(`${API}/live/${id}/room-token`, {
      params,
    });
  }

  // ----- Moderazione stanza (Fase 2) -----

  /** Coach: (ri)dà il permesso di pubblicazione a uno studente (es. microfono). */
  promote(
    id: string,
    body: { targetUserId: string; sources?: ('mic' | 'cam' | 'screen')[] },
  ): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/promote`, body);
  }

  /** Coach: revoca la parola. */
  demote(id: string, targetUserId: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/demote`, { targetUserId });
  }

  /** Coach: muta una traccia pubblicata. */
  mute(
    id: string,
    body: { targetUserId: string; trackSid: string },
  ): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/mute`, body);
  }

  /** Coach: espelle un partecipante. */
  kick(id: string, targetUserId: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/kick`, { targetUserId });
  }

  /** Coach: concede/revoca la condivisione schermo (+webcam) a un partecipante. */
  grantScreen(id: string, targetUserId: string, on: boolean): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/grant-screen`, { targetUserId, on });
  }

  /** Coach: toglie il microfono a tutti (tranne sé). */
  muteAll(id: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/mute-all`, {});
  }

  /** Coach: termina la live (chiude la stanza per tutti). */
  endLive(id: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/end`, {});
  }

  /** Coach: avvia la registrazione della sessione. */
  startRecording(id: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/recording/start`, {});
  }

  /** Coach: ferma la registrazione in corso. */
  stopRecording(id: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/recording/stop`, {});
  }

  /** Coach/admin: riprocessa una registrazione fallita. */
  retryRecording(id: string): Observable<unknown> {
    return this.http.post(`${API}/live/${id}/recording/retry`, {});
  }

  /**
   * Coach/admin: pubblica una registrazione pronta (READY) come lezione VOD.
   * Il payload sono le correzioni del pannello (titolo, tag, tier, avvisi…):
   * omesso, la lezione resta derivata dalla sessione come prima.
   */
  publishRecording(
    id: string,
    payload: PublishRecordingPayload = {},
  ): Observable<{ ok: true; lessonId: string }> {
    return this.http.post<{ ok: true; lessonId: string }>(
      `${API}/live/${id}/recording/publish`,
      payload,
    );
  }

  /**
   * Admin: registro presenze di una sessione on-site. Le sessioni EXTERNAL non
   * lasciano segnale lato sito e rispondono 400 (non un elenco vuoto, che si
   * leggerebbe come "non è venuto nessuno").
   */
  getAttendance(id: string): Observable<LiveAttendanceReport> {
    return this.http.get<LiveAttendanceReport>(`${API}/live/${id}/attendance`);
  }

  create(payload: LiveSessionPayload): Observable<LiveSession> {
    return this.http.post<LiveSession>(`${API}/live`, payload);
  }

  update(
    id: string,
    payload: Partial<LiveSessionPayload>,
  ): Observable<LiveSession> {
    return this.http.patch<LiveSession>(`${API}/live/${id}`, payload);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/live/${id}`);
  }
}
