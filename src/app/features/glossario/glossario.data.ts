/**
 * Il glossario del poker di /glossario.
 *
 * ⚠️ PERCHE' ESISTE, misurato e non ipotizzato (19-20/09/2026). Il sito e'
 * PRIMO su query Spin & Go che in Italia digita una persona al mese: il collo
 * di bottiglia e' la domanda, non la posizione. Un glossario e' l'unico tipo
 * di contenuto la cui domanda NON dipende dal formato — «limp poker
 * significato», «cosa significa squeeze nel poker» le cerca chi gioca
 * qualunque cosa — e allarga l'imbuto verso chi non sa ancora di volere una
 * scuola. E' anche l'unica cosa che rende visibile il concorrente piu' vicino:
 * le sue sei keyword in SimilarWeb sono tutte voci di glossario.
 *
 * ⚠️ OGNI VOCE HA UNA `query` MISURATA (autocompletamento di Google, ordinato
 * per frequenza reale): non e' un campo decorativo, e' la ragione per cui la
 * voce esiste e la tabella con cui l'owner l'ha approvata. Una voce senza
 * domanda si scrive solo se e' il bersaglio di un link dalle guide.
 *
 * ⚠️ VOCI DA 180-250 PAROLE, NON DA 40. I glossari concorrenti stanno a 32-64
 * parole per voce (misurato): una definizione in una riga piu' l'angolo
 * «negli Spin & Go» con un numero concreto e' contenuto migliore, non «thin».
 * Il pavimento e' 120 (la guardia del build), l'obiettivo e' 180.
 *
 * Stesso schema delle guide (`guides.data.ts`): contenuto STRUTTURATO in un
 * file TS, mai Markdown; `getPrerenderParams` legge gli slug da qui; la
 * sitemap li prende dal manifest; `check-prerender-content.mjs` misura ogni
 * pagina. ⚠️ Questo file ha SOLO `import type`: cosi' Node 24 lo importa senza
 * build e i test di `scripts/lib/` (glossario-lint) leggono i VALORI invece di
 * fare regex sul sorgente.
 *
 * ⚠️ VINCOLO LEGALE su ogni testo (art. 9 DL 87/2018): taglio didattico,
 * nessun nome di sala, nessun bonus, nessun link a piattaforme di gioco, mai
 * una promessa al lettore. Il lint (`scripts/check-glossario.mjs`) applica le
 * liste di `core/art9.constants.ts` a OGNI campo di testo. Rakeback, staking,
 * punti e moltiplicatori si DESCRIVONO e non si propongono (il test §D di
 * `gdpr/valutazione-prospetto-e-punti.md`): mai un rimando a /affiliazioni.
 *
 * ⚠️ Niente caratteri di seme (♠♥♦♣) nei testi: `semi-nudi.test.mjs`
 * scansiona anche i `.ts`. Si scrive «picche», «cuori».
 */

import type { GuideLink } from '../guides/guides.data';

export interface Voce {
  /** Segmento di URL: /glossario/<slug>/. ⚠️ Immutabile una volta pubblicata. */
  slug: string;
  /** Il termine come si scrive: e' l'<h1>, il nome nel DefinedTerm e la riga dell'indice. */
  termine: string;
  /** Sinonimi e forma inglese («jam» per shove): alternateName + riga «Detto anche». */
  varianti?: string[];
  /**
   * La query misurata che la voce insegue (autocompletamento Google, hl=it).
   * NON viene resa: serve al CLI di revisione e documenta il perche' della voce.
   */
  query: string;
  /** <title> SENZA il suffisso " — Best Fish Forever" (lo aggiunge SeoService); ≤ 60 caratteri. */
  titolo: string;
  /**
   * UNA frase ≤ 160 caratteri, col punto finale. E' quattro cose insieme: meta
   * description, DefinedTerm.description, riga dell'indice, lead della pagina —
   * cosi' indice e pagina non possono contraddirsi.
   */
  definizione: string;
  /** 2-4 paragrafi: come si usa, e l'angolo «negli Spin & Go» con un numero concreto. */
  spiegazione: string[];
  /** Un caso concreto, reso come paragrafo evidenziato. */
  esempio?: string;
  /** «Dove lo usi»: la guida che approfondisce (href = '/guide/<slug>', senza slash finale). */
  guida?: GuideLink;
  /** «Dove lo usi»: lo strumento del sito in cui il termine si tocca con mano. */
  strumento?: GuideLink;
  /** 2-4 slug di altre voci; mai se stessa. */
  correlati: string[];
  /** Data ISO dell'ultimo aggiornamento sostanziale (JSON-LD dateModified). */
  aggiornata: string;
}

/**
 * Le voci, nell'ordine in cui sono state scritte: l'indice le riordina per
 * lettera, quindi qui l'ordine non conta. Ondata 1 = le 50 con domanda
 * definitoria italiana esplicita; ondata 2 = le 50 con «X poker» ≥ 10
 * suggerimenti e pertinenza Spin & Go (piano del 20/09/2026).
 */
export const VOCI: readonly Voce[] = [
  {
    slug: 'all-in',
    termine: 'All-in',
    varianti: ['andare all-in', 'mettersi all-in'],
    query: 'all in poker significato',
    titolo: 'All-in nel poker: significato e quando si usa',
    definizione:
      'Andare all-in significa puntare tutte le fiches che si hanno davanti in una sola azione: da quel momento non si può più né puntare né foldare.',
    spiegazione: [
      'Chi va all-in mette nel piatto l’intero stack. Se un avversario ha più fiches, la parte in eccesso non entra in gioco: si vince al massimo quanto si è messo, e se restano altri giocatori si crea un piatto laterale (side pot) a cui il giocatore all-in non partecipa. Chi è all-in non prende più decisioni: aspetta lo showdown e vede le carte comuni fino al river.',
      'Negli Spin & Go l’all-in è la mossa più comune del gioco. Con stack da 25 big blind che scendono in fretta a 10-12, il rilancio «normale» lascia troppe fiches indietro e regala all’avversario la possibilità di ributtare tutto: per questo la teoria dice che, sotto una certa profondità, la prima azione dal bottone è o fold o all-in. Alla radice di uno Spin a 10 big blind il bottone va all-in con circa un quarto delle mani e passa quasi due terzi delle altre.',
      'L’errore tipico del principiante è leggere l’all-in come un gesto emotivo. È una scelta di dimensione: a 8 big blind, puntare tutto con una mano discreta vale più di un rilancio piccolo, perché toglie all’avversario ogni margine per rilanciare a sua volta e lo costringe a una decisione netta.',
    ],
    esempio:
      'Bottone con 9 big blind, gli altri due giocatori hanno 12 e 9. Con K-9 dello stesso seme la mossa di equilibrio non è rilanciare a 2 big blind: è all-in, perché un rilancio piccolo lascia il 78% dello stack indietro e apre la porta a un controrilancio a cui non si può rispondere.',
    guida: {
      testo: 'la guida al push/fold negli Spin & Go',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, dove si vede a quale profondità l’all-in diventa la mossa di default',
      href: '/tabelle',
    },
    correlati: ['push-fold', 'shove', 'open-shove', 'stack'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'push-fold',
    termine: 'Push/fold',
    varianti: ['push or fold', 'push-fold'],
    query: 'push fold poker meaning',
    titolo: 'Push/fold nel poker: cos’è e quando si gioca così',
    definizione:
      'Il push/fold è il regime di gioco in cui, con stack corti, ogni mano si riduce a due sole scelte: andare all-in (push) oppure passare (fold).',
    spiegazione: [
      'Quando lo stack scende sotto le 10-12 big blind, rilanciare «a metà» smette di avere senso: un rilancio a 2 big blind impegna già un quinto delle fiches e lascia all’avversario la possibilità di ributtare tutto. A quel punto la teoria semplifica l’albero delle decisioni a due rami, e le tabelle di equilibrio (le cosiddette tabelle di Nash) dicono con quali mani spingere e con quali passare, in base alla posizione e alla profondità.',
      'Negli Spin & Go il push/fold non è un caso limite: è il pane quotidiano. Si parte con 25 big blind in tre, i bui salgono ogni pochi minuti e nella maggior parte dei tornei si arriva a 10 big blind entro il primo quarto d’ora. Sapere a memoria i range di push dal bottone e dal piccolo buio, e i range di call dal grande buio, vale più di qualunque altra competenza nel formato.',
      'Un errore diffuso è applicare le tabelle a 15-20 big blind, dove il rilancio piccolo (il min-raise) torna a essere una mossa valida e più redditizia del push con molte mani. Il push/fold è la risposta giusta a una profondità precisa, non una filosofia.',
    ],
    esempio:
      'Piccolo buio con 7 big blind, il bottone ha passato. Con A-4 offsuit la tabella dice push: anche se il grande buio chiama con un range ampio, la mano ha abbastanza equity e il piatto già presente (1,5 big blind fra bui e ante) rende il fold troppo caro.',
    guida: {
      testo: 'la guida al push/fold negli Spin & Go, con le profondità in cui il regime scatta',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'l’allenamento preflop, che propone proprio le decisioni push/fold a stack corto',
      href: '/allenamento',
    },
    correlati: ['all-in', 'shove', 'nash', 'stack'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'shove',
    termine: 'Shove',
    varianti: ['jam', 'push', 'spingere'],
    query: 'shove poker significato',
    titolo: 'Shove nel poker: significato di shove, jam e push',
    definizione:
      'Shove (o jam, o push) è il verbo con cui si indica l’andare all-in: «shovare» una mano significa puntare tutto lo stack in un colpo solo.',
    spiegazione: [
      'Shove, jam e push dicono la stessa cosa e la scelta fra i tre è solo gergo: «shove» è il termine più comune nella letteratura di strategia, «jam» quello dei giocatori americani, «push» quello che dà il nome al regime push/fold. In italiano si sente spesso «spingere» o direttamente «pushare». Tutti descrivono l’azione, non lo stato: chi ha shovato è all-in.',
      'Negli Spin & Go la parola compare in ogni discussione di mano perché è la decisione più frequente del formato. Si distingue lo shove come prima azione (l’open shove, dal bottone o dal piccolo buio a piatto non aperto) dal re-shove, cioè l’all-in in risposta a un rilancio: sono due situazioni con range molto diversi, e le tabelle le trattano come nodi separati. Chi va all-in sopra un rilancio ha bisogno di una mano più forte, perché l’avversario ha già dichiarato qualcosa.',
      'Lo shove ha un vantaggio strutturale a stack corto: è l’unica puntata a cui l’avversario non può rispondere con un rilancio, quindi trasforma una decisione a più strade in una a due sole (chiama o passa). È per questo che sotto le 10 big blind quasi ogni rilancio della teoria diventa uno shove.',
    ],
    esempio:
      'Bottone con 11 big blind rilancia a 2; il piccolo buio, con 10 big blind e A-J offsuit, non chiama e non rilancia a 5: re-shova. Contro un range di apertura largo la mano è avanti, e l’all-in impedisce al bottone di vedere un flop a buon mercato in posizione.',
    guida: {
      testo: 'la guida al push/fold negli Spin & Go',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, nodo per nodo, dove ogni shove ha la sua frequenza',
      href: '/tabelle',
    },
    correlati: ['all-in', 'open-shove', 'push-fold', 'raise'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'open-shove',
    termine: 'Open shove',
    varianti: ['open push', 'open jam'],
    query: 'open shove meaning poker',
    titolo: 'Open shove nel poker: cosa significa e con quali mani',
    definizione:
      'L’open shove è l’all-in fatto come prima azione della mano, a piatto non ancora aperto: nessuno ha rilanciato prima, e chi parla mette tutto.',
    spiegazione: [
      'La parola «open» indica che il piatto è ancora vergine, cioè contiene solo bui e ante. L’open shove è quindi la versione a stack corto dell’open raise: invece di aprire con un rilancio piccolo, si apre puntando l’intero stack. Va distinto dal re-shove (l’all-in sopra un rilancio altrui) e dal call all-in (chiamare un all-in): tre situazioni con tre range diversi.',
      'Negli Spin & Go a tre giocatori l’open shove è la decisione tipica del bottone e del piccolo buio quando lo stack scende sotto le 10 big blind. I range sono più larghi di quanto il principiante si aspetti: dal bottone a 8 big blind si spinge con una porzione ampia delle mani, perché ci sono due avversari che devono chiamare con mani forti e un piatto morto (bui e ante) che rende profittevole raccogliere subito. Dal piccolo buio, dopo il fold del bottone, il range si allarga ancora, perché resta un solo avversario da battere.',
      'Il range di open shove dipende da tre cose: la profondità effettiva (lo stack più corto fra i giocatori coinvolti), la posizione e la presenza dell’ante. Le tabelle di equilibrio le tengono tutte in conto; a memoria si portano via poche soglie, per esempio quali assi si spingono a 8 big blind e quali no.',
    ],
    esempio:
      'Piccolo buio con 6 big blind, il bottone ha passato, il grande buio ha 14 big blind. Con 9-8 dello stesso seme l’open shove è corretto: il grande buio dovrebbe chiamare con circa metà delle mani, ma il piatto già presente e l’equity della mano quando viene chiamata rendono la spinta migliore del fold.',
    guida: {
      testo: 'la guida al push/fold negli Spin & Go',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, con il range di open shove per ogni profondità e posizione',
      href: '/tabelle',
    },
    correlati: ['shove', 'push-fold', 'open-raise', 'all-in'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'fold',
    termine: 'Fold',
    varianti: ['passare', 'foldare', 'lasciare'],
    query: 'fold poker significato',
    titolo: 'Fold nel poker: significato e perché è la mossa più usata',
    definizione:
      'Fold significa abbandonare la mano: si rinuncia alle carte e a qualunque diritto sul piatto, senza mettere altre fiches.',
    spiegazione: [
      'Chi folda esce dalla mano e perde ciò che ha già messo nel piatto (il buio, l’ante, una puntata precedente), ma non rischia altro. È l’unica azione sempre disponibile e non costa niente in più: per questo è anche la più frequente. In un tavolo a tre giocatori il bottone, la prima posizione a parlare, passa la maggioranza delle mani a quasi tutte le profondità.',
      'Negli Spin & Go il fold ha un valore che spesso si sottovaluta: con l’ante in gioco e i bui che salgono in fretta, ogni mano passata costa una frazione di big blind, ma ogni mano giocata male costa lo stack. Le tabelle di equilibrio mostrano che alla radice di uno Spin a 10 big blind il bottone folda circa il 65% delle mani: non per timidezza, ma perché contro due avversari con stack simili la maggior parte delle combinazioni non ha abbastanza equity per essere spinta o rilanciata.',
      'Il fold ha però un costo nascosto che la teoria misura: a piatto non aperto vale esattamente zero, mentre davanti a un all-in vale il rifiuto di un piatto già grande. È per questo che i range di call all-in dal grande buio sono molto più larghi dei range con cui si aprirebbe la stessa mano.',
    ],
    esempio:
      'Grande buio con 12 big blind, il piccolo buio va all-in per 9. Con K-J offsuit il fold è un errore: il piatto contiene già 10,5 big blind e ne servono 8 per chiamare, quindi bastano circa il 43% di equity contro il range di spinta, e K-J ne ha di più.',
    guida: {
      testo: 'la guida agli errori più comuni negli Spin & Go, dove il fold sbagliato compare tre volte',
      href: '/guide/errori-comuni-spin-and-go',
    },
    strumento: {
      testo: 'l’allenamento preflop, che propone anche i fold puri (un quarto delle domande)',
      href: '/allenamento',
    },
    correlati: ['call', 'check', 'raise', 'push-fold'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'call',
    termine: 'Call',
    varianti: ['chiamare', 'vedere', 'flat'],
    query: 'call poker significato',
    titolo: 'Call nel poker: significato e quando chiamare conviene',
    definizione:
      'Call significa pareggiare la puntata dell’avversario mettendo la stessa cifra: si resta in mano senza rilanciare.',
    spiegazione: [
      'Chiamare è l’azione di mezzo fra il fold e il raise: si accetta il prezzo fissato da chi ha puntato e si va a vedere la carta successiva (o lo showdown, se la puntata era un all-in). In italiano si dice anche «vedere»; «flat» o «flat call» indica il chiamare un rilancio invece di rilanciare a propria volta.',
      'Negli Spin & Go la decisione di call più importante è quella davanti a un all-in. Il criterio è aritmetico: si confronta l’equity della propria mano contro il range di chi ha spinto con le pot odds offerte dal piatto. Nel grande buio, con lo stack già in parte impegnato, servono spesso meno del 40% di equity per chiamare correttamente, e questo rende giuste chiamate che a occhio sembrano larghe. L’altra faccia è il call preflop di un rilancio piccolo, che a stack corto è raramente la mossa migliore: si finisce fuori posizione con una mano media e un piatto che vale già metà dello stack.',
      'Chiamare «per vedere» senza un piano è l’errore più caro del formato: ogni fiches chiamata è una fiches che non si può più usare per spingere. Le tabelle indicano dove il call è davvero l’azione migliore e dove è solo la più comoda.',
    ],
    esempio:
      'Grande buio con 10 big blind, il bottone va all-in per 8 dopo il fold del piccolo buio. Con A-8 offsuit si chiama: il piatto offre circa 1,3 a 1 e la mano ha oltre il 50% di equity contro un range di spinta da bottone a 8 big blind.',
    guida: {
      testo: 'la guida al push/fold, dove i range di call all-in sono spiegati per posizione',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO: ogni nodo mostra con quali mani si chiama e con quali no',
      href: '/tabelle',
    },
    correlati: ['fold', 'raise', 'pot-odds', 'equity'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'check',
    termine: 'Check',
    varianti: ['passare la parola', 'bussare'],
    query: 'check poker significato',
    titolo: 'Check nel poker: significato e quando si può fare',
    definizione:
      'Check significa non puntare e passare la parola al giocatore successivo restando in mano: è possibile solo se nessuno ha ancora puntato in quel giro.',
    spiegazione: [
      'Il check è un’azione gratuita: non si mettono fiches e non si rinuncia a niente. Se tutti i giocatori rimasti checkano, si passa alla carta successiva senza che il piatto cresca. Preflop può checkare solo il grande buio, e solo se nessuno ha rilanciato: gli altri devono almeno chiamare il buio per restare in mano.',
      'Negli Spin & Go il check preflop compare in una situazione precisa: quando il bottone e il piccolo buio limpano (chiamano il buio senza rilanciare), il grande buio può scegliere fra checkare e vedere il flop gratis o rilanciare per prendersi il piatto. Nelle tabelle di equilibrio quel nodo esiste davvero e il grande buio checka una parte consistente delle mani: con le mani forti si rilancia, con quelle medie si prende il flop gratis. Dopo il flop, il check è la scelta più frequente in assoluto.',
      'Il check-raise, cioè checkare con l’intenzione di rilanciare sopra la puntata dell’avversario, è una mossa a sé che ha una voce dedicata. Il «check back» invece è il check di chi è ultimo a parlare, che chiude il giro senza puntare.',
    ],
    esempio:
      'Bottone e piccolo buio limpano a 12 big blind, il grande buio ha 8-7 dello stesso seme. Rilanciare metterebbe nel piatto una parte importante dello stack con una mano che vuole vedere il flop: il check è la scelta di equilibrio, e la mano gioca bene contro due avversari con range deboli.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che spiega l’ordine delle azioni',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, dove il nodo del grande buio dopo due limp si vede per intero',
      href: '/tabelle',
    },
    correlati: ['check-raise', 'check-back', 'limp', 'call'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'raise',
    termine: 'Raise',
    varianti: ['rilancio', 'rilanciare', 'min-raise'],
    query: 'raise poker significato',
    titolo: 'Raise nel poker: significato, min-raise e quanto rilanciare',
    definizione:
      'Raise significa rilanciare: mettere più fiches della puntata corrente, costringendo gli altri a pareggiare la nuova cifra, rilanciare ancora o passare.',
    spiegazione: [
      'Il rilancio è l’azione che fa crescere il piatto e mette gli avversari davanti a una decisione. Il rilancio minimo (min-raise) è pari alla puntata precedente più la sua stessa entità: preflop, con il grande buio a 1, il min-raise porta a 2 big blind. Nella maggior parte delle situazioni un rilancio si misura in multipli del buio («aprire a 2,5x») o, dopo il flop, in frazioni del piatto.',
      'Negli Spin & Go la dimensione del rilancio è quasi sempre piccola: a 15-25 big blind la teoria apre dal bottone con un min-raise o poco più, perché con stack così corti un rilancio grande impegna troppo e trasforma ogni mano in un all-in di fatto. Alla radice di uno Spin a 10 big blind il bottone usa il min-raise con circa l’8% delle mani e l’all-in con circa il 26%: sotto quella profondità il rilancio piccolo sparisce quasi del tutto. Il 3-bet, cioè il rilancio sopra un rilancio, a stack corto è quasi sempre un all-in.',
      'Rilanciare «per vedere dove si è» è un’abitudine da cash game profondo che negli Spin & Go costa cara: ogni rilancio non spinto lascia all’avversario una spinta a cui spesso non si può rispondere.',
    ],
    esempio:
      'Bottone con 20 big blind e Q-J dello stesso seme: la mossa di equilibrio è aprire con un min-raise a 2 big blind, non spingere. Con 20 big blind l’all-in rischia troppo per quello che raccoglie, e il rilancio piccolo permette di foldare a un re-shove senza aver perso quasi niente.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, con le dimensioni di rilancio per profondità',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che a ogni profondità mostrano quando si rilancia e quando si spinge',
      href: '/tabelle',
    },
    correlati: ['open-raise', 'shove', 'call', 'fold'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'limp',
    termine: 'Limp',
    varianti: ['limpare', 'open limp', 'limp-in'],
    query: 'limp poker significato',
    titolo: 'Limp nel poker: significato e quando limpare ha senso',
    definizione:
      'Limpare significa entrare nel piatto preflop chiamando soltanto il grande buio, senza rilanciare: è l’ingresso più economico possibile in una mano.',
    spiegazione: [
      'Il limp ha una cattiva fama meritata nel cash game profondo, dove chiamare il buio senza iniziativa regala al grande buio un flop gratis e lascia il piatto piccolo a chi ha la mano migliore. Ma negli Spin & Go, con stack da 10-20 big blind e l’ante in gioco, il limp torna a essere una mossa che la teoria usa davvero, soprattutto dal piccolo buio dopo il fold del bottone: costa mezzo buio, tiene nel piatto le mani speculative e permette di rispondere a un rilancio del grande buio con un all-in (il limp-shove).',
      'Nelle tabelle di equilibrio per Spin & Go il limp compare come azione a sé («C» di call a piatto non aperto), con frequenze che dipendono dalla profondità: a 12-15 big blind dal piccolo buio si limpa con una fetta consistente di mani, mentre dal bottone a tre giocatori è più raro. Esistono anche varianti di dataset «no limp», in cui la mossa è esclusa per costruzione, perché non tutti i solver e non tutte le sale la trattano allo stesso modo.',
      'L’errore classico è limpare con la stessa logica del cash game, cioè «per vedere il flop a buon mercato» con una mano qualunque: negli Spin & Go il limp è una mossa di range, con un piano preciso per ogni risposta dell’avversario.',
    ],
    esempio:
      'Piccolo buio con 14 big blind, il bottone ha passato, il grande buio ha 16. Con 6-5 dello stesso seme il limp è l’azione di equilibrio: se il grande buio checka si vede un flop con una mano che gioca bene, se rilancia si può passare avendo perso mezzo buio, con una porzione del range si risponde all-in.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta il limp dal piccolo buio',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, dove il limp ha la sua colonna in ogni nodo che lo ammette',
      href: '/tabelle',
    },
    correlati: ['check', 'raise', 'open-raise', 'big-blind'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'big-blind',
    termine: 'Big blind',
    varianti: ['grande buio', 'BB', 'bb'],
    query: 'big blind poker significato',
    titolo: 'Big blind nel poker: significato, posizione e misura',
    definizione:
      'Il big blind (grande buio) è la puntata obbligatoria più alta, messa prima delle carte da chi siede a sinistra del piccolo buio; è anche l’unità degli stack.',
    spiegazione: [
      'I bui esistono per far girare il gioco: senza una puntata forzata nessuno avrebbe motivo di entrare in una mano senza una mano fortissima. Il grande buio vale il doppio del piccolo buio e fissa la puntata minima del giro. Chi lo mette è l’ultimo a parlare preflop e, se nessuno rilancia, può checkare e vedere il flop gratis; dopo il flop parla per primo, cioè fuori posizione, per tutto il resto della mano.',
      'Negli Spin & Go la sigla «bb» compare ovunque perché è l’unità di misura di tutto: si dice «stack da 25 big blind», «all-in per 8 big blind», «tabella a 10 big blind». Misurare in big blind e non in fiches rende comparabili tornei con buy-in e strutture diverse, ed è il modo in cui le tabelle di equilibrio sono indicizzate. Con tre giocatori il grande buio è la posizione che difende di più: davanti a un all-in dal bottone o dal piccolo buio chiama con range larghi, perché una parte delle fiches è già nel piatto e le pot odds sono favorevoli.',
      'L’ante, dove presente, si somma ai bui e allarga ancora i range: a parità di stack, un piatto iniziale più grande rende più profittevole sia spingere sia chiamare.',
    ],
    esempio:
      'Tavolo a tre con bui 50/100 e stack da 1.000: ognuno ha 10 big blind. Se i bui salgono a 100/200 senza che le fiches cambino, gli stessi 1.000 valgono 5 big blind, e le tabelle da consultare sono altre: è per questo che ci si orienta sui big blind e non sulle fiches.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che parte proprio dai bui e dall’ante',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, indicizzate per profondità in big blind',
      href: '/tabelle',
    },
    correlati: ['ante', 'stack', 'blind', 'call'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'stack',
    termine: 'Stack',
    varianti: ['chip stack', 'profondità', 'effective stack'],
    query: 'stack poker significato',
    titolo: 'Stack nel poker: significato e perché si misura in big blind',
    definizione:
      'Lo stack è l’insieme delle fiches che un giocatore ha davanti a sé in un dato momento: è ciò che può vincere, perdere o mettere in gioco in una mano.',
    spiegazione: [
      'Lo stack si misura in fiches, ma la misura che conta è in big blind: dire «ho 12 big blind» dice quanto vale la propria posizione nel torneo a prescindere dal livello dei bui, e permette di usare le stesse tabelle e gli stessi riferimenti in ogni torneo. Lo stack «effettivo» in una mano è il più corto fra quelli dei giocatori coinvolti: contro un avversario con 6 big blind, averne 30 non cambia niente, perché al massimo se ne possono vincere o perdere 6.',
      'Negli Spin & Go lo stack iniziale è di solito 25 big blind per ciascuno dei tre giocatori, e con i bui che salgono ogni pochi minuti la profondità effettiva scende in fretta sotto le 15 e poi le 10. È la ragione per cui il formato si decide quasi tutto preflop: a 10 big blind un rilancio e una chiamata mettono nel piatto quasi metà delle fiches, e l’albero delle decisioni si riduce a poche mosse.',
      'La gestione dello stack ha una logica precisa: sotto una certa profondità le mani speculative perdono valore (non c’è spazio per giocarle dopo il flop) e le mani con carte alte ne guadagnano, perché si va a vedere cinque carte con l’intero stack. Le tabelle preflop sono indicizzate proprio per profondità: cambiare stack significa cambiare tabella.',
    ],
    esempio:
      'Bottone con 40 big blind contro un piccolo buio con 7 e un grande buio con 28. Nella mano contro il piccolo buio lo stack effettivo è 7: si gioca come se si avessero 7 big blind, e la tabella da consultare è quella a 7, non quella a 40.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che spiega come cambia il gioco al calare dello stack',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, una per ogni profondità',
      href: '/tabelle',
    },
    correlati: ['big-blind', 'push-fold', 'all-in', 'bankroll'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'nash',
    termine: 'Nash (equilibrio di Nash)',
    varianti: ['tabelle di Nash', 'Nash chart', 'range di Nash'],
    query: 'tabelle di nash poker',
    titolo: 'Equilibrio di Nash nel poker: cosa sono le tabelle di Nash',
    definizione:
      'Le tabelle di Nash sono i range di push e di call all-in in cui nessuno migliora il proprio risultato cambiando strategia da solo: l’equilibrio del push/fold.',
    spiegazione: [
      'Il nome viene da John Nash, il matematico che formalizzò il concetto di equilibrio: una combinazione di strategie in cui ogni giocatore sta già facendo il meglio possibile date le strategie degli altri. Applicato al poker a stack corto, dove le mosse sono solo all-in o fold, l’equilibrio è calcolabile con esattezza, ed è per questo che le «tabelle di Nash» esistono da vent’anni e circolano in ogni forum: per ogni profondità dicono con quali mani spingere e con quali chiamare.',
      'Negli Spin & Go le tabelle di Nash classiche descrivono l’heads-up e vanno lette con due avvertenze. La prima: sono l’equilibrio di un gioco semplificato (solo push o fold), mentre a 15-20 big blind la strategia reale usa anche il min-raise e il limp — le tabelle GTO calcolate da un solver sull’albero completo differiscono in modo sensibile dalle tabelle di Nash pure. La seconda: l’equilibrio non è «la mossa migliore contro questo avversario». Contro chi chiama troppo poco si spinge più largo di Nash, contro chi chiama troppo si spinge più stretto: l’equilibrio è il punto di partenza da cui si devia con un motivo.',
      'La differenza fra tabella di Nash e tabella GTO è quindi di ambizione, non di qualità: la prima risolve due mosse, la seconda l’intero albero preflop del formato a tre giocatori, con l’ante e le posizioni.',
    ],
    esempio:
      'Heads-up a 10 big blind: la tabella di Nash dice che il piccolo buio spinge con oltre metà delle mani e il grande buio chiama con circa un terzo. Sono numeri d’equilibrio: se il grande buio chiama solo con le prime 15 mani, spingere quasi tutto diventa corretto, perché il fold dell’avversario paga più della sua chiamata.',
    guida: {
      testo: 'la guida al push/fold, che spiega come si legge una tabella e dove Nash e GTO differiscono',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO del sito, calcolate sull’albero completo a tre giocatori',
      href: '/tabelle',
    },
    correlati: ['push-fold', 'gto', 'equity', 'shove'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'open-raise',
    termine: 'Open raise',
    varianti: ['open', 'aprire', 'rilancio d’apertura', 'RFI'],
    query: 'open raise poker significato',
    titolo: 'Open raise nel poker: significato e range di apertura',
    definizione:
      'L’open raise è il primo rilancio della mano, a piatto non ancora aperto: chi lo fa «apre» il gioco, e le mani con cui lo fa formano il suo range di apertura.',
    spiegazione: [
      'La sigla inglese RFI (raise first in) indica la stessa cosa: essere i primi a rilanciare, quando nel piatto ci sono soltanto bui e ante. Il range di apertura è la porzione delle 169 mani con cui una posizione apre, e cambia con la posizione — chi parla per primo apre più stretto, chi parla per ultimo più largo — e con la profondità dello stack.',
      'Negli Spin & Go a tre giocatori la prima posizione a parlare è il bottone, che è anche l’ultima a parlare dopo il flop: un vantaggio doppio, e per questo il suo range di apertura è largo. La dimensione dell’apertura è quasi sempre minima (2 big blind) a 15-25 big blind, mentre sotto le 10 l’apertura si trasforma in open shove: l’all-in è il modo di aprire quando il rilancio piccolo lascerebbe troppe fiches all’avversario per rilanciare a sua volta. Alla radice di uno Spin a 10 big blind il bottone apre con un min-raise circa l’8% delle volte e con l’all-in circa il 26%.',
      'Aprire non significa impegnarsi: a 20 big blind un open raise a 2 con una mano media si può abbandonare davanti a un all-in avendo perso il 10% dello stack. È il motivo per cui il rilancio piccolo esiste: raccoglie i bui quando gli altri passano e costa poco quando non lo fanno.',
    ],
    esempio:
      'Bottone con 22 big blind e A-5 dello stesso seme: open raise a 2 big blind. Se il grande buio chiama, si gioca un flop in posizione con una mano che ha un asso e possibilità di colore; se uno dei due va all-in, si passa avendo speso il 9% dello stack.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta le aperture per posizione',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che mostrano il range di apertura di ogni posizione a ogni profondità',
      href: '/tabelle',
    },
    correlati: ['raise', 'open-shove', 'limp', 'range'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'pot-odds',
    termine: 'Pot odds',
    varianti: ['quote del piatto', 'odds del piatto'],
    query: 'pot odds poker significato',
    titolo: 'Pot odds nel poker: significato e come si calcolano',
    definizione:
      'Le pot odds sono il rapporto fra ciò che c’è nel piatto e ciò che serve per chiamare: dicono quanta equity minima serve perché la chiamata non perda.',
    spiegazione: [
      'Il calcolo è breve. Si somma il piatto attuale con la puntata da chiamare e si divide la puntata per quel totale: il risultato è la percentuale di volte in cui bisogna vincere per andare in pari. Chiamare 4 in un piatto che, dopo la chiamata, varrà 12 richiede 4/12 = 33% di equity. Se la propria mano vince più spesso di così contro il range dell’avversario, la chiamata guadagna; altrimenti perde.',
      'Negli Spin & Go le pot odds sono il motivo per cui le chiamate all-in dal grande buio sono così larghe. Con l’ante e il proprio buio già nel piatto, il rapporto è spesso vicino a 1,3-1,5 a 1, cioè bastano il 40-43% di equity: contro un range di spinta largo, mani come K-8 o Q-9 lo raggiungono. Il conto va fatto sul range e non sulla mano che si immagina all’avversario, ed è qui che l’intuito sbaglia più spesso.',
      'Le pot odds si applicano anche dopo il flop, per decidere se inseguire un progetto: un colore chiuso al turn ha circa il 19% di probabilità di arrivare al river, quindi chiamare conviene solo se la puntata è al massimo un quarto del piatto finale. Con stack corti, però, quasi ogni chiamata dopo il flop è di fatto un all-in, e il calcolo si fa una volta sola.',
    ],
    esempio:
      'Grande buio con 12 big blind; il piccolo buio va all-in per 9. Nel piatto ci sono 9 (la spinta) + 1 (il proprio buio) + 0,5 (il piccolo buio) + le ante: circa 10,8. Per chiamare servono altri 8. Equity minima = 8 / (10,8 + 8) ≈ 43%. Contro un range di spinta da piccolo buio a 9 big blind, A-7 offsuit la supera: si chiama.',
    guida: {
      testo: 'la guida al push/fold, dove le chiamate all-in sono ricondotte a questo calcolo',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'l’allenamento preflop, che propone decisioni di call all-in con l’EV di ogni scelta',
      href: '/allenamento',
    },
    correlati: ['equity', 'call', 'ev', 'fold'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'equity',
    termine: 'Equity',
    varianti: ['hand equity', 'equity della mano'],
    query: 'equity poker significato',
    titolo: 'Equity nel poker: significato e come si usa nelle decisioni',
    definizione:
      'L’equity è la quota del piatto che una mano vale in media, cioè la probabilità di vincerlo allo showdown: A-K contro una coppia di 8 ha circa il 46%.',
    spiegazione: [
      'L’equity non è la probabilità di avere la mano migliore adesso, ma di averla alla fine, contate tutte le carte che devono ancora uscire. Contro un singolo avversario si calcola con esattezza enumerando i board possibili; contro un range di mani si fa la media pesata su tutte le combinazioni del range. È la grandezza a cui si confrontano le pot odds: se l’equity supera la percentuale richiesta dal piatto, la chiamata guadagna.',
      'Negli Spin & Go quasi tutte le decisioni importanti sono chiamate all-in preflop, e lì l’equity è tutto: non ci saranno altre strade in cui recuperare o perdere. Alcuni numeri da tenere a mente: una coppia contro due carte più alte è avanti circa 55 a 45 (il classico coin flip); un asso con kicker basso contro due carte basse non accoppiate vale circa il 60%; due carte alte contro due basse circa il 65%. I range di push e di call delle tabelle nascono da questi conti, fatti su ogni coppia di mani.',
      'L’equity si «realizza» solo se si arriva allo showdown: fuori posizione con stack profondi una mano perde parte della sua equity perché viene costretta a passare prima. A stack corto questo problema quasi sparisce, ed è un altro motivo per cui il formato premia chi va all-in bene.',
    ],
    esempio:
      'Grande buio con 10 big blind, il bottone spinge con un range del 40% delle mani. La coppia di 5 ha circa il 52% di equity contro quel range; le pot odds ne chiedono il 42%: chiamata corretta, anche se contro molte mani specifiche del range la coppia è un coin flip.',
    guida: {
      testo: 'la guida al push/fold, che spiega come l’equity contro un range decide una chiamata',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che calcola l’equity all-in e l’EV Diff di ogni mano caricata',
      href: '/replayer',
    },
    correlati: ['pot-odds', 'ev', 'call', 'range'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'check-raise',
    termine: 'Check-raise',
    varianti: ['check raise', 'x/r'],
    query: 'check raise poker significato',
    titolo: 'Check-raise nel poker: significato e quando si usa',
    definizione:
      'Il check-raise è la sequenza in cui un giocatore checka, aspetta che un avversario punti e poi rilancia sopra quella puntata nello stesso giro di scommesse.',
    spiegazione: [
      'Si può check-raisare solo fuori posizione, cioè parlando prima dell’avversario: il check cede l’iniziativa, la puntata altrui la restituisce con gli interessi. La mossa ha due usi: per valore, con una mano forte che vuole far crescere il piatto contro chi punta volentieri, e come bluff o semi-bluff, con un progetto che ha equity ma preferirebbe prendersi il piatto subito. Il rischio è evidente: se l’avversario checka dietro, si è persa una strada di puntata.',
      'Negli Spin & Go il check-raise compare quasi sempre dal grande buio dopo aver chiamato un rilancio o dopo un limp, e con stack da 10-15 big blind è di fatto un all-in: il rilancio sopra una continuation bet impegna il resto dello stack. Per questo si usa con un range polarizzato, mani molto forti e progetti forti, mentre le mani medie preferiscono chiamare. Con stack più profondi, all’inizio del torneo, torna a essere una mossa con una dimensione propria.',
      'Il check-raise è anche il motivo per cui chi è in posizione non dovrebbe puntare ogni flop in automatico: contro un avversario capace di check-raisare, la continuation bet con aria va scelta, non fatta d’ufficio.',
    ],
    esempio:
      'Grande buio con 14 big blind chiama l’apertura a 2 del bottone. Flop 9-7-4 con due carte dello stesso seme; il grande buio ha 8-6 dello stesso seme (scala bilaterale e progetto di colore). Checka, il bottone punta 2: il check-raise all-in ha equity contro quasi ogni mano e prende spesso il piatto subito.',
    guida: {
      testo: 'la guida agli errori comuni negli Spin & Go, dove il gioco fuori posizione è uno dei capitoli',
      href: '/guide/errori-comuni-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, per rivedere i propri check-raise strada per strada',
      href: '/replayer',
    },
    correlati: ['check', 'raise', 'c-bet', 'check-back'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'check-back',
    termine: 'Check back',
    varianti: ['checkare dietro', 'check behind'],
    query: 'check back poker cosa vuol dire',
    titolo: 'Check back nel poker: cosa vuol dire checkare dietro',
    definizione:
      'Check back significa checkare da ultimo a parlare, dopo il check dell’avversario: si chiude il giro senza puntare e si vede la carta successiva gratis.',
    spiegazione: [
      'La parola «back» (o «behind») indica la posizione: solo chi parla per ultimo può checkare dietro, perché per farlo serve che tutti gli altri abbiano già checkato. È l’opposto della continuation bet: chi ha aperto preflop e riceve un check al flop può puntare (c-bet) o checkare dietro, e la scelta dice molto della sua mano. Si checka dietro con mani che vogliono arrivare allo showdown a basso costo, con mani deboli che non reggerebbero un check-raise, e a volte con mani forti per indurre l’avversario a puntare al turn.',
      'Negli Spin & Go il check back è frequente in posizione con stack da 12-20 big blind: puntare ogni flop dopo aver aperto costa caro contro chi check-raisa all-in, e molte mani medie (una coppia bassa, un asso alto senza coppia) preferiscono controllare la dimensione del piatto. L’errore opposto esiste: checkare dietro sempre, con tutto il range, regala carte gratis a chi ha un progetto e rende trasparente il proprio gioco.',
      'Chi è fuori posizione legge il check back come un’informazione: un avversario che checka dietro al flop raramente ha una mano molto forte, e questo apre la porta a una puntata al turn (la cosiddetta «probe bet»).',
    ],
    esempio:
      'Bottone con 18 big blind apre a 2, il grande buio chiama. Flop K-8-3 arcobaleno, il grande buio checka; il bottone ha 9-9. Puntare espone a un check-raise che non si può chiamare; checkare dietro tiene il piatto piccolo con una mano che spesso è la migliore ma non regge una puntata grande.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta il gioco in posizione dopo il flop',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che mostra strada per strada le scelte fatte in posizione',
      href: '/replayer',
    },
    correlati: ['check', 'c-bet', 'check-raise', 'value-bet'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'ante',
    termine: 'Ante',
    varianti: ['big blind ante', 'BB ante'],
    query: 'ante poker significato',
    titolo: 'Ante nel poker: significato e come cambia il gioco',
    definizione:
      'L’ante è una piccola puntata obbligatoria che ogni giocatore mette prima delle carte, oltre ai bui: ingrandisce il piatto e rende il gioco più aggressivo.',
    spiegazione: [
      'A differenza dei bui, che li mettono due giocatori soltanto, l’ante la paga tutto il tavolo (o, nella forma «big blind ante», la paga il solo grande buio per conto di tutti, per far prima). Serve a rendere costoso restare a guardare: con più fiche morte nel piatto, aspettare solo le mani forti costa una frazione di big blind a ogni giro, e i range di apertura e di chiamata si allargano di conseguenza.',
      'Negli Spin & Go alcune strutture hanno l’ante e altre no, e le due cose si giocano in modo diverso. Le tabelle preflop del sito esistono in entrambe le versioni, e nella versione con ante la profondità porta un piccolo scarto (per esempio «10,17» big blind), perché l’ante entra nel conto dello stack. L’effetto pratico: a parità di stack, con l’ante il piatto iniziale è più grande, quindi spingere raccoglie di più quando gli altri passano e chiamare richiede meno equity. I range di push del bottone e di call del grande buio si allargano entrambi.',
      'L’ante è anche il motivo per cui nel formato «aspettare» non è una strategia: dieci mani passate con l’ante costano più di una mano giocata bene.',
    ],
    esempio:
      'Stack da 10 big blind in tre, bui 1/0,5 e ante di 0,1 a testa. Senza ante, il bottone che spinge e trova due fold raccoglie 1,5 big blind; con l’ante ne raccoglie 1,8, cioè il 20% in più per lo stesso rischio. Su cento tentativi la differenza vale tre stack interi.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che spiega bui, ante e struttura',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, disponibili con e senza ante',
      href: '/tabelle',
    },
    correlati: ['big-blind', 'blind', 'stack', 'push-fold'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'blind',
    termine: 'Blind (bui)',
    varianti: ['bui', 'small blind', 'piccolo buio', 'SB'],
    query: 'blind poker significato',
    titolo: 'Blind nel poker: cosa sono i bui e il piccolo buio',
    definizione:
      'I blind (bui) sono le due puntate obbligatorie messe prima delle carte dai due giocatori a sinistra del bottone: il piccolo buio e il grande buio.',
    spiegazione: [
      'Si chiamano «bui» perché si mettono al buio, senza aver visto le carte. Il piccolo buio vale in genere metà del grande buio e lo mette il giocatore immediatamente a sinistra del bottone; il grande buio lo mette quello dopo. Chi è nei bui ha già investito una parte della mano e parla per primo dopo il flop: due svantaggi che la strategia compensa con range di difesa larghi e, a stack corto, con molti all-in.',
      'Negli Spin & Go, con tre giocatori, i bui sono due posizioni su tre: ognuno è nel piccolo o nel grande buio due mani su tre. Il piccolo buio è la posizione più difficile del formato: paga mezzo buio, parla per secondo preflop e per primo dopo il flop. Dopo il fold del bottone, però, diventa una posizione d’attacco: contro un solo avversario il suo range di push (o di limp, a profondità maggiori) è molto largo, perché il piatto morto è già suo per un terzo.',
      'I livelli dei bui salgono a intervalli fissi ed è questo che determina la velocità del torneo: negli Spin & Go i livelli durano pochi minuti e gli stack, misurati in big blind, si dimezzano più volte in un quarto d’ora.',
    ],
    esempio:
      'Piccolo buio con 9 big blind, il bottone ha passato. Con Q-8 offsuit l’all-in è la mossa di equilibrio: il grande buio dovrebbe chiamare con meno della metà delle mani, e nel piatto ci sono già 1,5 big blind più le ante da raccogliere quando passa.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che spiega le tre posizioni e i bui',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, con i nodi del piccolo buio dopo il fold del bottone',
      href: '/tabelle',
    },
    correlati: ['big-blind', 'ante', 'open-shove', 'limp'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'itm',
    termine: 'ITM (in the money)',
    varianti: ['in the money', 'a premio', 'andare a premio'],
    query: 'itm poker significato',
    titolo: 'ITM nel poker: significato di in the money e a premio',
    definizione:
      'ITM (in the money) indica i giocatori che hanno raggiunto le posizioni pagate di un torneo: «andare ITM» significa finire a premio, anche col premio minimo.',
    spiegazione: [
      'In un torneo multitavolo solo una frazione dei partecipanti (spesso il 10-15%) riceve un premio; il momento in cui il numero dei giocatori rimasti scende fino alle posizioni pagate si chiama bolla, e superarla significa essere ITM. La percentuale ITM di un giocatore (quante volte va a premio sui tornei giocati) è una statistica classica dei tracker, ma da sola dice poco: si può andare a premio spesso e perdere, se i premi sono sempre minimi.',
      'Negli Spin & Go l’ITM ha un significato diverso e più semplice: nella grande maggioranza dei tornei paga solo il primo, quindi essere ITM coincide con vincere. Solo con i moltiplicatori alti la struttura paga anche il secondo e il terzo; per il resto non esiste una bolla, non esiste un «minimo cash» da difendere e la pressione dei premi intermedi (quella che nei tornei si chiama ICM) quasi non conta. È il motivo per cui le fiches valgono in modo lineare e si può giocare per l’intero stack senza il freno che nei tornei normali frena le chiamate al margine.',
      'Il numero che sostituisce l’ITM nel formato è il ROI, cioè il ritorno per torneo sul buy-in: dice se il proprio gioco, in media, batte il costo del torneo e il rake.',
    ],
    esempio:
      'Un giocatore di tornei con 15% di ITM e uno di Spin & Go con 38% di vittorie non sono confrontabili: il primo va a premio quando arriva fra i pochi pagati, il secondo «va a premio» ogni volta che vince un torneo a tre. Il numero da guardare, per entrambi, è il ROI.',
    guida: {
      testo: 'la guida all’ICM negli Spin & Go, che spiega perché qui i premi intermedi quasi non esistono',
      href: '/guide/icm-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che mostra la distribuzione dei risultati per un dato ROI',
      href: '/simulatore-varianza',
    },
    correlati: ['icm', 'mtt', 'buy-in', 'moltiplicatore'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'bankroll',
    termine: 'Bankroll',
    varianti: ['roll', 'bankroll management', 'BRM'],
    query: 'bankroll poker significato',
    titolo: 'Bankroll nel poker: significato e quanti buy-in servono',
    definizione:
      'Il bankroll è la somma di denaro destinata solo al poker, separata dal resto: la riserva che assorbe le oscillazioni dei risultati senza toccare la vita reale.',
    spiegazione: [
      'Non è «quanto si è disposti a perdere» e non è il saldo del conto gioco: è un fondo dedicato, dimensionato sul limite che si gioca. Il bankroll management (BRM) è l’insieme delle regole che legano il limite al fondo: si sale di buy-in quando il fondo lo permette e si scende quando una serie negativa lo assottiglia, prima di dover smettere.',
      'Negli Spin & Go la varianza è alta per costruzione — la maggior parte dei tornei paga solo il primo e i moltiplicatori grandi sono rari — quindi il fondo richiesto è più grande di quanto l’intuito suggerisca. Un riferimento prudente per chi ha un margine positivo è nell’ordine dei 200-300 buy-in del limite giocato; con margini sottili o al primo salto di limite servono di più. Il numero dipende dal proprio ROI e dalla struttura dei moltiplicatori: il simulatore di varianza lo calcola per la propria situazione invece di applicare una regola valida per tutti.',
      'Il bankroll protegge anche la qualità delle decisioni: con un fondo corto ogni all-in si gioca con la paura addosso, e la paura sposta le chiamate al margine nella direzione sbagliata.',
    ],
    esempio:
      'Chi gioca Spin & Go da 5 € con 300 buy-in ha un fondo di 1.500 €. Una serie negativa di 60 buy-in, normale in un mese anche per chi ha un ROI positivo, lo porta a 1.200: si continua a giocare lo stesso limite. Con 500 € di fondo la stessa serie avrebbe imposto di scendere.',
    guida: {
      testo: 'la guida al bankroll per gli Spin & Go, con i numeri per limite',
      href: '/guide/bankroll-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che mostra quanti buy-in servono per il proprio ROI',
      href: '/simulatore-varianza',
    },
    correlati: ['buy-in', 'downswing', 'varianza', 'stack'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'gto',
    termine: 'GTO (Game Theory Optimal)',
    varianti: ['gioco GTO', 'strategia di equilibrio', 'solver'],
    query: 'gto poker significato',
    titolo: 'GTO nel poker: significato di Game Theory Optimal',
    definizione:
      'GTO (Game Theory Optimal) indica una strategia di equilibrio: nessun avversario può sfruttarla, anche se contro ognuno di loro non è la più redditizia.',
    spiegazione: [
      'Una strategia GTO è quella che un solver calcola risolvendo il gioco: per ogni situazione dice con quale frequenza fare ogni azione con ogni mano, in modo che nessun avversario possa guadagnare deviando dalla propria strategia di equilibrio. È una difesa perfetta, non un attacco: contro chi commette errori esiste sempre una strategia «exploit» che guadagna di più, al prezzo di essere a sua volta sfruttabile.',
      'Negli Spin & Go la parola GTO compare soprattutto nelle tabelle preflop: sono i range di equilibrio calcolati su tutto l’albero preflop a tre giocatori, con l’ante e le posizioni, e non solo sul push/fold delle tabelle di Nash. Si usano come base: si impara la frequenza di equilibrio e poi si devia con un motivo, per esempio spingendo più largo contro chi chiama troppo poco. Studiare le tabelle serve a sapere dove si sta deviando, non a giocare come una macchina.',
      'Un equivoco comune è credere che GTO significhi «la mossa giusta»: significa la mossa che non perde contro nessuno. Ai limiti bassi, dove gli avversari sbagliano molto, la mossa che guadagna di più è spesso un’altra, ma per trovarla bisogna conoscere l’equilibrio da cui ci si allontana.',
    ],
    esempio:
      'Alla radice di uno Spin a 10 big blind la strategia GTO del bottone spinge circa il 26% delle mani. Contro un grande buio che chiama solo con le prime dieci mani, spingerne il 40% guadagna di più: è un exploit, e funziona finché quell’avversario non si adegua.',
    guida: {
      testo: 'la guida completa alla strategia Spin & Go, che colloca la GTO nel percorso di studio',
      href: '/guide/strategia-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO del sito, con frequenze ed EV per ogni mano',
      href: '/tabelle',
    },
    correlati: ['nash', 'exploit', 'range', 'ev'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'range',
    termine: 'Range',
    varianti: ['range di mani', 'range preflop', 'ranging'],
    query: 'range poker preflop',
    titolo: 'Range nel poker: significato e come si legge un range',
    definizione:
      'Il range è l’insieme delle mani con cui un giocatore farebbe una data azione in una data situazione: si ragiona sul range dell’avversario, mai su una mano sola.',
    spiegazione: [
      'Nessuno sa quali due carte tiene l’avversario, ma si può sapere con quali mani avrebbe fatto quello che ha fatto: rilanciare dal bottone, chiamare un all-in, checkare dietro. Quell’insieme è il suo range, e si rappresenta su una griglia di 13 per 13 caselle, una per ogni combinazione di due carte: le coppie sulla diagonale, le mani dello stesso seme sopra, quelle di semi diversi sotto. Un range si esprime in percentuale delle 1.326 combinazioni possibili: «apre il 40%» significa che rilancia con le migliori quattro combinazioni su dieci.',
      'Negli Spin & Go i range preflop sono l’intero gioco. Le tabelle GTO del sito mostrano, per ogni profondità e posizione, il range di apertura del bottone, quelli di push e di limp del piccolo buio, quelli di call e di re-shove del grande buio; e a differenza di un elenco di mani mostrano anche le frequenze miste, cioè le mani che l’equilibrio gioca in un modo una parte delle volte e in un altro il resto. Ragionare per range cambia la lettura di ogni chiamata: si chiama con A-8 perché contro il range di spinta ha equity sufficiente, non perché si «sente» che l’avversario ha poco.',
      'Un range di un altro formato non si riusa: quello di un tavolo a sei o di un cash game profondo non descrive un tavolo a tre con 10 big blind e l’ante.',
    ],
    esempio:
      'Il bottone spinge all-in a 8 big blind. Il suo range di equilibrio è circa il 45% delle mani: tutte le coppie, quasi tutti gli assi, molti re e le mani connesse dello stesso seme. Il grande buio confronta la propria mano con quel 45%, non con la coppia d’assi che teme.',
    guida: {
      testo: 'la guida al push/fold, che insegna a leggere un range su una tabella',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, dove ogni range è una griglia 13 per 13 con le frequenze',
      href: '/tabelle',
    },
    correlati: ['gto', 'equity', 'open-raise', 'push-fold'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'ev',
    termine: 'EV (valore atteso)',
    varianti: ['expected value', 'valore atteso', '+EV', '-EV'],
    query: 'ev poker significato',
    titolo: 'EV nel poker: significato di valore atteso, +EV e −EV',
    definizione:
      'L’EV (expected value, valore atteso) è la media di ciò che un’azione frutta se ripetuta infinite volte: una scelta +EV guadagna nel tempo, una −EV perde.',
    spiegazione: [
      'Si calcola pesando ogni esito possibile con la sua probabilità: chiamare un all-in di 8 big blind in un piatto di 10 con il 45% di equity vale 0,45 × 10 − 0,55 × 8 = +0,1 big blind. Il segno dice se la scelta è giusta; la grandezza dice quanto costa sbagliarla. Il risultato di una singola mano non dice niente sull’EV: si può fare la mossa migliore e perdere lo stack, o la peggiore e vincere.',
      'Negli Spin & Go l’EV si misura in big blind per decisione e le tabelle preflop lo riportano per ogni mano e per ogni azione: leggere che con K-9 dello stesso seme l’all-in vale +0,3 e il fold vale 0 significa che spingere guadagna in media 0,3 big blind. Le mani «marginali» sono quelle in cui due azioni hanno EV quasi uguale: lì sbagliare costa poco, ed è per questo che l’allenamento del sito pesa gli errori per la differenza di EV e non li conta uno a uno. Il replayer calcola anche l’EV Diff di una mano all-in: quanto si è vinto rispetto a quanto ci si aspettava, cioè quanta fortuna c’è stata.',
      'Nel formato l’EV in fiches coincide quasi sempre con l’EV in denaro, perché la maggior parte dei tornei paga solo il primo: è la ragione per cui qui non serve la correzione ICM dei tornei normali.',
    ],
    esempio:
      'Piccolo buio con 7 big blind e J-8 offsuit, il bottone ha passato. Tabella: all-in +0,12 big blind, fold 0. La mossa è spingere; se il grande buio chiama con A-K e vince, l’EV della decisione non cambia: era giusta prima e resta giusta dopo.',
    guida: {
      testo: 'la guida al push/fold, che spiega come si confrontano gli EV di due azioni',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'l’allenamento preflop, che valuta ogni risposta per differenza di EV',
      href: '/allenamento',
    },
    correlati: ['equity', 'pot-odds', 'gto', 'varianza'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'c-bet',
    termine: 'C-bet (continuation bet)',
    varianti: ['continuation bet', 'puntata di continuazione', 'cbet'],
    query: 'cbet poker significato',
    titolo: 'C-bet nel poker: significato di continuation bet',
    definizione:
      'La c-bet (continuation bet) è la puntata al flop fatta da chi ha rilanciato preflop: si «continua» l’aggressione, con o senza aver migliorato la mano.',
    spiegazione: [
      'Chi rilancia preflop dichiara una mano forte; puntare al flop porta avanti quella storia e costringe l’avversario, che spesso non ha centrato niente, a passare. È per questo che la c-bet funziona anche con «aria»: il flop manca entrambi i giocatori due volte su tre, e chi ha l’iniziativa la incassa. La dimensione è di solito piccola, un quarto o un terzo del piatto, perché contro un avversario che ha mancato il flop una puntata grande non serve.',
      'Negli Spin & Go la c-bet compare quando il rilancio preflop è stato chiamato, cioè soprattutto a 15-25 big blind: sotto le 10 quasi nessun rilancio viene chiamato senza andare all-in. Con stack corti la scelta è netta, perché una c-bet chiamata mette in gioco una parte grande dello stack: si punta con le mani che vogliono costruire il piatto e con i progetti, si checka dietro con le mani medie che preferiscono arrivare allo showdown a basso costo. Puntare ogni flop in automatico, come si vede a molti tavoli, regala a chi check-raisa all-in un piatto facile.',
      'La c-bet ha una contromossa nota, il check-raise, e una lettura opposta, il check back: le tre voci vanno lette insieme.',
    ],
    esempio:
      'Bottone con 20 big blind apre a 2, il grande buio chiama. Flop 10-6-2 arcobaleno, il grande buio checka. Con A-K il bottone punta 1,5 nel piatto di 4,5: contro la maggior parte del range di chiamata, che ha mancato il flop, la puntata prende il piatto subito, e quando viene chiamata la mano ha sei carte per migliorare.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta il gioco dopo il flop con stack corti',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, per rivedere le proprie c-bet strada per strada',
      href: '/replayer',
    },
    correlati: ['check-raise', 'check-back', 'value-bet', 'open-raise'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'value-bet',
    termine: 'Value bet',
    varianti: ['puntata per valore', 'thin value'],
    query: 'value bet poker significato',
    titolo: 'Value bet nel poker: significato e come si dimensiona',
    definizione:
      'La value bet è una puntata fatta con la mano che si ritiene migliore per farsi chiamare da mani peggiori: è così che si incassa il valore di una mano forte.',
    spiegazione: [
      'È l’opposto del bluff: si punta per essere chiamati, non per far passare. La dimensione si sceglie in base a ciò che l’avversario può chiamare: troppo grande e si perde la chiamata, troppo piccola e si lascia sul tavolo del valore. Una value bet «thin» (sottile) è quella fatta con una mano solo leggermente migliore del range di chiamata dell’avversario, dove la puntata guadagna poco ma guadagna.',
      'Negli Spin & Go la value bet ha una forma particolare: con stack da 10-15 big blind, spesso l’unica puntata possibile è l’all-in, e la domanda diventa «quali mani peggiori chiamerebbero un all-in?». Contro un avversario che chiama largo, mani come una coppia media al flop vanno spinte per valore; contro chi chiama solo con mani forti, la stessa spinta è un errore. Le dimensioni intermedie, un terzo o metà del piatto, hanno senso solo all’inizio del torneo, con stack ancora profondi.',
      'Il criterio generale resta quello: si punta per valore quando più della metà delle mani che possono chiamare è peggiore della propria. Se a chiamare sarebbero solo mani migliori, la puntata è un bluff che non lo sa.',
    ],
    esempio:
      'Grande buio con 12 big blind ha chiamato l’apertura del bottone; flop K-9-4, turn 2, il grande buio ha K-J. Il bottone checka dietro il flop e il turn; al river il grande buio punta metà piatto: contro un range che tiene coppie di 9 e re con kicker più basso, la puntata viene chiamata da mani peggiori più spesso di quanto sia battuta.',
    guida: {
      testo: 'la guida agli errori comuni negli Spin & Go, dove le puntate senza uno scopo sono un capitolo',
      href: '/guide/errori-comuni-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, per verificare quali puntate hanno preso valore e quali no',
      href: '/replayer',
    },
    correlati: ['c-bet', 'check-back', 'equity', 'bluff'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'icm',
    termine: 'ICM (Independent Chip Model)',
    varianti: ['Independent Chip Model', 'pressione ICM'],
    query: 'icm poker significato',
    titolo: 'ICM nel poker: significato e perché qui pesa poco',
    definizione:
      'L’ICM (Independent Chip Model) converte le fiches di un torneo in denaro: quando i premi sono più di uno, le fiches non valgono tutte allo stesso modo.',
    spiegazione: [
      'In un torneo con più posizioni pagate raddoppiare le fiches non raddoppia il premio atteso: le prime fiches che si vincono valgono più delle ultime, e perdere lo stack costa più di quanto vincerne uno uguale renda. L’ICM misura questa differenza calcolando, per ogni distribuzione di stack, la probabilità di ogni piazzamento e il premio atteso. Ne segue la «pressione ICM»: vicino ai premi, o a un tavolo finale, chiamare un all-in richiede molta più equity di quella che le pot odds suggerirebbero.',
      'Negli Spin & Go l’ICM conta poco, e capire perché è utile. Nella grande maggioranza dei tornei paga solo il primo, quindi il valore in denaro di uno stack è proporzionale alle fiches: vincere tutte le fiche vale il premio, averne metà vale metà del premio in attesa. Le fiche sono lineari e si può giocare per l’intero stack ogni volta che l’EV in fiches è positivo. Solo con i moltiplicatori alti, quando la struttura paga anche il secondo e il terzo, torna una piccola correzione ICM; è un caso raro, e chi porta nel formato le abitudini prudenti dei tornei perde valore in tutti gli altri.',
      'Il numero da guardare, al posto dell’ICM, è l’EV in fiches delle tabelle preflop: nel formato è quasi sempre anche l’EV in denaro.',
    ],
    esempio:
      'Torneo a tre che paga solo il primo; stack 10, 10 e 10 big blind. Chiamare un all-in con il 51% di equity è corretto: non c’è nessun premio intermedio da proteggere. Con un moltiplicatore che paga anche il secondo, la stessa chiamata al 51% diventa un errore, perché perdere lo stack costa il secondo premio.',
    guida: {
      testo: 'la guida all’ICM negli Spin & Go, che spiega il caso raro in cui conta',
      href: '/guide/icm-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che ragionano in EV di fiches perché nel formato è ciò che conta',
      href: '/tabelle',
    },
    correlati: ['itm', 'ev', 'moltiplicatore', 'mtt'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'mtt',
    termine: 'MTT (torneo multitavolo)',
    varianti: ['multi-table tournament', 'torneo multitavolo'],
    query: 'mtt cosa significa nel poker',
    titolo: 'MTT nel poker: cosa significa torneo multitavolo',
    definizione:
      'MTT (multi-table tournament) è un torneo su più tavoli che si fondono man mano che i giocatori escono, fino al tavolo finale: paga una parte dei partecipanti.',
    spiegazione: [
      'Un MTT parte con decine o migliaia di iscritti, tutti con lo stesso stack; i bui salgono a intervalli fissi e i tavoli si accorpano quando i giocatori calano. Paga di solito il 10-15% dei partecipanti con una scala di premi molto ripida, dove il primo prende una fetta grande del montepremi. Dura ore, ha una bolla (il momento in cui si entra nei premi) e un tavolo finale in cui l’ICM pesa su ogni decisione.',
      'Gli Spin & Go sono un altro genere di torneo: tre giocatori, un solo tavolo, il montepremi deciso da un moltiplicatore estratto prima di iniziare, e nella maggior parte dei casi un solo premio. Durano pochi minuti e si giocano a decine in una sessione. Le differenze strategiche seguono da qui: negli MTT la sopravvivenza ha un valore proprio e i premi intermedi frenano le chiamate; negli Spin & Go le fiche sono lineari e l’unica cosa che conta è l’EV in fiches della singola decisione. Un buon giocatore di MTT che passa al formato deve disimparare la prudenza, e viceversa.',
      'Anche la varianza ha forma diversa: un MTT ha lunghi periodi senza premio interrotti da vincite grandi; uno Spin & Go alterna vittorie e sconfitte quasi ogni torneo, con le rare esplosioni dei moltiplicatori alti.',
    ],
    esempio:
      'In un MTT da 1.000 iscritti che paga 150 posti, un giocatore con 12 big blind a 160 rimasti passa una coppia di 9 contro un all-in: la bolla vale più dell’equity. Nello stesso spot in uno Spin & Go, dove il secondo non prende niente, la coppia di 9 chiama senza pensarci.',
    guida: {
      testo: 'la guida che confronta Spin & Go e Sit & Go, con le differenze di struttura e di gioco',
      href: '/guide/spin-and-go-vs-sit-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, tarato sulle strutture Spin & Go e non sugli MTT',
      href: '/simulatore-varianza',
    },
    correlati: ['itm', 'icm', 'buy-in', 'moltiplicatore'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'buy-in',
    termine: 'Buy-in',
    varianti: ['iscrizione', 'quota d’iscrizione'],
    query: 'buy in poker significato',
    titolo: 'Buy-in nel poker: significato e come si legge il costo',
    definizione:
      'Il buy-in è la somma che si paga per iscriversi a un torneo o per sedersi a un tavolo cash: nei tornei comprende il montepremi e la commissione (il rake).',
    spiegazione: [
      'Nei tornei il buy-in si scrive spesso come «9 + 1» o «4,50 + 0,50»: la prima cifra va nel montepremi, la seconda è la commissione trattenuta dalla sala. Nel cash game il buy-in è la somma con cui ci si siede, di solito compresa fra un minimo e un massimo espressi in big blind (per esempio da 40 a 100). Il buy-in è anche l’unità con cui si misurano risultati e bankroll: si dice «ho vinto tre buy-in» o «servono 200 buy-in».',
      'Negli Spin & Go il buy-in è fisso per livello (per esempio 1, 2, 5, 10 o 25 €) e il montepremi non è la somma dei tre buy-in: è il buy-in moltiplicato per il moltiplicatore estratto a inizio torneo. Nella maggior parte dei casi il moltiplicatore è basso e il montepremi vale meno dei tre buy-in messi insieme; la differenza, mediata sulla distribuzione dei moltiplicatori, è il rake effettivo del formato, che va dal 5% all’8% a seconda del livello e della sala. È un costo da conoscere, perché decide quanto margine serve per stare in attivo.',
      'Il ROI si esprime in percentuale del buy-in: un ROI del 5% su un buy-in da 10 € significa guadagnare in media 0,50 € a torneo, rake compreso.',
    ],
    esempio:
      'Spin & Go da 5 €: su cento tornei il moltiplicatore medio, pesato per frequenza, porta il montepremi medio a circa 14 € invece dei 15 € di tre buy-in. L’euro mancante per torneo è il rake: chi non batte quel 6-7% con il proprio vantaggio non può essere in attivo.',
    guida: {
      testo: 'la guida al rake negli Spin & Go, che spiega quanto pesa il costo del buy-in',
      href: '/guide/rake-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, in cui il buy-in e il rake della struttura sono impostabili',
      href: '/simulatore-varianza',
    },
    correlati: ['rake', 'bankroll', 'moltiplicatore', 'mtt'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'moltiplicatore',
    termine: 'Moltiplicatore',
    varianti: ['multiplier', 'moltiplicatore del montepremi'],
    query: 'spin and go multiplier odds',
    titolo: 'Moltiplicatore negli Spin & Go: cos’è e come si legge',
    definizione:
      'Il moltiplicatore è il numero estratto a caso prima di ogni Spin & Go che moltiplica il buy-in e fissa il montepremi: dal 2x più comune ai jackpot rari.',
    spiegazione: [
      'In un torneo classico il montepremi è la somma delle iscrizioni; negli Spin & Go è deciso da una ruota che gira prima della prima mano. La distribuzione è molto sbilanciata: la maggior parte dei tornei esce con il moltiplicatore minimo, una frazione con moltiplicatori medi, e pochissimi con quelli alti che pagano anche il secondo e il terzo. La sala pubblica la tabella delle probabilità di ogni moltiplicatore, e da quella tabella si calcola il rake effettivo del formato, cioè la differenza fra i tre buy-in e il montepremi medio.',
      'Saperlo leggere cambia le aspettative: chi gioca cento tornei vedrà quasi sempre montepremi piccoli, e i risultati di un mese dipendono in buona parte da quanti moltiplicatori medio-alti sono capitati. È la fonte principale della varianza del formato, più della fortuna alle carte, ed è il motivo per cui il bankroll richiesto è alto e per cui il simulatore di varianza modella proprio la distribuzione dei moltiplicatori. La strategia al tavolo, invece, non cambia con il moltiplicatore, salvo nei rari tornei che pagano più di un posto.',
      'La tabella dei moltiplicatori cambia da sala a sala e nel tempo: per questo qui non se ne riporta una. Va letta sulla struttura che si gioca davvero.',
    ],
    esempio:
      'Su una struttura in cui il moltiplicatore 2x esce nel 70% dei casi e il 25x una volta su mille, giocare cento tornei con ROI positivo può chiudersi in perdita se non capita nessun moltiplicatore medio: non è un segnale sul gioco, è la forma della distribuzione.',
    guida: {
      testo: 'la guida ai moltiplicatori degli Spin & Go, che insegna a leggere la tabella pubblicata dalla sala',
      href: '/guide/moltiplicatori-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che modella la distribuzione dei moltiplicatori',
      href: '/simulatore-varianza',
    },
    correlati: ['buy-in', 'varianza', 'rake', 'bankroll'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'rake',
    termine: 'Rake',
    varianti: ['commissione', 'fee', 'rake della sala'],
    query: 'rake poker cos è',
    titolo: 'Rake nel poker: cos’è e quanto pesa negli Spin & Go',
    definizione:
      'Il rake è la commissione che la sala trattiene su ogni torneo o su ogni piatto: è il costo del gioco, e il margine di un giocatore si misura al netto del rake.',
    spiegazione: [
      'Nel cash game il rake è una percentuale di ogni piatto, con un tetto per mano; nei tornei è la fee aggiunta al buy-in (la seconda cifra di «9 + 1»). In entrambi i casi è denaro che esce dal tavolo e non torna: la somma dei risultati di tutti i giocatori a un tavolo è negativa esattamente del rake, ed è per questo che «essere meglio della media» non basta per vincere.',
      'Negli Spin & Go il rake non è dichiarato come fee separata: è nascosto nella distribuzione dei moltiplicatori. Tre giocatori pagano tre buy-in, ma il montepremi medio — pesato sulle probabilità pubblicate di ogni moltiplicatore — vale meno di tre buy-in, e la differenza è il rake effettivo, di solito fra il 5% e l’8% a seconda del livello. Ai buy-in bassi la percentuale è più alta, e un ROI del 3% lordo può essere un risultato in perdita una volta contato il costo. Chi valuta il proprio gioco deve quindi partire dal rake della struttura che gioca davvero, non da una regola generale.',
      'Le restituzioni di rake (rakeback) esistono in molte forme e cambiano il conto: sono descritte nella guida al rake, con il solo scopo di far capire il meccanismo.',
    ],
    esempio:
      'Spin & Go da 10 €: tre buy-in fanno 30 €, ma il montepremi medio della struttura è 28 €. Il rake effettivo è 2 € a torneo, il 6,7%. Un giocatore che vince il 36% dei tornei a moltiplicatore medio 2x guadagna meno di quanto sembri, perché ogni torneo gli costa quei 2 € prima di cominciare.',
    guida: {
      testo: 'la guida al rake negli Spin & Go, che fa il conto sulla distribuzione dei moltiplicatori',
      href: '/guide/rake-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, in cui il rake della struttura è un parametro',
      href: '/simulatore-varianza',
    },
    correlati: ['buy-in', 'moltiplicatore', 'bankroll', 'ev'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'varianza',
    termine: 'Varianza',
    varianti: ['variance', 'oscillazioni', 'swing'],
    query: 'varianza nel poker',
    titolo: 'Varianza nel poker: cos’è e quanto è grande negli Spin & Go',
    definizione:
      'La varianza è la misura di quanto i risultati reali si discostano dal valore atteso: dice quanto grandi sono le oscillazioni che un giocatore deve aspettarsi.',
    spiegazione: [
      'Due giocatori con lo stesso ROI possono avere mesi molto diversi: la differenza è varianza, non abilità. Nel breve periodo il risultato è dominato dal caso (quali carte escono, quali moltiplicatori capitano); solo su migliaia di tornei l’EV emerge dal rumore. La varianza si misura in buy-in ed è ciò che determina quanti buy-in servono per non andare in rovina con un gioco che, in media, guadagna.',
      'Negli Spin & Go la varianza ha due fonti: le carte, come in ogni forma di poker, e la distribuzione dei moltiplicatori, che è la fonte più grande. Un mese in cui non capita nessun moltiplicatore medio-alto chiude in perdita anche per un giocatore in attivo; un singolo moltiplicatore alto vinto paga decine di tornei. Per questo giudicare il proprio gioco dai risultati di poche centinaia di tornei è quasi sempre un errore: il campione è troppo piccolo per distinguere l’EV dalla fortuna.',
      'Il simulatore del sito rende visibile tutto questo: date le probabilità dei moltiplicatori, il ROI e il numero di tornei, mostra la nuvola dei percorsi possibili di un bankroll e il rischio di rovina per ogni dimensione del fondo.',
    ],
    esempio:
      'Con un ROI del 5% su tornei da 5 €, mille tornei rendono in media 250 €. Il simulatore mostra che una parte non piccola delle simulazioni chiude comunque in negativo dopo mille tornei, e che serie negative di 50-80 buy-in sono ordinarie: chi le legge come «sto giocando male» cambia gioco proprio quando non dovrebbe.',
    guida: {
      testo: 'la guida alla varianza negli Spin & Go, con i numeri del formato',
      href: '/guide/varianza-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che disegna migliaia di percorsi possibili del bankroll',
      href: '/simulatore-varianza',
    },
    correlati: ['downswing', 'bankroll', 'ev', 'moltiplicatore'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'exploit',
    termine: 'Exploit (gioco exploitative)',
    varianti: ['exploitative', 'sfruttare', 'deviazione'],
    query: 'exploit poker significato',
    titolo: 'Exploit nel poker: significato di gioco exploitative',
    definizione:
      'Fare un exploit significa deviare dall’equilibrio per sfruttare un errore preciso dell’avversario: si guadagna di più, al prezzo di diventare sfruttabili.',
    spiegazione: [
      'La strategia GTO non perde contro nessuno ma non massimizza contro nessuno. Se un avversario passa troppo davanti a un all-in, spingere più mani di quante ne spingerebbe l’equilibrio guadagna di più; se chiama troppo, spingerne meno e solo per valore guadagna di più. Ogni deviazione di questo tipo è un exploit, e ha un costo: un avversario che se ne accorge può a sua volta sfruttarla. Il gioco «exploitative» è quindi una scelta consapevole, non un’assenza di teoria.',
      'Negli Spin & Go a limiti bassi gli exploit valgono molto, perché gli errori degli avversari sono grandi e ripetuti: chi limpa sempre il piccolo buio, chi non chiama mai un all-in senza un asso, chi va all-in con qualunque coppia a 20 big blind. La condizione per sfruttarli è conoscere l’equilibrio: senza sapere che il grande buio dovrebbe chiamare con il 35% delle mani, non si può riconoscere chi ne chiama il 15%. Le tabelle GTO servono a questo — a misurare la deviazione altrui e a scegliere la propria.',
      'Un exploit senza una lettura è solo un errore con un nome migliore: spingere «più largo perché tanto chiamano poco» va verificato sul campione di mani che si ha, non sull’impressione dell’ultima chiamata.',
    ],
    esempio:
      'Contro un grande buio che nelle ultime venti mani ha passato ogni all-in senza un asso o una coppia, il piccolo buio a 8 big blind spinge il 75% delle mani invece del 55% dell’equilibrio. Se l’avversario si adegua e comincia a chiamare largo, si torna verso l’equilibrio.',
    guida: {
      testo: 'la guida completa alla strategia Spin & Go, che colloca GTO ed exploit nel percorso',
      href: '/guide/strategia-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, il punto di partenza da cui ogni exploit si misura',
      href: '/tabelle',
    },
    correlati: ['gto', 'range', 'nash', 'reg'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'bluff',
    termine: 'Bluff',
    varianti: ['bluffare', 'semi-bluff', 'bluff catcher'],
    query: 'bluff poker',
    titolo: 'Bluff nel poker: significato, semi-bluff e quando ha senso',
    definizione:
      'Il bluff è una puntata fatta con una mano che, se chiamata, quasi sempre perde: serve a far passare mani migliori e rende solo se l’avversario folda abbastanza.',
    spiegazione: [
      'Un bluff è un calcolo, non un colpo di teatro. Se si punta due terzi del piatto, il bluff va in pari quando l’avversario passa il 40% delle volte; se passa di più guadagna, se passa di meno perde. Il semi-bluff è un bluff con una rete di sicurezza: si punta con un progetto (colore, scala) che perde adesso ma può diventare la mano migliore, quindi si guadagna sia dai fold sia dalle volte in cui il progetto arriva.',
      'Negli Spin & Go il bluff classico, quello a più strade con puntate grandi, è raro: gli stack sono corti e quasi ogni puntata dopo il flop impegna il resto delle fiches, quindi si ha una sola occasione. La forma tipica è il semi-bluff all-in con un progetto contro una continuation bet, oppure l’all-in preflop con mani che non vogliono essere chiamate ma reggono la chiamata, che è la logica del push/fold: molte spinte «funzionano» perché gli altri passano, non perché la mano sia forte. La mano che chiama un possibile bluff con una mano media si chiama bluff catcher.',
      'Contro avversari che non passano mai, il bluff non esiste: si punta solo per valore. È l’exploit più semplice del formato, e uno dei più redditizi ai limiti bassi.',
    ],
    esempio:
      'Grande buio con 12 big blind chiama l’apertura del bottone; flop 10-9-2 con due carte dello stesso seme, il grande buio ha 8-7 dello stesso seme. Contro la c-bet di 2, il check-raise all-in è un semi-bluff: prende il piatto quando il bottone passa, e quando viene chiamato ha circa il 50% di equity.',
    guida: {
      testo: 'la guida agli errori comuni negli Spin & Go, dove i bluff senza uno scopo hanno un capitolo',
      href: '/guide/errori-comuni-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, per rivedere i propri bluff e la loro equity',
      href: '/replayer',
    },
    correlati: ['value-bet', 'check-raise', 'c-bet', 'equity'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'tilt',
    termine: 'Tilt',
    varianti: ['andare in tilt', 'tiltare', 'tilt control'],
    query: 'tilt meaning poker',
    titolo: 'Tilt nel poker: significato e come si riconosce',
    definizione:
      'Il tilt è lo stato in cui un’emozione — rabbia, frustrazione, fretta — prende il posto del ragionamento e fa giocare peggio di quanto si sappia fare.',
    spiegazione: [
      'La parola viene dal flipper, che si blocca («tilt») quando lo si scuote troppo. Nel poker descrive il momento in cui una bad beat, una serie negativa o anche una vincita grande cambiano il modo di decidere: si chiama per «riprendersi» i soldi, si spinge per stanchezza, si evita una chiamata corretta per paura. Il tilt non è un difetto di carattere, è una reazione normale a un gioco con molta varianza; ciò che si può allenare è riconoscerlo presto e avere una regola per fermarsi.',
      'Negli Spin & Go il tilt costa più che altrove perché i tornei durano pochi minuti: in mezz’ora di tilt si giocano dieci tornei, non una mano. I segnali ricorrenti sono precisi — chiamare all-in fuori tabella «perché tanto», aprire un tavolo in più dopo una sconfitta, giocare il limite superiore per recuperare — e ognuno si può trasformare in una regola: sessione chiusa dopo N tornei persi di fila, mai un salto di limite in perdita. Il mental coaching della scuola lavora proprio su queste regole.',
      'Il rimedio strutturale è il bankroll: con un fondo dimensionato, una serie negativa è un numero che il simulatore aveva già previsto, non un’emergenza.',
    ],
    esempio:
      'Dopo tre tornei persi con la mano migliore all-in, un giocatore chiama un all-in a 15 big blind con K-5 offsuit «per cambiare aria». La tabella dice fold con margine: la decisione non è un errore di conoscenza, è tilt, e la regola giusta era chiudere la sessione al terzo torneo.',
    guida: {
      testo: 'la guida agli errori comuni negli Spin & Go, che dedica un capitolo al tilt',
      href: '/guide/errori-comuni-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che mostra quanto sono normali le serie negative',
      href: '/simulatore-varianza',
    },
    correlati: ['downswing', 'varianza', 'bankroll', 'cooler'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'downswing',
    termine: 'Downswing',
    varianti: ['serie negativa', 'swing negativo', 'upswing'],
    query: 'downswing poker',
    titolo: 'Downswing nel poker: cos’è e quanto può durare',
    definizione:
      'Il downswing è una serie prolungata di risultati negativi che non dipende da come si gioca: è la varianza nella direzione sbagliata, con una durata prevedibile.',
    spiegazione: [
      'Per definizione un downswing è misurato in buy-in dal picco precedente al punto più basso: «un downswing di 60 buy-in» significa che il bankroll è sceso di 60 buy-in prima di risalire. L’opposto è l’upswing. Entrambi sono normali per chiunque, compreso chi ha un margine positivo; la differenza fra un giocatore in attivo e uno in perdita non è l’assenza di downswing, è che i primi si chiudono.',
      'Negli Spin & Go i downswing sono lunghi e frequenti per via della distribuzione dei moltiplicatori: un giocatore con un ROI del 5% su tornei da 5 € deve aspettarsi, nel corso di un anno, serie negative di 60-100 buy-in, e in casi rari di più. Il simulatore di varianza le mostra prima che accadano, ed è il modo migliore per non scambiarle per un segnale sul proprio gioco. La sola cosa che un downswing dovrebbe cambiare è il limite, se il bankroll lo impone: non la strategia.',
      'Durante un downswing la tentazione è duplice — cambiare gioco o giocare di più per recuperare — e sono entrambe le vie più corte verso il tilt.',
    ],
    esempio:
      'Bankroll di 300 buy-in, ROI del 4%: il simulatore stima che un downswing di 70 buy-in nell’arco di 3.000 tornei sia un evento ordinario. Chi lo vive con 300 buy-in continua a giocare lo stesso limite; chi lo vive con 100 buy-in ha perso il 70% del fondo e deve scendere.',
    guida: {
      testo: 'la guida alla varianza negli Spin & Go, con la lunghezza attesa dei downswing',
      href: '/guide/varianza-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che calcola i downswing attesi per il proprio ROI',
      href: '/simulatore-varianza',
    },
    correlati: ['varianza', 'bankroll', 'tilt', 'ev'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'staking',
    termine: 'Staking',
    varianti: ['backing', 'stake', 'staker', 'make-up'],
    query: 'staking poker italia',
    titolo: 'Staking nel poker: significato di backing e make-up',
    definizione:
      'Lo staking è l’accordo con cui una persona (lo staker) finanzia il gioco di un’altra in cambio di una quota dei profitti, secondo termini fissati prima.',
    spiegazione: [
      'Il giocatore mette il tempo e le decisioni, lo staker mette il bankroll: i profitti si dividono secondo una percentuale pattuita, e le perdite vengono coperte dallo staker. Quasi tutti gli accordi prevedono il make-up: le perdite accumulate vanno recuperate prima che il giocatore torni a incassare la propria quota. Un accordo di staking serio scrive tutto prima di cominciare — quota, limiti giocabili, durata, condizioni di uscita — perché ogni ambiguità emerge nel momento peggiore, cioè in un downswing.',
      'Negli Spin & Go lo staking è comune perché la varianza è alta e il bankroll richiesto è grande: un giocatore con un margine dimostrato ma con poco capitale trova sensato cedere una parte dei profitti in cambio della possibilità di giocare limiti che da solo non potrebbe sostenere. Il rovescio è che l’accordo va letto con attenzione: una quota alta allo staker, sommata al rake, può lasciare al giocatore un margine netto molto sottile.',
      'Questa voce descrive il meccanismo e basta: se un accordo convenga dipende dai numeri del singolo caso, e non c’è una regola generale.',
    ],
    esempio:
      'Accordo al 50% con make-up. Il primo mese il giocatore perde 400 €, coperti dallo staker; il secondo mese vince 1.000 €: i primi 400 ripianano il make-up, i restanti 600 si dividono a metà. Il giocatore incassa 300 €, non 500.',
    guida: {
      testo: 'la guida al bankroll per gli Spin & Go, che spiega quanto capitale richiede il formato',
      href: '/guide/bankroll-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, per stimare le perdite che un accordo deve poter assorbire',
      href: '/simulatore-varianza',
    },
    correlati: ['bankroll', 'downswing', 'varianza', 'rake'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'reg',
    termine: 'Reg (regular)',
    varianti: ['regular', 'giocatore regolare', 'grinder'],
    query: 'reg poker significato',
    titolo: 'Reg nel poker: significato di regular',
    definizione:
      'Reg (regular) è il giocatore abituale di un limite o di un formato: gioca con volume e con metodo, e si riconosce dagli altri per la solidità delle sue scelte.',
    spiegazione: [
      'La parola nasce come contrapposizione a «fish», il giocatore occasionale che commette errori grandi. Un reg non è necessariamente un vincente — esistono reg in perdita — ma è qualcuno che gioca molto, conosce le tabelle e non regala fiches con chiamate assurde. Riconoscere i reg al tavolo serve a scegliere la strategia: contro un reg si gioca vicino all’equilibrio, contro un occasionale si sfruttano gli errori.',
      'Negli Spin & Go i reg si riconoscono in pochi tornei: aprono con dimensioni standard, spingono e chiamano secondo le tabelle, non limpano a caso, non chiamano all-in con mani deboli. Su alcune sale un HUD li segnala in fretta; senza, bastano una decina di mani osservate con attenzione. La conseguenza pratica è che contro due reg il torneo si gioca sul filo dell’equilibrio e il margine è sottile — è il motivo per cui la scelta del limite e dell’orario pesa quanto la strategia.',
      'Diventare un reg vincente è il percorso normale di chi studia: giocare vicino all’equilibrio contro chi lo conosce, e deviare con un motivo contro chi non lo conosce.',
    ],
    esempio:
      'Tre giocatori a 10 big blind. Il reg al bottone spinge il 26% delle mani, come da tabella; l’occasionale al piccolo buio spinge il 60%. Contro il primo si chiama con il range di equilibrio, contro il secondo si chiama molto più largo: è la stessa posizione con due strategie diverse.',
    guida: {
      testo: 'la guida a come scegliere una scuola di poker, che spiega cosa distingue chi studia',
      href: '/guide/scegliere-scuola-poker-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, la base comune con cui ogni reg gioca',
      href: '/tabelle',
    },
    correlati: ['exploit', 'gto', 'grinder', 'hud'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'grinder',
    termine: 'Grinder',
    varianti: ['grindare', 'grind', 'volume'],
    query: 'grinder poker significato',
    titolo: 'Grinder nel poker: significato e cosa vuol dire grindare',
    definizione:
      'Il grinder è chi gioca con grande volume e disciplina per accumulare un margine piccolo su molte partite: grindare è macinare tornei, non cercare il colpo.',
    spiegazione: [
      'Il termine viene dall’inglese «to grind», macinare. Descrive un approccio: il grinder sa che il proprio vantaggio per torneo è piccolo e che si trasforma in denaro solo con il volume, quindi gioca molti tavoli, molte ore, con regole fisse di bankroll e di sessione. È l’opposto del giocatore occasionale, e spesso coincide con il reg.',
      'Negli Spin & Go il grind è la forma naturale del gioco: un torneo dura pochi minuti, si giocano più tavoli insieme e in una sessione se ne possono chiudere decine. Il margine per torneo è di pochi centesimi o pochi euro, e a renderlo un reddito è il numero. Ha un costo: giocare molti tavoli abbassa la qualità delle singole decisioni, e la varianza del formato rende i mesi molto diversi fra loro. Il grinder che dura nel tempo è quello che tratta il gioco come un lavoro con orari, pause e un fondo dimensionato.',
      'Le scuole e gli accordi di staking esistono per i grinder: chi gioca un torneo a settimana non ha bisogno né dell’una né dell’altro.',
    ],
    esempio:
      'Un grinder di Spin & Go da 5 € con ROI del 4% guadagna in media 0,20 € a torneo. A 300 tornei a settimana sono 60 €; a 1.500 al mese, 300 €. Nessun singolo torneo conta: conta il totale, e conta che il ROI regga al volume.',
    guida: {
      testo: 'la guida al bankroll per gli Spin & Go, scritta per chi fa volume',
      href: '/guide/bankroll-spin-and-go',
    },
    strumento: {
      testo: 'il simulatore di varianza, che mostra cosa succede a un ROI piccolo su migliaia di tornei',
      href: '/simulatore-varianza',
    },
    correlati: ['reg', 'bankroll', 'varianza', 'rake'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'cooler',
    termine: 'Cooler',
    varianti: ['setup', 'mano fredda'],
    query: 'cosa significa cooler nel poker',
    titolo: 'Cooler nel poker: cosa significa e perché non è un errore',
    definizione:
      'Un cooler è una mano in cui due giocatori hanno entrambi una mano fortissima e chi ha la seconda perde tutto senza errori: nessuna giocata poteva evitarlo.',
    spiegazione: [
      'Il cooler è diverso dalla bad beat: nella bad beat si era avanti e la carta sbagliata ha ribaltato la mano; nel cooler si era dietro dall’inizio, ma con una mano così forte che passarla sarebbe stato l’errore. Coppia di re contro coppia d’assi preflop, colore contro colore più alto, full contro full: sono situazioni in cui le fiches finiscono nel piatto per forza, e chi perde non ha nulla da rivedere.',
      'Negli Spin & Go i cooler sono frequenti perché le fiches vanno nel piatto preflop con mani che non sono affatto premium: a 8 big blind si spinge con K-9 e si chiama con A-7, quindi le situazioni «mano forte contro mano più forte» non sono coppia contro coppia ma asso contro asso con kicker migliore, e si ripetono ogni giorno. Saperle riconoscere protegge dal tilt: un cooler non contiene un’informazione sul proprio gioco, e cambiare strategia dopo un cooler è un errore che nasce da una non-decisione.',
      'Il replayer del sito serve anche a questo: rivedere la mano e verificare se davvero l’unica scelta era quella fatta. Se lo era, la mano si archivia senza rimpianti.',
    ],
    esempio:
      'Piccolo buio con 9 big blind spinge A-J; il grande buio chiama con A-K. Il piccolo buio era dietro fin dall’inizio, ma la spinta con A-J a 9 big blind è nel range di equilibrio con margine: è un cooler, e la decisione era corretta.',
    guida: {
      testo: 'la guida alla varianza negli Spin & Go, dove cooler e bad beat sono messi nel giusto contesto',
      href: '/guide/varianza-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, per rivedere la mano e verificare che non c’era alternativa',
      href: '/replayer',
    },
    correlati: ['tilt', 'varianza', 'equity', 'ev'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'hud',
    termine: 'HUD (Heads-Up Display)',
    varianti: ['heads-up display', 'tracker', 'statistiche a schermo'],
    query: 'hud meaning poker',
    titolo: 'HUD nel poker: significato e cosa mostra sugli avversari',
    definizione:
      'L’HUD (Heads-Up Display) è il pannello che un tracker sovrappone al tavolo online, con le statistiche di ogni avversario ricavate dalle mani già giocate.',
    spiegazione: [
      'Il tracker legge le hand history salvate dal client della sala, le mette in un database e ne ricava numeri come il VPIP (quante mani gioca), il PFR (quante ne rilancia), la frequenza di fold a un all-in. L’HUD è la finestra che mostra quei numeri accanto a ogni giocatore, aggiornati mano dopo mano. Serve a sostituire l’impressione («mi sembra che chiami tanto») con una misura, e a rileggere il proprio gioco a fine sessione.',
      'Negli Spin & Go l’HUD ha un limite strutturale: i tornei durano poche mani e contro lo stesso avversario se ne accumulano poche decine, quindi le statistiche sono rumorose per lungo tempo. Le più utili sono quelle che si stabilizzano in fretta — quante volte passa davanti a un all-in, quante volte limpa il piccolo buio — mentre quelle postflop richiedono campioni che nel formato non si raggiungono. Non tutte le sale lo permettono: molte limitano o vietano gli strumenti in tempo reale su questo formato, e il regolamento va letto prima di installare qualunque cosa.',
      'I filtri e i report per PokerTracker messi a disposizione dalla scuola servono più alla revisione che al tavolo: guardare le proprie statistiche su migliaia di mani dice dove si perde EV.',
    ],
    esempio:
      'Dopo 40 mani contro lo stesso avversario, l’HUD mostra «fold a push: 8 su 9». Il campione è piccolo ma il segnale è forte: dal piccolo buio a 8 big blind si può spingere più largo dell’equilibrio finché il numero non cambia.',
    guida: {
      testo: 'la guida a tracker e HUD per gli Spin & Go, con le statistiche che contano davvero nel formato',
      href: '/guide/tracker-hud-spin-and-go',
    },
    strumento: {
      testo: 'la libreria dei documenti, con i filtri e i report per PokerTracker',
      href: '/docs',
    },
    correlati: ['vpip', 'pfr', 'reg', 'exploit'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'vpip',
    termine: 'VPIP',
    varianti: ['Voluntarily Put money In Pot', 'VP$IP'],
    query: 'vpip poker significato',
    titolo: 'VPIP nel poker: significato e come si legge il numero',
    definizione:
      'Il VPIP (Voluntarily Put money In Pot) è la percentuale di mani in cui un giocatore mette fiches nel piatto di sua volontà, chiamando o rilanciando.',
    spiegazione: [
      'È la statistica più immediata di un HUD: dice quanto un giocatore è largo. I bui obbligatori non contano; contano la chiamata e il rilancio preflop. Un VPIP del 20% a un tavolo pieno indica un giocatore selettivo, uno del 50% un giocatore che entra in metà delle mani. Da solo però non dice come gioca: per questo si legge insieme al PFR, che misura quante di quelle mani le rilancia.',
      'Negli Spin & Go i valori sono più alti che nel cash game a sei o nove: a tre giocatori si entra in molte più mani, e a stack corto l’equilibrio stesso prevede che il bottone giochi circa un terzo delle mani e il grande buio ne difenda una parte ampia. Un VPIP «alto» va quindi giudicato rispetto al formato e alla posizione, non rispetto ai riferimenti dei tavoli pieni. Il numero si stabilizza in fretta, perché ogni mano genera una decisione preflop, ed è una delle poche statistiche affidabili dopo poche decine di mani.',
      'Il proprio VPIP, letto su migliaia di mani per posizione, è il primo controllo di una revisione: un piccolo buio che gioca troppo poco dopo il fold del bottone lascia fiches sul tavolo ogni giro.',
    ],
    esempio:
      'Un avversario con VPIP 62% e PFR 12% chiama molto e rilancia poco: contro di lui si punta per valore con mani più deboli del solito e si bluffa quasi mai, perché non passa.',
    guida: {
      testo: 'la guida a tracker e HUD per gli Spin & Go',
      href: '/guide/tracker-hud-spin-and-go',
    },
    strumento: {
      testo: 'la libreria dei documenti, con i report che leggono VPIP e PFR per posizione',
      href: '/docs',
    },
    correlati: ['pfr', 'hud', 'range', 'reg'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'pfr',
    termine: 'PFR',
    varianti: ['Pre-Flop Raise', 'preflop raise'],
    query: 'pfr poker significato',
    titolo: 'PFR nel poker: significato e differenza col VPIP',
    definizione:
      'Il PFR (Pre-Flop Raise) è la percentuale di mani in cui un giocatore rilancia preflop: letto insieme al VPIP dice quanto il suo gioco è aggressivo o passivo.',
    spiegazione: [
      'Il PFR è sempre minore o uguale al VPIP, perché ogni rilancio è anche una mano giocata. La distanza fra i due numeri è l’informazione: un giocatore con VPIP 30 e PFR 25 rilancia quasi tutte le mani che gioca (aggressivo), uno con VPIP 30 e PFR 8 chiama molto e rilancia poco (passivo). Contro il primo si difende con attenzione, contro il secondo si punta per valore e si isolano i suoi limp.',
      'Negli Spin & Go il PFR conta sia i rilanci piccoli sia gli all-in preflop, che nel formato sono la maggior parte dei rilanci sotto le 10 big blind. Un PFR molto alto dal bottone e dal piccolo buio è la norma dell’equilibrio, non un segnale di follia; ciò che distingue un avversario è il rapporto con il VPIP e la frequenza di limp. Come il VPIP, il PFR si stabilizza in poche decine di mani ed è una delle statistiche leggibili nel formato.',
      'Un uso concreto: contro un avversario con PFR alto ma che passa a ogni re-shove, il rilancio piccolo si punisce con l’all-in sopra, con un range più largo del normale.',
    ],
    esempio:
      'Bottone con VPIP 45 e PFR 44 a 15 big blind: apre quasi tutto quello che gioca. Il grande buio che ha 12 big blind risponde con un range di re-shove più largo — assi con kicker medio, coppie piccole, re alti — perché l’apertura è debole in media.',
    guida: {
      testo: 'la guida a tracker e HUD per gli Spin & Go',
      href: '/guide/tracker-hud-spin-and-go',
    },
    strumento: {
      testo: 'la libreria dei documenti, con i filtri per PokerTracker della scuola',
      href: '/docs',
    },
    correlati: ['vpip', 'hud', 'open-raise', 'shove'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'squeeze',
    termine: 'Squeeze',
    varianti: ['squeeze play', 'squeezare'],
    query: 'squeeze poker significato',
    titolo: 'Squeeze nel poker: significato e quando funziona',
    definizione:
      'Lo squeeze è un rilancio fatto dopo un’apertura e almeno una chiamata: si «stringe» chi ha aperto fra il proprio rilancio e i chiamanti che gli stanno dietro.',
    spiegazione: [
      'La mossa sfrutta una situazione precisa: chi ha aperto deve rispondere a un rilancio sapendo che dietro di lui c’è ancora un giocatore che ha chiamato, e chi ha chiamato lo ha fatto con una mano che di solito non regge un rilancio grande. Lo squeeze prende il piatto — già gonfio dall’apertura e dalla chiamata — senza vedere il flop, e si fa sia per valore con mani forti sia come bluff con mani che si passano volentieri se qualcuno risponde.',
      'Negli Spin & Go lo squeeze compare dal grande buio quando il bottone apre e il piccolo buio chiama, e a stack corto è quasi sempre un all-in: con 12-15 big blind il rilancio sopra un’apertura e una chiamata impegna lo stack per costruzione. Il piatto contiene già due rilanci più i bui, quindi l’all-in raccoglie molto quando entrambi passano, e ha bisogno di poca equity quando viene chiamato. Il range di squeeze all-in del grande buio è più largo di quanto sembri: assi medi, coppie, re con kicker buono.',
      'Il rischio è che la chiamata del piccolo buio nasconda una mano forte in attesa proprio di questo: contro chi chiama spesso con l’intenzione di ributtare, lo squeeze si restringe alle mani che reggono l’all-in.',
    ],
    esempio:
      'Bottone con 20 big blind apre a 2, il piccolo buio chiama; il grande buio ha 13 big blind e A-9 dello stesso seme. Nel piatto ci sono 5,5 big blind: lo squeeze all-in raccoglie subito il 42% dello stack quando entrambi passano, e contro i range di chiamata la mano tiene.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta le mosse a tre giocatori nel piatto',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che hanno il nodo del grande buio dopo apertura e chiamata',
      href: '/tabelle',
    },
    correlati: ['raise', 'shove', 'open-raise', 'range'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'nuts',
    termine: 'Nuts',
    varianti: ['the nuts', 'mano massima', 'nut flush'],
    query: 'nuts poker significato',
    titolo: 'Nuts nel poker: significato di avere il nuts',
    definizione:
      'Il nuts è la mano migliore possibile date le carte comuni sul tavolo: chi ha il nuts non può essere battuto in quel momento, qualunque cosa abbia l’avversario.',
    spiegazione: [
      'Il nuts si calcola dal board: su un tavolo con tre carte dello stesso seme il nuts è il colore con l’asso, su un tavolo accoppiato può essere un poker o un full. Cambia a ogni carta — la mano che era il nuts al flop può non esserlo più al river — e per questo si parla di «nuts attuale» e di mani «nut» per categoria: il nut flush è il miglior colore possibile, la nut straight la miglior scala. Riconoscere il nuts e, soprattutto, riconoscere di non averlo, è la base della lettura del board.',
      'Negli Spin & Go la parola pesa meno che nel cash game profondo, perché la maggior parte delle fiches entra nel piatto preflop e lo showdown decide da solo: chi è all-in con una coppia di assi non ha il nuts, ha una mano forte, e vince o perde secondo l’equity. Dopo il flop, con stack ancora profondi all’inizio del torneo, la domanda torna utile: puntare tutto con una mano che non è il nuts contro un avversario che potrebbe averlo è il modo classico di perdere uno stack.',
      'L’espressione «nuts» viene dal gergo americano dell’Ottocento, e non ha niente a che fare con la matematica: è solo la mano che nessuno può battere.',
    ],
    esempio:
      'Flop 7-8-9 con due carte dello stesso seme. Chi ha 10-J ha la scala massima: è il nuts al flop. Se al turn arriva una terza carta dello stesso seme, il nuts diventa il colore, e la scala non è più imbattibile.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta la lettura del board dopo il flop',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che mostra strada per strada la forza relativa delle mani',
      href: '/replayer',
    },
    correlati: ['equity', 'value-bet', 'kicker', 'trips'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'utg',
    termine: 'UTG (under the gun)',
    varianti: ['under the gun', 'prima posizione'],
    query: 'utg poker significato',
    titolo: 'UTG nel poker: significato di under the gun',
    definizione:
      'UTG (under the gun) è la prima posizione a parlare preflop, a sinistra del grande buio: la più scomoda, perché gli altri decidono dopo aver visto cosa fa.',
    spiegazione: [
      'L’espressione significa «sotto tiro»: chi è UTG deve decidere per primo, senza informazioni, e con l’intero tavolo che parla dopo di lui. Per questo i range di apertura da UTG sono i più stretti del tavolo. Ai tavoli da nove le posizioni si chiamano, in ordine, UTG, UTG+1, middle, hijack, cutoff, bottone, piccolo e grande buio; ai tavoli da sei UTG è la prima delle quattro posizioni prima dei bui.',
      'Negli Spin & Go la posizione UTG non esiste: con tre giocatori le posizioni sono bottone, piccolo buio e grande buio, e il primo a parlare preflop è il bottone, che però è anche l’ultimo a parlare dopo il flop — il contrario dell’UTG di un tavolo pieno, che è penalizzato in tutte le strade. È una delle ragioni per cui i range del formato non si trasportano da altri giochi: il bottone a tre apre molto più largo di qualunque prima posizione, perché ha dietro solo due avversari e la posizione migliore dopo il flop.',
      'Chi arriva dagli MTT o dal cash game a sei deve disimparare la prudenza «da UTG»: al tavolo a tre, parlare per primi preflop non è uno svantaggio, è il turno del giocatore con più opzioni.',
    ],
    esempio:
      'A un tavolo da sei, UTG con 20 big blind apre circa il 15% delle mani. Al tavolo a tre di uno Spin & Go, il bottone con 20 big blind — che è la «prima posizione» — ne apre più del doppio: la stessa parola descrive due situazioni che non hanno niente in comune.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che spiega le tre posizioni del formato',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, con il range di apertura del bottone a ogni profondità',
      href: '/tabelle',
    },
    correlati: ['big-blind', 'blind', 'open-raise', 'range'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'muck',
    termine: 'Muck',
    varianti: ['muckare', 'carte al muck', 'auto-muck'],
    query: 'muck poker significato',
    titolo: 'Muck nel poker: significato e cosa succede allo showdown',
    definizione:
      'Il muck è il mucchio delle carte scartate: «muckare» significa gettare le proprie carte senza mostrarle, sia passando sia allo showdown quando si è battuti.',
    spiegazione: [
      'Dal vivo il muck è fisico, le carte coperte al centro del tavolo; online è l’opzione con cui, allo showdown, chi ha la mano peggiore evita di mostrarla. Chi vince il piatto deve mostrare (o l’ultimo aggressore mostra per primo, secondo le regole della sala), chi perde può muckare. L’«auto-muck» è l’impostazione del client che scarta in automatico le mani perdenti allo showdown: comoda, ma toglie agli avversari un’informazione che si sarebbe potuta scegliere se dare.',
      'Negli Spin & Go la scelta di mostrare o muckare ha un valore piccolo ma reale, perché contro gli stessi avversari si giocano tante mani in pochi minuti: mostrare un bluff riuscito invita chiamate future (utile se si vuole essere pagati con le mani forti), muckarlo mantiene l’immagine. Le hand history salvate dal client registrano anche le mani muckate allo showdown quando la sala le espone, ed è lì che un tracker ricava statistiche su come gli avversari sono arrivati allo showdown.',
      'Nel replayer del sito le carte muckate, quando la hand history le riporta, si vedono: è il modo più diretto di scoprire con cosa un avversario ha chiamato un all-in.',
    ],
    esempio:
      'Showdown a tre carte comuni dopo un all-in preflop: il piccolo buio mostra A-K, il grande buio con A-J perde. Online può muckare e non far sapere con cosa aveva chiamato; nella hand history di alcune sale la mano compare comunque, e il tracker la conta.',
    guida: {
      testo: 'la guida a tracker e HUD, che spiega cosa le hand history registrano e cosa no',
      href: '/guide/tracker-hud-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che mostra anche le carte arrivate allo showdown',
      href: '/replayer',
    },
    correlati: ['fold', 'hud', 'bluff', 'nuts'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'chip',
    termine: 'Chip (cip, fiche)',
    varianti: ['cip', 'fiche', 'fiches', 'gettone'],
    query: 'cip poker significato',
    titolo: 'Chip (cip) nel poker: significato e valore delle fiches',
    definizione:
      'Chip (in italiano cip o fiche) è il gettone con cui si punta: nei tornei è un punteggio senza valore in denaro, nel cash game vale la cifra che porta stampata.',
    spiegazione: [
      'La grafia «cip» è l’adattamento italiano dell’inglese chip, e «fiche» viene dal francese: le tre parole indicano la stessa cosa. Nel cash game ogni fiche vale denaro e si può alzarsi dal tavolo in qualunque momento portandosela via; nei tornei le fiches sono un punteggio — tutti ne ricevono lo stesso numero all’iscrizione e chi le perde tutte è eliminato — e il denaro arriva solo dai premi. Da qui la parola «stack» per il mucchio di fiches di un giocatore e «chip leader» per chi ne ha di più.',
      'Negli Spin & Go le fiches hanno una proprietà rara: valgono in modo lineare. Nella maggior parte dei tornei paga solo il primo, quindi il valore in denaro di uno stack è proporzionale alle fiches che contiene, e non c’è la distorsione dell’ICM dei tornei con più premi. Per questo il formato si ragiona in «chip EV», il valore atteso in fiches, che coincide con quello in denaro. La misura pratica delle fiches non è il numero stampato ma il rapporto con il grande buio: 1.000 fiches sono 10 big blind a bui 50/100 e 5 a bui 100/200.',
      'Nel sito i punti BFF non sono fiches e non hanno niente a che fare con il gioco: sono il credito del negozio della scuola, e vivono altrove.',
    ],
    esempio:
      'Torneo con 500 fiches a testa e bui 10/20: ognuno ha 25 big blind. Dopo tre livelli i bui sono 25/50 e chi ha ancora 500 fiches ne ha 10 di big blind: le fiches non sono cambiate, il loro peso sì.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che parte da fiches, bui e struttura',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, indicizzate in big blind e non in fiches',
      href: '/tabelle',
    },
    correlati: ['stack', 'big-blind', 'icm', 'ev'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'trips',
    termine: 'Trips (tris)',
    varianti: ['tris', 'set', 'three of a kind'],
    query: 'trips nel poker significato',
    titolo: 'Trips nel poker: significato e differenza fra trips e set',
    definizione:
      'Trips è il tris fatto con una carta in mano e due sul board; il set è il tris con una coppia in mano e una carta sul board: stesso punto, due casi.',
    spiegazione: [
      'La distinzione conta per come si gioca la mano. Il set è nascosto: chi ha una coppia in mano e trova la terza carta sul board ha una mano forte che l’avversario non può vedere, perché il board non è accoppiato. I trips sono visibili: il board mostra due carte uguali, quindi ogni avversario sa che un tris è possibile, e chi ce l’ha può essere battuto da un tris con kicker migliore o da un full.',
      'Negli Spin & Go i set e i trips compaiono soprattutto negli all-in preflop decisi dallo showdown, e la loro forza si misura in equity più che in gioco postflop: una coppia piccola all-in contro due carte alte fa set circa una volta su otto al flop. Con stack profondi all’inizio del torneo, il set è la mano classica con cui si vince uno stack intero contro chi ha una coppia alta; i trips su board accoppiato, invece, richiedono attenzione al kicker, che nel formato decide molti showdown fra mani uguali.',
      'La parola «tris» è quella italiana per il punto; «trips» e «set» sono le due sfumature inglesi, e valgono la pena di essere distinte perché la prima si vede e la seconda no.',
    ],
    esempio:
      'Board 9-9-4-K-2. Chi ha A-9 ha trips di 9 con kicker asso; chi ha 9-7 ha lo stesso tris con kicker 7 e perde. Chi ha 4-4 in mano ha un full (tre 4 e due 9) e batte entrambi: per questo si legge il board carta per carta prima di mettere tutto nel piatto.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta la lettura del board',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, con il valutatore che mostra il punto di ogni giocatore',
      href: '/replayer',
    },
    correlati: ['kicker', 'nuts', 'equity', 'value-bet'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'kicker',
    termine: 'Kicker',
    varianti: ['carta di accompagnamento', 'kicker alto'],
    query: 'kicker poker significato',
    titolo: 'Kicker nel poker: significato e quando decide una mano',
    definizione:
      'Il kicker è la carta che accompagna il punto e decide fra due mani uguali: a parità di coppia vince chi ha il kicker più alto, e fra due assi decide.',
    spiegazione: [
      'Il poker si gioca con le migliori cinque carte fra le due in mano e le cinque comuni. Quando due giocatori hanno lo stesso punto — la stessa coppia, lo stesso tris — si confrontano le carte rimanenti in ordine decrescente: la più alta è il kicker. Se anche i kicker sono uguali, o se le cinque carte migliori sono tutte sul board, il piatto si divide. Un kicker vale solo se entra nelle cinque carte: con due coppie sul board e una coppia in mano, il kicker può non contare affatto.',
      'Negli Spin & Go il kicker decide una quota enorme degli showdown, perché le fiches entrano preflop con assi e re accompagnati da carte medie. A-9 contro A-K è la situazione più comune del formato: chi ha il kicker più basso è «dominato», ha circa il 25-30% di equity, e vince solo trovando il proprio kicker o una scala. È il motivo per cui le tabelle di push e di call distinguono con cura A-2 da A-T: non è la coppia d’assi a fare la differenza, è cosa c’è accanto.',
      'Il concetto vale anche al contrario: quando l’avversario può avere solo assi con kicker alto, il proprio asso con kicker basso è una chiamata da evitare anche se «ho un asso».',
    ],
    esempio:
      'All-in preflop a 10 big blind: A-J contro A-4. Il board non porta né J né 4: vince A-J per il kicker. Se il board fosse A-K-Q-J-10, i due avrebbero la stessa scala sul tavolo e il piatto si dividerebbe: il kicker non entra nelle cinque carte.',
    guida: {
      testo: 'la guida al push/fold, dove il valore del kicker spiega la forma dei range',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che mostrano dove A-2 e A-T stanno in celle diverse',
      href: '/tabelle',
    },
    correlati: ['trips', 'nuts', 'equity', 'range'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'gutshot',
    termine: 'Gutshot',
    varianti: ['scala interna', 'inside straight draw', 'belly buster'],
    query: 'gutshot poker significato',
    titolo: 'Gutshot nel poker: significato di scala interna',
    definizione:
      'Il gutshot è un progetto di scala «interna»: manca una sola carta nel mezzo, e la chiudono quattro carte del mazzo contro le otto di una scala bilaterale.',
    spiegazione: [
      'Con 8-9 su un board 5-6-K si ha un gutshot: serve un 7, e nel mazzo ce ne sono quattro. La scala bilaterale (open-ended), per esempio 8-9 su 6-7-K, si chiude con un 5 o con un 10, cioè otto carte. La differenza pesa: dal flop al river un gutshot arriva circa il 17% delle volte, una bilaterale il 32%. Per questo il gutshot da solo raramente giustifica una chiamata grande; serve qualcos’altro (una carta alta, un progetto di colore, la posizione).',
      'Negli Spin & Go i progetti si giocano quasi sempre in un’unica decisione, perché con stack corti la puntata al flop mette dentro il resto delle fiches: il conto è «quanta equity ho contro il range dell’avversario» e non «quante volte chiudo». Un gutshot con due carte alte (A-J su 10-Q-4) vale più di quanto sembri, perché somma le quattro carte della scala alle sei che accoppiano; un gutshot nudo con carte basse vale poco. Come semi-bluff il gutshot funziona se l’avversario può passare, non se chiama con tutto.',
      'Il termine viene dall’inglese («colpo allo stomaco»); in italiano si dice anche scala interna o «scala a buco».',
    ],
    esempio:
      'Grande buio con 14 big blind chiama l’apertura del bottone con 9-8; flop 5-6-K. Serve solo un 7, quattro carte: un gutshot. Il bottone punta 2 nel piatto di 4,5: le pot odds chiedono circa il 31% di equity e il gutshot da solo ne ha il 17% al turn, quindi si passa, salvo un piano di check-raise come semi-bluff. Con flop 6-7-K la stessa mano avrebbe una scala bilaterale (un 5 o un 10, otto carte) e il conto cambierebbe.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta i progetti a stack corto',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che calcola l’equity di ogni progetto all-in',
      href: '/replayer',
    },
    correlati: ['flush-draw', 'scala', 'equity', 'pot-odds'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'scala',
    termine: 'Scala',
    varianti: ['straight', 'scala colore', 'scala reale'],
    query: 'scala poker regole',
    titolo: 'Scala nel poker: regole, scala colore e scala reale',
    definizione:
      'La scala è il punto formato da cinque carte in sequenza di semi diversi: A-2-3-4-5 è la più bassa (l’asso vale uno), 10-J-Q-K-A la più alta (broadway).',
    spiegazione: [
      'Nella scala dei punti del Texas hold’em la scala batte il tris e perde contro il colore. Fra due scale vince quella con la carta più alta; l’asso può stare in cima (10-J-Q-K-A) o in fondo (A-2-3-4-5, detta «ruota» o wheel), ma non «gira»: Q-K-A-2-3 non è una scala. La scala colore è una scala con cinque carte dello stesso seme e batte il poker; la scala reale è la scala colore 10-J-Q-K-A, il punto massimo del gioco.',
      'Negli Spin & Go la scala compare soprattutto come progetto: le mani connesse dello stesso seme (8-7, 9-8) fanno parte dei range di apertura e di chiamata proprio perché possono chiudere scale e colori, e a stack corto un progetto forte al flop si gioca spesso all-in come semi-bluff. Chi legge il board deve chiedersi sempre se è possibile una scala: con 6-7-8 sul tavolo, chi ha una coppia di assi ha un punto fragile.',
      'Il nome viene dalla sequenza delle carte come i pioli di una scala; l’inglese straight significa «dritta», nel senso di «in fila».',
    ],
    esempio:
      'Board 6-7-8-K-2. Chi ha 9-10 ha la scala massima (6-7-8-9-10); chi ha 4-5 ha una scala più bassa (4-5-6-7-8) e perde; chi ha 9-5 ha 5-6-7-8-9 e sta in mezzo. Con tre carte in sequenza sul board, la domanda «chi può avere la scala?» va fatta prima di puntare.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che ripassa i punti del poker',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, col valutatore che mostra il punto di ognuno',
      href: '/replayer',
    },
    correlati: ['gutshot', 'broadway', 'flush-draw', 'nuts'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'flush-draw',
    termine: 'Flush draw',
    varianti: ['progetto di colore', 'draw a colore', 'nut flush draw'],
    query: 'flush draw poker significato',
    titolo: 'Flush draw nel poker: significato e probabilità di chiudere',
    definizione:
      'Il flush draw è il progetto di colore: quattro carte dello stesso seme fra mano e board, con nove carte nel mazzo che lo chiudono al turn o al river.',
    spiegazione: [
      'Con due carte dello stesso seme in mano e altre due sul flop si ha un flush draw: restano nove carte di quel seme (13 meno le 4 viste) su 47 non viste. La probabilità di chiudere è circa il 19% al turn, il 19% al river e il 35% dal flop al river con due carte da vedere. Il nut flush draw è il progetto con l’asso: se il colore arriva, è il migliore possibile. Un flush draw con carte basse rischia di chiudere e perdere contro un colore più alto.',
      'Negli Spin & Go il flush draw è il progetto che più spesso finisce all-in al flop: contro una continuation bet, un check-raise all-in con nove carte per chiudere più, spesso, due carte alte da accoppiare ha equity vicina al 50% contro molte mani, e in più prende il piatto quando l’avversario passa. È il semi-bluff più comune del formato. Da parte di chi ha la mano fatta, il conto è speculare: puntare abbastanza perché il progetto non abbia le pot odds per chiamare.',
      'Un errore diffuso è contare gli out due volte: le nove carte del colore si contano una volta sola, e se una di esse accoppia anche il board può regalare un full all’avversario.',
    ],
    esempio:
      'Grande buio con 12 big blind ha A-8 dello stesso seme; flop 9-5-2 con due carte di quel seme. Il bottone punta 2 nel piatto di 4,5: il check-raise all-in ha il 35% di chiudere il nut flush più le tre carte che accoppiano l’asso, e fa passare tutte le mani con cui il bottone puntava in bluff.',
    guida: {
      testo: 'la guida a come si gioca uno Spin & Go, che tratta i progetti e i semi-bluff',
      href: '/guide/come-giocare-spin-and-go',
    },
    strumento: {
      testo: 'il replayer delle mani, che calcola l’equity all-in di ogni progetto',
      href: '/replayer',
    },
    correlati: ['gutshot', 'equity', 'bluff', 'nuts'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'broadway',
    termine: 'Broadway',
    varianti: ['carte broadway', 'scala broadway'],
    query: 'broadway poker significato',
    titolo: 'Broadway nel poker: significato di carte e scala broadway',
    definizione:
      'Broadway indica le cinque carte più alte del mazzo (10, J, Q, K, A) e la scala che formano, 10-J-Q-K-A, che è la scala più alta possibile.',
    spiegazione: [
      'Il nome viene dalla strada di New York e nel gergo del poker ha due usi: «carte broadway» sono le figure più il 10 e l’asso, «la broadway» è la scala che le contiene tutte. Due carte broadway in mano (K-Q, Q-J, A-10) sono mani che valgono per la loro capacità di fare la coppia più alta con un buon kicker e, in più, di chiudere la scala massima.',
      'Negli Spin & Go le mani broadway sono una fetta importante dei range di apertura e di chiamata all-in: a 10 big blind il bottone spinge K-Q, K-J e Q-J, e il grande buio chiama con molte di esse, perché contro un range largo due carte alte hanno equity decorosa (circa il 55-60% contro due carte basse) e giocano bene anche quando non accoppiano. Il loro limite è essere «dominate» da assi e coppie: K-Q contro A-K ha circa il 25% di equity, ed è il caso in cui il kicker decide.',
      'Board con tre carte broadway (per esempio J-Q-K) sono quelli in cui le scale sono più probabili e in cui una coppia alta vale meno di quanto sembri.',
    ],
    esempio:
      'Piccolo buio con 8 big blind spinge Q-J dello stesso seme; il grande buio chiama con A-9. Preflop Q-J ha circa il 42% di equity; se il flop porta 10-K-4, la mano diventa un gutshot alla broadway più due overcard al 10, e se arriva l’asso al turn la scala è chiusa.',
    guida: {
      testo: 'la guida al push/fold negli Spin & Go, dove le mani broadway stanno nei range di spinta',
      href: '/guide/push-fold-spin-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, con la frequenza di ogni mano broadway a ogni profondità',
      href: '/tabelle',
    },
    correlati: ['scala', 'kicker', 'range', 'gutshot'],
    aggiornata: '2026-09-20',
  },
  {
    slug: 'deep-stack',
    termine: 'Deep stack',
    varianti: ['stack profondo', 'deep', 'giocare deep'],
    query: 'deep stack poker significato',
    titolo: 'Deep stack nel poker: significato di stack profondo',
    definizione:
      'Deep stack indica una situazione con stack grandi rispetto ai bui — di norma sopra le 100 big blind — in cui il gioco dopo il flop conta più del preflop.',
    spiegazione: [
      'Con stack profondi una mano ha tre strade dopo il flop in cui le puntate possono crescere, e le mani che valgono di più sono quelle capaci di fare punti nascosti e forti — coppie piccole per il set, connettori dello stesso seme per scale e colori — perché possono vincere uno stack intero da chi ha una coppia alta. Le carte alte non accoppiate, al contrario, perdono valore: fanno spesso la mano migliore al flop ma non reggono tre puntate grandi.',
      'Negli Spin & Go il deep stack praticamente non esiste: si parte con 25 big blind e in pochi minuti si scende sotto le 15. È la ragione per cui la strategia del formato è quasi tutta preflop e per cui i range del cash game profondo non si riusano: a 10 big blind una coppia di 5 vale per il suo showdown value all-in, non per il set che potrebbe fare al flop. L’unico momento «profondo» di uno Spin & Go sono le prime mani, e già lì 25 big blind sono uno stack corto per gli standard del cash game.',
      'Il contrario è lo short stack; l’intermedio (20-40 big blind) è la zona in cui rilancio piccolo e all-in convivono e la scelta della dimensione conta di più.',
    ],
    esempio:
      'In un cash game con 150 big blind, chiamare un’apertura con 5-5 per cercare il set è corretto: le volte che arriva (circa una su otto) si può vincere uno stack enorme. A 12 big blind in uno Spin & Go la stessa coppia si gioca all-in preflop, perché non c’è profondità per aspettare il flop.',
    guida: {
      testo: 'la guida che confronta Spin & Go e Sit & Go, dove le profondità sono una delle differenze',
      href: '/guide/spin-and-go-vs-sit-and-go',
    },
    strumento: {
      testo: 'le tabelle preflop GTO, che coprono le profondità reali del formato, da 1 a 33 big blind',
      href: '/tabelle',
    },
    correlati: ['stack', 'big-blind', 'push-fold', 'open-raise'],
    aggiornata: '2026-09-20',
  },
  // ⚠️ FINE VOCI — le nuove si aggiungono SOPRA questa riga.
];

export function voceBySlug(slug: string): Voce | undefined {
  return VOCI.find((v) => v.slug === slug);
}

export function slugGlossario(): string[] {
  return VOCI.map((v) => v.slug);
}

/**
 * Tutto il testo PUBBLICO di una voce, in un elenco: e' l'unica definizione di
 * «cosa va lintato» e la usano sia `scripts/lib/glossario-lint.mjs` sia le
 * spec Karma, cosi' un campo aggiunto domani entra nel lint per costruzione.
 */
export function testiDiVoce(v: Voce): string[] {
  return [
    v.termine,
    ...(v.varianti ?? []),
    v.titolo,
    v.definizione,
    ...v.spiegazione,
    ...(v.esempio ? [v.esempio] : []),
    ...(v.guida ? [v.guida.testo] : []),
    ...(v.strumento ? [v.strumento.testo] : []),
  ];
}
