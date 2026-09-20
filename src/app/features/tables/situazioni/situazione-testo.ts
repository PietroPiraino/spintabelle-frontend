import type { PreflopNode } from '../../../core/models/api.models';
import {
  BASE_LABELS,
  depthDisplay,
  formatBb,
  formatEv,
  formatFreq,
  parseFormat,
} from '../preflop-display';
import { SOGLIA_CONFINE, type AzioneStat, type Statistiche } from './situazione-stats';
import { nomePosizione, type Situazione } from './situazioni.catalogo';

/**
 * Il testo di una pagina chart, generato dai NUMERI del nodo: ogni pagina
 * dice cose diverse perche' i dati sono diversi, e nessuna e' un modello
 * riempito a mano. E' prosa che il lettore legge davvero (come si legge la
 * griglia, dove sono le decisioni al margine, che cosa NON e' questa tabella)
 * e insieme le ~400 parole che distinguono una pagina da una griglia nuda.
 *
 * ⚠️ VINCOLO LEGALE (art. 9 DL 87/2018): niente nomi di sala, niente
 * promesse. I template qui sotto sono lintati da `situazioni.test.mjs` sulle
 * 24 pagine generate.
 */

export interface Faq {
  q: string;
  a: string;
}

const pct = (x: number) => formatFreq(x);
/** EV col segno, ma uno zero senza segno: «+0,00» si legge come un errore. */
const ev = (x: number) => formatEv(x).replace(/^[+−]0,00$/, '0,00');

/** «va all-in», «rilancia a 2 bb», «limpa», «chiama», «checka», «passa». */
function verbo(a: AzioneStat, controAllIn: boolean): string {
  switch (a.tipo) {
    case 'ALLIN':
      return 'va all-in';
    case 'RAISE':
      return `rilancia a ${a.label.replace(/^Raise /, '').replace('bb', ' bb')}`;
    case 'CALL':
      return controAllIn ? 'chiama' : 'limpa';
    case 'CHECK':
      return 'checka';
    default:
      return 'passa';
  }
}

/** Terza plurale: «vanno all-in», «rilanciano a 2 bb», «limpano», «chiamano»… */
function verboPlurale(a: AzioneStat, controAllIn: boolean): string {
  switch (a.tipo) {
    case 'ALLIN':
      return 'vanno all-in';
    case 'RAISE':
      return `rilanciano a ${a.label.replace(/^Raise /, '').replace('bb', ' bb')}`;
    case 'CALL':
      return controAllIn ? 'chiamano' : 'limpano';
    case 'CHECK':
      return 'checkano';
    default:
      return 'passano';
  }
}

/** «l'all-in», «il rilancio a 2 bb», «il limp», «la chiamata», «il check», «il fold». */
function nome(a: AzioneStat, controAllIn: boolean): string {
  switch (a.tipo) {
    case 'ALLIN':
      return 'l’all-in';
    case 'RAISE':
      return `il rilancio a ${a.label.replace(/^Raise /, '').replace('bb', ' bb')}`;
    case 'CALL':
      return controAllIn ? 'la chiamata' : 'il limp';
    case 'CHECK':
      return 'il check';
    default:
      return 'il fold';
  }
}

function elenco(parti: string[]): string {
  if (parti.length <= 1) return parti.join('');
  return `${parti.slice(0, -1).join(', ')} e ${parti[parti.length - 1]}`;
}

function iniziale(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** «il bottone», «lo small blind», «il big blind». */
function conArticolo(pos: string): string {
  return pos.startsWith('s') ? `lo ${pos}` : `il ${pos}`;
}

/** «in uno Spin & Go», «in un Heads-Up». */
function inUn(gioco: string): string {
  return /^S/.test(gioco) ? `in uno ${gioco}` : `in un ${gioco}`;
}

export function paragrafiSituazione(
  s: Situazione,
  node: PreflopNode,
  st: Statistiche,
): string[] {
  const controAllIn = /RAI$/.test(s.preflop_actions);
  const pos = nomePosizione(s.posizione);
  const parti = parseFormat(node.format);
  const gioco = BASE_LABELS[parti.base];
  const bb = depthDisplay(node.depth_label, node.format);
  const giocatori = parti.base === 'husng' ? 'due' : 'tre';
  const attive = st.azioni.filter((a) => a.quotaCombo >= 0.0005);
  const fold = st.azioni.find((a) => a.tipo === 'FOLD');
  const nonFold = attive.filter((a) => a.tipo !== 'FOLD');
  const out: string[] = [];

  // 1. La situazione e il riassunto
  out.push(
    `${iniziale(conArticolo(pos))} con ${bb} big blind, ${s.contesto}, ${inUn(gioco)} a ${giocatori} giocatori. ${s.premessa} Il piatto vale ${formatBb(node.pot)} big blind. La griglia mostra la strategia di equilibrio (GTO) calcolata sull’albero preflop completo del formato, non su un gioco ridotto a due mosse: in equilibrio ${conArticolo(pos)} ${elenco(
      attive.map((a) => `${verbo(a, controAllIn)} con il ${pct(a.quotaCombo)} delle combinazioni`),
    )}.`,
  );

  // 2. Un paragrafo per ogni azione che non e' il fold
  for (const a of nonFold) {
    const top = a.maniPure.slice(0, 4);
    const testa = `${iniziale(nome(a, controAllIn))} copre il ${pct(a.quotaCombo)} delle 1.326 combinazioni: ${a.maniDominanti} mani su 169 lo scelgono più spesso di ogni altra azione.`;
    if (!a.maniPure.length) {
      out.push(`${testa} Nessuna mano lo fa in modo puro: compare solo nelle strategie miste, cioè in mani che alternano due azioni con frequenze precise.`);
      continue;
    }
    out.push(
      `${testa} Le mani che ${verboPlurale(a, controAllIn)} sempre: ${a.notazione}. Le più redditizie per EV sono ${elenco(top)}.`,
    );
  }

  // 3. Il fold
  if (fold && fold.quotaCombo >= 0.0005) {
    out.push(
      `Il fold copre il ${pct(fold.quotaCombo)} delle combinazioni ed è l’azione più frequente per ${fold.maniDominanti} mani su 169. ${
        controAllIn
          ? 'Davanti a un all-in il fold vale esattamente zero, mentre la chiamata vale l’equity della mano contro il range di chi ha spinto meno la puntata da pareggiare: le mani passate sono quelle sotto la soglia di equity che le pot odds richiedono.'
          : 'A piatto non aperto il fold vale zero per definizione: ogni mano giocata deve valere più di zero contro i range di risposta degli avversari, e quelle che non ci arrivano si passano.'
      }`,
    );
  }

  // 4. Le mani miste
  if (st.maniMiste.length) {
    const esempi = st.maniMiste.slice(0, 5).map((m) => {
      const azioni = st.azioni.filter((a) => m.parti.some((p) => p.code === a.code));
      return `${m.mano} (${azioni
        .map((a) => `${nome(a, controAllIn).replace(/^(l’|il |la )/, '')} ${pct(m.parti.find((p) => p.code === a.code)!.freq)}`)
        .join(', ')})`;
    });
    out.push(
      `${st.maniMiste.length} mani hanno una strategia mista, cioè si giocano in due modi con frequenze precise: per esempio ${elenco(esempi)}. Non è indecisione del solver: è ciò che rende la strategia non sfruttabile, perché nessuna mano dichiara da sola quale azione porta. A un tavolo vero si può semplificare scegliendo l’azione più frequente, con una perdita di EV quasi sempre trascurabile.`,
    );
  }

  // 5. Il confine fra giocare e passare
  if (st.confine) {
    const nomeDi = (code: string) =>
      nome(st.azioni.find((x) => x.code === code)!, controAllIn).replace(/^(l’|il |la )/, '');
    const giocate = st.confine.giocate.map((m) => `${m.mano} (${nomeDi(m.azione)}, ${ev(m.ev)} bb)`);
    const passate = st.confine.passate.map((m) => `${m.mano} (${nomeDi(m.azione)} varrebbe ${ev(m.ev)} bb)`);
    out.push(
      `Il confine fra giocare e passare: le mani più deboli che si giocano ancora sono ${elenco(giocate)}; le più forti che si passano sono ${elenco(passate)}. In tutto ${st.confine.quante} mani stanno entro ${formatBb(SOGLIA_CONFINE)} big blind da quel confine, e sono quelle che una lettura dell’avversario può spostare da un lato o dall’altro: le mani lontane dal confine si giocano allo stesso modo contro chiunque.`,
    );
  }

  // 6. Le mani non raggiunte
  if (st.nonRaggiunte > 0) {
    out.push(
      `${st.nonRaggiunte} mani non arrivano mai a questo nodo: chi le aveva le ha già passate, rilanciate o spinte in una decisione precedente, quindi la griglia le mostra spente. Non è una difficoltà: è una mano che qui non si può avere.`,
    );
  }

  // 7. Come si legge, e che cosa NON e'
  out.push(
    `Come si legge la griglia: le coppie stanno sulla diagonale, le mani dello stesso seme sopra (per esempio AKs), quelle di semi diversi sotto (AKo); ogni cella è divisa in segmenti colorati proporzionali alla frequenza di ciascuna azione, e passando sulla cella si leggono frequenza ed EV di ogni scelta. L’EV medio del range a questo nodo è ${formatEv(st.evMedio)} big blind.`,
  );
  out.push(
    parti.base === 'husng'
      ? `Questa non è la tabella di Nash. Le tabelle di Nash risolvono un gioco a due sole mosse, push o fold; qui l’albero comprende anche il limp e il rilancio piccolo, e alle profondità in cui il limp è redditizio la differenza è grande: la strategia di equilibrio dello small blind cambia forma, e la colonna «call» del big blind cambia con lei. È l’equilibrio del gioco completo, non la mossa migliore contro un avversario preciso: contro chi passa troppo si spinge più largo, contro chi chiama troppo più stretto.`
      : `È l’equilibrio, non la mossa migliore contro un avversario preciso: contro chi passa troppo davanti a un all-in si spinge più largo di così, contro chi chiama troppo più stretto. Le tabelle servono a sapere da dove si sta deviando. La struttura con l’ante ha una griglia a sé, con range un po’ più larghi, e la variante con stack asimmetrici (uno dei tre giocatori corto) un’altra ancora: sono nel visualizzatore, insieme a ogni altra profondità e a ogni nodo successivo a questo.`,
  );
  return out;
}

export function faqSituazione(s: Situazione, node: PreflopNode, st: Statistiche): Faq[] {
  const controAllIn = /RAI$/.test(s.preflop_actions);
  const pos = nomePosizione(s.posizione);
  const bb = depthDisplay(node.depth_label, node.format);
  const parti = parseFormat(node.format);
  const allin = st.azioni.find((a) => a.tipo === 'ALLIN');
  const call = st.azioni.find((a) => a.tipo === 'CALL');
  const fold = st.azioni.find((a) => a.tipo === 'FOLD');
  const out: Faq[] = [];

  if (allin && allin.quotaCombo >= 0.0005) {
    out.push({
      q: `Con quali mani si va all-in ${s.posizione === 'BB' ? 'dal big blind' : s.posizione === 'SB' ? 'dallo small blind' : 'dal bottone'} a ${bb} big blind?`,
      a: `In equilibrio l’all-in copre il ${pct(allin.quotaCombo)} delle combinazioni. Le mani che lo fanno sempre sono ${allin.notazione || 'poche e tutte in strategia mista'}; le altre lo alternano con un’altra azione secondo le frequenze della griglia.`,
    });
  }
  if (controAllIn && call && call.quotaCombo >= 0.0005) {
    out.push({
      q: `Quante mani chiamano l’all-in ${pos === 'big blind' ? 'dal big blind' : 'dallo small blind'} a ${bb} big blind?`,
      a: `La chiamata copre il ${pct(call.quotaCombo)} delle combinazioni, ${call.maniDominanti} mani su 169. Sembrano tante perché una parte delle fiches è già nel piatto: le pot odds richiedono meno equity di quanta ne suggerisca l’istinto, e il fold vale zero.`,
    });
  }
  if (fold) {
    out.push({
      q: `Quante mani si passano in questa situazione?`,
      a: `Il fold copre il ${pct(fold.quotaCombo)} delle combinazioni. ${
        controAllIn
          ? 'Sono le mani che contro il range di chi ha spinto non raggiungono l’equity richiesta dal piatto.'
          : 'Non è timidezza: contro i range di risposta degli avversari, quelle mani valgono meno di zero se giocate.'
      }`,
    });
  }
  out.push(
    parti.base === 'husng'
      ? {
          q: 'Questa tabella coincide con la chart di Nash per l’heads-up?',
          a: 'No. Le tabelle di Nash conoscono solo push e fold; questa è calcolata sull’albero preflop completo, con limp e rilancio, e alle profondità in cui il limp è redditizio i range di spinta sono più stretti di quelli di Nash e la colonna del call cambia di conseguenza.',
        }
      : {
          q: 'Vale anche per i Twister e per le strutture con l’ante?',
          a: 'Il Twister è lo stesso gioco a tre con un altro nome: la griglia vale. La struttura con l’ante ha invece una tabella propria, con range un po’ più larghi perché il piatto iniziale è più grande; nel visualizzatore ci sono entrambe, a ogni profondità.',
        },
  );
  return out;
}
