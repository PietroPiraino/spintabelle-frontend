import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './http-error';

/**
 * Consegna un blob al browser come file da salvare.
 *
 * ⚠️ Il blob si prende via XHR e non con un `<a href>` verso la rotta: l'access
 * token sta in memoria e lo attacca l'interceptor, una navigazione diretta
 * prenderebbe 401 (idioma dei documenti e della storia IG delle news).
 * ⚠️ La revoca dell'URL è RITARDATA: nello stesso tick può abortire un
 * salvataggio avviato in modo asincrono (lezione dell'export dell'account).
 * ⚠️ Promosso qui alla TERZA copia; le due precedenti (account, news) restano
 * dove sono finché non si toccano per altro.
 */
export function scaricaBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Il messaggio d'errore di una chiamata con `responseType: 'blob'`.
 *
 * ⚠️ Con quel tipo di risposta anche il corpo dell'ERRORE arriva come Blob,
 * quindi `apiErrorMessage` non lo legge e ripiega sempre sul testo generico:
 * il 409 che spiega PERCHÉ («la card si scarica da quando la rosa è
 * pubblicata») andrebbe perso.
 */
export async function messaggioErroreBlob(
  err: unknown,
  fallback: string,
): Promise<string> {
  if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
    try {
      const corpo = JSON.parse(await err.error.text()) as { message?: unknown };
      const finto = new HttpErrorResponse({
        error: corpo,
        status: err.status,
        statusText: err.statusText,
      });
      return apiErrorMessage(finto, fallback);
    } catch {
      return apiErrorMessage(
        new HttpErrorResponse({ status: err.status }),
        fallback,
      );
    }
  }
  return apiErrorMessage(err, fallback);
}
