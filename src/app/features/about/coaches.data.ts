export type CoachId = 'exivezzz' | 'nagato' | 'bastogne';

export interface CoachStat {
  label: string;
  value: string;
}

export interface Coach {
  id: CoachId;
  num: string;
  nickname: string;
  /** Nome e cognome reali, mostrati sotto il nickname. */
  fullName: string;
  eyebrow: string;
  tag: string;
  bio: string;
  /** Micro-quote in prima persona, mostrata come citazione nel pannello. */
  quote: string;
  stats: CoachStat[];
  isFounder?: boolean;
}

export const COACHES: Coach[] = [
  {
    id: 'exivezzz',
    num: '01',
    nickname: 'Exivezzz',
    fullName: 'Alessandro “Exivezzz” Vendramin',
    eyebrow: 'Main Coach',
    tag: 'Twister 200 € · specialista exploit',
    bio:
      'Main coach della scuola e top reg dei Twister da 200 euro. Exivezzz vive di ' +
      'letture: legge i field, trova le falle e le punisce con una precisione che a ' +
      'fine sessione non lascia molto da discutere. Quando non è al tavolo, è su un ' +
      'campo di beach volley sotto il sole. Stesso schema: capire l’avversario, ' +
      'scegliere il momento, chiudere il punto. Da lui impari a exploitare davvero, ' +
      'non a memoria.',
    quote: '«Il fish non lo aspetto: lo vado a prendere.»',
    stats: [
      { label: 'Stake', value: 'Twister 200 €' },
      { label: 'Stile', value: 'Macchina da exploit' },
      { label: 'Fuori dal tavolo', value: 'Beach volley addict' },
    ],
  },
  {
    id: 'nagato',
    num: '02',
    nickname: 'NagatoUzumaki',
    fullName: 'Pietro “NagatoUzumaki” Piraino',
    eyebrow: 'Founder & Coach',
    tag: 'Twister 50 € · Software Developer',
    bio:
      'Founder della scuola e mente dietro il sito che stai usando: di professione ' +
      'Software Developer, reg dei Twister da 50 euro. NagatoUzumaki ha messo insieme ' +
      'il progetto Best Fish Forever un pezzo alla volta, con la stessa pazienza con ' +
      'cui prepara una battuta. Fuori dal poker è un sub in apnea: scende in ' +
      'profondità con muta, pinne e arbalete a caccia di pesci. Veri, quelli. Il ' +
      'doppio senso è tutta la nostra filosofia.',
    quote: '«Sott’acqua o ai tavoli, la preda è sempre la stessa.»',
    stats: [
      { label: 'Ruolo', value: 'Founder' },
      { label: 'Professione', value: 'Software Developer' },
      { label: 'Stake', value: 'Twister 50 €' },
      { label: 'Fuori dal tavolo', value: 'Pesca in apnea' },
    ],
    isFounder: true,
  },
  {
    id: 'bastogne',
    num: '03',
    nickname: 'Bastogne87',
    fullName: 'Pietro “Bastogne87” Bulfon',
    eyebrow: 'Coach',
    tag: 'People’s Poker · 50 e 100 €',
    bio:
      'Genovese, classe 1987, vive di poker da sei anni: ha lasciato la Magistrale in ' +
      'Architettura a pochissimi esami dalla fine perché nel poker aveva ormai ' +
      'trovato la sua dimensione. Ha scalato gli Spin & Go partendo dai 5 euro fino ' +
      'ai 100 di PokerStars — l’ultimo gradino prima dei nosebleed — e oggi grinda i ' +
      '50 e i 100 su People’s Poker. Da oltre due anni allena, sia in privato sia ' +
      'per chi vuole alzare il proprio livello. Specialista del gioco No Ante, ' +
      'conosce GTO Wizard a fondo, anche in chiave exploitativa.',
    quote: '«Studio la GTO per sapere quando vale la pena tradirla.»',
    stats: [
      { label: 'Stake', value: 'People’s 50/100 €' },
      { label: 'Specialità', value: 'Gioco No Ante' },
      { label: 'Firma', value: 'GTO Wizard in chiave exploit' },
    ],
  },
];
