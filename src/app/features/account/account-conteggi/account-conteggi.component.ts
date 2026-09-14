import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ProspettoMese } from '../../../core/models/api.models';
import { SOCIAL_LINKS } from '../../../core/social-links';
import { formattaBp, formattaCent } from '../../admin/denaro';
import { Carico } from '../account.types';

/** L'indirizzo del Titolare, lo stesso dell'informativa (sezione 1). */
export const EMAIL_TITOLARE = 'pietropiraino91@gmail.com';

/**
 * Il prospetto dei propri conteggi — la scheda che esiste SOLO per chi ha
 * un accordo di rakeback o di staking.
 *
 * ⚠️⚠️ PRIMA superficie del modulo conteggi rivolta all'utente (11/09/2026):
 * la valutazione è `gdpr/valutazione-prospetto-e-punti.md`, adottata prima
 * del codice, e le sue cinque misure (§G.1) sono il bilanciamento: qui non
 * c'è una sola cifra della scuola (né l'incasso dall'agente, né i margini,
 * né la ripartizione fra i soci), nessun confronto fra mesi formulato come
 * incoraggiamento, nessuna classifica, e NESSUN punto BFF — i punti stanno
 * in un'altra scheda, e nessuna frase li collega (§D/§H).
 *
 * ⚠️ Euro e percentuali: le STESSE funzioni del pannello admin
 * (`features/admin/denaro.ts`): il giocatore confronta questa pagina con
 * quella dell'amministrazione, e due formattazioni sarebbero due cifre.
 */
@Component({
  selector: 'app-account-conteggi',
  imports: [],
  templateUrl: './account-conteggi.component.html',
  styleUrls: ['../account-shared.scss', './account-conteggi.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountConteggiComponent {
  readonly prospetto = input.required<Carico<ProspettoMese[]>>();
  readonly riprova = output<void>();

  protected readonly EMAIL_TITOLARE = EMAIL_TITOLARE;
  protected readonly discord = SOCIAL_LINKS.discord;

  protected readonly mesi = computed<ProspettoMese[]>(() => {
    const p = this.prospetto();
    return p.stato === 'ok' ? p.dati : [];
  });

  protected eur(cent: number): string {
    return formattaCent(cent);
  }

  protected pct(bp: number): string {
    return formattaBp(bp);
  }

  /**
   * Le cifre che contano per quel mese, nel `summary`: chi apre la scheda
   * legge subito «resta da darti» senza aprire i dodici numeri sotto. Una per
   * accordo — chi ha conto rakeback E staking nello stesso mese le vede
   * entrambe, perché sono due bonifici in direzioni potenzialmente opposte.
   */
  protected cifreChiave(m: ProspettoMese): { etichetta: string; valore: string }[] {
    const out: { etichetta: string; valore: string }[] = [];
    if (m.rakeback) {
      const r = m.rakeback;
      out.push(
        r.ticketDallAgente
          ? { etichetta: 'Ti spetta', valore: this.eur(r.spettanteAlPlayerCent) }
          : { etichetta: 'Resta da darti', valore: this.eur(r.residuoAlPlayerCent) },
      );
    }
    if (m.stakato) {
      const st = m.stakato;
      out.push(
        st.daRegolareCent < 0
          ? { etichetta: 'Ti rimborsiamo', valore: this.eur(-st.daRegolareCent) }
          : { etichetta: 'Da bonificare', valore: this.eur(st.daRegolareCent) },
      );
    }
    return out;
  }
}
