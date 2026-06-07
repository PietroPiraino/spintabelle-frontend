export type CoachId = 'exivezz' | 'nagato' | 'bastogne';

export interface CoachStat {
  label: string;
  value: string;
}

export interface Coach {
  id: CoachId;
  num: string;
  nickname: string;
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
    id: 'exivezz',
    num: '01',
    nickname: 'Exivezz',
    eyebrow: 'Main Coach',
    tag: 'Twister 200 € · specialista exploit',
    bio:
      'Main coach della scuola e top reg dei Twister da 200 euro. Exivezz vive di ' +
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
    eyebrow: 'Coach',
    tag: 'People’s Poker · 50 e 100 €',
    bio:
      'Coach con un debole dichiarato per l’estetica del Joker di Batman: giacca ' +
      'viola, gilet, tutto il guardaroba — ma con la sua faccia, capelli ' +
      'biondo-ramati e occhi azzurri. Bastogne87 gioca i 50 e i 100 euro su People’s ' +
      'Poker e non si ferma lì: ama esplorare field diversi, anche low stakes, per ' +
      'studiare come cambia il gioco. Curioso per natura, è il primo a provare ' +
      'tavoli nuovi.',
    quote: '«Mi vesto da matto, gioco da lucido.»',
    stats: [
      { label: 'Stake', value: 'People’s 50/100 €' },
      { label: 'Stile', value: 'Field explorer' },
      { label: 'Firma', value: 'Estetica da Joker' },
    ],
  },
];
