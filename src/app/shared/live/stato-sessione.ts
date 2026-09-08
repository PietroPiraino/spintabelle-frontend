import { DestroyRef, PLATFORM_ID, inject, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LiveSession } from '../../core/models/api.models';

/**
 * Con quanto anticipo la stanza si considera aperta.
 *
 * ⚠️ È lo stesso numero di `LIVE_REMINDER_MINUTES` lato backend (il promemoria
 * Discord «live in arrivo»). Non è una coincidenza da mantenere a mano: è la
 * definizione che il progetto ha già dato di «sta per iniziare», e due anticipi
 * diversi vorrebbero dire che l'avviso arriva quando il sito dice ancora di no.
 */
export const ANTICIPO_APERTURA_MIN = 60;

/** Quanto dura una sessione che non dichiara una durata. */
const DURATA_PREDEFINITA_MIN = 90;

export type StatoSessione = 'ora' | 'imminente' | 'programmata' | 'terminata';

/**
 * Lo stato di una sessione, in quattro gradi.
 *
 * ⚠️ PERCHÉ ESISTE. Fino al 27/08/2026 «Entra nella stanza» compariva con lo
 * STESSO peso su ogni sessione, comprese quelle fra dieci giorni — e non era
 * solo un problema visivo: `canJoinLive` è `unlocked && !endedAt` e **non
 * guarda l'orologio**, né nel service né nell'endpoint che conia il token.
 * Quel pulsante era davvero cliccabile, e portava in una stanza LiveKit
 * effimera vuota, senza coach e senza spiegazione.
 *
 * ⚠️ Resta una CONVENZIONE DEL CLIENT, non una verità: chi ha l'URL diretto
 * della stanza entra comunque. Il gate sul server è stato valutato e rimandato
 * di proposito (decisione owner del 27/08/2026) — richiederebbe l'eccezione
 * esplicita per il coach che apre la stanza in anticipo per sistemare l'audio.
 * Chi legge questa funzione non deve scambiarla per quel gate.
 *
 * ⚠️ ESTRATTA da `LiveComponent` l'08/09/2026 perché i consumatori sono
 * diventati due (la pagina pubblica e il pannello admin), e a comportamento
 * IDENTICO: le funzioni prendono `adesso` invece di leggerlo da un signal
 * privato, e nient'altro è cambiato. La tentazione di «migliorare» la soglia
 * dei 60 minuti durante il trasloco è il modo con cui le due schermate
 * divergono senza che nessuno se ne accorga.
 *
 * ⚠️ Per le sessioni EXTERNAL (Zoom/Discord) il server NON espone alcun dato di
 * fine: `endedAt` non è serializzato e `ended` è `undefined`. Lì «terminata» si
 * può solo dedurre da `startsAt + durataMin`, ed è un limite del dato, non di
 * questa funzione.
 */
export function statoSessione(
  s: Pick<LiveSession, 'startsAt' | 'durationMin' | 'ended'>,
  adesso: number,
): StatoSessione {
  if (s.ended) return 'terminata';
  if (isLiveNow(s, adesso)) return 'ora';
  const mancano = new Date(s.startsAt).getTime() - adesso;
  if (mancano <= 0) return 'terminata';
  return mancano <= ANTICIPO_APERTURA_MIN * 60_000 ? 'imminente' : 'programmata';
}

/**
 * «In diretta ora»: iniziata da non oltre la durata prevista e non terminata
 * dal coach.
 */
export function isLiveNow(
  s: Pick<LiveSession, 'startsAt' | 'durationMin' | 'ended'>,
  adesso: number,
): boolean {
  if (s.ended) return false;
  const start = new Date(s.startsAt).getTime();
  const durata =
    s.durationMin && s.durationMin > 0 ? s.durationMin : DURATA_PREDEFINITA_MIN;
  return adesso >= start && adesso <= start + durata * 60_000;
}

/** «fra 42 minuti», «fra 3 ore», «domani», «fra 5 giorni». */
export function quandoManca(
  s: Pick<LiveSession, 'startsAt'>,
  adesso: number,
): string {
  const ms = new Date(s.startsAt).getTime() - adesso;
  if (ms <= 0) return '';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `fra ${min} minut${min === 1 ? 'o' : 'i'}`;
  const ore = Math.round(min / 60);
  if (ore < 24) return `fra ${ore} or${ore === 1 ? 'a' : 'e'}`;
  const giorni = Math.round(ore / 24);
  return giorni === 1 ? 'domani' : `fra ${giorni} giorni`;
}

/**
 * L'orologio come SEGNALE, da chiamare in un contesto di injection.
 *
 * ⚠️ Senza, lo stato verrebbe calcolato una volta al mount e non si
 * aggiornerebbe mai: chi tiene aperta la pagina vedrebbe per sempre la
 * situazione del momento in cui è entrato, e una sessione non passerebbe mai da
 * «imminente» a «in diretta ora» — proprio nei minuti in cui la pagina serve.
 * Trenta secondi bastano: la soglia più fine che si mostra è il minuto.
 *
 * ⚠️ L'intervallo parte SOLO nel browser: in prerender girerebbe in Node e
 * terrebbe vivo il processo, impedendo alla pagina di stabilizzarsi — cioè il
 * build si fermerebbe su quella rotta.
 */
export function orologio(passoMs = 30_000): Signal<number> {
  const adesso = signal(Date.now());
  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    const destroyRef = inject(DestroyRef);
    const t = setInterval(() => adesso.set(Date.now()), passoMs);
    destroyRef.onDestroy(() => clearInterval(t));
  }
  return adesso.asReadonly();
}
