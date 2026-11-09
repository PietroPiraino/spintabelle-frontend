/**
 * I testi statici della pagina `/awards`: ciò che finisce nell'HTML
 * prerenderizzato, cioè ciò che legge chi arriva da Google o da una card
 * condivisa prima che l'API risponda.
 *
 * ⚠️ Etichette e descrizioni delle categorie sono la COPIA di
 * `backend/src/awards/awards.types.ts` (`categoriaEtichetta`,
 * `categoriaDescrizione`): due repo che non condividono codice. Cambiandole di
 * là, vanno cambiate qui.
 *
 * ⚠️ Art. 9 DL 87/2018: nessun nome di sala, nessun importo vinto, nessun
 * volume di gioco, nessuna promessa. La spec li passa tutti al lint di
 * `core/art9.constants.ts`.
 */
import type {
  AwardsCategoria,
  AwardsFormato,
  DateAwards,
} from '../../core/models/awards.models';

export interface CategoriaAwards {
  categoria: AwardsCategoria;
  etichetta: string;
  descrizione: string;
  formato: AwardsFormato;
}

const FASCIA_LOW = 'buy-in fino a 10 €';
const FASCIA_MID = 'buy-in da 20 a 50 €';

export const CATEGORIE_AWARDS: readonly CategoriaAwards[] = [
  {
    categoria: 'sng-assoluto',
    etichetta: 'Miglior giocatore italiano Spin & Go',
    descrizione:
      'Il giocatore italiano che, secondo la comunità, ha giocato meglio nell’anno, a qualunque livello.',
    formato: 'spin',
  },
  {
    categoria: 'sng-mid',
    etichetta: 'Miglior giocatore Spin & Go Mid stakes',
    descrizione: `Il miglior regular ai tavoli con ${FASCIA_MID}.`,
    formato: 'spin',
  },
  {
    categoria: 'sng-low',
    etichetta: 'Miglior giocatore Spin & Go Low stakes',
    descrizione: `Il miglior regular ai tavoli con ${FASCIA_LOW}.`,
    formato: 'spin',
  },
  {
    categoria: 'sng-grinder',
    etichetta: 'Miglior mass grinder Spin & Go',
    descrizione:
      'Chi gioca molti tavoli insieme e non si ferma mai: il grinder più riconosciuto della comunità.',
    formato: 'spin',
  },
  {
    categoria: 'twister-assoluto',
    etichetta: 'Miglior giocatore italiano Twister',
    descrizione:
      'Il giocatore italiano che, secondo la comunità, ha giocato meglio nell’anno, a qualunque livello.',
    formato: 'twister',
  },
  {
    categoria: 'twister-mid',
    etichetta: 'Miglior giocatore Twister Mid stakes',
    descrizione: `Il miglior regular ai tavoli con ${FASCIA_MID}.`,
    formato: 'twister',
  },
  {
    categoria: 'twister-low',
    etichetta: 'Miglior giocatore Twister Low stakes',
    descrizione: `Il miglior regular ai tavoli con ${FASCIA_LOW}.`,
    formato: 'twister',
  },
  {
    categoria: 'twister-grinder',
    etichetta: 'Miglior mass grinder Twister',
    descrizione:
      'Chi gioca molti tavoli insieme e non si ferma mai: il grinder più riconosciuto della comunità.',
    formato: 'twister',
  },
  {
    categoria: 'fish',
    etichetta: "Fish dell'anno",
    descrizione:
      'La categoria ironica: un premio che si prende con il sorriso, e che si assegna solo a chi lo accetta.',
    formato: 'comunita',
  },
];

/** I tre gruppi in cui la pagina mostra le categorie. */
export const GRUPPI_AWARDS: readonly { formato: AwardsFormato; titolo: string }[] =
  [
    { formato: 'spin', titolo: 'Spin & Go' },
    { formato: 'twister', titolo: 'Twister' },
    { formato: 'comunita', titolo: 'Comunità' },
  ];

/**
 * Le date decise per l'edizione 2026 (istanti di Roma). Servono solo finché
 * l'API non risponde: le date vere sono quelle del documento-edizione, che si
 * spostano dal pannello senza deploy.
 */
export const DATE_AWARDS_2026: DateAwards = {
  proposteDal: '2026-11-10T00:00:00+01:00',
  proposteAl: '2026-11-22T23:59:59.999+01:00',
  contattiAl: '2026-12-03T23:59:59.999+01:00',
  votoDal: '2026-12-07T00:00:00+01:00',
  votoAl: '2027-01-04T23:59:59.999+01:00',
  cerimoniaAt: '2027-01-09T21:00:00+01:00',
};

/**
 * Il regolamento, una regola per voce. ⚠️ Ogni frase qui è una promessa che il
 * backend mantiene: cambiarne una senza cambiare il codice (o il registro A20)
 * rende falsa la pagina.
 */
export const REGOLE_AWARDS: readonly string[] = [
  'Possono proporre e votare tutti gli iscritti al sito con l’indirizzo email confermato. L’iscrizione è gratuita.',
  'Si propone un nickname per categoria, e lo si può cambiare fino alla chiusura delle proposte. Si può proporre anche sé stessi.',
  'Le proposte restano private: non le pubblichiamo mai, né una per una né come classifica.',
  'Contattiamo i giocatori più proposti con un invito personale. Compare sul sito solo chi accetta, e solo nelle categorie che sceglie.',
  'Per ogni categoria la rosa finale ha da tre a cinque finalisti. Una categoria con meno di tre finalisti quest’anno non viene assegnata.',
  'Si vota un finalista per categoria, e si può cambiare il voto fino alla chiusura. Il voto è segreto.',
  'Non pubblichiamo quanti voti ha preso ciascuno, nemmeno a premi assegnati: si annunciano solo i vincitori. In caso di parità il premio è ex aequo.',
  'Lo staff può annullare i voti irregolari, per esempio quelli in serie da account creati apposta.',
  'Non ci sono premi in denaro né altri vantaggi: in palio c’è il riconoscimento della comunità e un posto nell’albo d’oro.',
  'Le categorie premiano soltanto: non esistono categorie per mettere in cattiva luce qualcuno.',
];

/** FAQ: unica sorgente per il testo a schermo e per il JSON-LD FAQPage. */
export const FAQ_AWARDS: readonly { q: string; a: string }[] = [
  {
    q: 'Posso proporre un giocatore che non è iscritto al sito?',
    a: 'Sì. Lo contattiamo noi, con un invito personale, e compare sul sito solo se accetta. Finché non accetta, il suo nickname resta un conteggio privato.',
  },
  {
    q: 'Posso proporre me stesso?',
    a: 'Sì, come chiunque altro. Se il tuo nickname è fra i più proposti nella categoria, ti mandiamo l’invito come a tutti.',
  },
  {
    q: 'Il mio voto è pubblico?',
    a: 'No. Nessuno sul sito vede per chi hai votato, e alla fine si annunciano solo i vincitori, senza il numero dei voti.',
  },
  {
    q: 'C’è un premio in denaro?',
    a: 'No. I vincitori entrano nell’albo d’oro dei premi e ricevono un riconoscimento nella propria area personale. È un premio della comunità, non un concorso.',
  },
  {
    q: 'Come si diventa finalisti?',
    a: 'Servono tre cose: essere fra i nickname più proposti nella categoria, accettare l’invito, ed essere scelti per la rosa finale, che ha da tre a cinque nomi.',
  },
  {
    q: 'Quando si conoscono i vincitori?',
    a: 'Il giorno della premiazione, in diretta sul nostro canale YouTube. Subito dopo li trovi in questa pagina, nell’albo d’oro.',
  },
];
