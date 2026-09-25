import { Injectable } from '@angular/core';
import {
  DefaultUrlSerializer,
  PRIMARY_OUTLET,
  UrlSegmentGroup,
  UrlTree,
} from '@angular/router';
import {
  aggiungiBarraFinale,
  togliBarraFinale,
  vuoleBarraFinale,
} from './barra-finale';

/**
 * Il serializer del router, con la barra finale sulle pagine pubbliche.
 *
 * `serialize` e' cio' che scrive l'`href` di ogni `routerLink` — anche
 * nell'HTML prerenderizzato, che e' quello che Google legge — e l'indirizzo
 * nella barra del browser dopo una navigazione. Con il serializer di serie le
 * pagine pubbliche uscivano senza barra, cioe' ogni link interno era un 308:
 * il perche' e l'elenco stanno in `barra-finale.ts`.
 *
 * `parse` toglie la barra prima di passare la mano: per il router una barra
 * finale e' un segmento vuoto in piu', e `glossario/:slug` smetterebbe di
 * corrispondere. Serve davvero: `router.url` ora porta la barra, e chi lo
 * ripassa a `navigateByUrl` (un `?redirect=` costruito da li', per esempio)
 * finirebbe sulla 404 del wildcard.
 *
 * ⚠️ Nel dubbio NON aggiunge niente: con outlet ausiliari o parametri matrice
 * l'indirizzo non e' quello di una pagina pubblica, e un reindirizzamento in
 * piu' costa meno di un indirizzo che non esiste.
 */
@Injectable()
export class BarraFinaleUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(togliBarraFinale(url));
  }

  override serialize(tree: UrlTree): string {
    const url = super.serialize(tree);
    const segmenti = segmentiPrimari(tree.root);
    return segmenti && vuoleBarraFinale(segmenti) ? aggiungiBarraFinale(url) : url;
  }
}

/**
 * I segmenti dell'outlet primario, scendendo anche nei gruppi annidati (un
 * albero costruito da `createUrlTree` puo' spezzare il percorso su piu'
 * livelli). `null` se c'e' qualunque altra cosa: outlet secondari o parametri
 * matrice (`;chiave=valore`).
 */
function segmentiPrimari(
  gruppo: UrlSegmentGroup,
  out: string[] = [],
): string[] | null {
  for (const s of gruppo.segments) {
    if (Object.keys(s.parameters).length) return null;
    out.push(s.path);
  }
  const figli: string[] = Object.keys(gruppo.children);
  if (figli.length === 0) return out;
  if (figli.length !== 1 || figli[0] !== PRIMARY_OUTLET) return null;
  return segmentiPrimari(gruppo.children[PRIMARY_OUTLET], out);
}
