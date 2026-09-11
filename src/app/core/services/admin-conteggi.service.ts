import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ContoRakebackPayload,
  DettaglioMese,
  MeseContabile,
  RigaRakebackPayload,
  RigaStakatoPayload,
  SpesaRicorrente,
  SpesaRicorrentePayload,
  Stakato,
  StakatoPayload,
  VoceMese,
  VocePayload,
ContoRakeback,
  ProspettoMese,
  AnteprimaPunti,
  VersamentoView,
  VersamentoPayload,
  SaldiSoci,
} from '../models/api.models';

const API = environment.API_URL;

/**
 * I conteggi mensili (rotte ADMIN-only su /admin/conteggi).
 *
 * ⚠️ Gli importi viaggiano in CENTESIMI INTERI e le percentuali in PUNTI BASE
 * in entrambe le direzioni: la conversione vive in un punto solo,
 * `features/admin/denaro.ts`, sul bordo dell'interfaccia.
 *
 * ⚠️ Ogni mutazione restituisce il DETTAGLIO DEL MESE ricalcolato, non solo la
 * riga toccata: righe, totali e conto economico nascono da una lettura sola e
 * quindi non possono dissentire fra loro. Il client non somma mai niente da sé.
 */
@Injectable({ providedIn: 'root' })
export class AdminConteggiService {
  private readonly http = inject(HttpClient);

  // ── Mesi ─────────────────────────────────────────────────────────────────

  listMesi(): Observable<MeseContabile[]> {
    return this.http.get<MeseContabile[]>(`${API}/admin/conteggi/mesi`);
  }

  /**
   * ⚠️ È idempotente: apre il mese se non c'è e in ogni caso sincronizza le
   * spese ricorrenti attive e i conti attivi. Chiamarla due volte non duplica
   * niente — lo impediscono i due indici unique, non un controllo nel codice.
   */
  apriMese(
    anno: number,
    mese: number,
    quotaTitolareBp?: number,
  ): Observable<DettaglioMese> {
    return this.http.post<DettaglioMese>(`${API}/admin/conteggi/mesi`, {
      anno,
      mese,
      ...(quotaTitolareBp !== undefined ? { quotaTitolareBp } : {}),
    });
  }

  dettaglio(meseId: string): Observable<DettaglioMese> {
    return this.http.get<DettaglioMese>(
      `${API}/admin/conteggi/mesi/${meseId}`,
    );
  }

  sincronizza(
    meseId: string,
  ): Observable<{ vociCreate: number; righeCreate: number }> {
    return this.http.post<{ vociCreate: number; righeCreate: number }>(
      `${API}/admin/conteggi/mesi/${meseId}/sincronizza`,
      {},
    );
  }

  chiudiMese(meseId: string): Observable<DettaglioMese> {
    return this.http.post<DettaglioMese>(
      `${API}/admin/conteggi/mesi/${meseId}/chiudi`,
      {},
    );
  }

  riapriMese(meseId: string): Observable<DettaglioMese> {
    return this.http.post<DettaglioMese>(
      `${API}/admin/conteggi/mesi/${meseId}/riapri`,
      {},
    );
  }

  notaMese(meseId: string, nota: string): Observable<MeseContabile> {
    return this.http.patch<MeseContabile>(
      `${API}/admin/conteggi/mesi/${meseId}/nota`,
      { nota },
    );
  }

  // ── Voci ─────────────────────────────────────────────────────────────────

  creaVoce(meseId: string, body: VocePayload): Observable<VoceMese> {
    return this.http.post<VoceMese>(
      `${API}/admin/conteggi/mesi/${meseId}/voci`,
      body,
    );
  }

  aggiornaVoce(voceId: string, body: VocePayload): Observable<VoceMese> {
    return this.http.patch<VoceMese>(
      `${API}/admin/conteggi/voci/${voceId}`,
      body,
    );
  }

  eliminaVoce(voceId: string): Observable<void> {
    return this.http.delete<void>(`${API}/admin/conteggi/voci/${voceId}`);
  }

  // ── La colonna del rakeback ──────────────────────────────────────────────

  /**
   * ⚠️ UNA chiamata per tutta la colonna, non una per cella: il calcolo del
   * rakeback vive solo sul server e questo client non ne ha una copia. La
   * risposta è il mese ricalcolato, totali compresi.
   */
  salvaRakeback(
    meseId: string,
    righe: RigaRakebackPayload[],
  ): Observable<DettaglioMese> {
    return this.http.put<DettaglioMese>(
      `${API}/admin/conteggi/mesi/${meseId}/rakeback`,
      { righe },
    );
  }

  // ── La colonna degli stakati ─────────────────────────────────────────────

  /** ⚠️ Una chiamata per tutta la colonna, per la ragione scritta sopra. */
  salvaStakati(
    meseId: string,
    righe: RigaStakatoPayload[],
  ): Observable<DettaglioMese> {
    return this.http.put<DettaglioMese>(
      `${API}/admin/conteggi/mesi/${meseId}/stakati`,
      { righe },
    );
  }

  /**
   * Porta il conteggio di una riga sul registro staking.
   *
   * ⚠️ La risposta è il mese ricalcolato: dopo la scrittura il debito EV è
   * cambiato, e ridisegnare dalla risposta è l'unico modo di non mostrare una
   * ripartizione che non esiste più.
   */
  registraStakato(rigaId: string): Observable<DettaglioMese> {
    return this.http.post<DettaglioMese>(
      `${API}/admin/conteggi/stakati/righe/${rigaId}/registra`,
      {},
    );
  }

  // ── Anagrafiche ──────────────────────────────────────────────────────────

  listStakati(): Observable<Stakato[]> {
    return this.http.get<Stakato[]>(`${API}/admin/conteggi/stakati`);
  }

  creaStakato(body: StakatoPayload): Observable<Stakato> {
    return this.http.post<Stakato>(`${API}/admin/conteggi/stakati`, body);
  }

  aggiornaStakato(id: string, body: StakatoPayload): Observable<Stakato> {
    return this.http.patch<Stakato>(
      `${API}/admin/conteggi/stakati/${id}`,
      body,
    );
  }

  /**
   * Il prospetto dell'utente autenticato.
   *
   * ⚠️ Sta in questo servizio benché la rotta NON sia sotto `/admin`: è lo
   * stesso dominio e gli stessi tipi, e un secondo servizio per una chiamata
   * sola sarebbe un posto in più in cui cercarla. La rotta è `/conteggi`, senza
   * prefisso admin, e non accetta alcun id: il server sceglie le righe dal
   * token.
   */
  /**
   * Manda al giocatore il prospetto di quel mese.
   *
   * ⚠️ `userId` e non l'id della riga: il prospetto è della PERSONA, e chi ha
   * sia un conto rakeback sia un accordo di staking riceve UNA email con tutto
   * quello che lo riguarda.
   */
  inviaProspetto(meseId: string, userId: string): Observable<void> {
    return this.http.post<void>(
      `${API}/admin/conteggi/mesi/${meseId}/prospetto`,
      { userId },
    );
  }

  saldiSoci(): Observable<SaldiSoci> {
    return this.http.get<SaldiSoci>(`${API}/admin/conteggi/soci`);
  }

  creaVersamento(body: VersamentoPayload): Observable<VersamentoView> {
    return this.http.post<VersamentoView>(
      `${API}/admin/conteggi/versamenti`,
      body,
    );
  }

  eliminaVersamento(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/admin/conteggi/versamenti/${id}`);
  }

  anteprimaPunti(meseId: string): Observable<AnteprimaPunti> {
    return this.http.get<AnteprimaPunti>(
      `${API}/admin/conteggi/mesi/${meseId}/punti`,
    );
  }

  /** ⚠️ Idempotente per marcatore: premuto due volte non raddoppia. */
  accreditaPunti(meseId: string): Observable<AnteprimaPunti> {
    return this.http.post<AnteprimaPunti>(
      `${API}/admin/conteggi/mesi/${meseId}/punti`,
      {},
    );
  }

  mioProspetto(): Observable<ProspettoMese[]> {
    return this.http.get<ProspettoMese[]>(`${API}/conteggi/mio-prospetto`);
  }

  eliminaStakato(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/admin/conteggi/stakati/${id}`);
  }

  listRicorrenti(): Observable<SpesaRicorrente[]> {
    return this.http.get<SpesaRicorrente[]>(
      `${API}/admin/conteggi/ricorrenti`,
    );
  }

  creaRicorrente(
    body: SpesaRicorrentePayload,
  ): Observable<SpesaRicorrente> {
    return this.http.post<SpesaRicorrente>(
      `${API}/admin/conteggi/ricorrenti`,
      body,
    );
  }

  aggiornaRicorrente(
    id: string,
    body: SpesaRicorrentePayload,
  ): Observable<SpesaRicorrente> {
    return this.http.patch<SpesaRicorrente>(
      `${API}/admin/conteggi/ricorrenti/${id}`,
      body,
    );
  }

  eliminaRicorrente(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/admin/conteggi/ricorrenti/${id}`);
  }

  listConti(): Observable<ContoRakeback[]> {
    return this.http.get<ContoRakeback[]>(`${API}/admin/conteggi/conti`);
  }

  creaConto(body: ContoRakebackPayload): Observable<ContoRakeback> {
    return this.http.post<ContoRakeback>(`${API}/admin/conteggi/conti`, body);
  }

  aggiornaConto(
    id: string,
    body: ContoRakebackPayload,
  ): Observable<ContoRakeback> {
    return this.http.patch<ContoRakeback>(
      `${API}/admin/conteggi/conti/${id}`,
      body,
    );
  }

  eliminaConto(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/admin/conteggi/conti/${id}`);
  }
}
