import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PreflopFormat,
  PreflopMeta,
  PreflopNode,
} from '../models/api.models';

const API = environment.API_URL;

/**
 * Accesso alle soluzioni preflop. I dati sono statici, quindi tutto ciò
 * che arriva resta in cache per la sessione: rinavigare un nodo già visto
 * non rifà la chiamata HTTP.
 */
@Injectable({ providedIn: 'root' })
export class PreflopService {
  private readonly http = inject(HttpClient);

  private meta$: Observable<PreflopMeta> | null = null;
  private readonly nodeCache = new Map<string, PreflopNode>();
  private readonly inFlight = new Map<string, Observable<PreflopNode>>();

  /** Formati e profondità disponibili (una sola chiamata per sessione). */
  getMeta(): Observable<PreflopMeta> {
    this.meta$ ??= this.http.get<PreflopMeta>(`${API}/preflop/meta`).pipe(
      catchError((err: unknown) => {
        // niente cache dell'errore: il prossimo chiamante ritenta
        this.meta$ = null;
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.meta$;
  }

  /**
   * Un nodo dell'albero (percorso vuoto = radice), con cache e dedup richieste.
   * `stacks` ("25-25-12") è richiesto solo per i formati asimmetrici.
   */
  getNode(
    format: PreflopFormat,
    depth: string,
    actions = '',
    stacks?: string,
  ): Observable<PreflopNode> {
    const key = `${format}|${depth}|${stacks ?? ''}|${actions}`;
    const cached = this.nodeCache.get(key);
    if (cached) return of(cached);

    let req = this.inFlight.get(key);
    if (!req) {
      let params = new HttpParams().set('format', format).set('depth', depth);
      if (stacks) params = params.set('stacks', stacks);
      if (actions) params = params.set('actions', actions);
      req = this.http.get<PreflopNode>(`${API}/preflop/node`, { params }).pipe(
        tap((node) => this.nodeCache.set(key, node)),
        finalize(() => this.inFlight.delete(key)),
        shareReplay(1),
      );
      this.inFlight.set(key, req);
    }
    return req;
  }

  /** Scalda la cache con i figli del nodo: il click sull'azione diventa istantaneo. */
  prefetchChildren(node: PreflopNode): void {
    // stacks va passato SOLO per gli asimmetrici, esattamente come fa il
    // caricamento reale: i nodi simmetrici hanno comunque uno stacks valorizzato
    // (es. "33-33-33"), ma il click li interroga senza, quindi includerlo qui
    // metterebbe il prefetch sotto una chiave di cache diversa (mai riletta)
    const stacks = node.format.includes('_asymmetric')
      ? node.stacks
      : undefined;
    for (const action of node.actions) {
      if (action.is_terminal) continue;
      const path = node.preflop_actions
        ? `${node.preflop_actions}-${action.code}`
        : action.code;
      this.getNode(node.format, node.depth_label, path, stacks).subscribe({
        error: () => {
          /* prefetch best-effort: l'eventuale errore riemerge al click */
        },
      });
    }
  }
}
