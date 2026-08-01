import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AffiliationAdmin,
  AffiliationIdentifierPayload,
  AffiliationRequestPayload,
  AffiliationResendResult,
  AffiliationStatus,
  AffiliationsPendingCount,
  MyAffiliation,
  MyAffiliationRequest,
  Paginated,
  PokerRoom,
  PokerRoomAdmin,
  PokerRoomPayload,
  PokerRoomRemoved,
  PokerRoomUpdatePayload,
  PokerRoomUpdated,
} from '../models/api.models';

const API = environment.API_URL;

/** Paginazione del catalogo sale (vetrina utente e elenco admin). */
export interface PokerRoomListOpts {
  page?: number;
  limit?: number;
}

/** Filtri della coda admin (applicati dal backend). */
export interface AffiliationListOpts {
  page?: number;
  limit?: number;
  /** default lato server: `IN_VERIFICA` (le righe da decidere) */
  status?: AffiliationStatus;
  roomId?: string;
  /** ricerca su email/nickname/username dichiarato/codice di riferimento */
  q?: string;
}

/**
 * Programma di affiliazione: rotte utente (`/affiliations`) e admin
 * (`/admin/affiliations`).
 *
 * ⚠️ Tutte richiedono il JWT — anche la vetrina delle sale: i marchi degli
 * operatori stanno dietro login e non finiscono nell'HTML prerenderizzato.
 *
 * ⚠️ Gli errori si leggono SEMPRE con `apiErrorMessage(err, fallback)`
 * (`core/utils/http-error.ts`): il backend risponde con messaggi italiani già
 * pronti — cooldown coi minuti residui, tetto delle richieste aperte con la via
 * d'uscita, username già collegato a un altro account — e un `err.message`
 * grezzo li butterebbe via proprio dove servono.
 */
@Injectable({ providedIn: 'root' })
export class AffiliationsService {
  private readonly http = inject(HttpClient);

  // ── Utente ──

  /**
   * Vetrina: solo le sale attive, nell'ordine deciso dall'admin.
   *
   * Envelope paginato dal primo giorno anche se la pagina lo carica intero: il
   * catalogo è piccolo, ma così la UI potrà impaginare senza un cambio rotto.
   */
  rooms(opts: PokerRoomListOpts = {}): Observable<Paginated<PokerRoom>> {
    return this.http.get<Paginated<PokerRoom>>(`${API}/affiliations/rooms`, {
      params: this.pageParams(opts, 50),
    });
  }

  /** "Dove sono tracciato / che cosa è in corso": alimenta card e /account. */
  mine(): Observable<MyAffiliation[]> {
    return this.http.get<MyAffiliation[]>(`${API}/affiliations/me`);
  }

  /**
   * Richiesta del link affiliato (tre spunte, nessun identificativo).
   *
   * La risposta porta `emailSent`: se è `false` la card deve mostrare comunque
   * il link in pagina e dirlo.
   */
  request(
    roomId: string,
    payload: AffiliationRequestPayload,
  ): Observable<MyAffiliationRequest> {
    return this.http.post<MyAffiliationRequest>(
      `${API}/affiliations/rooms/${roomId}/request`,
      payload,
    );
  }

  /**
   * Invio o correzione dell'identificativo dichiarato.
   *
   * ⚠️ `PUT`, non `POST`: sostituisce il valore ed è idempotente — prima
   * consegna, correzione, ripartenza dopo una revoca e riapertura dopo un
   * annullamento sono la stessa operazione.
   */
  submitIdentifier(
    roomId: string,
    payload: AffiliationIdentifierPayload,
  ): Observable<MyAffiliation> {
    return this.http.put<MyAffiliation>(
      `${API}/affiliations/rooms/${roomId}/identifier`,
      payload,
    );
  }

  /**
   * Rinvio dell'email (link o ricevuta, secondo lo stato della riga).
   *
   * 409 col cooldown quando è troppo presto: il messaggio del server porta i
   * minuti residui, quindi va mostrato invece di uno generico.
   */
  resend(roomId: string): Observable<AffiliationResendResult> {
    return this.http.post<AffiliationResendResult>(
      `${API}/affiliations/rooms/${roomId}/resend`,
      {},
    );
  }

  /**
   * Annullamento self-service, da qualunque stato e senza mai un 409 —
   * `APPROVATO` compreso. ⚠️ Non annulla il rapporto con la sala: smettiamo di
   * conservare i dati di collegamento, e la card deve dirlo in chiaro.
   */
  cancel(roomId: string): Observable<MyAffiliation> {
    return this.http.delete<MyAffiliation>(
      `${API}/affiliations/rooms/${roomId}`,
    );
  }

  // ── Admin ──

  /** Coda delle richieste (default lato server: `IN_VERIFICA`, 25/pagina). */
  adminList(
    opts: AffiliationListOpts = {},
  ): Observable<Paginated<AffiliationAdmin>> {
    let params = this.pageParams(opts, 25);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.roomId) params = params.set('roomId', opts.roomId);
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<Paginated<AffiliationAdmin>>(
      `${API}/admin/affiliations`,
      { params },
    );
  }

  /** Badge sul tab: quante righe aspettano una decisione. */
  pendingCount(): Observable<AffiliationsPendingCount> {
    return this.http.get<AffiliationsPendingCount>(
      `${API}/admin/affiliations/pending-count`,
    );
  }

  /** Approvazione (solo da `IN_VERIFICA`): la nota è facoltativa. */
  approve(id: string, note?: string): Observable<AffiliationAdmin> {
    return this.http.post<AffiliationAdmin>(
      `${API}/admin/affiliations/${id}/approve`,
      note === undefined ? {} : { note },
    );
  }

  /**
   * Rifiuto (solo da `IN_VERIFICA`). ⚠️ La nota è OBBLIGATORIA (min 3 caratteri):
   * la legge l'utente nell'email d'esito, e un rifiuto senza motivo è un vicolo
   * cieco che si trasforma in un messaggio di supporto.
   */
  reject(id: string, note: string): Observable<AffiliationAdmin> {
    return this.http.post<AffiliationAdmin>(
      `${API}/admin/affiliations/${id}/reject`,
      { note },
    );
  }

  /** Revoca (solo da `APPROVATO`): stessa nota obbligatoria del rifiuto. */
  revoke(id: string, note: string): Observable<AffiliationAdmin> {
    return this.http.post<AffiliationAdmin>(
      `${API}/admin/affiliations/${id}/revoke`,
      { note },
    );
  }

  /**
   * Rinvio dell'email dal pannello: dispaccia sullo stato della riga (link,
   * ricevuta o esito). È anche la riparazione dopo un template ruotato — vedi
   * `righeAperteConLinkPrecedente` su `updateRoom`. 409 su `ANNULLATO`: non c'è
   * nulla da rimandare, la riapertura è una richiesta dell'utente.
   */
  adminResend(id: string): Observable<AffiliationResendResult> {
    return this.http.post<AffiliationResendResult>(
      `${API}/admin/affiliations/${id}/resend`,
      {},
    );
  }

  /**
   * Nota INTERNA dell'owner. ⚠️ Campo separato da `note`: quella la legge
   * l'utente, questa non esce da nessuna vista utente né da nessuna email.
   */
  setAdminNote(id: string, adminNote: string): Observable<AffiliationAdmin> {
    return this.http.patch<AffiliationAdmin>(
      `${API}/admin/affiliations/${id}/note`,
      { adminNote },
    );
  }

  /**
   * Affiliazioni di un singolo utente: alimenta il pannello inline del tab
   * Iscritti. ⚠️ Vive su `/admin/users/:id/affiliations` (come `lesson-views`),
   * ma sta qui perché restituisce `AffiliationAdmin[]`: una seconda copia in
   * `admin-users.service.ts` sarebbe la stessa rotta con due tipi da tenere
   * allineati a mano.
   */
  forUser(userId: string): Observable<AffiliationAdmin[]> {
    return this.http.get<AffiliationAdmin[]>(
      `${API}/admin/users/${userId}/affiliations`,
    );
  }

  // ── Admin: catalogo sale ──

  /** Elenco admin: include le sale inattive. */
  adminRooms(
    opts: PokerRoomListOpts = {},
  ): Observable<Paginated<PokerRoomAdmin>> {
    return this.http.get<Paginated<PokerRoomAdmin>>(
      `${API}/admin/affiliations/rooms`,
      { params: this.pageParams(opts, 25) },
    );
  }

  /** Crea una sala (multipart; il logo è facoltativo). Nasce INATTIVA. */
  createRoom(
    payload: PokerRoomPayload,
    logo?: File,
  ): Observable<PokerRoomAdmin> {
    return this.http.post<PokerRoomAdmin>(
      `${API}/admin/affiliations/rooms`,
      this.toFormData(payload, logo),
    );
  }

  /**
   * Modifica una sala (multipart; logo assente = si tiene quello attuale).
   *
   * ⚠️ `slug` non è nel payload: è la chiave dei deep-link `?completa=<slug>` già
   * spediti, e il backend lo rifiuta. Se cambia `affiliateUrlTemplate` la
   * risposta porta `righeAperteConLinkPrecedente`: va stampato, altrimenti un
   * tracker ruotato è un guasto silenzioso.
   */
  updateRoom(
    id: string,
    payload: PokerRoomUpdatePayload,
    logo?: File,
  ): Observable<PokerRoomUpdated> {
    return this.http.patch<PokerRoomUpdated>(
      `${API}/admin/affiliations/rooms/${id}`,
      this.toFormData(payload, logo),
    );
  }

  /**
   * Elimina una sala. ⚠️ Con tracciamenti esistenti risponde **200** con
   * `disattivata:true` e il conteggio: è un successo da trattare come tale
   * (ricaricando l'elenco), non un errore.
   */
  removeRoom(id: string): Observable<PokerRoomRemoved> {
    return this.http.delete<PokerRoomRemoved>(
      `${API}/admin/affiliations/rooms/${id}`,
    );
  }

  // ── Interni ──

  private pageParams(
    opts: { page?: number; limit?: number },
    defaultLimit: number,
  ): HttpParams {
    return new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? defaultLimit);
  }

  /**
   * FormData per il multipart delle sale; Angular imposta da sé il boundary.
   *
   * ⚠️ Si salta OGNI campo `undefined`, invece di scriverlo comunque: su una
   * PATCH parziale `String(undefined)` manderebbe la stringa letterale
   * `"undefined"` (che per un testo è un valore valido e finirebbe salvato) e
   * per un numero il backend leggerebbe `Number('')`, cioè **0** — un
   * `identifierMinLen` azzerato o un `ordine` che si sposta in cima senza che
   * nessuno l'abbia toccato. Un campo davvero da svuotare si manda come stringa
   * vuota, esplicitamente.
   *
   * ⚠️ I booleani viaggiano come `'true'`/`'false'`: il backend li ricoerce con
   * un confronto sulla stringa (`Boolean('false')` sarebbe `true`).
   */
  private toFormData(
    payload: Partial<PokerRoomPayload>,
    logo?: File,
  ): FormData {
    const fd = new FormData();
    const set = (key: string, value: string | number | boolean | undefined) => {
      if (value !== undefined) fd.set(key, String(value));
    };
    set('name', payload.name);
    // `slug` solo alla creazione: sulla PATCH non è nel payload per costruzione
    // (`PokerRoomUpdatePayload` lo esclude), quindi qui è già `undefined`.
    set('slug', payload.slug);
    set('network', payload.network);
    set('descrizione', payload.descrizione);
    set('condizioni', payload.condizioni);
    set('istruzioni', payload.istruzioni);
    set('affiliateUrlTemplate', payload.affiliateUrlTemplate);
    set('codicePromozionale', payload.codicePromozionale);
    set('identifierLabel', payload.identifierLabel);
    set('identifierHelp', payload.identifierHelp);
    set('identifierFormat', payload.identifierFormat);
    set('identifierMinLen', payload.identifierMinLen);
    set('identifierMaxLen', payload.identifierMaxLen);
    set('identifierCaseSensitive', payload.identifierCaseSensitive);
    set('richiedeSecondoId', payload.richiedeSecondoId);
    set('secondIdentifierLabel', payload.secondIdentifierLabel);
    set('consenteAccountEsistenti', payload.consenteAccountEsistenti);
    set('ordine', payload.ordine);
    set('active', payload.active);
    if (logo) fd.set('logo', logo, logo.name);
    return fd;
  }
}
