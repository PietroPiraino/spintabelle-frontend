import { HttpErrorResponse } from '@angular/common/http';

/** Estrae un messaggio leggibile da un errore API (NestJS / class-validator). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 429) {
      return 'Troppi tentativi: riprova tra qualche minuto.';
    }
    if (err.status === 0) {
      return 'Impossibile raggiungere il server. Controlla la connessione.';
    }
    const message: unknown = err.error?.message;
    if (Array.isArray(message)) return message.join(' · ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
