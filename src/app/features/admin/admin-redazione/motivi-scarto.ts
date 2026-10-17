import type { NewsScartoMotivo } from '../../../core/models/api.models';

/**
 * Il menu del motivo di scarto (dal 17/10/2026), nell'ordine di
 * `NEWS_SCARTO_MOTIVI` del backend e con le stesse etichette di
 * `newsScartoMotivoLabel`. ⚠️ Copia: i due repo non condividono codice. Un
 * valore che il server non conosce è un 400 sull'intera chiamata, quindi chi
 * aggiunge un motivo lo aggiunge prima là.
 */
export const MOTIVI_SCARTO: readonly { valore: NewsScartoMotivo; etichetta: string }[] = [
  { valore: 'FATTO_ERRATO', etichetta: 'Fatto sbagliato' },
  { valore: 'DATO_NON_VERIFICABILE', etichetta: 'Dato non verificabile sulle fonti' },
  { valore: 'NON_NOTIZIA', etichetta: 'Non interessa al nostro pubblico' },
  { valore: 'DOPPIONE', etichetta: 'Doppione' },
  { valore: 'SCRITTURA', etichetta: 'Scritto male' },
  { valore: 'CONFORMITA', etichetta: 'Problema di conformità' },
  { valore: 'FUORI_TEMPO', etichetta: 'Notizia vecchia' },
  { valore: 'ALTRO', etichetta: 'Altro' },
];

export function etichettaMotivo(m: NewsScartoMotivo): string {
  return MOTIVI_SCARTO.find((x) => x.valore === m)?.etichetta ?? m;
}
