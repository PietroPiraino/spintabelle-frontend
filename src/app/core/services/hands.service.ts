import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HandImportResult,
  HandMineList,
  HandReportReason,
  HandUploadPreview,
  HandVetrinaOrdine,
  HandView,
  Paginated,
} from '../models/api.models';

const API = environment.API_URL;

/** I filtri della libreria. ⚠️ Devono rispecchiare `LibreriaDto` del server. */
export interface HandLibraryFilters {
  gameType?: string;
  q?: string;
  ordina?: 'data' | 'piatto';
  verso?: 'asc' | 'desc';
  inVetrina?: boolean;
}

/**
 * Il Replayer: caricamento, libreria personale, vetrina, voti, segnalazioni.
 *
 * ⚠️ **Due chiamate sono PUBBLICHE e devono restare tali** — la mano singola
 * (`get`) e la segnalazione (`segnala`): la prima è la condivisione, cioè metà
 * della funzione; la seconda è la via con cui un **terzo** che si è trovato
 * nominato in una mano esercita gli artt. 17 e 21, e quel terzo non ha un
 * account. Non aggiungere guardie qui né interceptor che pretendano un token.
 */
@Injectable({ providedIn: 'root' })
export class HandsService {
  private readonly http = inject(HttpClient);

  // ── pubbliche ─────────────────────────────────────────────────────────

  /** Una mano dal suo indirizzo pubblico. Rimossa o inesistente → 404. */
  get(publicId: string): Observable<HandView> {
    return this.http.get<HandView>(`${API}/hands/${publicId}`);
  }

  /** La vetrina: solo le mani per cui chi le ha caricate ha spuntato la casella. */
  vetrina(
    page = 1,
    limit = 24,
    ordine: HandVetrinaOrdine = 'recenti',
  ): Observable<Paginated<HandView>> {
    // ⚠️ `ordine` va **dichiarato nel DTO lato server**: col
    // `forbidNonWhitelisted` globale un parametro non previsto fa fallire
    // l'**intera** chiamata con 400, non lo ignora.
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit)
      .set('ordine', ordine);
    return this.http.get<Paginated<HandView>>(`${API}/hands/vetrina`, {
      params,
    });
  }

  /** ⚠️ Funziona **senza account**: è una condizione di liceità, non una comodità. */
  segnala(
    publicId: string,
    dati: { motivo: HandReportReason; dettaglio?: string; contatto?: string },
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API}/hands/${publicId}/segnala`,
      dati,
    );
  }

  // ── autenticate ───────────────────────────────────────────────────────

  /**
   * Interpreta senza scrivere e senza consumare quota: quante mani ci sono,
   * quante sono già in libreria, quante ne entrano.
   */
  preview(testo: string): Observable<HandUploadPreview> {
    return this.http.post<HandUploadPreview>(`${API}/hands/preview`, { testo });
  }

  /**
   * ⚠️ `inVetrina` si manda **solo se vero**. Il predefinito vive nello schema
   * del backend (decisione D5, la vetrina è opt-in): mandare `false` esplicito
   * funzionerebbe, ma renderebbe questa chiamata una seconda sede della regola —
   * e due sedi divergono.
   */
  importa(testo: string, inVetrina: boolean): Observable<HandImportResult> {
    const body: { testo: string; inVetrina?: boolean } = { testo };
    if (inVetrina) body.inVetrina = true;
    return this.http.post<HandImportResult>(`${API}/hands/import`, body);
  }

  /**
   * La libreria personale, con i filtri della tabella.
   *
   * ⚠️ **Ogni parametro va dichiarato anche nel DTO del server** (`LibreriaDto`):
   * il `ValidationPipe` ha `forbidNonWhitelisted`, quindi un parametro che qui
   * si aggiunge e là no non viene ignorato — fa rispondere **400 all'intera
   * chiamata**. Chi lo dimentica non vede un filtro che non funziona: vede la
   * libreria sparire.
   *
   * ⚠️ I filtri vuoti **non si mandano**: `set('gameType', '')` arriverebbe come
   * stringa vuota e il server la userebbe come filtro, restituendo zero righe.
   */
  mie(page = 1, limit = 24, filtri: HandLibraryFilters = {}): Observable<HandMineList> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (filtri.gameType) params = params.set('gameType', filtri.gameType);
    if (filtri.q?.trim()) params = params.set('q', filtri.q.trim());
    if (filtri.ordina) params = params.set('ordina', filtri.ordina);
    if (filtri.verso) params = params.set('verso', filtri.verso);
    if (filtri.inVetrina !== undefined) {
      params = params.set('inVetrina', String(filtri.inVetrina));
    }
    return this.http.get<HandMineList>(`${API}/hands/mie`, { params });
  }

  cancella(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${API}/hands/${id}`);
  }

  /**
   * ⚠️ `POST`, non `DELETE /hands/mie`: quest'ultima differirebbe da
   * `DELETE /hands/:id` di un solo segmento, e il giorno in cui un `:id` valesse
   * la stringa `mie` il router sceglierebbe la rotta sbagliata.
   */
  svuota(): Observable<{ cancellate: number }> {
    return this.http.post<{ cancellate: number }>(`${API}/hands/mie/svuota`, {});
  }

  vota(
    id: string,
    value: 1 | -1 | 0,
  ): Observable<{ likes: number; dislikes: number; mio: number }> {
    return this.http.post<{ likes: number; dislikes: number; mio: number }>(
      `${API}/hands/${id}/voto`,
      { value },
    );
  }

  mioVoto(id: string): Observable<{ value: number }> {
    return this.http.get<{ value: number }>(`${API}/hands/${id}/mio-voto`);
  }

  /**
   * I voti dell'utente su un elenco di mani, **in una chiamata sola**.
   *
   * ⚠️ Esiste perché `mioVoto` è per-mano: una vetrina da dodici card avrebbe
   * significato dodici chiamate al caricamento della pagina. E senza lo stato
   * iniziale il cuore parte spento anche su una mano già votata, quindi il primo
   * clic **toglie** un voto che l'utente non ricorda di aver messo — un pulsante
   * che fa il contrario di quello che dice.
   */
  mieiVoti(ids: readonly string[]): Observable<{ voti: Record<string, number> }> {
    return this.http.post<{ voti: Record<string, number> }>(
      `${API}/hands/miei-voti`,
      { ids },
    );
  }

  /**
   * ⚠️ **Irreversibile**: i nickname vengono sovrascritti, non nascosti. Il
   * testo originale non si conserva, quindi dopo questa chiamata non esistono
   * più da nessuna parte — ed è ciò che la rende una risposta vera all'art. 17,
   * invece di una maschera. Chiedere conferma prima, sempre.
   */
  anonimizza(id: string): Observable<{ ok: true }> {
    return this.http.patch<{ ok: true }>(`${API}/hands/${id}/anonimizza`, {});
  }

  vetrinaSet(id: string, inVetrina: boolean): Observable<{ ok: true }> {
    return this.http.patch<{ ok: true }>(`${API}/hands/${id}/vetrina`, {
      inVetrina,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Formattazione degli importi
// ───────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **Gli importi arrivano come INTERI in unità minime**, e `decimali` dice
 * quante cifre valgono. Dividere per 100 è l'ultimo passo, quello della stampa:
 * farlo prima riporta in gioco la virgola mobile che il backend ha eliminato
 * apposta, e il replayer torna ad annunciare piatti da `12.300000000000001`.
 */
export function formatImporto(valore: number, decimali: number): string {
  const v = decimali > 0 ? valore / 10 ** decimali : valore;
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(v);
}

/**
 * Lo stesso importo espresso in **grandi bui**, che è la lingua della scuola:
 * uno stack da 1.084 fiche non dice niente, «10,8 bb» sì.
 *
 * ⚠️ Torna `null` quando il grande buio non è noto (vale 0): stampare «Infinity
 * bb» o «0 bb» sarebbe peggio che non stampare nulla.
 */
export function formatBui(valore: number, bigBlind: number): string | null {
  if (!bigBlind) return null;
  const bb = valore / bigBlind;
  return `${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: bb < 10 ? 1 : 0,
    maximumFractionDigits: bb < 10 ? 1 : 0,
  }).format(bb)} bb`;
}
