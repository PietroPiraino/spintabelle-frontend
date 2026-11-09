import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AnteprimaInvito,
  AwardsCategoria,
} from '../../core/models/awards.models';
import { AuthService } from '../../core/services/auth.service';
import { AwardsService } from '../../core/services/awards.service';
import { apiErrorMessage } from '../../core/utils/http-error';

/** La chiave `localStorage` (dichiarata nella cookie policy). */
export const CHIAVE_INVITO = 'bff-awards-invito';
/** Quanto si tiene da parte il token: lo dice la cookie policy («7 giorni»). */
const DURATA_MS = 7 * 86_400_000;

/**
 * Il token d'invito: prima dal FRAMMENTO dell'indirizzo, poi da `localStorage`.
 *
 * ⚠️ Il token arriva nel frammento (`#`) perché il browser non lo manda mai al
 * server: non finisce nei log né nelle statistiche. Appena letto lo si mette da
 * parte e lo si toglie dall'indirizzo, così sopravvive al giro registrazione →
 * conferma email → accesso, e non resta nella barra (o in una schermata
 * condivisa). ⚠️ `localStorage` può mancare o lanciare (navigazione privata):
 * si degrada a «riapri il collegamento», mai a un errore.
 */
export function leggiTokenInvito(): string | null {
  const dalFrammento = window.location.hash.slice(1).trim();
  if (dalFrammento) {
    try {
      localStorage.setItem(
        CHIAVE_INVITO,
        JSON.stringify({ token: dalFrammento, scade: Date.now() + DURATA_MS }),
      );
    } catch {
      /* archiviazione assente: il token vale per questa pagina */
    }
    history.replaceState(
      history.state,
      '',
      window.location.pathname + window.location.search,
    );
    return dalFrammento;
  }
  try {
    const raw = localStorage.getItem(CHIAVE_INVITO);
    if (!raw) return null;
    const { token, scade } = JSON.parse(raw) as { token?: string; scade?: number };
    if (!token || !scade || Date.now() > scade) {
      localStorage.removeItem(CHIAVE_INVITO);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function dimenticaTokenInvito(): void {
  try {
    localStorage.removeItem(CHIAVE_INVITO);
  } catch {
    /* niente da togliere */
  }
}

type Stato =
  | 'nessuno'
  | 'carico'
  | 'errore'
  | 'pronto'
  | 'accettato'
  | 'rifiutato';

/**
 * `/awards/invito` — la persona contattata dallo staff risponde all'invito.
 *
 * ⚠️ Due asimmetrie volute:
 * - per **accettare** serve un account con l'email confermata: la candidatura
 *   si collega a una persona, che così può ritirarsi quando vuole;
 * - per **rifiutare** NO: obbligare a registrarsi per dire di no vorrebbe dire
 *   raccogliere dati per non trattarne.
 * ⚠️ Categorie e consenso nascono NON spuntati: un consenso pre-spuntato non è
 * un consenso (art. 7, e Corte di giustizia C-673/17 «Planet49»).
 */
@Component({
  selector: 'app-awards-invito',
  imports: [RouterLink],
  templateUrl: './awards-invito.component.html',
  styleUrl: './awards-invito.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AwardsInvitoComponent {
  private readonly api = inject(AwardsService);
  protected readonly auth = inject(AuthService);

  protected readonly stato = signal<Stato>('carico');
  protected readonly errore = signal<string | null>(null);
  protected readonly invito = signal<AnteprimaInvito | null>(null);
  protected readonly scelte = signal<ReadonlySet<AwardsCategoria>>(new Set());
  protected readonly consenso = signal(false);
  protected readonly inVolo = signal(false);
  protected readonly erroreAzione = signal<string | null>(null);
  protected readonly confermaRifiuto = signal(false);
  protected readonly accettate = signal<AwardsCategoria[]>([]);

  protected readonly puoAccettare = computed(
    () => this.scelte().size > 0 && this.consenso() && !this.inVolo(),
  );

  protected readonly etichettaDi = computed(() => {
    const m = new Map<AwardsCategoria, string>();
    for (const c of this.invito()?.categorie ?? []) m.set(c.categoria, c.etichetta);
    return m;
  });

  private token: string | null = null;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.dalIndirizzo();
    // ⚠️ Un secondo link aperto nella STESSA scheda cambia solo il frammento:
    // Angular non ricrea il componente, e senza questo ascolto la pagina
    // resterebbe sull'invito di prima — cioè si risponderebbe all'invito
    // sbagliato.
    const suCambio = () => {
      if (window.location.hash.length > 1) this.dalIndirizzo();
    };
    window.addEventListener('hashchange', suCambio);
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('hashchange', suCambio),
    );
  }

  private dalIndirizzo(): void {
    this.token = leggiTokenInvito();
    this.invito.set(null);
    this.scelte.set(new Set());
    this.consenso.set(false);
    this.confermaRifiuto.set(false);
    this.erroreAzione.set(null);
    if (!this.token) {
      this.stato.set('nessuno');
      return;
    }
    this.carica();
  }

  protected carica(): void {
    if (!this.token) return;
    this.stato.set('carico');
    this.errore.set(null);
    this.api.anteprimaInvito(this.token).subscribe({
      next: (a) => {
        this.invito.set(a);
        this.stato.set('pronto');
      },
      error: (err: unknown) => {
        this.errore.set(
          apiErrorMessage(err, 'Non riusciamo a leggere il tuo invito.'),
        );
        this.stato.set('errore');
      },
    });
  }

  protected scegli(categoria: AwardsCategoria, event: Event): void {
    const attiva = (event.target as HTMLInputElement).checked;
    this.scelte.update((s) => {
      const n = new Set(s);
      if (attiva) n.add(categoria);
      else n.delete(categoria);
      return n;
    });
    this.erroreAzione.set(null);
  }

  protected spuntaConsenso(event: Event): void {
    this.consenso.set((event.target as HTMLInputElement).checked);
    this.erroreAzione.set(null);
  }

  protected accetta(): void {
    if (!this.token || !this.puoAccettare()) return;
    // Nell'ordine dell'invito, non in quello dei clic.
    const ordine = (this.invito()?.categorie ?? []).map((c) => c.categoria);
    const categorie = ordine.filter((c) => this.scelte().has(c));
    this.inVolo.set(true);
    this.erroreAzione.set(null);
    this.api.accettaInvito(this.token, categorie).subscribe({
      next: ({ accettate }) => {
        this.inVolo.set(false);
        dimenticaTokenInvito();
        this.accettate.set(accettate);
        this.stato.set('accettato');
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        this.erroreAzione.set(
          apiErrorMessage(err, 'Non siamo riusciti a registrare la tua risposta.'),
        );
      },
    });
  }

  protected rifiuta(): void {
    if (!this.token || this.inVolo()) return;
    this.inVolo.set(true);
    this.erroreAzione.set(null);
    this.api.rifiutaInvito(this.token).subscribe({
      next: () => {
        this.inVolo.set(false);
        dimenticaTokenInvito();
        this.stato.set('rifiutato');
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        this.confermaRifiuto.set(false);
        this.erroreAzione.set(
          apiErrorMessage(err, 'Non siamo riusciti a registrare la tua risposta.'),
        );
      },
    });
  }
}
