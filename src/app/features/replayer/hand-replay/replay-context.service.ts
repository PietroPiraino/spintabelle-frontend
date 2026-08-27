import { Injectable, computed, inject, signal } from '@angular/core';
import { HandMineView, HandView } from '../../../core/models/api.models';
import {
  HandsService,
  formatBui,
  formatImporto,
} from '../../../core/services/hands.service';

/**
 * Il netto dell'eroe, col segno, in grandi bui.
 *
 * ⚠️ **In grandi bui e non in fiche**: l'elenco mescola mani di tornei e cash
 * con bui diversi, e «+240» accanto a «+3,5» non si confrontano. In bui sì.
 * Il ripiego in unità grezze serve solo se il grande buio non è noto.
 */
function nettoLeggibile(
  m: HandView | HandMineView,
  seat: number,
): string | null {
  const riga = (m.netti ?? []).find((n) => n.seat === seat);
  if (!riga || !Number.isFinite(riga.netto)) return null;
  const v = riga.netto;
  const assoluto =
    formatBui(Math.abs(v), m.bigBlind) ?? formatImporto(Math.abs(v), m.decimali);
  if (v > 0) return `+${assoluto}`;
  if (v < 0) return `−${assoluto}`;
  return assoluto;
}

/** Una mano nell'elenco laterale: quel tanto che basta a riconoscerla. */
export interface ManoDelContesto {
  publicId: string;
  formato: string;
  /** Le carte dell'eroe, se note: è il modo più rapido per ritrovare una mano. */
  carte: string[];
  /**
   * Quanto l'eroe ha **vinto o perso** in quella mano, già formattato in grandi
   * bui col segno (`+18,4 bb`, `−9,7 bb`), oppure `null` se non ricavabile.
   *
   * ⚠️ Viene da `netti[]`, che il server calcola con la regola della puntata non
   * chiamata: **non** si somma `risultati[]`, che contiene i soli **vincitori** —
   * chi perde non c'è, e il netto verrebbe `null` proprio nelle mani perse.
   */
  netto: string | null;
}

/** Da dove si è arrivati alla mano che si sta guardando. */
export type OrigineContesto = 'vetrina' | 'libreria' | 'selezione';

const ETICHETTA_ORIGINE: Record<OrigineContesto, string> = {
  vetrina: 'Dalla vetrina',
  libreria: 'Dalla tua libreria',
  selezione: 'Le mani che hai scelto',
};

/**
 * **Il contesto**: l'elenco di mani da cui si è arrivati a quella aperta, che è
 * ciò che rende sensati i comandi «mano precedente» e «mano successiva» (▲ ▼).
 *
 * ⚠️⚠️ **PERCHÉ UN SERVIZIO IN MEMORIA E NON LA QUERY STRING — la decisione, e
 * le tre ragioni.** L'alternativa ovvia era portarsi dietro un `?da=libreria`
 * (o addirittura l'elenco degli identificativi) nell'indirizzo. È stata
 * scartata:
 *
 * 1. **Il requisito è «da un collegamento condiviso il contesto NON c'è».** Con
 *    un parametro nell'URL quel requisito dipenderebbe dalla disciplina di chi
 *    condivide: il comando «Copia» di questa pagina ripulisce l'indirizzo, ma
 *    copiare dalla **barra del browser** è ciò che fa la maggior parte della
 *    gente, e lì il parametro c'è. In memoria la garanzia è **per costruzione**:
 *    un altro dispositivo, un'altra scheda, un ricaricamento non hanno nulla.
 * 2. **La libreria è privata, l'indirizzo di una mano è pubblico.** `?da=libreria`
 *    (peggio ancora con gli identificativi dentro) mescola un elenco personale
 *    in una stringa fatta per essere spedita, e finisce nella cronologia e in
 *    qualunque incollaggio. Un dato privato non entra in un indirizzo pubblico
 *    perché farebbe comodo.
 * 3. **Un `?da=libreria` su un collegamento condiviso porterebbe a un 401.** Chi
 *    lo riceve non è iscritto: la pagina chiamerebbe `/hands/mie` e prenderebbe
 *    un errore, cioè esattamente sul caso d'uso principale della sezione.
 *
 * Prezzo accettato, e dichiarato: **il contesto non sopravvive a un
 * ricaricamento**. È la stessa proprietà che lo tiene fuori dai collegamenti
 * condivisi, non un effetto collaterale da riparare — dopo un F5 l'elenco
 * sparisce e i due comandi si spengono, che è la verità («non sappiamo più da
 * dove venivi») invece di una scorciatoia che la nasconde.
 *
 * ⚠️ **Il contesto lo DEDUCE la pagina della mano** (dalla navigazione
 * precedente), non lo spingono la vetrina e la libreria. È una scelta di
 * accoppiamento: quelle due pagine non devono sapere che esiste un elenco
 * laterale da qualche parte, e soprattutto non devono ricordarsi di popolarlo —
 * un contratto che si onora «ricordandosene» è un contratto che prima o poi non
 * viene onorato, in silenzio, e il sintomo sarebbero due frecce spente senza che
 * nulla si rompa a vista.
 */
@Injectable({ providedIn: 'root' })
export class ReplayContextService {
  private readonly hands = inject(HandsService);

  private readonly _origine = signal<OrigineContesto | null>(null);
  private readonly _mani = signal<readonly ManoDelContesto[]>([]);

  readonly origine = this._origine.asReadonly();
  readonly mani = this._mani.asReadonly();

  readonly titolo = computed(() => {
    const o = this._origine();
    return o ? ETICHETTA_ORIGINE[o] : '';
  });

  /**
   * Carica l'elenco della vetrina. ⚠️ Non chiede nulla ad `AuthService`: la
   * vetrina è pubblica, e chiedere un token qui spegnerebbe l'elenco proprio per
   * chi sfoglia senza account.
   */
  caricaVetrina(): void {
    this.hands.vetrina(1, 24).subscribe({
      next: (r) => this.imposta('vetrina', r.items),
      // ⚠️ Silenzioso: il contesto è un di più. Una banda d'errore qui direbbe
      // «la mano non si è caricata», che è falso — la mano è già a schermo.
      error: () => this.pulisci(),
    });
  }

  /** Carica la libreria personale. Si arriva qui solo da `/mie-mani`, che è guardata. */
  caricaLibreria(): void {
    this.hands.mie(1, 50).subscribe({
      next: (r) => this.imposta('libreria', r.items),
      error: () => this.pulisci(),
    });
  }

  /**
   * L'elenco delle mani **selezionate a mano** nella libreria.
   *
   * ⚠️⚠️ **È L'UNICA ORIGINE CHE SI SPINGE, E LA DEROGA VA MOTIVATA.** Il
   * riquadro in testa a questa classe dice che il contesto lo *deduce* la pagina
   * della mano, per non obbligare vetrina e libreria a ricordarsi di popolarlo.
   * Qui non è possibile: quali righe siano spuntate lo sa **solo** `/mie-mani`,
   * non è ricavabile dal percorso di provenienza e non sta da nessuna parte da
   * cui rileggerlo. La regola generale resta; questa è l'eccezione che il
   * requisito impone, non una scorciatoia.
   *
   * ⚠️ **Non passa dall'API**: le righe le ha già in mano il chiamante, e
   * rifarne la richiesta filtrata vorrebbe un endpoint nuovo per un elenco che
   * è già a schermo.
   */
  impostaSelezione(mani: readonly (HandView | HandMineView)[]): void {
    this.imposta('selezione', mani);
  }

  pulisci(): void {
    this._origine.set(null);
    this._mani.set([]);
  }

  private imposta(o: OrigineContesto, mani: readonly (HandView | HandMineView)[]): void {
    this._origine.set(o);
    this._mani.set(
      mani.map((m) => {
        const eroe = m.players.find((p) => p.isHero);
        return {
          publicId: m.publicId,
          formato: m.gameTypeLabel,
          carte: eroe?.carte ?? [],
          netto: eroe ? nettoLeggibile(m, eroe.seat) : null,
        };
      }),
    );
  }
}
