/**
 * Le guide evergreen di /guide.
 *
 * ⚠️ PERCHE' IL CONTENUTO STA IN UN FILE TS E NON NELLE NEWS.
 * Le news si pubblicano dall'admin senza deploy, e per questo hanno due difetti
 * che qui non possiamo permetterci: un articolo pubblicato fra due build non e'
 * prerenderizzato (vedi il buco documentato in check-routes.mjs), e il corpo e'
 * Markdown reso da un chunk lazy. Le guide sono il contenuto su cui il sito deve
 * posizionarsi: devono essere nell'HTML statico, con H2 veri, sempre. Qui il
 * contenuto e' STRUTTURATO (niente Markdown, niente `[innerHTML]`), quindi il
 * template lo rende in tag reali senza dipendere da nessun chunk.
 *
 * ⚠️ Aggiungere una guida = aggiungere una voce a `GUIDE`. Nient'altro: la rotta
 * `guide/:slug` la prerenderizza da sola (`getPrerenderParams` legge questo
 * file), la sitemap la prende dal manifest del build e la guardia
 * `check-prerender-content.mjs` la misura col minimo di default.
 *
 * ⚠️ VINCOLO LEGALE su ogni testo qui dentro (art. 9 DL 87/2018): taglio
 * didattico, nessun nome di sala da gioco, nessun bonus o promozione, nessun
 * link esterno verso piattaforme di gioco, mai un inquadramento "guadagna".
 */

/** Link interno mostrato nel richiamo in fondo alle sezioni. */
export interface GuideLink {
  testo: string;
  href: string;
}

/**
 * Rimando a una voce del glossario (/glossario/<slug>/). `termine` e' copiato
 * dalla voce per non importare il glossario nel chunk delle guide: il lint
 * (`scripts/lib/glossario-lint.mjs`, `lintTermini`) verifica che coincida.
 */
export interface VoceLink {
  slug: string;
  termine: string;
}

export interface GuideSection {
  h2: string;
  paragrafi: string[];
  /** Elenco puntato, solo dove elencare aiuta davvero. */
  lista?: string[];
}

export interface Guide {
  /** Segmento di URL: /guide/<slug>/. ⚠️ Immutabile una volta pubblicata. */
  slug: string;
  /** <title>, SENZA il suffisso " — Best Fish Forever" (lo aggiunge SeoService). */
  titolo: string;
  /** meta description, 140-160 caratteri. */
  descrizione: string;
  occhiello: string;
  h1: string;
  lead: string;
  /** Data ISO dell'ultimo aggiornamento sostanziale (mostrata e in JSON-LD). */
  aggiornata: string;
  sezioni: GuideSection[];
  /** Link interni pertinenti: e' il punto in cui la guida passa autorevolezza. */
  strumenti?: GuideLink[];
  /** Unica sorgente per le FAQ a schermo E per il JSON-LD FAQPage. */
  faq: { q: string; a: string }[];
  /** Slug di altre guide, per il blocco "continua da qui". */
  correlate: string[];
  /**
   * Voci del glossario usate nella guida: il blocco «Termini usati in questa
   * guida», cioe' i link IN ENTRATA del glossario (un hub che da' e non riceve
   * e' mezzo hub). ⚠️ ULTIMO campo, e ultimo anche in ogni oggetto:
   * `guide-links.test.mjs` legge questo file con una regex che vuole `titolo:`
   * subito dopo `slug:`.
   */
  termini?: VoceLink[];
}

export const GUIDE: readonly Guide[] = [
  // ⚠️ LA PAGINA PILASTRO, ed è la PRIMA dell'array per questo: l'indice rende
  // `GUIDE` nell'ordine in cui è scritto.
  //
  // PERCHE' ESISTE, misurato e non ipotizzato (Search Console, 19/09/2026). Le
  // dieci guide avevano 117 impressioni in 90 giorni a posizione media 7,2, su
  // query che Google anonimizza perché troppo rare: il sito presidiava nove
  // SOTTO-temi e nessuna pagina rispondeva al termine generico «strategia
  // Spin & Go». Questa pagina possiede la query testa e passa il lettore alla
  // guida che approfondisce.
  //
  // ⚠️ `correlate` elenca QUI TUTTE le altre, contro le tre delle sorelle: il
  // template le rende senza tetto, e un hub che ne linka tre sarebbe una guida
  // come le altre messa in cima. È l'unico punto del sito in cui ogni guida ha
  // un ingresso interno garantito — togliere una voce da qui significa lasciare
  // quella guida con i soli ingressi casuali del blocco «Per approfondire».
  //
  // ⚠️ Ogni sezione riassume una guida e NON la sostituisce: il riassunto deve
  // restare fedele al `lead` della guida a cui rimanda, o le due pagine si
  // contraddicono e il lettore se ne accorge al primo clic.
  {
    slug: 'strategia-spin-and-go',
    titolo: 'Strategia Spin & Go: cosa conta e in che ordine studiarlo',
    descrizione:
      'La strategia degli Spin & Go in una pagina: cosa decide davvero un 3-max hyper turbo, in che ordine studiarlo e dove approfondire ogni singolo pezzo.',
    occhiello: 'Guida principale',
    h1: 'Strategia Spin & Go: cosa conta davvero, e in che ordine studiarlo',
    lead: 'La strategia di un 3-max hyper turbo non è una lista di mosse da imparare: è una conseguenza della struttura. Tre giocatori, venticinque big blind di partenza, livelli che salgono ogni pochi minuti e un montepremi che quasi sempre va tutto al primo. Da lì discende tutto il resto: dove si decide il torneo, cosa conviene studiare per primo e cosa invece pesa molto meno di quanto si legga in giro. Questa pagina mette le parti in fila, e ognuna rimanda alla guida che la spiega per intero.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'Tutto parte dalla struttura, non da una lista di mosse',
        paragrafi: [
          'Un torneo di questo tipo comincia con venticinque big blind a testa e livelli che salgono ogni pochi minuti. Dopo pochi giri gli stack sono corti in termini di bui, e quando gli stack sono corti il numero di decisioni possibili crolla: non c\'è spazio per costruire un piatto su tre strade, e gran parte dei soldi entra prima del flop o subito dopo, con le mani già impegnate.',
          'La seconda particolarità è il montepremi. Non lo conosci quando ti siedi: viene estratto quando il tavolo si forma, e nella grande maggioranza dei casi paga soltanto chi arriva primo. Ha una conseguenza che vale per tutta la strategia: le fiches valgono in modo lineare, cioè raddoppiare lo stack raddoppia davvero quanto vale la tua posizione nel torneo.',
          'La terza è il numero di giocatori. In tre, ogni mano ti vede al bottone, nel piccolo buio o nel grande buio, e i bui ti passano addosso una volta ogni tre mani invece che una ogni nove. Non puoi aspettare: aspettare, qui, è una strategia che perde da sola.',
        ],
      },
      {
        h2: 'Le tre fasi del torneo, e quanto pesa ognuna',
        paragrafi: [
          'Un torneo si divide in tre tratti che chiedono cose diverse. Il primo è il gioco a tre con stack ancora giocabili, dove si aprono e si difendono piatti. Il secondo è il gioco a tre corto, dove le scelte si riducono a entrare per tutto o passare. Il terzo è l\'heads-up, che comincia quando qualcuno esce e dura fino alla fine.',
          'La distribuzione del tempo sorprende quasi tutti: la fase in cui si gioca il maggior numero di mani è l\'ultima. A tre le mani finiscono in fretta, spesso senza vedere il flop; in due si gioca ogni mano, e si gioca finché uno dei due non ha tutte le fiches. È la ragione per cui chi prepara con cura le aperture a tre e improvvisa l\'heads-up ha studiato a fondo la parte più corta del torneo.',
          'Questo non rende secondario il gioco a tre, perché è lì che si decide con quale stack arrivi in due. Cambia però l\'ordine delle priorità quando il tempo per studiare è poco, ed è quasi sempre poco.',
        ],
      },
      {
        h2: 'Il preflop è la parte che si può davvero sapere',
        paragrafi: [
          'Le mani di partenza sono centosessantanove. Per ogni profondità di stack, per ogni posizione al tavolo e per ogni sequenza di azioni già avvenute esiste una risposta di riferimento su cosa farne. Non è un\'opinione che cambia con l\'umore: è un insieme finito di situazioni, e si può studiare fino a saperlo.',
          'Quando gli stack si accorciano il ventaglio si stringe ancora: le uniche due azioni sensate diventano mettere dentro tutto o passare, perché un rilancio parziale lascia dietro un resto così piccolo che chi risponde ha ragioni matematiche per non passare quasi mai. È il tratto in cui un errore ripetuto costa di più, perché la stessa situazione torna decine di volte in una sessione.',
          'È anche la parte in cui il materiale deve dichiarare su cosa è calcolato. Una tabella costruita su un tavolo senza ante propone spinte troppo strette dove l\'ante c\'è, perché con del morto in mezzo conviene attaccare più largo. Se una tabella non dice formato, profondità e presenza di ante, non sai se descrive il tavolo dove sei seduto.',
        ],
      },
      {
        h2: 'Che cosa cambia quando restate in due',
        paragrafi: [
          'In heads-up cambiano le distanze, non solo i range. Sei sempre in uno dei due bui, quindi paghi per vedere ogni mano; il bottone e il piccolo buio sono la stessa persona, e quella persona agisce per prima prima del flop e per ultima dopo. Mani che a tre passi senza pensarci diventano rilanci obbligati.',
          'Il prezzo che ti fa il buio è l\'altra metà. Difendere troppo poco dal grande buio regala piatti piccoli ma continui; difendere troppo ti porta in piatti dove sei battuto e fuori posizione. La differenza fra i due errori, ripetuta per centinaia di mani, è quasi tutto il margine di questa fase.',
          'È anche il tratto in cui l\'avversario conta di più. A tre e corto molte decisioni sono quasi meccaniche; in due, con stack ancora profondi rispetto ai bui, chi hai davanti — quanto folda, quanto rilancia, cosa fa quando lo rialzi — sposta la risposta giusta.',
        ],
      },
      {
        h2: 'Il moltiplicatore non cambia quasi mai come si gioca',
        paragrafi: [
          'È il malinteso più diffuso su questo formato: esce un moltiplicatore alto e si pensa che vada giocato in un altro modo. Nella grande maggioranza dei tavoli il premio va tutto al primo, e in quel caso il valore delle fiches è lineare: non c\'è alcuna correzione da applicare, perché non c\'è un secondo posto da proteggere.',
          'La correzione serve solo quando il montepremi si divide fra più posti, cosa che succede oltre una certa soglia di moltiplicatore e che cambia da operatore a operatore. Lì, e soltanto lì, mettere fiches a rischio costa più di quanto renda vincerne altrettante, e conviene stringere in alcuni spot.',
          'Chi ti riempie di ICM su un formato dove quasi ogni torneo paga un posto solo ti sta insegnando una correzione che al tuo tavolo non si applica, e nel frattempo non ti sta insegnando i range.',
        ],
      },
      {
        h2: 'Ante, formati asimmetrici e rake: quando i range si spostano',
        paragrafi: [
          'Lo stesso gioco non è identico dappertutto. Alcuni tavoli hanno l\'ante, altri no. In alcuni formati uno dei due bui parte con uno stack più corto degli altri due, e quell\'asimmetria cambia chi può attaccare chi. La scala dei moltiplicatori disponibili e la soglia oltre cui il montepremi si divide cambiano da un operatore all\'altro.',
          'Cambia anche il rake, nell\'ordine del sette-dieci per cento a seconda del buy-in. Non è un dettaglio da contabili: è il costo fisso che si toglie da ogni torneo giocato, e più è alto più ampio deve essere il vantaggio tecnico perché il conto stia in piedi.',
          'Sono differenze che spostano i range, non sfumature. Studiare su materiale calcolato per una struttura e giocare su un\'altra è il modo più silenzioso di sbagliare, perché nessuna singola mano sembra un errore.',
        ],
      },
      {
        h2: 'Bankroll e varianza fanno parte della strategia',
        paragrafi: [
          'Tre giocatori, pochi minuti a torneo e un montepremi quasi sempre tutto al primo producono oscillazioni larghe, anche su tratti lunghi. Una serie negativa di centinaia di tornei non dimostra che stai sbagliando qualcosa, e una serie positiva non dimostra il contrario: è la struttura del gioco, non un contrattempo.',
          'La conseguenza pratica è che il fondo che tieni da parte e i buy-in che scegli non sono un capitolo separato dalla strategia: sono il vincolo che decide se potrai continuare a giocarla. Salire di livello troppo presto trasforma una serie del tutto normale in una serie che ti ferma.',
          'Il poker comporta un rischio economico reale, e nessuno studio lo toglie. Quello che si può ridurre è la quota di errori evitabili, e la probabilità di trovarsi senza fondo nel mezzo di una serie negativa che era prevedibile.',
        ],
      },
      {
        h2: 'Un ordine di studio che regge',
        paragrafi: [
          'Se il tempo è poco, l\'ordine conta più della quantità. Prima le aperture e le difese a tre alle profondità in cui il formato si gioca davvero, poi il push or fold di quando gli stack si accorciano, poi l\'heads-up, che è la fase più lunga. Il postflop viene dopo, perché a questi stack ci arrivi di rado e quasi sempre con gran parte dei soldi già in mezzo.',
          'Poi serve un modo per esercitarsi, non solo per leggere. Consultare una tabella mentre giochi insegna poco; rispondere alla stessa situazione cento volte, sbagliando e vedendo subito la risposta, è quello che la fa restare. E rivedere le proprie mani è l\'unico modo per scoprire quali errori stai ripetendo senza accorgertene.',
          'In pratica, per il primo mese, un ordine che funziona è questo:',
        ],
        lista: [
          'Aperture e difese a tre, alle profondità in cui il formato si gioca davvero.',
          'Push or fold: riconoscere quando le azioni sensate sono soltanto due, e saperle a memoria.',
          'Heads-up: range di apertura e di difesa, perché è la fase in cui giocherai più mani.',
          'Gli errori ricorrenti, per controllare quali stai facendo tu invece di studiarli in astratto.',
          'Bankroll e varianza, prima di scegliere a quale buy-in sederti.',
          'Solo dopo, il postflop e le situazioni rare.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle preflop', href: '/tabelle/' },
      { testo: 'gli esercizi di allenamento', href: '/allenamento/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
      { testo: 'la chart push/fold a 10 big blind dal bottone, pubblica e commentata', href: '/tabelle/spin-and-go-btn-10bb' },
    ],
    faq: [
      {
        q: 'Qual è la strategia di base negli Spin & Go?',
        a: 'Giocare molte mani e giocarle in modo aggressivo prima del flop, perché con venticinque big blind e livelli rapidi aspettare le mani forti costa più di quanto renda. In concreto: aperture larghe dal bottone, difese misurate dai bui, e il passaggio al push or fold appena lo stack si accorcia. Il resto sono raffinamenti di queste tre cose.',
      },
      {
        q: 'Da dove si comincia se non si è mai giocato questo formato?',
        a: 'Dalla struttura, non dai range: capire perché un 3-max hyper turbo si decide quasi sempre prima del flop rende sensato tutto il resto. Subito dopo vengono le aperture a tre alle profondità in cui si gioca davvero, e poi l\'heads-up. Studiare i range senza sapere da dove vengono significa impararli a memoria e non saperli adattare.',
      },
      {
        q: 'Serve studiare l\'ICM per gli Spin & Go?',
        a: 'Quasi mai. L\'ICM descrive cosa succede quando il montepremi è diviso fra più posti, e nella grande maggioranza di questi tornei paga solo il primo: lì le fiches valgono in modo lineare e non c\'è nulla da correggere. Serve sopra la soglia di moltiplicatore in cui il premio si divide, che cambia da operatore a operatore.',
      },
      {
        q: 'Quanto conta il postflop in questo formato?',
        a: 'Meno di quanto si creda, e non perché sia facile. Con stack corti e livelli rapidi al flop ci arrivi di rado, e quando ci arrivi gran parte dei soldi è già in mezzo, quindi le scelte residue sono poche. Studiarlo prima di avere range preflop solidi vuol dire lavorare sulla parte più piccola del margine.',
      },
      {
        q: 'Quanto tempo serve per capire se una strategia funziona?',
        a: 'Più di quanto suggerisca l\'istinto. Con tre giocatori, un moltiplicatore estratto a ogni torneo e un premio quasi sempre tutto al primo, i risultati oscillano molto anche su migliaia di tornei. Un simulatore di varianza serve proprio a questo: vedere quanto può essere lunga una serie negativa del tutto normale, prima di trovartici dentro.',
      },
      {
        q: 'Le tabelle preflop bastano da sole?',
        a: 'Sono la base e non il percorso. Una tabella dice cosa fare in una situazione; non dice perché, non ti segnala gli errori che ripeti e non copre l\'heads-up giocato contro una persona che si adatta. Servono insieme a degli esercizi e a un modo per rivedere le mani, altrimenti restano un riferimento che consulti e dimentichi.',
      },
    ],
    correlate: [
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'come-giocare-spin-and-go',
      'push-fold-spin-and-go',
      'heads-up-spin-and-go',
      'errori-comuni-spin-and-go',
      'icm-spin-and-go',
      'spin-and-go-vs-twister',
      'varianza-spin-and-go',
      'bankroll-spin-and-go',
      'scegliere-scuola-poker-spin-and-go',
    ],
  },
  {
    slug: 'come-giocare-spin-and-go',
    titolo: 'Come giocare gli Spin & Go: guida al 3-max hyper turbo',
    descrizione: 'Tre giocatori, 25 big blind e livelli che volano: come funziona davvero il 3-max hyper turbo e cosa studiare per primo se arrivi da altri formati.',
    occhiello: 'Introduzione al formato',
    h1: 'Come giocare gli Spin & Go: cosa cambia rispetto a qualsiasi altro torneo',
    lead: 'Uno Spin & Go dura pochi minuti, si gioca in tre e parte da 25 big blind a testa che valgono sempre meno a ogni livello. Il montepremi non lo conosci quando ti siedi: viene estratto quando il tavolo si forma, e quasi sempre paga solo chi arriva primo. Sono tre differenze che cambiano quasi ogni decisione rispetto al torneo o al cash game da cui probabilmente arrivi.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Tre giocatori e 25 big blind cambiano il punto di partenza',
        paragrafi: [
          'In tre non esiste una posizione precoce. Preflop parla per primo il bottone, che non ha versato nulla, poi la piccola con 0,5 bb e la grande con 1 bb: chi apre trova 1,5 bb già sul tavolo e due soli avversari da superare. È il motivo per cui qui si apre su una quota di mani molto più larga di quella sensata a un tavolo pieno.',
          'Lo stack iniziale è di 25 bb e non resta 25 bb a lungo: i livelli salgono ogni pochi minuti, quindi la profondità si riduce anche se non perdi una mano. Ogni decisione va letta in bui, non in fiches. La mano che a inizio torneo rilanci per costruire un piatto, pochi minuti dopo è una mano da all-in o da fold.',
          'Alcuni formati aggiungono l’ante: il piatto iniziale è più grande, quindi rubare i bui rende di più e chi difende paga un prezzo migliore per farlo, e le due spinte vanno nella stessa direzione, verso più mani giocate. Esistono poi formati asimmetrici, in cui uno dei due bui parte più corto: lì lo stack effettivo dipende da chi è coinvolto nel piatto.',
        ],
      },
      {
        h2: 'Il moltiplicatore decide che partita stai giocando',
        paragrafi: [
          'Prima della prima mano viene estratto un moltiplicatore che stabilisce il montepremi. Su una sala italiana la scala va da 2x fino a 12.000x, con un 6.000x sui buy-in più alti. Nella grande maggioranza dei tavoli il premio è winner-takes-all: arrivare secondi vale esattamente quanto arrivare terzi, cioè zero.',
          'Sui moltiplicatori più alti il premio si divide fra i tre giocatori, per esempio 83,3% al primo, 10% al secondo e 6,7% al terzo, e su un moltiplicatore intermedio possono pagare due posti con una divisione 80/20. Sono gli unici tavoli in cui uscire terzi costa qualcosa rispetto a uscire secondi, quindi gli unici dove rifiutare uno spot marginale ha senso.',
          'I moltiplicatori alti sono rari, e la conseguenza è l’opposto di quella che molti immaginano: il moltiplicatore va guardato prima di giocare, ma la strategia di riferimento resta quella dei tavoli winner-takes-all. Chi imposta ogni partita come se il premio fosse diviso gioca troppo prudente nella quasi totalità dei tavoli che vedrà.',
        ],
      },
      {
        h2: 'Perché quasi tutto si decide prima del flop',
        paragrafi: [
          'Con 25 bb di partenza e livelli rapidi, gran parte delle mani finisce prima del flop o con gli stack già impegnati preflop. Il postflop esiste, ma pesa meno: le situazioni con abbastanza bui per giocare tre strade sono una minoranza e si concentrano nei primi minuti, quando la profondità è ancora quella iniziale.',
          'Man mano che lo stack cala il ventaglio di azioni sensate si restringe, finché sotto una certa profondità restano solo all-in o fold. Prima di quel punto il rilancio piccolo è una scelta normale, non un ripiego: quello che non funziona è la taglia da tavolo profondo, che impegna una fetta grossa dello stack e non lascia margine per rispondere a una riapertura.',
          'Per questo lo studio parte dalle 169 mani di partenza e da cosa farne nelle poche configurazioni possibili: bottone che apre, piccola contro bottone, grande che difende, e le stesse situazioni con lo stack corto. Sono poche caselle rispetto a un torneo profondo, si ripresentano decine di volte per sessione, ed è dove il tempo di studio rende di più.',
        ],
      },
      {
        h2: 'In che ordine studiare, se parti adesso',
        paragrafi: [
          'Prima le decisioni con stack corto, quelle in cui l’unica scelta è entrare per tutto o passare. Sono le mani più frequenti dopo i primi livelli e le più semplici da fissare, perché non hanno rami postflop. Sapere cosa fai da bottone, da piccola e da grande con pochi bui toglie di mezzo una fetta enorme di errori.',
          'Poi l’apertura da 25 bb e le risposte alle aperture. Qui le mani si giocano ancora, quindi serve una linea di riferimento per i piatti che continuano dopo il flop: quali mani prosegui, quali abbandoni, con quale taglia apri. Non serve saperne a memoria una libreria: serve una scelta coerente, perché una linea coerente si può correggere e una improvvisata no.',
          'Infine il gioco in due, che nei tavoli winner-takes-all decide il torneo. Non è il gioco in tre con un giocatore in meno: sparisce chi poteva punirti alle spalle, i range si allargano da entrambe le parti e ogni mano passata costa un buio, quindi aspettare qualcosa di meglio ha un prezzo immediato.',
        ],
      },
      {
        h2: 'Gli automatismi che porti dal cash game e che qui costano',
        paragrafi: [
          'Al cash game lo stack torna pieno a ogni mano e il denaro sul tavolo vale sempre uguale. Qui no: le fiches perse non tornano, i bui salgono, e ogni fiche che metti nel piatto pesa più della precedente, perché è una quota più grande di quello che ti resta. Da questa differenza nascono quasi tutti gli automatismi importati.',
          'Non sono uno per giocatore: sono quasi sempre gli stessi quattro, e chi ne ha uno di solito li ha tutti, perché hanno la stessa radice. Sono difficili da vedere dall’interno, perché mentre li commetti sembrano il gioco normale, quello che a stack profondo funzionava davvero.',
          'Nessuno di questi errori è vistoso mano per mano: si vedono solo su molte partite, ed è per questo che è difficile accorgersene da soli. Il risultato di una serata non dice quasi niente, in un formato dove il moltiplicatore è estratto e vince un giocatore su tre. Il posto dove emergono è il confronto a mente fredda fra quello che hai fatto e quello che la situazione chiedeva.',
        ],
        lista: [
          'aprire con una taglia da tavolo profondo, che con 25 bb impegna troppo e non lascia margine per rispondere a una riapertura',
          'difendere il buio grande con mani da implied odds, che rendono poco quando la profondità non basta a costruire un piatto grosso',
          'cercare valore sottile con mani marginali, in spot dove la scelta reale è fra piatto grosso e niente',
          'giocare lentamente le mani forti, in un formato dove il tempo per costruire il piatto in tre strade quasi non c’è',
        ],
      },
      {
        h2: 'Chi arriva dai tornei profondi porta il problema opposto',
        paragrafi: [
          'Nei tornei a molti giocatori sopravvivere ha un valore in sé: ogni eliminazione altrui ti fa salire nella scala dei premi anche se non fai nulla, e rifiutare spot redditizi in fiches può essere corretto. In un tavolo winner-takes-all quella scala non esiste: il tuo capitale è la probabilità di arrivare primo, che cresce con lo stack.',
          'Quindi la pressione da bolla, qui, quasi non c’è. Passare uno spot marginale per «restare in vita» non ti fa guadagnare nulla, mentre i bui che salgono ti mangiano lo stack. I due sintomi tipici sono lo stesso errore visto da due lati: si passa troppo quando si è corti, e si evita l’all-in perché sembra estremo. Qui è l’azione normale, e rimandarla peggiora le condizioni in cui la prenderai comunque.',
          'Il ragionamento sulla scala dei premi torna utile solo sui tavoli dove il montepremi è diviso davvero fra più posti, che sono una minoranza. Riconoscerli e trattarli diversamente è un passo successivo: prima va sistemata l’impostazione di base, quella delle partite in cui conta soltanto arrivare primi.',
        ],
      },
      {
        h2: 'Cosa aspettarti nei primi mesi',
        paragrafi: [
          'Due cose non dipendono dalla tua tecnica. La prima è il rake, nell’ordine del 7-10% a seconda del buy-in: è il costo del tavolo, non lo controlli, e va messo nel conto di qualsiasi valutazione tu faccia sul tuo gioco. È anche il motivo per cui la differenza fra una decisione buona e una mediocre pesa più che altrove.',
          'La seconda è la varianza. In un formato dove vince un giocatore su tre e il montepremi viene estratto, i risultati di qualche centinaio di partite dicono pochissimo su come stai giocando. Serie negative lunghe fanno parte del funzionamento normale, e confonderle con un problema tecnico porta a cambiare strategia proprio quando non serve cambiarla.',
          'Il poker comporta un rischio economico reale e nessuno può prometterti un esito. Il modo sensato di misurare i progressi non è il saldo di un mese, ma quante volte, nelle situazioni che si ripetono, hai fatto quello che la situazione chiedeva: è l’unica parte del gioco sotto il tuo controllo, ed è anche l’unica che si può studiare.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
    ],
    faq: [
      { q: 'Devo saper giocare postflop per iniziare?', a: 'Serve, ma non è da lì che si parte. Con 25 bb iniziali e livelli rapidi, la quota di mani che arrivano al flop con abbastanza profondità da giocare tre strade è piccola. Se il tempo di studio è limitato, dedicalo prima alle decisioni preflop con stack corto: sono più frequenti, più semplici da fissare e producono gli errori più costosi quando sbagli.' },
      { q: 'Quanto dura una partita?', a: 'Pochi minuti. I livelli salgono ogni pochi minuti e si parte da 25 bb, quindi la struttura è pensata perché il torneo finisca in fretta. Per lo studio la conseguenza è che vedrai molte più situazioni preflop identiche di quante ne vedresti altrove: è un formato che premia il riconoscimento di spot ricorrenti più della lettura del singolo avversario.' },
      { q: 'Devo memorizzare tutte e 169 le mani di partenza?', a: 'Non una per una. Le 169 mani si raggruppano: coppie, assi, mani suited e i loro equivalenti offsuit si comportano in modo simile all’interno dello stesso gruppo, quindi quello che impari sono i confini fra «entro» e «passo». Attenzione però: quei confini si spostano parecchio da una situazione all’altra. Aprire da bottone e difendere il buio grande sono due mappe diverse, non la stessa con un ritocco.' },
      { q: 'Il moltiplicatore alto cambia davvero come gioco?', a: 'Sì, ma solo sui tavoli dove il montepremi è diviso fra più posti. Lì arrivare secondi o terzi vale qualcosa, quindi qualche spot marginale conviene rifiutarlo. Sui tavoli winner-takes-all, cioè la grande maggioranza, il valore del tuo stack è semplicemente la probabilità di arrivare primo: nessuna considerazione sulla scala dei premi ha senso, si gioca per finire con tutte le fiches davanti.' },
      { q: 'Twister e Spin & Go sono lo stesso gioco?', a: 'È lo stesso formato con nomi diversi su sale diverse. Cambiano i moltiplicatori disponibili, il rake e la soglia oltre la quale il montepremi si divide fra più posti. La struttura di base resta identica, cioè tre giocatori, 25 bb, livelli rapidi e montepremi estratto, e con essa quasi tutta la strategia che studi.' },
      { q: 'Da quale buy-in ha senso iniziare?', a: 'Da uno che puoi permetterti di perdere molte volte di fila senza che la cosa pesi, perché in questo formato succede anche giocando bene. Il rischio economico è reale e nessuno può garantirti un esito. La scelta del livello è una decisione di gestione del rischio, non di ambizione: si sale quando le decisioni sono stabili, non quando si è impazienti.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'push-fold-spin-and-go',
      'spin-and-go-vs-twister',
    ],
    termini: [
      { slug: 'big-blind', termine: 'Big blind' },
      { slug: 'limp', termine: 'Limp' },
      { slug: 'raise', termine: 'Raise' },
      { slug: 'check', termine: 'Check' },
      { slug: 'call', termine: 'Call' },
      { slug: 'fold', termine: 'Fold' },
    ],
  },
  {
    slug: 'bankroll-spin-and-go',
    titolo: 'Bankroll Spin & Go: quanti buy-in servono davvero',
    descrizione: 'Non esiste un numero unico di buy-in: dipende dal tuo vantaggio e dalla struttura dei moltiplicatori. Si ragiona per ordini di grandezza, non per regole.',
    occhiello: 'Bankroll e varianza',
    h1: 'Bankroll per gli Spin & Go: quanti buy-in servono davvero',
    lead: '«Quanti buy-in servono» è la domanda con la risposta più scomoda: non ne esiste una valida per tutti, e chi te ne dà una secca sta tirando a indovinare. Il fondo che ti serve dipende da quanto sei più forte del campo, dalla struttura dei moltiplicatori della sala dove giochi e da quanto sei disposto a perdere prima di fermarti. Si può però ragionare sul serio su cosa sposta quel numero, e su come misurarlo invece di ereditarlo da qualcun altro.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Perché qui la varianza non somiglia a quella di un torneo normale',
        paragrafi: [
          'Ogni torneo parte con tre giocatori, 25 big blind a testa e livelli che salgono ogni pochi minuti. Prima che venga distribuita una carta viene estratto un moltiplicatore che decide il montepremi: su una sala italiana si va da 2x fino a 12.000x, con un 6.000x sui buy-in più alti. Il tuo risultato dipende quindi da due estrazioni diverse, non da una sola.',
          'La prima è il moltiplicatore, su cui non hai alcun controllo. La seconda è il torneo vero e proprio, che nella grande maggioranza dei casi paga un solo posto: o arrivi primo, o hai perso il buy-in. Solo sui moltiplicatori più alti il montepremi si divide fra i tre giocatori, e su un moltiplicatore intermedio può pagare due posti, ma sono i casi rari: il grosso del tuo volume è winner-takes-all.',
          'Ne esce una distribuzione fortemente asimmetrica: moltissimi tornei che pesano poco e pochissimi che pesano quasi tutto. Anche un giocatore forte perde la maggior parte dei tornei che gioca, e il saldo di un mese dice molto meno di quanto si creda sul livello di chi lo ha prodotto.',
        ],
      },
      {
        h2: 'La domanda utile non è quanti buy-in, ma quanto puoi perdere restando in gioco',
        paragrafi: [
          'Un bankroll non è un premio: è la quantità di denaro che puoi vedere sparire senza cambiare il modo in cui giochi e senza toccare soldi che servono ad altro. Formulata così, la domanda ha una risposta misurabile: dato un certo vantaggio e un certo volume, qual è la probabilità di arrivare a zero prima che il vantaggio si veda?',
          'Quella probabilità non è mai zero. Puoi renderla piccola, e il prezzo che paghi per renderla piccola è giocare a un limite più basso di quello che ti piacerebbe. Chi ragiona per regole salta questo passaggio e sceglie un numero perché lo ha sentito dire, senza sapere a quale rischio corrisponde quel numero per il suo gioco.',
          'Il poker con soldi veri comporta un rischio economico reale, e nessuna gestione del bankroll lo elimina. Serve a un\'altra cosa: evitare che una serie negativa perfettamente normale chiuda il progetto prima che tu abbia abbastanza dati per capire se stavi giocando bene.',
        ],
      },
      {
        h2: 'Il tuo vantaggio si misura contro gli avversari più il rake',
        paragrafi: [
          'Il rake in questo formato è nell\'ordine del 7-10% a seconda del buy-in, e viene tolto da ogni montepremi. Il tuo vantaggio quindi non si misura contro gli avversari e basta: si misura contro gli avversari più la commissione. Molti giocatori che battono il tavolo non battono il tavolo più il rake, e non se ne accorgono per mesi perché la varianza copre la differenza.',
          'Il legame fra margine e bankroll è più duro di quanto sembri. Nell\'approssimazione standard con cui si calcola il rischio di rovina, a parità di varianza e di rischio accettato, il fondo necessario cresce come l\'inverso del vantaggio: se il margine si dimezza, il fondo che ti tiene in piedi raddoppia. È il motivo per cui il rake sposta il bankroll molto più di quanto sposti il risultato di una singola sessione.',
          'Per questo due persone allo stesso limite possono avere bisogno di bankroll molto diversi. Non è una questione di carattere: una delle due ha un margine più sottile, quindi ha bisogno di più tempo perché quel margine si veda, quindi deve sopravvivere più a lungo.',
        ],
      },
      {
        h2: 'Salire di limite dopo un colpo grosso è il modo più comune di tornare indietro',
        paragrafi: [
          'Quando sali di limite due variabili si muovono insieme, e nella stessa direzione sbagliata. Il tuo bankroll, contato in buy-in, si accorcia di colpo. E il campo che trovi è mediamente più forte, quindi il tuo vantaggio si assottiglia proprio nel momento in cui te ne servirebbe di più.',
          'Il caso classico è sempre lo stesso: qualcuno centra un moltiplicatore alto, si ritrova con un fondo che «basta» per il limite sopra e ci si trasferisce. Quel fondo però non è la prova di un vantaggio, è l\'esito di un\'estrazione. Qualche settimana dopo è tornato al punto di partenza con meno soldi e con la sensazione di aver sbagliato qualcosa di tecnico.',
          'Se vuoi provare un limite più alto, decidi prima quanti tornei durerà il tentativo e a quale cifra torni giù. Uno shot deciso in anticipo è un esperimento con una regola di uscita. Uno shot deciso mentre sei in corsa è il modo di non ammettere che sei salito senza il fondo per restarci.',
        ],
      },
      {
        h2: 'Cosa vedi quando simuli il tuo caso invece di indovinarlo',
        paragrafi: [
          'Il modo onesto di scegliere un numero è simularlo. Metti la tua stima di vantaggio, il volume che pensi di fare e il bankroll che hai, e guarda quante delle migliaia di storie possibili finiscono a zero. Poi cambia il bankroll e guarda come si muove quella percentuale: è lì che si vede quanto costa davvero ogni buy-in in meno.',
          'Due cose saltano all\'occhio quasi sempre. La prima è che i percorsi restano larghissimi anche su volumi che sembrano enormi: dopo migliaia di tornei ci sono ancora storie in profondo rosso a parità di vantaggio. La seconda è che il rischio di arrivare a zero non scende in modo lineare mentre aggiungi fondi: i primi buy-in in più pesano molto, poi la curva si appiattisce e continuare ad accumulare cambia poco.',
          'Il numero che ottieni non è una promessa: è la conseguenza della stima di vantaggio che hai inserito, e se quella stima è ottimistica lo è anche tutto il resto. Vale la pena rifare il conto con un vantaggio dimezzato e guardare se il fondo che hai regge lo stesso.',
        ],
      },
      {
        h2: 'Da dove viene la stima del tuo vantaggio, e perché all\'inizio non ce l\'hai',
        paragrafi: [
          'Il profitto è il dato peggiore da guardare all\'inizio, perché contiene i moltiplicatori. Poche centinaia di tornei con un moltiplicatore alto centrato raccontano una storia; gli stessi tornei senza quell\'estrazione ne raccontano una opposta. In mezzo, la bravura non è cambiata.',
          'Un indicatore più stabile è la frequenza con cui arrivi primo, perché non dipende da quale moltiplicatore ti è uscito. Con tre giocatori e un montepremi che quasi sempre va tutto al vincitore, la soglia di pareggio sta poco sopra un terzo dei tornei: il rake alza quel terzo di qualche punto, e la distanza fra quella soglia e la tua frequenza reale è il margine su cui stai costruendo tutto il resto.',
          'Il conto resta approssimato, perché sui moltiplicatori che pagano più di un posto una parte del valore arriva dal secondo e dal terzo posto. Sul volume dei primi mesi trattalo come un\'indicazione grezza e non come una misura: serve a capire se sei lontano o vicino alla soglia, non a fissare il bankroll al decimale.',
          'Finché quella stima è incerta, il bankroll giusto è quello che regge anche l\'ipotesi pessimista. Non è pessimismo: sbagliare in un verso ti costa tempo, sbagliare nell\'altro ti costa il progetto, e ricominciare da zero costa molto più del limite che ti sei risparmiato.',
        ],
      },
      {
        h2: 'Le decisioni si prendono da lucidi, non dentro la serie negativa',
        paragrafi: [
          'Nessuna di queste abitudini sostituisce il calcolo, ma sono ciò che lo rende applicabile. Servono a togliere le decisioni dal momento in cui sei meno lucido, cioè dentro una serie negativa, quando ogni scelta sembra urgente e la voglia di rientrare in fretta spinge esattamente nella direzione sbagliata.',
          'L\'ultima verifica non è aritmetica ma comportamentale. Se ti accorgi che stai giocando in modo diverso perché hai paura di perdere quella somma, il limite è sbagliato a prescindere da quanti buy-in dice il foglio di calcolo: un fondo profondo sulla carta che però ti fa esitare in una decisione marginale non sta facendo il suo lavoro.',
        ],
        lista: [
          'Fissa in anticipo la cifra alla quale scendi di limite, in numeri, non «quando mi sembrerà il caso».',
          'Tieni il fondo di gioco separato dal denaro che ti serve per vivere: se le due cose si toccano, il numero di buy-in che hai in mente è finto.',
          'Conta i buy-in, non gli euro: salendo di limite lo stesso saldo diventa un fondo più corto.',
          'Rivedi la stima del vantaggio ogni tanti tornei, non dopo una sessione buona o cattiva.',
          'Decidi prima quanto dura uno shot e a quale cifra rientri.',
        ],
      },
    ],
    strumenti: [
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
    ],
    faq: [
      { q: 'Se proprio devo partire da un numero, quale?', a: 'Non da un numero: da un rischio. Decidi prima quale probabilità di arrivare a zero sei disposto ad accettare, poi guarda quale fondo corrisponde a quella probabilità con la tua stima di vantaggio e il tuo volume. Chi parte dal numero sentito dire si porta dietro il rischio di qualcun altro, calcolato su un vantaggio e su una struttura di moltiplicatori che non sono i suoi.' },
      { q: 'Posso usare la stessa regola che applico nei tornei normali?', a: 'No, perché qui c\'è un\'estrazione in più. Il moltiplicatore decide quanto vale il torneo prima che tu giochi una mano, e la maggior parte dei tornei paga un solo posto: la distribuzione dei risultati è più asimmetrica a parità di bravura. Una regola nata su un torneo a molti posti pagati sottostima quanto profonda può essere una serie negativa.' },
      { q: 'Una lunga serie negativa significa che sto giocando male?', a: 'Non lo dimostra, e non lo esclude. In questo formato una serie negativa lunga è compatibile con un gioco corretto, quindi il risultato da solo non risponde. L\'unico modo per separare le due ipotesi è rivedere le decisioni: confrontare le mani giocate con la strategia di riferimento e guardare dove ti scosti, invece di leggere il grafico.' },
      { q: 'Giocare più tavoli insieme cambia il fondo che mi serve?', a: 'Cambia il ritmo con cui la varianza si manifesta, e spesso anche il margine. Più tavoli significano più tornei nello stesso arco di tempo, quindi oscillazioni più ampie in giorni e settimane, e in genere decisioni meno accurate su ognuno. Se aggiungendo tavoli il tuo vantaggio si assottiglia, il fondo che ti serve cresce anche se il numero di tornei giocati aumenta.' },
      { q: 'Cambia qualcosa sui Twister o sui formati con ante e stack asimmetrici?', a: 'Il Twister è lo stesso gioco su altre sale: cambiano i moltiplicatori disponibili, il rake e la soglia oltre la quale il montepremi si divide fra più posti, quindi cambia la distribuzione dei risultati e il conto va rifatto sulla struttura che giochi davvero. L\'ante e gli stack asimmetrici pesano sulla strategia molto più che sul bankroll.' },
      { q: 'Meglio molto volume a un limite basso o poco volume a un limite alto?', a: 'Volume dove il fondo è profondo. Su un limite in cui il bankroll è corto ogni decisione viene presa con la paura addosso, e i tornei che giochi sono troppo pochi per capire se il tuo vantaggio esiste. Il limite più basso non è una punizione: è la condizione che ti permette di accumulare i dati e le ore che servono.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'varianza-spin-and-go',
      'errori-comuni-spin-and-go',
      'spin-and-go-vs-twister',
    ],
  },
  {
    slug: 'push-fold-spin-and-go',
    titolo: 'Push or fold negli Spin & Go: come si legge una tabella preflop',
    descrizione: 'Che cosa vuol dire una mano giocata al 33%, come si confronta un EV in big blind e perché in un 3-max hyper turbo il push or fold arriva dopo poche mani.',
    occhiello: 'Preflop',
    h1: 'Push or fold: come si legge davvero una tabella preflop',
    lead: 'Push or fold vuol dire che le uniche due azioni sensate sono mettere dentro tutto lo stack o passare. Non è una semplificazione per principianti: quando lo stack è abbastanza corto, un rilancio parziale lascia dietro un resto così piccolo che chi ti risponde ha ragioni matematiche per non passare quasi mai. In un 3-max hyper turbo, con 25 big blind di partenza e livelli che salgono ogni pochi minuti, a quel punto ci si arriva in una manciata di mani.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Perché negli hyper turbo il push/fold arriva quasi subito',
        paragrafi: [
          'Si parte con 25 big blind e i livelli salgono ogni pochi minuti. Bastano poche mani passate senza giocare un piatto perché lo stack effettivo scenda sotto le quindici big blind, e da lì in giù i bui pesano abbastanza da chiudere da soli lo spazio per giocare dopo il flop.',
          'Il meccanismo è aritmetico, non stilistico. Se apri a 2 big blind con uno stack da 10, dietro ti restano 8 fiches in un piatto che ne contiene già 3,5: chi ti risponde rischia poco rispetto a quello che può vincere, e non passa quasi mai. La stessa mano giocata all-in mette l\'avversario davanti a una decisione secca, che è esattamente ciò che vuoi quando non hai fiches per manovrare dopo il flop.',
          'In un formato a tre giocatori ci si arriva prima che a un tavolo pieno. Ogni orbita costa 1,5 big blind di bui e le mani girano in fretta, quindi il numero di decisioni prese con stack profondi resta basso. È il motivo per cui lo studio del preflop rende qui più che altrove: è dove si decide la maggior parte del torneo.',
        ],
      },
      {
        h2: 'Che cosa hai davanti quando apri una tabella',
        paragrafi: [
          'Una tabella preflop è una griglia di 169 caselle: tutte le mani di partenza possibili, con le coppie sulla diagonale e, ai due lati, le versioni suited e offsuit della stessa coppia di carte. Ogni casella raggruppa le combinazioni equivalenti, quindi quando leggi un riquadro stai leggendo una famiglia di mani, non una mano sola.',
          'Una tabella non vale per tutto il torneo: vale per un nodo, cioè una combinazione precisa di formato, stack effettivo, posizione e azioni già avvenute. Cambia uno solo di questi elementi e sei su un\'altra tabella, con un range che può essere molto diverso. Chi impara una griglia sola e la applica ovunque sta usando la risposta giusta alla domanda sbagliata.',
        ],
      },
      {
        h2: 'Le frequenze dicono ogni quanto, non quanto spesso vinci',
        paragrafi: [
          'Spesso accanto a una mano non trovi «spingi» o «passa», ma un numero: 33% push, 67% fold. Vuol dire che in quella identica situazione la strategia corretta è spingere un terzo delle volte e passare gli altri due terzi. Non è la probabilità di vincere la mano, non è quanto spesso l\'avversario passerà, non è una misura di quanto la mano è forte.',
          'La miscela nasce da un\'indifferenza: si gioca in due modi proprio quando le due opzioni valgono quasi lo stesso. Se una fosse chiaramente migliore, la tabella la indicherebbe al cento per cento. Il numero descrive un comportamento su molte ripetizioni, non una scelta da fare su questa mano.',
          'In pratica non serve tirare un dado a ogni giro. Sulle mani miste sbagliare costa pochissimo, proprio perché le due strade valgono quasi uguale. Conviene invece essere precisi sui confini del range, cioè sulle mani che si spingono sempre e su quelle che si passano sempre, e lasciare che la zona intermedia resti approssimativa.',
        ],
      },
      {
        h2: 'L\'EV in big blind è un confronto, non una promessa',
        paragrafi: [
          'Accanto a ogni azione la tabella riporta un EV espresso in big blind. Se il push vale +0,4 bb e il fold 0, la lettura corretta è: spingere rende in media 0,4 big blind in più che passare, su un numero molto grande di ripetizioni di quella stessa situazione.',
          'Non è un pronostico sulla mano che stai giocando adesso. Con un push da +0,4 bb perderai comunque moltissime volte, a volte in modo brutale, e la differenza fra le due righe si materializza solo su un campione grande. È anche il motivo per cui una sessione in perdita non dimostra che le decisioni fossero sbagliate: le due cose vivono su scale diverse.',
          'Da qui esce una gerarchia di studio. Le mani dove i due EV distano molto sono errori costosi, da eliminare per primi; quelle dove distano pochi centesimi di big blind sono rifiniture. Guardare la differenza fra le righe, e non il valore assoluto di una sola, è ciò che trasforma la tabella in una lista di priorità.',
        ],
      },
      {
        h2: 'Come cambia il range quando cambia lo stack',
        paragrafi: [
          'Più lo stack è corto, più il range si allarga, e la ragione sta nel rapporto fra ciò che rischi e ciò che c\'è già nel piatto. Con 6 big blind ne metti sei per incassarne subito 1,5, e ti basta che gli avversari passino abbastanza spesso perché la spinta si ripaghi da sola. Con 18 big blind ne rischi tre volte tanto per lo stesso incasso immediato, e la stessa mano smette di funzionare.',
          'L\'allargamento non è uniforme. Scendendo, entrano prima le mani che reggono un confronto secco quando vengono pagate, cioè assi, carte alte e coppie: all-in non c\'è nessun postflop in cui recuperare. Le mani connesse e suited hanno bisogno di vedere tutte e cinque le carte comuni per esprimersi, e rendono relativamente meno proprio dove lo stack è più corto.',
          'Cambia anche la struttura. Nei formati con ante il piatto iniziale è più grande: rubare rende di più e i range si aprono a parità di stack. Nei formati asimmetrici, dove uno dei due bui parte più corto, il ragionamento va fatto sullo stack effettivo, cioè il minore fra quelli coinvolti nella mano.',
        ],
      },
      {
        h2: 'Conta chi deve ancora parlare, più della posizione in sé',
        paragrafi: [
          'A tre giocatori la domanda vera non è dove sei seduto, ma quante persone devono ancora decidere dopo di te. Dal bottone ne hai due: perché una spinta passi liscia devono passare entrambe, e questo tiene il range più stretto di quanto suggerisca l\'idea che in posizione si apra largo.',
          'Dal piccolo buio, quando il bottone ha già passato, resta un solo avversario da superare: è lì che il range di spinta è il più largo del tavolo. Basta che passi una persona per incassare 1,5 big blind, e con stack corti quell\'incasso immediato ripaga una quantità enorme di mani. Che tu sia fuori posizione conta poco, perché dopo un all-in un postflop da giocare non c\'è.',
          'Il grande buio non apre mai: quando tocca a lui, o il piatto è già suo o ha davanti un\'azione da valutare. Il suo range si costruisce su una domanda diversa, non «passeranno?» ma «quanto spesso sono avanti contro le mani con cui mi ha spinto contro?». Per questo è più stretto del range che deve battere, ma meno di quanto sembri: avendo già una big blind nel piatto, paga anche mani mediocri.',
        ],
        lista: [
          'Bottone: due avversari da superare, quindi range di spinta più stretto di quello del piccolo buio',
          'Piccolo buio dopo il fold del bottone: un solo avversario, il range di spinta più largo del tavolo',
          'Grande buio: non apre mai, risponde soltanto, e decide sulla forza contro un range già dichiarato',
          'Chi ha già investito paga più largo: il grande buio ha una big blind nel piatto e riceve odds migliori',
        ],
      },
      {
        h2: 'Come usare una tabella senza trasformarla in un automatismo',
        paragrafi: [
          'Le tabelle nascono da un modello che assume avversari solidi. Contro chi passa troppo, spingere più largo di quanto indicato guadagna; contro chi paga qualunque cosa la correzione va nella direzione opposta, cioè si stringe e si spinge con le mani che stanno bene quando vengono chiamate. Nessuna delle due deviazioni si legge nella tabella: si legge negli avversari, e va rivista quando cambiano.',
          'Il modo più efficace di studiarle è a ritroso, partendo da una mano appena giocata: apri il nodo esatto, guarda quanto distava l\'EV della tua azione da quella indicata e passa oltre se la differenza è piccola. Venti mani riviste così insegnano più di un\'ora passata a memorizzare griglie fuori contesto.',
          'Resta il fatto che tutto questo riduce gli errori, non il rischio. Il poker comporta una perdita economica reale e possibile, la varianza in un formato hyper turbo è ampia, e una strategia preflop corretta migliora le decisioni senza garantire alcun risultato su nessun orizzonte temporale.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
      { testo: 'creare un account gratuito', href: '/registrazione' },
      { testo: 'la chart push/fold a 10 big blind dal bottone', href: '/tabelle/spin-and-go-btn-10bb' },
      { testo: 'il range di call del big blind a 10 big blind contro l’all-in', href: '/tabelle/spin-and-go-bb-10bb-vs-push-sb' },
    ],
    faq: [
      { q: 'Sotto quante big blind si gioca solo push or fold?', a: 'Non c\'è un numero unico. Sotto una decina di big blind le alternative alla spinta valgono quasi sempre meno; nella fascia subito sopra dipende da posizione, presenza dell\'ante e da quanto gli avversari sono disposti a passare a un rilancio piccolo. Il criterio pratico è un altro: se dopo un\'apertura standard resta uno stack che nessuno può realisticamente passare, quell\'apertura è già una spinta mascherata.' },
      { q: 'Devo davvero randomizzare le mani con frequenze intermedie?', a: 'Nella pratica no. Le mani miste sono quelle dove le due opzioni valgono quasi lo stesso, quindi scegliendone sempre una perdi pochi centesimi di big blind. Conviene invece essere precisi sui confini del range, dove la distanza di EV fra spingere e passare è grande e si ripete in continuazione.' },
      { q: 'Cosa vuol dire esattamente EV +0,3 bb?', a: 'Che quell\'azione, ripetuta molte volte in quella identica situazione, rende in media 0,3 big blind più di zero. Il confronto utile però è con l\'altra riga: se il fold vale 0 e il push +0,3, ogni volta che passi stai lasciando lì 0,3 bb. Sulla singola mano il risultato può essere qualunque cosa.' },
      { q: 'Le stesse tabelle valgono anche sul formato Twister?', a: 'La struttura del gioco è la stessa: tre giocatori, 25 big blind di partenza, hyper turbo. Cambiano i moltiplicatori disponibili, il rake e la soglia oltre la quale il montepremi si divide fra più posti. Poiché nella grande maggioranza dei tornei si gioca winner-takes-all, le indicazioni preflop restano in pratica sovrapponibili; le differenze si sentono solo sui moltiplicatori alti, che sono rari.' },
      { q: 'Perché la tabella cambia se l\'avversario ha già rilanciato?', a: 'Perché il suo range non è più sconosciuto. Contro una spinta o un rilancio hai un\'informazione che prima non avevi, e la domanda diventa quanto spesso sei avanti contro le mani con cui lui agisce, non quanto spesso lo fai passare. Per questo esiste un nodo diverso per ogni sequenza di azioni, e non una tabella sola per ogni stack.' },
      { q: 'Quanto conta lo stack degli avversari e non solo il mio?', a: 'Conta quello effettivo, cioè il minore fra il tuo e quello di chi può pagarti: è il massimo che può cambiare di mano. Se hai 20 big blind ma dietro c\'è un avversario con 6, contro di lui stai giocando uno spot da 6. Nei formati asimmetrici, dove uno dei bui parte più corto, questa distinzione è il punto di partenza di ogni ragionamento.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'heads-up-spin-and-go',
      'errori-comuni-spin-and-go',
    ],
    termini: [
      { slug: 'push-fold', termine: 'Push/fold' },
      { slug: 'all-in', termine: 'All-in' },
      { slug: 'shove', termine: 'Shove' },
      { slug: 'open-shove', termine: 'Open shove' },
    ],
  },
  {
    slug: 'varianza-spin-and-go',
    titolo: 'Varianza negli Spin & Go: quanto dura un downswing',
    descrizione: 'Perché nel 3-max hyper turbo i downswing sono lunghi, che cosa separa l\'EV dal risultato e come capire se stai giocando male o è solo distribuzione.',
    occhiello: 'Varianza e rischio',
    h1: 'La varianza negli Spin & Go: quanto può durare un downswing normale',
    lead: 'In un formato dove ogni torneo dura pochi minuti, si gioca in tre e quasi sempre paga solo il primo posto, il risultato di una sessione dice poco sul livello di chi l\'ha giocata. La varianza qui non è un contrattempo: è la struttura del gioco. Sapere quanto è larga la distribuzione dei risultati serve a due cose concrete: non cambiare strategia per il motivo sbagliato e non mettere in gioco più soldi di quanti se ne possano perdere.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Che cosa separa l\'EV dal risultato che vedi',
        paragrafi: [
          'L\'EV di una decisione è il suo valore medio se la ripetessi un numero enorme di volte. Il risultato realizzato è un campione, spesso piccolo. Nel 3-max hyper turbo la distanza fra i due resta ampia a lungo, perché ogni torneo produce un esito grezzo: o prendi il montepremi o non prendi niente.',
          'Una decisione può essere corretta e perdere: se spingi con la mano davanti e vieni chiamato, l\'avversario ha comunque le sue carte da vedere e una parte delle volte arriva primo. Se le decisioni erano buone lo dice il confronto con la soluzione di riferimento per quello stack e quella posizione, non il piatto che hai raccolto.',
          'C\'è poi uno scarto tipico del formato: puoi giocare una serie di tornei sopra il tuo standard e restare in perdita solo perché i moltiplicatori estratti sono stati tutti bassi. Le decisioni riguardano chi vince il torneo, il moltiplicatore quanto quel torneo valeva, ed è sorteggiato prima che tu veda una carta.',
          'Il rake sposta il discorso. Con un prelievo nell\'ordine del 7-10% del buy-in a seconda del livello, una fetta del vantaggio grezzo se ne va prima che si distribuiscano le carte. Il margine che resta è sottile rispetto all\'ampiezza degli scarti, ed è questa combinazione a produrre tratti negativi lunghi.',
        ],
      },
      {
        h2: 'Perché in questo formato la dispersione è così larga',
        paragrafi: [
          'Le fonti di scarto sono quattro e agiscono insieme. Vale la pena separarle, perché una sola delle quattro dipende in qualche misura da te: due giocatori dello stesso identico livello, sullo stesso numero di tornei, possono ritrovarsi lontani senza che nessuno dei due abbia giocato meglio dell\'altro.',
          'Il moltiplicatore non si somma al resto: lo scala. Lo stesso all-in, vinto o perso, pesa in proporzione a quanto valeva il torneo estratto. È il motivo per cui la fascia dei risultati possibili resta larga anche su volumi che in un altro formato basterebbero già a farsi un\'idea.',
        ],
        lista: [
          'Il moltiplicatore è sorteggiato prima che tu veda le carte: sulle sale italiane la scala arriva fino a 12.000x, con un 6.000x sui buy-in più alti. I valori alti capitano di rado e proprio per questo pesano molto sul risultato medio.',
          'Il pagamento: nella grande maggioranza dei tornei prende tutto il primo e il secondo posto vale quanto il terzo, cioè zero. Solo sui moltiplicatori alti il montepremi si divide fra i tre giocatori, per esempio 83,3 / 10 / 6,7, e su un intermedio può pagare due posti, 80/20.',
          'La struttura hyper turbo: si parte da 25 big blind e i livelli salgono ogni pochi minuti, quindi molte mani si decidono in un solo scambio preflop, dove le differenze di equity sono strette.',
          'Il numero di giocatori: in tre, a parità di livello, ne vinci circa uno su tre. Serie di sconfitte consecutive sono aritmetica ordinaria, non un segnale.',
        ],
      },
      {
        h2: 'Perché il percorso tipico sta sotto la media',
        paragrafi: [
          'In una distribuzione simmetrica media e mediana coincidono. Qui la distribuzione è storta a destra: la coda dei moltiplicatori alti è rarissima ma enorme, alza la media e non sposta quasi per niente il percorso tipico. Quel valore medio è portato da tornei che nella maggior parte dei mesi non ti capitano.',
          'La conseguenza pratica è che il risultato atteso in media è un numero che la maggior parte dei percorsi non tocca nel breve periodo: se simuli mille percorsi con gli stessi identici parametri, oltre la metà finisce sotto la media. Succede ogni volta che pochi eventi rarissimi trasportano una fetta grossa del valore totale.',
          'Cambia quindi che cosa ha senso guardare. La media dice se una scelta è corretta sul lunghissimo periodo; per farsi un\'idea di come andrà probabilmente il prossimo mese servono la mediana e la fascia dei percentili, cioè dove finisce il decimo di percorsi peggiore e dove quello migliore.',
        ],
      },
      {
        h2: 'Quanto può durare un tratto negativo',
        paragrafi: [
          'Non esiste un numero unico, e chi te ne dà uno sta semplificando. La durata dipende da tre grandezze: quanto è reale il tuo margine, quanto è larga la dispersione per torneo e quanti tornei giochi. Con margine sottile e dispersione da formato a moltiplicatore, il campione perché il risultato realizzato assomigli a quello atteso si misura in decine di migliaia di tornei, non in centinaia.',
          'Un ordine di grandezza da tenere a mente: il numero di tornei per distinguere un giocatore vincente da uno in pari cresce con il quadrato del rapporto fra dispersione e margine. Dimezzare il margine, per esempio salendo di livello dove gli avversari sbagliano meno, quadruplica il campione richiesto.',
          'Anche chi gioca bene passa periodi lunghi sotto il proprio massimo storico: è l\'andamento ordinario di chi fa volume dove paga solo il primo. Il guaio nasce quando quel periodo arriva addosso a un bankroll non dimensionato per reggerlo, o a qualcuno che nel frattempo riscrive la strategia ogni poche centinaia di tornei.',
        ],
      },
      {
        h2: 'Il rischio di rovina non è una soglia, è una probabilità',
        paragrafi: [
          'Rovina significa che il bankroll scende sotto il minimo per continuare a giocare a quel livello. Non è una linea che si supera o non si supera: è una probabilità, e dipende da quanti buy-in hai davanti, dal margine, dall\'ampiezza della dispersione e da quanto a lungo giochi.',
          'Due cose non ovvie. Con margine nullo o negativo la rovina non è probabile, è certa: basta aspettare abbastanza, e il rake fa parte del conto. E anche con un margine positivo reale un bankroll piccolo produce una probabilità di rovina alta: la curva scende ripida nelle prime decine di buy-in e poi si appiattisce, quindi i primi buy-in comprano più sicurezza degli ultimi.',
          'Il poker con soldi veri comporta un rischio economico reale, e nessuna simulazione lo elimina: una curva di rischio di rovina serve a scegliere consapevolmente quanto rischio accettare, non a garantire che non si materializzi. Quanti buy-in tenere davanti non è un numero valido per tutti: dipende dal margine reale e dalla scala di moltiplicatori che giochi.',
        ],
      },
      {
        h2: 'Come si distingue una serie sfortunata da un errore di gioco',
        paragrafi: [
          'I risultati, da soli, non lo dicono su una finestra corta: la distinzione si fa sul processo, guardando le decisioni invece degli esiti. È un lavoro noioso e non lo si può delegare a un grafico che sale o scende. Quattro controlli si possono fare subito.',
          'Una serie sfortunata ha un profilo riconoscibile: le decisioni reggono al riesame, la perdita è distribuita su situazioni diverse, i tornei persi lo sono in spot dove eri davanti o quasi alla pari. Un problema di gioco si concentra, si ripete e ha una causa scrivibile in una frase.',
          'Le due cose convivono quasi sempre: in un tratto lungo di risultati negativi c\'è di solito un po\' dell\'una e un po\' dell\'altro. Trattarlo come sola sfortuna congela gli errori; trattarlo come solo errore porta a smontare una strategia che stava funzionando.',
        ],
        lista: [
          'Confronta le tue soglie di spinta e di call con una soluzione di riferimento, posizione per posizione e stack per stack: se sbagli, sbagli quasi sempre nella stessa direzione.',
          'Guarda dove si concentra la perdita: se sta quasi tutta in un tipo di situazione, le aperture dal bottone, le difese da big blind, il primo livello a 25 big blind, non è varianza.',
          'Controlla se il tuo gioco è cambiato durante il tratto negativo: call più larghi, spinte più strette, sessioni più lunghe del solito, decisioni prese più in fretta.',
          'Verifica il volume su cui stai ragionando: qualunque conclusione tratta da poche centinaia di tornei è rumore, per quanto netta possa sembrare.',
        ],
      },
      {
        h2: 'Che cosa ha senso chiedere a una simulazione',
        paragrafi: [
          'Un simulatore Monte Carlo non prevede il tuo prossimo mese: genera migliaia di percorsi con i parametri che gli dai e mostra come sono distribuiti. Il valore sta nella domanda che gli poni: dove sta la mediana dopo un certo numero di tornei, quanto è larga la fascia dei percentili, con che probabilità un percorso tocca un certo minimo.',
          'I risultati dipendono per intero dai parametri di ingresso: se sopravvaluti il tuo margine la simulazione restituisce ottimismo, non informazione, e il modo onesto di usarla è provare anche l\'ipotesi in cui sei più debole di quanto credi. Un singolo percorso simulato non è una previsione.',
        ],
      },
    ],
    strumenti: [
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
    ],
    faq: [
      { q: 'Quanti tornei servono perché il risultato rispecchi il mio livello?', a: 'Non c\'è un numero valido per tutti: dipende dal rapporto fra il tuo margine e la dispersione del formato, e il campione necessario cresce con il quadrato di quel rapporto. In un formato dove quasi sempre paga solo il primo si ragiona in decine di migliaia di tornei prima che il risultato smetta di essere dominato dal caso.' },
      { q: 'Un downswing lungo vuol dire che sto giocando male?', a: 'Da solo non vuol dire niente. In tre giocatori, a parità di livello, ne vinci circa uno su tre: lunghe serie di sconfitte consecutive capitano più volte anche in poche centinaia di tornei. La risposta si trova riesaminando le decisioni, non i risultati: se gli errori sono sistematici e concentrati negli stessi spot è gioco, se le decisioni reggono è distribuzione.' },
      { q: 'Perché il mio risultato è quasi sempre sotto la media attesa?', a: 'Perché la media è tirata verso l\'alto da eventi rari: i moltiplicatori più alti portano una fetta grossa del valore totale e capitano di rado. Il percorso tipico, la mediana, sta sotto la media, e oltre la metà dei percorsi simulati finisce sotto quel numero. Non è un calcolo sbagliato, è la forma della distribuzione.' },
      { q: 'Posso ridurre la varianza cambiando il modo in cui gioco?', a: 'Poco, e a un costo. Puoi rinunciare a qualche spinta marginale e stringere leggermente la dispersione, ma la maggior parte della varianza viene dalla struttura: moltiplicatore estratto prima delle carte, montepremi quasi sempre al solo primo posto, 25 big blind che scendono in fretta. Rinunciare a spot corretti abbassa il margine, cioè proprio la leva che ti serve grande.' },
      { q: 'Con un bankroll grande il rischio di rovina si azzera?', a: 'No, si riduce. Con un margine positivo la probabilità di rovina scende rapidamente nelle prime decine di buy-in e poi si appiattisce: ogni buy-in in più compra meno sicurezza del precedente. Con margine nullo o negativo nessuna dimensione basta, perché il tempo lavora contro. E resta comunque un rischio economico reale, non un parametro che si porta a zero.' },
      { q: 'L\'ICM cambia qualcosa in un formato del genere?', a: 'Molto meno che in un torneo a più posti pagati. Nella grande maggioranza dei tornei prende tutto il primo, quindi il secondo e il terzo posto valgono lo stesso, cioè niente, e non c\'è nessuna scaletta di premi da difendere. Una scaletta esiste solo sui moltiplicatori alti, che sono rari: trattare l\'ICM come se fosse sempre presente porta a giocare troppo stretto.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'bankroll-spin-and-go',
      'errori-comuni-spin-and-go',
      'spin-and-go-vs-twister',
    ],
  },
  {
    slug: 'icm-spin-and-go',
    titolo: 'ICM negli Spin & Go: quando conta e quando no',
    descrizione: 'Negli Spin & Go quasi tutti i tavoli pagano solo il primo: lì l\'ICM non corregge niente. Quando la struttura dei premi cambia le tue decisioni, e quando no.',
    occhiello: 'ICM e montepremi',
    h1: 'ICM negli Spin & Go: conta molto meno di quanto pensi',
    lead: 'Le fiches non valgono tutte uguale: quando il montepremi è diviso fra più posti, quelle che metti a rischio valgono più di quelle che puoi vincere. È questo che descrive l\'ICM. Negli Spin & Go la condizione da cui parte il modello è vera solo su una minoranza di tavoli, e applicarlo ovunque costa parecchio.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Che cosa dice l\'ICM, senza formule',
        paragrafi: [
          'L\'ICM traduce uno stack in una quota di montepremi, passando per la probabilità di chiudere in ciascuna posizione. Se pagano più posti quella traduzione non è proporzionale: raddoppiare le fiches non raddoppia la tua quota, perché una parte del montepremi te la stai già garantendo restando vivo. Da qui la regola pratica che rischiare costa più di quanto renda vincere.',
          'La conseguenza è che alcuni all-in positivi in fiches diventano perdenti in denaro. Non perché cambi il calcolo sulle carte, ma perché il premio che rischi di perdere pesa più del premio che puoi aggiungere. I range si stringono, e si stringono in modo asimmetrico: dipende da chi ti copre e da quanto è corto il terzo giocatore.',
          'L\'ICM non è una legge del gioco, è un modello con assunzioni forti. Le probabilità di piazzamento le deduce dagli stack, come se i tre giocatori fossero equivalenti per livello tecnico, e ignora posizione, bui e il fatto che il gioco continui dopo questa mano. Non ti dice come giocare una mano: ti dice quanto vale, in denaro, quello che stai mettendo sul tavolo.',
        ],
      },
      {
        h2: 'In un winner-takes-all l\'ICM non corregge niente',
        paragrafi: [
          'Se paga solo il primo, la tua quota di montepremi è la probabilità di arrivare primo, e nel modello quella probabilità è proporzionale alle fiches che hai. La traduzione torna lineare: una fiche vinta vale esattamente quanto una fiche persa. Non c\'è nessuna correzione da applicare, perché non c\'è niente che tu stia già difendendo.',
          'Sparisce anche la bolla. Eliminare un avversario non ti fa entrare a premio, e finire terzo o secondo è la stessa cosa: zero. L\'unico piazzamento che esiste è il primo, quindi sopravvivere non è un obiettivo intermedio ma solo un modo di dire che non hai ancora perso.',
          'In pratica ogni spot con valore atteso positivo in fiches va preso, anche marginale. L\'unica ragione per lasciar passare un testa o croce è ritenere di avere sugli avversari un vantaggio tecnico che vale più della differenza; con 25 big blind iniziali e livelli che salgono ogni pochi minuti quel vantaggio ha poco spazio per esprimersi, e comunque non giustifica il fold di uno spot chiaramente positivo.',
        ],
      },
      {
        h2: 'Quante volte, davvero, il montepremi si divide',
        paragrafi: [
          'All\'inizio di ogni torneo viene estratto un moltiplicatore che stabilisce il montepremi. Nella grande maggioranza dei casi ti ritrovi davanti un winner-takes-all. Solo i moltiplicatori alti dividono la posta fra i tre giocatori, con una ripartizione del tipo 83,3% / 10% / 6,7%, e su un moltiplicatore intermedio può capitare che paghino due posti, 80/20. Su tutto il resto paga soltanto il primo.',
          'Quei tavoli sono rari per costruzione: è il meccanismo che rende il formato quello che è. Su una sala italiana i moltiplicatori vanno da 2x fino a 12.000x, con un 6.000x sui buy-in più alti, ma i valori bassi sono la norma, e sono loro a pagare la rarità di quelli alti.',
          'Sulle altre sale il gioco è lo stesso, ma i dettagli cambiano: moltiplicatori disponibili diversi, rake diverso e soprattutto una soglia diversa oltre la quale il montepremi si divide fra più posti. Vale la pena guardarla una volta nella sala dove giochi, invece di dare per scontato che valga quello che hai letto altrove.',
        ],
      },
      {
        h2: 'Cosa cambia davvero quando pagano più di un posto',
        paragrafi: [
          'Quando i posti pagati sono due esiste una bolla vera: il terzo prende zero e il secondo prende qualcosa. Chi ha lo stack corto ha un motivo concreto per sopravvivere, e chi copre tutti può alzare la frequenza di attacco, perché in quella mano non rischia l\'eliminazione. È la dinamica dei tornei grandi, compressa in tre giocatori.',
          'Un esempio, a bui ormai alti. Sei sul bottone con 12 big blind, lo small blind ne ha 4 e il big blind 9. In winner-takes-all spingi con un range molto largo e la cosa finisce lì. Con due posti pagati la lettura cambia: lo short a 4 big blind sta per essere consumato dai bui, ogni giro che passa senza che tu rischi nulla è valore che ti arriva senza fare niente, e l\'all-in che ti manda fuori terzo contro il big blind vale meno di prima.',
          'Attenzione al verso della correzione. Non si gioca più stretto in generale: si stringe dove rischi l\'eliminazione contro chi ti copre, e si allarga contro chi ha più da perdere di te. Chi in quella mano non può essere eliminato è, per costruzione, quello che paga meno per metterla in mezzo.',
          'Quando invece i posti pagati sono tre non c\'è nessuna bolla: siete già tutti a premio e resta solo la scala fra terzo, secondo e primo. Con una ripartizione del tipo 83,3% / 10% / 6,7% la fetta del vincitore è talmente più grande delle altre due che la correzione esiste ma resta piccola: qualche spinta marginale in meno da stack coperto, non un gioco diverso.',
        ],
      },
      {
        h2: 'L\'errore che costa di più: l\'ICM applicato ovunque',
        paragrafi: [
          'Chi arriva dai tornei a molti giocatori si porta dietro un istinto ragionevole lì e sbagliato qui: rispettare la bolla, non rischiare vicino ai salti di premio, lasciar passare la mano marginale. Su un tavolo winner-takes-all quell\'istinto produce fold in situazioni chiaramente positive: call rifiutati, spinte non fatte, bui lasciati andare un giro dopo l\'altro.',
          'Il danno non si vede in una mano sola, si accumula sul volume. La struttura non lascia margine per aspettare: si parte da 25 big blind, i livelli salgono ogni pochi minuti e in alcuni formati c\'è anche l\'ante. Dal buy-in viene poi trattenuto un rake nell\'ordine del 7-10% a seconda della cifra, e il margine a cui rinunci negli spot positivi è esattamente quello che dovrebbe coprirlo.',
          'C\'è un test rapido. Se al tavolo ti senti pensare che è meglio non rischiare di uscire adesso, controlla quanti posti paga quel torneo. Se paga solo il primo, quella frase non descrive niente: uscire adesso e uscire fra dieci mani da secondo valgono la stessa cifra, cioè zero.',
        ],
      },
      {
        h2: 'Come tenerne conto senza rifare i conti a ogni mano',
        paragrafi: [
          'Le domande da farsi sono due e si esauriscono in fretta: quanti posti paga questo tavolo, e chi copre chi. La prima si guarda una volta all\'inizio e vale per tutto il torneo. La seconda cambia mano per mano, ma è una lettura immediata degli stack, non un calcolo.',
          'Se paga solo il primo non c\'è nessuna correzione da applicare e il lavoro è tutto sull\'accuratezza dei range: quali mani spingi da ogni posizione a ogni profondità, quali difendi dal big blind, dove il call è meglio del fold. Lì si decide la grande maggioranza dei tornei che giocherai.',
          'Un caso a parte sono i formati asimmetrici, dove uno dei due bui parte con uno stack più corto: chi copre chi è deciso dalla struttura prima ancora della prima mano. Se quel tavolo paga più di un posto, la correzione è in gioco fin dall\'inizio, invece di comparire solo quando qualcuno si accorcia.',
          'Quando il moltiplicatore è alto, la correzione è una sola idea da tenere presente per tutto il torneo, non un modello da ricostruire mano per mano mentre l\'orologio corre: stringi le spinte che possono mandarti fuori contro chi ti copre, allarga contro chi rischia di uscire prima di te, e per il resto usa i range che useresti comunque.',
        ],
        lista: [
          'Quanti posti paga il tavolo: si controlla una volta sola, all\'inizio.',
          'Chi copre chi: solo l\'eliminazione contro uno stack che ti copre ha un costo in denaro.',
          'Se paga solo il primo: si gioca per le fiches, senza sconti.',
          'Se pagano due o tre posti: si stringono le spinte che ti mandano fuori, si allarga contro chi rischia di uscire prima di te.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
    ],
    faq: [
      { q: 'L\'ICM conta anche nell\'heads-up finale?', a: 'No, e non è un «quasi mai». Quando restano due giocatori il terzo piazzamento è già assegnato, e la tua quota di quel che resta torna proporzionale alle fiches: la correzione è esattamente zero, sia che paghi solo il primo sia che paghino due o tre posti. La fase in cui il modello morde è quella a tre giocatori.' },
      { q: 'Serve un software di ICM per giocare questo formato?', a: 'Per la maggior parte dei tavoli no, perché su un winner-takes-all le soluzioni calcolate in fiches sono già la risposta giusta. Un software serve se vuoi capire di quanto si stringe sui moltiplicatori che dividono il montepremi, ed è studio da fare a mente fredda: al tavolo, con livelli così rapidi, non hai il tempo di consultare niente.' },
      { q: 'Come faccio a sapere quanti posti paga il tavolo?', a: 'La ripartizione del montepremi viene mostrata quando il moltiplicatore è estratto, prima della prima mano, e vale fino alla fine del torneo. È l\'unica informazione da leggere all\'inizio. Fra sale diverse la soglia oltre la quale il montepremi si divide non è la stessa: controlla come funziona in quella dove giochi, invece di assumerlo.' },
      { q: 'Se l\'ICM conta così poco qui, perché se ne parla tanto?', a: 'Perché nei tornei a molti giocatori, con premi che salgono a scalini e una bolla vera, è uno dei fattori che decide la parte finale. Il problema è il trasferimento: la stessa idea portata di peso su un tavolo da tre a premio unico produce un gioco passivo, e in una struttura da 25 big blind il passivo è la modalità che perde più in fretta.' },
      { q: 'Sui moltiplicatori alti conviene giocare per il secondo posto?', a: 'No, l\'obiettivo resta il primo: nella ripartizione tipica la fetta del vincitore è molto più grande di quelle degli altri due. Quello che cambia è il prezzo di un\'eliminazione evitabile, non l\'obiettivo. Tradurre la correzione in «faccio fold a tutto e spero che si scontrino» è solo un altro modo di giocare male quel tavolo.' },
      { q: 'Studiare l\'ICM riduce il rischio?', a: 'No. L\'ICM riguarda come valuti una decisione, non come va a finire: il poker resta un gioco con un rischio economico reale, la varianza non si toglie e nessuno può promettere risultati. Studiarlo serve a smettere di pagare errori evitabili nei pochi tavoli in cui conta, e a non introdurne di nuovi in tutti quelli in cui non conta.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'push-fold-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'heads-up-spin-and-go',
    ],
  },
  {
    slug: 'spin-and-go-vs-twister',
    titolo: 'Spin & Go e Twister: cosa cambia davvero',
    descrizione: 'Spin & Go e Twister sono lo stesso torneo: cambiano scala dei moltiplicatori, rake e soglia dei posti pagati. Cosa sposta la strategia e cosa la varianza.',
    occhiello: 'Formati a confronto',
    h1: 'Spin & Go e Twister: lo stesso gioco, le differenze che contano',
    lead: 'Spin & Go e Twister sono lo stesso torneo con due nomi commerciali diversi. Tre giocatori, venticinque big blind a testa, livelli che salgono ogni pochi minuti, un moltiplicatore estratto prima della prima mano. Passando da un operatore all\'altro cambiano la scala dei moltiplicatori disponibili, il rake e la soglia oltre cui il montepremi smette di andare tutto al vincitore; possono cambiare anche l\'ante e la simmetria degli stack, ed è da lì che conviene partire.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Quello che non cambia da una sala all\'altra',
        paragrafi: [
          'La struttura è identica ovunque: tre giocatori, venticinque big blind di stack iniziale, livelli hyper turbo. I bui sono gli stessi, il bottone non versa nulla, lo small blind mezzo big blind, il big blind uno, e in alcuni formati c\'è anche l\'ante. Il moltiplicatore viene estratto prima della prima mano, quindi giochi già sapendo cosa c\'è in palio.',
          'Anche il problema tecnico è lo stesso. Le mani di partenza sono sempre centosessantanove, l\'albero delle azioni preflop ha la stessa forma, e con una struttura hyper turbo dopo pochi livelli si gioca già a stack corti, dove la scelta si riduce spesso a entrare all-in o passare. A parità di ante, stack iniziale e posti pagati, una soluzione calcolata per una certa profondità effettiva descrive lo stesso spot su qualsiasi sala.',
          'Per questo l\'idea che si tratti di due giochi diversi è sbagliata nel modo peggiore: porta a rifare da zero uno studio che era già valido, invece di correggere le poche cose che cambiano davvero.',
        ],
      },
      {
        h2: 'La scala dei moltiplicatori non è la stessa ovunque',
        paragrafi: [
          'Su una sala italiana i moltiplicatori vanno da 2x fino a 12.000x, con un 6.000x che compare sui buy-in più alti. Su un altro operatore i gradini disponibili sono diversi: cambia il massimo, cambiano le fasce intermedie, e non è detto che allo stesso moltiplicatore corrisponda la stessa ripartizione del montepremi. È la differenza più visibile fra i due nomi, quella che si nota guardando la schermata di attesa.',
          'I moltiplicatori alti escono di rado, e i più alti in assoluto così di rado che si può giocare a lungo senza vederne nemmeno uno. Quella parte della scala non è qualcosa su cui costruire un\'aspettativa. Sulle decisioni incide solo per via indiretta: un moltiplicatore alto porta con sé un montepremi diviso fra più posti, ed è la divisione a contare, non la cifra.',
          'La scala pesa comunque, in un altro punto. Più montepremi è concentrato in eventi rari, meno un campione piccolo di tornei dice qualcosa sul tuo livello di gioco. È un problema di lettura dei risultati prima che di strategia, e ricade sul margine che conviene tenere da parte.',
        ],
      },
      {
        h2: 'Il rake cambia, e non lo vedi mai al tavolo',
        paragrafi: [
          'Il rake è nell\'ordine del 7-10% a seconda del buy-in, e la forbice non è identica fra un operatore e l\'altro. Non compare da nessuna parte durante la mano: è già dedotto quando la sala annuncia il montepremi, quindi non entra in nessuna decisione preflop.',
          'Entra invece nel conto quando valuti a che livello di buy-in ha senso giocare. Un paio di punti percentuali sembrano poco, ma si applicano a ogni singolo torneo, e su un formato che dura pochi minuti i tornei si accumulano in fretta. È il costo fisso del gioco, e alza il livello tecnico che serve perché lo studio si veda nei risultati.',
          'La percentuale scende salendo di buy-in, ma salendo di buy-in cambiano anche gli avversari. I due effetti tirano in direzioni opposte, e il secondo pesa di solito più del primo: un rake più basso non compensa un tavolo in cui sei il giocatore peggiore.',
        ],
      },
      {
        h2: 'Quando il montepremi smette di andare tutto al vincitore',
        paragrafi: [
          'Nella grande maggioranza dei tornei vince tutto chi resta ultimo al tavolo e il secondo posto non paga niente. Sui moltiplicatori più alti il montepremi si divide fra i tre giocatori, per esempio 83,3% al primo, 10% al secondo e 6,7% al terzo; su un moltiplicatore intermedio può pagare due posti, con uno split 80/20.',
          'La soglia a cui scatta la divisione è la meno appariscente delle tre, ed è l\'unica che tocca le decisioni. Va guardata per come è scritta: se è espressa sul moltiplicatore, basta conoscere il numero estratto; se è espressa sul montepremi complessivo, dipende anche dal buy-in, e lo stesso moltiplicatore può pagare un numero diverso di posti a livelli diversi.',
          'Quando pagano più posti il torneo cambia natura, ma meno di quanto si dica in giro. Arrivare secondi vale qualcosa, quindi sopravvivere entra nel conto accanto a eliminare, e le spinte marginali con tre giocatori ancora al tavolo costano più di quanto suggerisca la sola equity della mano: è l\'effetto ICM, che in un winner-takes-all non c\'è per niente. Quanto pesa dipende da quanta parte del montepremi sta fuori dal primo posto, e in entrambe le ripartizioni è una fetta piccola: correzioni ai margini, non un gioco diverso. E riguardano la minoranza dei tornei, quelli che escono sui moltiplicatori alti.',
        ],
        lista: [
          'Un solo posto pagato: è il caso normale, la struttura per cui sono calcolate quasi tutte le soluzioni preflop di questo formato.',
          'Due posti pagati, 80/20: il secondo posto vale un quinto del montepremi, abbastanza da rendere più caro un all-in marginale quando si è ancora in tre.',
          'Tre posti pagati, 83,3 / 10 / 6,7: fuori dal primo posto resta meno di un sesto del montepremi, spalmato su due quote, e l\'effetto sulle decisioni c\'è ma resta contenuto.',
        ],
      },
      {
        h2: 'Perché il preflop resta quasi identico',
        paragrafi: [
          'A una data profondità effettiva la decisione dipende da tre cose: quanti stack ci sono, in che posizione sei e con che range ti risponde chi ha ancora carte. Il nome commerciale del formato non compare in questa lista. Venticinque big blind sul bottone contro small blind e big blind sono lo stesso problema ovunque tu li stia giocando.',
          'Le cose che spostano davvero una soluzione preflop sono altre: la presenza dell\'ante, che aggiunge morto al piatto e allarga i range di apertura; gli stack asimmetrici, dove uno dei bui parte più corto e la profondità effettiva cambia a seconda di chi ti sta di fronte; e il payout, quando non è winner-takes-all. Sono tre variabili strutturali, e nessuna delle tre coincide con il nome della sala.',
          'In pratica: una tabella costruita per venticinque big blind, senza ante e con un solo posto pagato resta valida sull\'altro operatore, a patto che lì la struttura sia la stessa. Se cambia l\'ante o gli stack sono asimmetrici non è un altro gioco: è un altro ramo dello stesso albero, e va guardato quel ramo.',
        ],
      },
      {
        h2: 'Dove le differenze si sentono: varianza e bankroll',
        paragrafi: [
          'Con tre giocatori e un solo posto pagato la maggior parte dei tornei finisce senza premio, anche per chi al tavolo è il migliore. Aggiungi che una parte del montepremi complessivo sta in moltiplicatori che escono raramente, e ottieni una distribuzione molto larga: sequenze lunghe di tornei persi non sono un sintomo, sono il funzionamento normale del formato.',
          'Qui la differenza fra un operatore e l\'altro è concreta. Una scala che arriva più in alto concentra di più il montepremi in eventi rari e allarga ulteriormente la distribuzione; una soglia di divisione più bassa la restringe, perché il secondo posto ripaga una parte dei tornei. Stesso gioco, stessa abilità, oscillazioni diverse.',
          'Di conseguenza il numero di buy-in da tenere da parte non è una costante che porti con te da una sala all\'altra: la stessa cifra può essere prudente su una struttura e insufficiente su un\'altra. Conviene simulare le due strutture invece di andare a memoria, tenendo presente che resta una stima. Il poker comporta un rischio economico reale, e nessuna gestione del bankroll lo elimina.',
        ],
      },
      {
        h2: 'Cosa guardare prima di sederti su una struttura nuova',
        paragrafi: [
          'Le informazioni che servono sono nelle regole del formato e nella schermata del tavolo, e si leggono in pochi minuti. Sono meno di quante sembrino, ma ognuna cambia qualcosa di preciso.',
          'Fatto questo controllo, quello che resta da adattare è poco: la profondità di studio non cambia, cambiano il ramo dell\'albero da guardare e il conto della varianza da rifare. Chi tratta i due formati come mondi separati riscrive per settimane cose che aveva già, e intanto non guarda l\'unica parte che è davvero diversa.',
        ],
        lista: [
          'La scala dei moltiplicatori e, se la sala le pubblica, le frequenze con cui escono: dice quanto sarà larga la distribuzione dei risultati.',
          'Il rake al livello di buy-in a cui giochi davvero, non quello dei tavoli alti.',
          'La soglia oltre cui si pagano due o tre posti, e se è espressa sul montepremi o sul moltiplicatore.',
          'La presenza dell\'ante: cambia i range di apertura, non solo la dimensione del piatto.',
          'Lo stack iniziale e l\'eventuale esistenza di formati asimmetrici, dove uno dei bui parte più corto.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
    ],
    faq: [
      { q: 'Spin & Go e Twister hanno regole diverse?', a: 'No. Le regole del gioco sono identiche: tre giocatori, venticinque big blind, struttura hyper turbo, moltiplicatore estratto prima della prima mano. Diversi sono i parametri che ogni operatore imposta: quali moltiplicatori esistono, quanto rake trattiene e a che punto il montepremi si divide fra più posti. Sono differenze di configurazione, non di regolamento.' },
      { q: 'Devo rifare lo studio preflop se cambio sala?', a: 'No, se la struttura è la stessa. Una soluzione dipende da profondità effettiva, posizione, range avversari e forma del payout. Controlla tre cose sull\'altra sala: se c\'è l\'ante, se lo stack iniziale e la simmetria coincidono, e se a quel montepremi paga uno o più posti. Se coincidono, le tabelle che già usi valgono.' },
      { q: 'Il rake più basso ai buy-in alti conviene?', a: 'Non da solo. Salendo di buy-in la percentuale trattenuta scende, ma gli avversari migliorano, e il secondo effetto pesa spesso più del primo. Il rake è un criterio per scegliere fra due strutture allo stesso livello, non un motivo per salire di livello prima di essere pronto tecnicamente.' },
      { q: 'Cosa cambia quando il torneo paga due o tre posti?', a: 'Il secondo posto smette di valere zero, quindi sopravvivere acquista valore rispetto a eliminare, e le spinte marginali con tre giocatori al tavolo diventano più costose di quanto dica la sola equity della mano. È l\'effetto ICM, ma resta modesto: fuori dal primo posto sta una fetta piccola del montepremi, e succede in una minoranza di tornei.' },
      { q: 'Serve più bankroll su una struttura o sull\'altra?', a: 'Dipende dalla struttura, non dal nome. Una scala di moltiplicatori più lunga verso l\'alto allarga la distribuzione dei risultati e chiede più margine; una soglia di divisione del montepremi più bassa la restringe un po\'. La differenza si stima simulando le due strutture, e resta una stima: il rischio economico non si annulla.' },
      { q: 'Come faccio a sapere quali moltiplicatori esistono dove gioco?', a: 'Sono pubblicati nelle regole del formato, insieme alla ripartizione del montepremi per ogni fascia. È l\'unica fonte da usare: le scale cambiano nel tempo, e un elenco copiato da un forum o da un video di due anni fa descrive spesso una struttura che non esiste più.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'varianza-spin-and-go',
      'bankroll-spin-and-go',
      'icm-spin-and-go',
    ],
  },
  {
    slug: 'scegliere-scuola-poker-spin-and-go',
    titolo: 'Scuola di poker Spin & Go: come sceglierne una',
    descrizione: 'I criteri per capire se una scuola di poker insegna davvero il 3-max hyper turbo: chi è il coach, quanto è aggiornato il materiale, dove finiscono le domande.',
    occhiello: 'Percorso di studio',
    h1: 'Come scegliere una scuola di poker per Spin & Go',
    lead: 'Le pagine di presentazione delle scuole di poker si somigliano tutte: video, community, «percorso completo». Le differenze stanno altrove: nel formato che il coach gioca davvero, in quanto è vecchio il materiale che ti vende, in cosa succede quando fai una domanda tecnica e non risponde nessuno. Quasi tutto questo si verifica dall\'esterno, prima di pagare.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Chi insegna gioca questo formato o insegna poker in generale',
        paragrafi: [
          'Un coach generalista spiega concetti veri ovunque, ma qui la struttura è particolare: tre giocatori, 25 big blind di partenza, livelli che salgono ogni pochi minuti. Dopo pochi giri sei corto e le decisioni si concentrano prima del flop, prima in tre e poi in heads-up. Chi arriva dal cash game o dai tornei lunghi può avere la teoria giusta e i range sbagliati.',
          'Le domande da fare sono banali e nessuna scuola seria si offende: quali buy-in giochi, quanti tornei di questo formato al mese, da quanto tempo. Un coach che il formato lo ha giocato anni fa e oggi insegna e basta non è automaticamente peggio, ma il suo materiale invecchia insieme a lui, e tocca a te chiederlo prima.',
          'Poi fai una domanda specifica e guarda la forma della risposta. «Dipende dall\'avversario» è una risposta corretta se prosegue dicendo da cosa dipende: quanto folda, quanto apre dal bottone, come reagisce quando lo rialzi. Se si ferma prima, non è prudenza, è che non lo sa.',
        ],
      },
      {
        h2: 'Il materiale è aggiornato alla struttura che giochi tu',
        paragrafi: [
          'Il formato non è uguale dappertutto e non è congelato nel tempo. Cambiano i moltiplicatori disponibili, il rake, nell\'ordine del 7-10% a seconda del buy-in, e la soglia oltre la quale il montepremi si divide fra più posti invece di andare tutto al primo. Alcuni tavoli hanno l\'ante, altri no. Esistono formati asimmetrici in cui uno dei due bui parte più corto degli altri.',
          'Sono differenze che spostano i range, non sfumature. Un video registrato su una struttura senza ante insegna spinte un po\' troppo strette per un tavolo con l\'ante, dove c\'è più morto da raccogliere; una tabella calcolata su stack pari non descrive un tavolo asimmetrico. Per questo il materiale deve dichiarare su quale formato e su quale profondità è stato costruito: senza quell\'etichetta non sai se ti riguarda.',
          'Non tutto invecchia allo stesso modo. Il motivo per cui un torneo 3-max hyper turbo si decide prima del flop, la gestione del bankroll e della varianza, il modo di ragionare quando il montepremi si divide fra più posti restano validi per anni. Su quest\'ultimo punto diffida di chi ti riempie di ICM: nella grande maggioranza dei tornei il premio va tutto al primo, e lì non c\'è nulla da correggere. A invecchiare sono le frequenze esatte e i range, cioè la parte che stai comprando.',
        ],
      },
      {
        h2: 'Studiare in ordine vale più che guardare cento video',
        paragrafi: [
          'Un catalogo non è un percorso. Guardando video a caso impari cose che non sai dove mettere: una lezione su uno spot postflop, prima di avere range di apertura e di spinta solidi, ti serve poco, perché a quello spot ci arrivi di rado e spesso con le mani sbagliate.',
          'Un percorso onesto ha un ordine e te lo dice: prima il preflop, cioè le 169 mani di partenza con aperture e spinte per ogni profondità di stack, poi l\'heads-up, che è dove ogni torneo finisce per decidersi, poi il resto. E prevede un modo per esercitarsi, non solo per guardare: tabelle da consultare, esercizi, revisione delle mani giocate.',
          'Chiedi com\'è fatto il primo mese di uno che parte da zero. Se la risposta è che hai accesso a tutto, quella è una libreria. Può bastare se sai già cosa cercare; se non lo sai, stai pagando materiale che non aprirai.',
        ],
      },
      {
        h2: 'Serve un posto dove fare domande e ricevere una risposta',
        paragrafi: [
          'La differenza fra del materiale e una scuola è la risposta alla tua domanda specifica. Avrai mani che non capisci, e senza un posto dove portarle ti costruisci una spiegazione tua, spesso sbagliata, e la ripeti per mesi finché non ti costa abbastanza da accorgertene.',
          'Prima di iscriverti guarda il gruppo o il canale, se è visibile: quanti messaggi nell\'ultima settimana, quante domande tecniche hanno sotto una risposta, se scrive anche chi insegna o solo gli iscritti. Un gruppo dove l\'ultima domanda seria è di un mese fa e sotto non c\'è niente ti dice più di qualsiasi pagina di presentazione.',
          'Chiedi anche tempi e limiti. Nessuno può rispondere a tutto in tempo reale, e chi ti dice che risponde entro un paio di giorni, nel canale e non in privato, è più affidabile di chi promette assistenza continua e poi sparisce nei giorni in cui gioca.',
        ],
      },
      {
        h2: 'La lingua conta più di quanto sembri',
        paragrafi: [
          'Buona parte del materiale tecnico su questo formato è in inglese. Se lo leggi bene la scelta si allarga parecchio; se lo mastichi a fatica, una traduzione approssimativa ti costa più di quanto ti fa risparmiare, perché i termini di strategia hanno significati precisi e una sfumatura sbagliata cambia la decisione al tavolo.',
          'Il punto non è capire un video: è fare una domanda e capire la risposta, discutere una mano, poter dire che secondo te lì si gioca diversamente. In una lingua che non padroneggi lo fai meno, e quindi studi meno. Se scegli materiale in inglese, verifica almeno di poter discutere in una lingua in cui ti muovi bene.',
        ],
      },
      {
        h2: 'I segnali per cui conviene andarsene subito',
        paragrafi: [
          'Alcune cose non sono questioni di gusto: quando le trovi, il resto della vetrina non le compensa. Non significa per forza che chi insegna sia incompetente, significa che il prodotto è costruito più per vendersi che per insegnarti, e te lo sta dicendo prima che tu paghi invece che dopo tre mesi.',
          'Ce n\'è uno più sottile: la scuola che non dice mai «qui dipende». In questo formato esistono spot con una risposta netta, quasi meccanica, e altri in cui la scelta giusta cambia con l\'avversario che hai davanti. Chi presenta tutto come regola fissa sta semplificando per vendere meglio, e ti lascia senza strumenti appena il tavolo non collabora.',
        ],
        lista: [
          'Promesse di risultato, dal «metodo garantito» al «ti porto a battere il formato». Il poker comporta un rischio economico reale e nessuno può promettere come andrà a te.',
          'Prezzi legati a quanto vinci. Chi prende una quota dei tuoi risultati non ti sta vendendo insegnamento ma un accordo di altra natura, con incentivi diversi dai tuoi: valutalo per quello che è.',
          'Inviti ad aprire un conto da qualche parte in cambio di accesso al materiale. È pubblicità, e il prodotto pubblicizzato non è il corso.',
          'Domande tecniche ferme da settimane nel gruppo che ti viene mostrato come valore aggiunto.',
          'Materiale che non dichiara mai su quale struttura, con quale stack e con o senza ante è stato costruito.',
        ],
      },
      {
        h2: 'Come mettere alla prova una scuola prima di pagarla',
        paragrafi: [
          'Quasi tutti i criteri qui sopra si controllano da fuori, in mezz\'ora. Guarda un contenuto gratuito e chiediti se ti ha lasciato qualcosa di usabile stasera al tavolo, non se era piacevole da vedere. Scrivi una domanda tecnica dove si può scrivere e conta i giorni. Chiedi su quale struttura è calcolato il materiale preflop e vedi se ti rispondono con un\'etichetta precisa o con una frase di circostanza.',
          'Se una scuola non mostra niente prima del pagamento, stai comprando alla cieca. Non è detto che sia fatta male, ma non hai modo di saperlo, e il rischio è tuo. Vale anche il contrario: molto materiale visibile e gratuito non dimostra che dietro ci sia un percorso, dimostra solo che c\'è una vetrina curata.',
          'Best Fish Forever è costruita su questo formato: le tabelle preflop dichiarano formato, profondità e presenza di ante, il percorso ha un ordine e le domande hanno un posto dove finire. Valutala con gli stessi criteri con cui valuteresti chiunque altro. Nessun percorso di studio, questo incluso, toglie il rischio economico del gioco: riduce gli errori evitabili, che è un\'altra cosa.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
    ],
    faq: [
      { q: 'Serve davvero una scuola o posso studiare da solo?', a: 'Puoi studiare da solo: materiale gratuito, tabelle, revisione delle tue mani. Costa più tempo e nessuno ti dice quando stai guardando nel posto sbagliato, che è l\'errore più caro perché da soli non si vede. Una scuola compra ordine e risposte. Se hai tempo e sai costruirti un piano di studio, la differenza si assottiglia parecchio.' },
      { q: 'Il coach deve giocare buy-in più alti dei miei?', a: 'Non necessariamente. Conta che giochi il formato con regolarità e conosca la struttura dei tavoli dove siedi tu. Ai buy-in alti il campo è più duro e certe finezze si vedono meglio, ma un coach al tuo livello che spiega bene ti serve più di uno più forte che spiega male. Chiedi come insegna, non solo come gioca.' },
      { q: 'Come capisco se le tabelle preflop che mi propongono sono buone?', a: 'Devono dichiarare formato, profondità di stack e presenza di ante, e devono essere navigabili per sequenza di azioni, non un\'immagine unica. Per ognuna delle 169 mani di partenza vuoi vedere frequenza e valore di ogni azione, non tre colori. E devono descrivere il tavolo dove giochi: una tabella senza ante usata con l\'ante è sbagliata dalla prima mano.' },
      { q: 'Quanto dovrebbe costare un percorso serio?', a: 'Non esiste un prezzo di riferimento: dipende da cosa c\'è dentro, se ci sono sessioni dal vivo, revisione individuale, materiale preflop tenuto aggiornato. Il criterio utile è un altro: quanto lo userai davvero. Se apri il materiale due volte al mese, qualunque cifra è alta. E il prezzo non deve dipendere dai tuoi risultati, per i motivi detti sopra.' },
      { q: 'Un gruppo grande è meglio di uno piccolo?', a: 'No, conta la quota di domande che ricevono risposta. Un canale con centinaia di iscritti dove nessuno commenta le mani vale meno di un gruppo piccolo che ne rivede qualcuna ogni settimana. Guarda le ultime dieci domande tecniche: quante hanno sotto una risposta, quanto ci è voluto e chi l\'ha scritta.' },
      { q: 'Se una scuola non parla mai di varianza è un problema?', a: 'È un segnale. Con il moltiplicatore estratto a inizio torneo, 25 big blind di stack e un montepremi quasi sempre tutto al primo, i risultati oscillano molto anche su tratti lunghi. Chi insegna il formato senza mai nominarla o non lo gioca, o sta tenendo fuori dalla vetrina la parte che fa smettere le persone.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'come-giocare-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'varianza-spin-and-go',
    ],
  },
  {
    slug: 'errori-comuni-spin-and-go',
    titolo: 'Errori comuni negli Spin & Go: i sette più costosi',
    descrizione: 'Sette sbagli che tornano nei 3-max hyper turbo: small blind giocato come il bottone, limp senza piano, big blind troppo stretto, ICM usato ovunque.',
    occhiello: 'Errori ricorrenti',
    h1: 'Gli errori più comuni negli Spin & Go, e come si correggono',
    lead: 'Quasi tutto quello che si perde nei 3-max hyper turbo non se ne va in spot complicati al river. Se ne va in decisioni preflop ripetute centinaia di volte, sempre nello stesso modo. Sette errori ricorrenti, il motivo per cui costano e la correzione.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Giochi lo small blind come se fosse il bottone',
        paragrafi: [
          'In tre giocatori il bottone apre largo perché dopo il flop parla per ultimo contro entrambi i bui. Dallo small blind quel vantaggio non esiste: se il bottone lascia, resti solo contro il big blind, che per continuare paga meno di te e che deciderà sempre dopo di te per tutte le strade successive.',
          'Il numero di mani con cui entri da lì può essere alto, e spesso lo è: hai un avversario solo davanti e mezzo buio già nel piatto. Quello che non può restare uguale è il seguito. Chi copia il piano del bottone rilancia alla stessa misura, si arrende agli stessi rilanci e finisce a giocare fuori posizione piatti che non aveva previsto.',
          'La correzione parte da un confronto, non da una regola generale. Metti il tuo range dallo small blind accanto a quello che la soluzione dà allo stesso stack e guarda dove le due cose divergono: a volte è il range di entrata, molto più spesso è la risposta al rilancio del big blind, dove si lascia troppo oppure si paga con mani che poi non sanno che farsene del flop.',
        ],
      },
      {
        h2: 'Il tuo range non si accorcia insieme allo stack',
        paragrafi: [
          'Un hyper turbo passa da 25 big blind a 10 in pochi livelli, e la stessa mano cambia natura mentre lo stack scende. A 20 big blind un rilancio lascia spazio a un gioco postflop; a 10 lo stesso rilancio impegna già metà stack e ti mette davanti a una decisione che potevi evitare mandando tutto dentro subito.',
          'L\'errore tipico è tenere lo stesso schema per tutta la partita: apri sempre alla stessa misura, lasci sempre le stesse mani, e a un certo punto stai facendo con 9 big blind quello che avevi imparato a 25. L\'errore speculare è altrettanto comune: chi scopre le spinte comincia a usarle troppo presto e a 20 big blind manda all-in mani che avrebbero un\'apertura standard nettamente migliore.',
          'Serve un riferimento per fasce di stack. Guarda cosa cambia fra 20, 15 e 10 big blind nella stessa posizione: sono tre strategie diverse, e il passaggio dal rilancio alla spinta non avviene a una soglia sola, avviene mano per mano.',
        ],
      },
      {
        h2: 'Il limp che usi non è quello che sta nelle soluzioni',
        paragrafi: [
          'Completare dallo small blind sembra un modo per vedere un flop a poco prezzo. Nelle soluzioni un limp esiste davvero, e in questo formato non è nemmeno raro, ma arriva con il seguito già scritto: quali mani continuano contro un rilancio, quali rispondono mandando dentro tutto, quali lasciano. È una strategia costruita, non un risparmio sul prezzo d\'ingresso.',
          'Il limp di chi comincia è un\'altra cosa: è il modo di non decidere. Entri senza aver definito niente, non hai tolto nessuno dalla mano e lasci all\'avversario un rilancio comodo che ti riporta a scegliere in condizioni peggiori di quelle di partenza, spesso con una mano che non sai come difendere.',
          'Dal bottone il problema è più netto, perché dietro restano due giocatori e l\'entrata passiva li invita entrambi a vedere il flop a buon mercato. Se una mano vale la pena di entrare, il rilancio le lascia qualcosa che il limp non le lascia: la possibilità di vincere il piatto subito. Se non la vale, il fold costa zero.',
        ],
        lista: [
          'non fa lasciare nessuno: chi voleva vedere il flop lo vede comunque, a un prezzo che gli va benissimo',
          'rinuncia alla fold equity, che a stack corto è la leva che rende giocabile anche una mano mediocre',
          'ti lascia fuori posizione in un piatto che non hai definito, senza una risposta pronta al rilancio',
        ],
      },
      {
        h2: 'Dal big blind lasci a un prezzo che non rivedrai',
        paragrafi: [
          'Hai già 1 big blind nel piatto prima di guardare le carte, e nei formati con ante c\'è dell\'altro. Quando il bottone apre piccolo, il prezzo per continuare è basso: non ti serve una bella mano, ti serve una mano che vinca abbastanza spesso da giustificare quel prezzo.',
          'Chi comincia lascia dal big blind mani che difenderebbero bene, perché le giudica in astratto, «è una mano debole», invece che rispetto a quanto costa vederle. Contro un avversario che apre largo, un big blind troppo stretto è la perdita più prevedibile del formato: non richiede nemmeno che lui giochi bene, gli basta continuare ad aprire.',
          'Il rovescio esiste ed è altrettanto costoso: difendere tutto e poi non saper giocare i flop fuori posizione. Difendere meglio non vuol dire pagare di più, vuol dire pagare con le mani giuste, e sotto una certa profondità buona parte della difesa non è nemmeno un call: è una spinta che nega all\'apertura il flop che stava cercando.',
        ],
      },
      {
        h2: 'Tratti ogni torneo come se pagasse tre posti',
        paragrafi: [
          'Il moltiplicatore viene estratto prima della prima mano e decide che partita stai giocando. Nella grande maggioranza dei casi paga un posto solo: chi arriva secondo porta a casa esattamente quanto chi arriva terzo, cioè niente. In quel torneo giocare per «arrivare in due» non ha alcun senso.',
          'Sui moltiplicatori alti la struttura cambia sul serio: il montepremi si divide fra i tre giocatori, per esempio 83,3 / 10 / 6,7 per cento, e su un moltiplicatore intermedio possono essere pagati due posti, 80 e 20. Lì una spinta marginale che nel winner-takes-all è corretta può diventare un errore, perché eliminarsi ha un costo che negli altri tornei non c\'era.',
          'L\'errore comune non è ignorare l\'ICM, è applicarlo sempre. Quei tornei sono una minoranza, e chi ha letto qualcosa sull\'argomento comincia a lasciar perdere spot buoni anche dove paga solo il primo, rimettendoci ogni volta. La domanda da farsi all\'inizio è una: questo torneo paga più di un posto? Se la risposta è no, le fiches valgono quasi esattamente quanto sembrano e si gioca di conseguenza.',
        ],
        lista: [
          'paga un posto solo: è il caso più frequente, e il secondo posto non vale più del terzo',
          'paga due posti, 80 e 20: arrivare secondi vale qualcosa, ma quasi tutto resta al primo',
          'paga tre posti, per esempio 83,3 / 10 / 6,7 per cento: qui anche il terzo posto ha un valore reale',
        ],
      },
      {
        h2: 'Sali di limite dopo una serie fortunata',
        paragrafi: [
          'Una serie di moltiplicatori sopra la media, o qualche testa a testa vinto di fila, cambia i tuoi numeri molto più in fretta di quanto cambi il tuo livello di gioco. La varianza qui è alta per come è fatto il formato: il montepremi lo decide un\'estrazione, la maggior parte dei tornei vale poco e una piccola minoranza vale moltissimo.',
          'Chi sale di limite in quel momento fa due cose insieme: alza l\'importo di ogni buy-in e si siede contro avversari mediamente più forti, mentre il campione su cui sta giudicando sé stesso è ancora piccolo. Quando la serie si inverte, la fase negativa arriva a un limite dove ogni torneo pesa di più.',
          'Non esiste un numero di buy-in valido per tutti: dipende da quanto sei disposto a scendere di limite quando le cose vanno male, da quanto ti pesa perdere e da quanto sono distanti fra loro i moltiplicatori che ti capitano. Un simulatore di percorsi serve soprattutto a vedere quante sessioni consecutive in perdita rientrano nella norma anche giocando bene. Il poker comporta un rischio economico reale e nessuno può garantire un risultato.',
        ],
      },
      {
        h2: 'Studi i postflop e trascuri il preflop, dove sta quasi tutto',
        paragrafi: [
          'In un torneo che parte da 25 big blind con livelli che salgono ogni pochi minuti, moltissime mani si chiudono con una decisione sola e parecchie non vedono nemmeno il flop. Il numero di decisioni preflop che prendi in una sessione non è paragonabile a quello degli spot postflop complicati, e ogni errore preflop si ripete identico ogni volta che quella situazione torna.',
          'Le mani di partenza sono 169. È un insieme piccolo e finito: si può imparare cosa farne posizione per posizione e fascia di stack per fascia di stack, e si può verificare. I postflop no: dipendono dal range con cui ci sei arrivato, quindi studiarli partendo da un preflop sbagliato vuol dire cercare la risposta giusta a una domanda che non avresti dovuto farti.',
          'L\'ordine che regge è: prima i range di apertura e di risposta per fascia di stack, poi spinte e chiamate a stack corto, poi i pochi spot postflop che tornano davvero spesso. Non è una gerarchia di importanza teorica, è una gerarchia di frequenza: si comincia da quello che ti capita di più, perché è lì che un errore si moltiplica.',
        ],
      },
    ],
    strumenti: [
      { testo: 'Le tabelle GTO preflop, per confrontare i tuoi range con la soluzione allo stesso stack', href: '/tabelle/' },
      { testo: 'Il simulatore di varianza, per vedere quanto sono lunghe le serie negative normali', href: '/simulatore-varianza/' },
      { testo: 'Le lezioni video della scuola', href: '/lezioni/' },
    ],
    faq: [
      { q: 'Qual è l\'errore che costa di più in assoluto?', a: 'Non c\'è una classifica valida per tutti: costa di più quello che ripeti più spesso. Per la maggior parte di chi comincia sono le due decisioni che tornano in ogni singolo torneo, cioè cosa fare dallo small blind quando il bottone lascia e quanto difendere dal big blind quando il bottone apre. Uno spot postflop delicato, in confronto, capita ogni tanto.' },
      { q: 'Se il limp è un errore, perché lo vedo fare anche a giocatori forti?', a: 'Perché il limp non è un errore in sé: nelle soluzioni esiste, soprattutto dallo small blind, e viene con una risposta già pronta a ogni rilancio dell\'avversario. Chi lo copia senza quel seguito ottiene il peggio dei due mondi, cioè un piatto giocato fuori posizione e nessun piano per quando qualcuno rilancia.' },
      { q: 'A quanti big blind si passa al gioco push or fold?', a: 'Non c\'è una soglia netta, ed è la parte che confonde di più. Il passaggio è graduale e avviene mano per mano: alcune mani sono già una spinta a stack più profondi, altre restano un\'apertura normale anche parecchio più giù. Quello che serve non è un numero, è sapere cosa cambia fra una fascia di stack e la successiva nella tua posizione.' },
      { q: 'Come capisco se dal big blind sto lasciando troppo?', a: 'Guarda quanto spesso lasci la mano quando il bottone apre e confrontalo con la soluzione allo stesso stack, non con la tua sensazione. Il segnale pratico è un avversario che apre quasi tutto e non viene mai punito: se contro quel giocatore il tuo big blind non si allarga, stai regalando bui a ripetizione.' },
      { q: 'Devo studiare l\'ICM fin da subito?', a: 'Devi sapere che esiste e riconoscere quando serve, cioè nei tornei in cui il montepremi è diviso fra più posti. Applicarlo dappertutto è un errore comune quanto ignorarlo: nella grande maggioranza dei tornei paga solo il primo, e lì la cautela da bolla non ha nulla su cui appoggiarsi.' },
      { q: 'Dopo quanti tornei posso dire se sto migliorando?', a: 'Molti più di quelli che ti aspetti, e comunque il risultato da solo non basta: in un formato dove il montepremi dipende da un\'estrazione, una serie fortunata e una sfortunata si somigliano parecchio finché il campione resta piccolo. È più utile valutare le decisioni, spot per spot, e usare i numeri solo su campioni grandi.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'push-fold-spin-and-go',
      'icm-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
    ],
    termini: [
      { slug: 'fold', termine: 'Fold' },
      { slug: 'call', termine: 'Call' },
      { slug: 'limp', termine: 'Limp' },
    ],
  },
  {
    slug: 'heads-up-spin-and-go',
    titolo: 'Heads-up negli Spin & Go: cosa cambia quando resti in due',
    descrizione: 'Quasi ogni Spin & Go finisce in due: perché in heads-up si apre molto più largo, quanto deve difendere il grande buio e cosa cambia mentre lo stack cala.',
    occhiello: 'Heads-up finale',
    h1: 'Heads-up negli Spin & Go: come si gioca la fase che decide il torneo',
    lead: 'Quasi ogni Spin & Go finisce in due, e lì si decide chi vince il torneo. È la fase in cui si gioca il maggior numero di mani, ed è quella che quasi tutti improvvisano dopo aver studiato con cura le aperture a tre. In due cambiano le distanze: quali mani valgono, quanto pesa la posizione, che prezzo ti fa il buio.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'La fase più frequente è anche quella meno studiata',
        paragrafi: [
          'Il torneo è a tre, ma la struttura lo porta quasi sempre a due: qualcuno esce, e da quel momento ogni mano è heads-up fino alla fine. In numero di mani giocate l\'heads-up pesa più di qualsiasi altra configurazione del formato, e nella grande maggioranza dei tornei, quelli winner-takes-all, è l\'unica fase che separa il primo posto dal niente.',
          'Nonostante questo, il tempo di studio va quasi tutto sul tavolo a tre: cosa aprire dal bottone, come difendere il grande buio, cosa fare contro un all-in. Sono decisioni che si ripetono per pochi minuti a torneo. L\'heads-up dura fino alla fine e viene affrontato a intuito, con range vaghi e adattamenti presi al volo su due o tre mani viste.',
          'Il risultato è che due giocatori quasi identici nella fase a tre possono avere una distanza enorme in due. Nel breve periodo non si vede: in un hyper turbo il rumore copre tutto per parecchie sessioni, e chi sbaglia qui può passare mesi senza avere motivo di sospettarlo.',
        ],
      },
      {
        h2: 'In due si gioca molto più largo, e non è una questione di stile',
        paragrafi: [
          'Con due giocatori al tavolo la mano avversaria è una sola. Perché la tua sia davanti non serve granché, e quando è dietro spesso lo è di poco: contro una singola mano sconosciuta quasi tutto è più vicino alla parità di quanto sembri. A tre giocatori, per entrare in un piatto, devi passare davanti a due mani invece che a una, e la soglia si alza.',
          'Chi apre dal bottone in heads-up ha già versato mezzo big blind. Con un rilancio minimo ne aggiunge uno e mezzo per contendere l\'uno e mezzo già in mezzo, contro un solo avversario e con la posizione su tutte le strade successive. A quel prezzo l\'apertura resta redditizia con una quota di mani che a tre giocatori sarebbe fuori discussione.',
          'Non è aggressività per gusto: è l\'aritmetica dei bui che cambia. Le frequenze esatte, mano per mano, dipendono dalla profondità e dall\'eventuale ante, e sono il tipo di dettaglio che conviene leggere invece di ricostruirlo a memoria: nelle tabelle l\'albero heads-up è una sezione a sé, separata da quella a tre giocatori.',
        ],
      },
      {
        h2: 'La posizione pesa più che al tavolo a tre',
        paragrafi: [
          'In heads-up il bottone è anche il piccolo buio: agisce per primo preflop e per ultimo su flop, turn e river. Significa che chi apre vede la reazione dell\'avversario prima di decidere, su tutte le strade che contano, in ogni singola mano giocata.',
          'A tre giocatori la posizione ruota e c\'è sempre un terzo che può intervenire. In due il vantaggio si concentra su due soli ruoli che si scambiano a ogni mano: chi gioca male fuori posizione paga il conto una mano sì e una no, non ogni tanto.',
          'È anche il motivo per cui lo stesso range che dal bottone è largamente giocabile diventa un problema dal grande buio se lo difendi passivamente. La posizione non salva una mano debole, ma cambia quali mani vale la pena portare al flop e quali conviene giocare subito, preflop, con una decisione sola.',
        ],
      },
      {
        h2: 'Il grande buio deve difendere molto più di quanto sembri',
        paragrafi: [
          'Dal grande buio hai già un big blind nel piatto. Contro un rilancio piccolo ti resta da aggiungere poco per vedere un flop contro un range molto largo, a un prezzo che rende insostenibile passare la maggioranza delle 169 mani di partenza. Il fold automatico con tutto ciò che sembra brutto è, in due, l\'errore che costa di più sull\'intera durata dell\'heads-up.',
          'Difendere non significa chiamare sempre. Una parte delle mani sta meglio come rilancio o come all-in: nega il flop a buon mercato e chiude il piatto subito abbastanza spesso da giustificare il rischio. Un\'altra parte vuole vedere il flop, perché il range di chi ha aperto è pieno di mani che sulla maggior parte delle carte non prendono niente.',
          'Il punto delicato è che difendere largo funziona solo se poi sai giocare quei flop. Chiamare con mani marginali e arrendersi a ogni puntata è peggio che passare preflop: paghi due volte lo stesso ingresso. Se il postflop in due ti mette in difficoltà, la correzione onesta è difendere un po\' meno adesso e lavorare a parte su quella fase.',
        ],
      },
      {
        h2: 'Quando lo stack si accorcia, le decisioni si riducono',
        paragrafi: [
          'Si parte da 25 big blind e i livelli salgono ogni pochi minuti. Quando resti in due, la profondità che comanda, cioè lo stack del più corto dei due, è di solito già molto sotto quella iniziale e continua a scendere mentre giochi. Le decisioni non diventano più difficili: diventano meno numerose.',
          'Sotto una certa soglia le linee intermedie spariscono. Rilanciare e poi passare a un all-in costa troppo rispetto a quello che c\'è nel piatto, e la scelta reale si riduce a spingere o foldare. Non esiste un numero unico che segna quel confine: dipende dall\'ante, dalla dimensione del rilancio e soprattutto da quanto largo chiama l\'avversario.',
          'Nei formati asimmetrici, dove uno dei due bui parte con uno stack più corto, capita spesso di arrivare in due con stack molto diversi. Chi è dietro se ne accorge subito: la profondità che comanda è la sua, quindi la zona in cui restano solo all-in e fold può essere già lì alla prima mano dell\'heads-up, e le soluzioni cambiano di conseguenza.',
        ],
      },
      {
        h2: 'In due l\'avversario medio è più sfruttabile che altrove',
        paragrafi: [
          'Le aperture a tre giocatori sono facili da imitare: si trovano ovunque, si memorizzano in un pomeriggio e reggono anche applicate meccanicamente. In heads-up quasi nessuno arriva con un piano, e gli errori diventano sistematici: non capitano una volta, si ripetono per tutta la durata della fase finale, sempre nella stessa direzione.',
          'Adattarsi richiede prove, però, non impressioni. Un fold non è una tendenza e tre mani non sono un campione. Le correzioni affidabili sono quelle grosse e ripetute, e vanno fatte nella direzione dell\'errore altrui senza spingersi al punto di crearne uno tuo: chi apre qualsiasi cosa contro un avversario che ha smesso di passare sta solo cambiando il tipo di perdita.',
        ],
        lista: [
          'Passa quasi sempre dal grande buio: apri più mani, tenendo il rilancio piccolo, perché il valore arriva dai piatti che nessuno contende.',
          'Chiama tutto e non rilancia mai: togli i bluff, punta con le mani forti e smetti di provare a farlo passare.',
          'Apre e poi passa a un all-in: rilancia sopra la sua apertura molto più spesso, anche con mani che non vorresti mostrare.',
          'Non chiama mai un all-in: spingi ogni volta che la profondità lo consente, finché non comincia a chiamare.',
        ],
      },
      {
        h2: 'Cosa studiare per primo, e perché in quest\'ordine',
        paragrafi: [
          'Il primo blocco è il tuo range dal bottone alle profondità che incontri davvero. Non serve la griglia dei 25 big blind se in due ci arrivi con dodici: apri i nodi che corrispondono agli stack veri della tua fase finale e leggili in sequenza, per vedere come cambiano quando lo stack scende e quando compare l\'ante.',
          'Il secondo è la difesa dal grande buio, e sono tre risposte diverse: contro il rilancio minimo, contro un rilancio più grande e contro l\'all-in. Vanno studiate separatamente, perché è lì che si concentra quasi tutta la perdita di chi improvvisa questa fase.',
          'Il postflop viene dopo, e non perché sia irrilevante: a queste profondità moltissimi piatti si chiudono prima del flop, quindi il tempo speso a correggere un range preflop rende molto di più. Vale la pena ricordarlo comunque: il poker resta un gioco con un rischio economico reale, e studiare riduce gli errori, non la possibilità di perdere.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
      { testo: 'creare un account gratuito', href: '/registrazione' },
    ],
    faq: [
      { q: 'Quando comincia davvero l\'heads-up in uno Spin & Go?', a: 'Nel momento in cui esce il terzo giocatore, e con una struttura hyper turbo può succedere già nei primi minuti. I gettoni dei tre stack iniziali restano in tavola, ma valgono sempre meno man mano che i livelli salgono: la stessa quantità di gettoni può essere una fase ancora giocabile o quasi solo spingere e passare, a seconda di quando ci arrivi.' },
      { q: 'Dal bottone devo aprire tutte le mani?', a: 'Quasi mai tutte, ma molte più di quante ne apriresti a tre giocatori. La quota non si muove in una direzione sola mentre lo stack cala: quando l\'apertura diventa un all-in la selezione si stringe rispetto a un rilancio minimo, e torna ad allargarsi solo quando lo stack è davvero minimo. È il caso tipico in cui conviene leggere il nodo giusto invece di andare a sensazione.' },
      { q: 'L\'ICM conta nell\'heads-up?', a: 'Nei tornei winner-takes-all no: in due i gettoni valgono in proporzione al montepremi, quindi una decisione neutra in gettoni lo è anche in denaro. Quando invece il moltiplicatore estratto paga più di un posto, il secondo posto ha un valore suo e le mani per tutto lo stack smettono di essere neutre: rischiare per raddoppiare costa un po\' più di quanto rende.' },
      { q: 'Come capisco se l\'avversario passa troppo dal grande buio?', a: 'Guardando cosa succede dopo i tuoi rilanci, su un numero di mani che non sia tre. Un paio di fold non dicono niente, una sequenza continua di piatti vinti senza vedere il flop sì. Nel dubbio la mossa meno costosa è aprire un po\' più largo e osservare: se l\'avversario reagisce, torni indietro subito.' },
      { q: 'Meglio limpare o rilanciare dal bottone?', a: 'Entrambe le linee esistono nelle soluzioni, e alcune varianti del formato tolgono del tutto il limp. Limpare con un range largo richiede un piano contro il rilancio del grande buio, che in due arriva spesso; sotto una certa profondità la domanda sparisce da sola, perché restano solo l\'all-in e il fold.' },
      { q: 'Quanto postflop serve sapere per questa fase?', a: 'Meno di quanto sembri all\'inizio, più di zero. A stack corti buona parte dei piatti si chiude prima del flop, quindi la priorità è avere range coerenti preflop. Quando invece l\'heads-up comincia con stack ancora giocabili, saper condurre i flop fuori posizione è proprio ciò che rende sostenibile difendere largo dal grande buio.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'push-fold-spin-and-go',
      'perche-il-3max-hyper-turbo-si-decide-preflop',
      'come-giocare-spin-and-go',
    ],
  },
  {
    slug: 'perche-il-3max-hyper-turbo-si-decide-preflop',
    titolo: '3-max hyper turbo: perché si decide prima del flop',
    descrizione: 'Con 25 big blind e livelli rapidi quasi tutte le mani finiscono prima del flop: cosa cambia nel modo di studiare e perché il preflop si impara davvero.',
    occhiello: 'Struttura del formato',
    h1: 'Perché il 3-max hyper turbo si decide quasi sempre prima del flop',
    lead: 'Una mano di 3-max hyper turbo comincia con 25 big blind e livelli che salgono ogni pochi minuti. Con quella struttura le decisioni postflop sono poche per torneo, e quelle che restano arrivano con gran parte dei soldi già in mezzo. La parte che sposta i risultati è quindi un insieme finito di situazioni preflop, e un insieme finito si può imparare fino in fondo.',
    aggiornata: '2026-08-16',
    sezioni: [
      {
        h2: 'Venticinque big blind si consumano in fretta',
        paragrafi: [
          'Lo stack iniziale è di 25 big blind per tutti e tre i giocatori. Sembra un margine ragionevole finché non conti quanto costa una mano giocata in modo normale: fra apertura e rilancio buona parte dello stack è già in mezzo, e dietro ne resta troppo poco per tre strade di puntata. La profondità con cui prendi la decisione vera è quasi sempre inferiore a quella che leggi sul tavolo.',
          'Poi ci sono i livelli. In una struttura hyper turbo i bui salgono ogni pochi minuti, quindi il tuo stack misurato in big blind scende anche nelle mani che non giochi. Dove il formato prevede l\'ante, la discesa è più rapida ancora: paghi qualcosa a ogni giro e il piatto iniziale è più grande in rapporto agli stack, il che spinge tutti a entrare più spesso.',
          'Il passaggio dalla profondità iniziale a stack da push-fold non richiede molte mani. È la ragione per cui la parte più lunga di un torneo si gioca in una fascia dove le opzioni sono tre: rilanciare, andare all-in, passare.',
        ],
      },
      {
        h2: 'La maggior parte delle mani non arriva mai al flop',
        paragrafi: [
          'In tre giocatori, con bui che pesano rispetto agli stack, l\'azione preflop è già una decisione sulla taglia del piatto. Due giocatori passano e la mano finisce lì; oppure entra un all-in preflop e flop, turn e river si girano senza che nessuno debba decidere altro. In entrambi i casi la mano si è chiusa prima che ci fosse una board da leggere.',
          'Quando il flop lo vedi, spesso ti resta poco rispetto al piatto. La decisione c\'è ancora, ma il ventaglio è stretto: con quel rapporto fra piatto e stack le linee possibili sono poche e la scelta giusta è meno sensibile alle sfumature della texture. Non è che il postflop sia irrilevante, è che pesa meno per mano e capita in una minoranza di mani.',
          'Vale la pena essere precisi su cosa significa «si decide preflop»: non che il postflop non esista, ma che un errore preflop torna ogni volta che quello spot si ripresenta, cioè di continuo, mentre un errore postflop capita di rado e per importi più piccoli, perché buona parte dei soldi era già stata impegnata prima.',
        ],
      },
      {
        h2: 'Un albero di decisioni che si chiude invece di aprirsi',
        paragrafi: [
          'Le mani di partenza sono 169 e non cambiano mai. Le posizioni al tavolo sono tre. Le sequenze di azione preflop che si presentano davvero, a queste profondità, sono un numero finito e piuttosto piccolo: chi apre per primo, cosa fa chi parla dopo, come si risponde a un rilancio. Ogni combinazione di questi elementi è uno spot, e gli spot si contano.',
          'In un formato profondo succede il contrario. Il preflop apre la mano e poco altro: i soldi si spostano su tre strade successive, con più taglie possibili a ogni giro, moltiplicate per tutte le board che possono uscire. Quell\'albero non si memorizza: si impara a percorrere con un ragionamento costruito mano per mano, per anni.',
          'È una differenza di natura, non di difficoltà. Giocare bene 25 big blind in tre non è banale: le frequenze corrette sono spesso controintuitive e nessuno le indovina a occhio. Ma sono un insieme chiuso di risposte, e un insieme chiuso si può studiare fino a saperlo.',
        ],
        lista: [
          'le 169 mani di partenza, sempre le stesse',
          'tre posizioni soltanto: bottone, piccolo buio, grande buio',
          'poche profondità davvero rilevanti, perché lo stack scende in fretta verso il push-fold',
          'un numero limitato di sequenze, dato che dopo due rilanci gli stack sono già dentro',
        ],
      },
      {
        h2: 'Perché qui la memoria rende più che altrove',
        paragrafi: [
          'Se lo stesso spot ti si ripresenta molte volte in una sessione, conoscere a memoria la risposta migliore ti fa incassare quel piccolo margine ogni volta. In un formato dove ogni mano prende una piega diversa, la stessa ora di studio si spalma su situazioni che magari non rivedi per settimane.',
          'C\'è anche un effetto sul tempo di decisione. Hyper turbo vuol dire timer corti: se ricostruisci il ragionamento da zero a ogni mano, il tempo lo spendi lì e non su ciò che ha davvero informazione, cioè come stanno giocando gli altri due.',
          'Attenzione a non rovesciare il senso della cosa: la memoria non sostituisce la comprensione. Sapere che una mano si difende contro un all-in da 12 big blind ma non contro uno da 20 serve poco se non sai perché. Appena l\'avversario si comporta in modo diverso dal riferimento, senza il perché resti senza appigli.',
        ],
      },
      {
        h2: 'Come si traduce in un piano di studio',
        paragrafi: [
          'L\'ordine sensato è per frequenza: prima gli spot che incontri più spesso, poi quelli rari. Vuol dire cominciare dalle situazioni a stack corto, dove le opzioni sono all-in o passa e un errore è netto e verificabile, e salire dopo verso le profondità iniziali, dove le decisioni sono più articolate ma capitano meno volte per torneo.',
          'La revisione delle mani conta più di quanto sembri, perché la sensazione di cosa si sbaglia è quasi sempre falsa: restano in mente le mani perse in modo doloroso, non quelle giocate male, e un fold sbagliato non lascia alcun ricordo. Guardare le proprie mani con l\'albero delle azioni accanto è il modo più rapido per accorgersi che l\'errore stava due decisioni prima.',
        ],
        lista: [
          'gli spot di push-fold, i più frequenti e i più facili da controllare',
          'l\'apertura da bottone e le risposte dei due bui alla profondità iniziale',
          'cosa cambia quando uno dei tre esce e resta l\'heads-up',
          'i moltiplicatori che pagano più di un posto, dove le fiche smettono di valere in modo lineare',
        ],
      },
      {
        h2: 'Perché funziona per chi ha poche ore',
        paragrafi: [
          'Un torneo si chiude in fretta, quindi anche una finestra di tempo breve ne contiene un numero ragionevole e ti rimette davanti gli stessi spot molte volte. Chi gioca due sere a settimana ottiene comunque ripetizione, che è la condizione perché lo studio diventi automatismo invece che nozione.',
          'Il rovescio è che la ripetizione riguarda anche gli errori. Se il tuo riferimento preflop è sbagliato o approssimativo, lo applichi centinaia di volte prima di accorgertene, e nessun risultato di breve periodo te lo segnalerà: il montepremi a moltiplicatore fa oscillare i risultati molto più di quanto oscilli la qualità del tuo gioco.',
          'Va detto senza giri di parole: giocare con vincite in denaro comporta un rischio economico reale, e il rake, nell\'ordine del 7-10% a seconda del buy-in, è una sottrazione costante dal montepremi. Studiare migliora le decisioni che prendi; non garantisce risultati, e nessuno può prometterteli.',
        ],
      },
      {
        h2: 'Dove il preflop imparato smette di bastare',
        paragrafi: [
          'Un riferimento preflop è costruito contro avversari equilibrati. Al tavolo capita spesso l\'opposto: c\'è chi non va mai all-in senza una mano forte e chi ci va con qualsiasi cosa. Contro il primo passi mani che il riferimento difenderebbe, contro il secondo ne difendi molte di più. Capire quale dei due hai davanti è il lavoro che nessuna tabella fa al posto tuo.',
          'Poi c\'è il moltiplicatore estratto a inizio torneo. Nella grande maggioranza dei casi il montepremi va tutto al primo: le fiche valgono in modo lineare e non c\'è niente da correggere. Sui moltiplicatori alti, che escono di rado, il premio si divide fra i tre giocatori, e su uno intermedio può pagare due posti: lì conservare lo stack acquista un valore proprio e qualche spinta marginale smette di convenire. È una correzione che riguarda pochi tornei, non un filtro da applicare sempre.',
          'Nei formati asimmetrici uno dei due bui parte con uno stack più corto: le tre coppie di giocatori hanno profondità effettive diverse e i riferimenti si spostano. Anche la sala dove giochi fa la sua parte, perché cambiano i moltiplicatori disponibili, il rake e la soglia oltre la quale il montepremi si divide fra più posti. Il ragionamento resta lo stesso, i numeri esatti no: conviene verificarli sul formato che giochi davvero invece di importarli da un video girato su un\'altra struttura.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle GTO preflop', href: '/tabelle/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le lezioni video della scuola', href: '/lezioni/' },
    ],
    faq: [
      { q: 'Vuol dire che il postflop non serve studiarlo?', a: 'Vuol dire che è la seconda cosa, non la prima. Le mani che arrivano al flop sono una minoranza, e spesso ci arrivi con poco stack rispetto al piatto, il che riduce le linee sensate. Quando il preflop è solido, allora sì: le mani giocate su più strade diventano il posto dove trovi il margine successivo.' },
      { q: 'Quanto tempo serve per imparare il preflop?', a: 'Non c\'è un numero unico e dipende da come studi. Chi lavora per spot, verificando le proprie mani dopo la sessione, arriva prima di chi prova a mandare a memoria tutto insieme. Conta anche quanto giochi, perché la memoria si fissa con la ripetizione al tavolo e non con la lettura. Il segnale di avanzamento è che decidi senza consultare nulla.' },
      { q: 'L\'ICM pesa come negli altri tornei?', a: 'Meno di quanto si racconta. Nella grande maggioranza dei tornei il montepremi va tutto al vincitore, e lì le fiche valgono in modo lineare: non c\'è alcuna correzione da fare. Entra sui moltiplicatori che pagano più di un posto, dove uscire terzi e uscire secondi non sono la stessa cosa. Riconoscere quel caso conta più che applicare la logica ovunque.' },
      { q: 'Se conosco il preflop a memoria vinco?', a: 'No. Conoscerlo elimina gli errori sistematici, cioè la parte su cui hai controllo. Sul risultato di breve periodo pesano molto di più il moltiplicatore estratto e la varianza del formato, e il rake sottrae una quota costante dal montepremi a ogni torneo. Giocare con vincite in denaro resta un\'attività con rischio economico reale.' },
      { q: 'I riferimenti valgono anche sui formati asimmetrici?', a: 'In parte. La logica è la stessa, i punti di riferimento no: se uno dei bui parte con uno stack più corto, le tre coppie di giocatori hanno profondità effettive diverse e le mani che si spingono cambiano di conseguenza. Conviene guardare l\'albero per quella combinazione di stack invece di adattare a occhio quello simmetrico.' },
      { q: 'Mi serve un solver per studiare questo formato?', a: 'Non per cominciare. Il preflop a queste profondità è già risolto e consultabile: ti serve un albero navigabile con frequenze ed EV per ogni mano, non una macchina da far girare. Un solver diventa utile più avanti, quando vuoi vedere come cambia una risposta al variare di un\'ipotesi. Prima aggiunge lavoro senza aggiungere decisioni migliori.' },
    ],
    correlate: [
      'strategia-spin-and-go',
      'push-fold-spin-and-go',
      'come-giocare-spin-and-go',
      'icm-spin-and-go',
    ],
  },
  // ⚠️ Query confermata il 19/09/2026 con l'autocompletamento di Google:
  // `spin and go rake`, `rake spin and go`, `spin n go rake`, `spin and go max
  // rake`, `twister poker rake`. Nessuna pagina del sito la trattava, e il rake
  // e' il costo che decide se il conto sta in piedi.
  // ⚠️ Il paragrafo sul rakeback resta CONCETTUALE: niente nomi di sala, niente
  // inviti, nessun collegamento a /affiliazioni — che e' noindex proprio per
  // l'art. 9 DL 87/2018. Descrivere che cosa sia una restituzione di rake e'
  // didattica; proporla e' pubblicita'.
  {
    slug: 'rake-spin-and-go',
    titolo: 'Il rake negli Spin & Go: quanto pesa davvero',
    descrizione:
      'Quanto costa davvero il rake negli Spin & Go e nei Twister: dove si nasconde, perché una percentuale piccola diventa un numero grande e come tenerne conto.',
    occhiello: 'Costi e struttura',
    h1: 'Il rake negli Spin & Go: quanto pesa, e perché non si vede',
    lead: 'Il rake è il costo del servizio: la parte del tuo iscrizione che non finisce nel montepremi. In un torneo lampo non compare da nessuna parte come voce separata — paghi una cifra tonda e cominci a giocare — e proprio per questo è la spesa che quasi nessuno mette nel conto quando valuta se sta andando bene. Su un formato dove si gioca a volume, è anche la differenza fra un vantaggio reale e un pareggio.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'Dove si nasconde il rake in un torneo che dura sei minuti',
        paragrafi: [
          'In un torneo l\'iscrizione è divisa in due parti: una entra nel montepremi, l\'altra resta a chi organizza. Nei tavoli tradizionali la divisione è scritta accanto al nome del torneo; negli Spin & Go e nei Twister l\'iscrizione è una cifra sola, il moltiplicatore viene estratto dopo, e la separazione non la vedi mai.',
          'L\'ordine di grandezza è il sette-dieci per cento dell\'iscrizione, e in genere cala man mano che si sale di livello: più alto è il buy-in, più bassa è la percentuale trattenuta. È una differenza che conta, perché è una percentuale applicata a ogni singolo torneo giocato, non una tantum.',
          'La conseguenza pratica è che il rake si paga sempre: quando vinci, quando arrivi secondo, quando esci alla prima mano. Non dipende dal risultato, dipende dal fatto che ti sei seduto. È l\'unico costo del gioco con questa caratteristica, ed è il motivo per cui va guardato in rapporto al volume e non al singolo torneo.',
        ],
      },
      {
        h2: 'Perché una percentuale piccola diventa un numero grande',
        paragrafi: [
          'Il sette per cento sembra poco finché si guarda un torneo. Il punto è che in questo formato un torneo dura pochi minuti, e chi gioca sul serio ne fa centinaia al mese, spesso su più tavoli insieme. Moltiplica la percentuale per il numero di iscrizioni e ottieni una cifra che in molti casi è più grande del risultato netto della stagione.',
          'C\'è un modo semplice per farsi un\'idea senza calcoli complicati: prendi quanti tornei hai giocato nell\'ultimo mese, moltiplica per l\'iscrizione, e prendine circa un decimo. Quella è la cifra che hai pagato per sedere al tavolo. Per molti giocatori è la prima volta che la vedono scritta, e cambia il modo in cui leggono i propri risultati.',
          'È anche il motivo per cui la scelta del livello a cui giocare non è solo una questione di bankroll. Salire di buy-in, dove la percentuale trattenuta è più bassa, riduce il costo relativo; ma alza anche la durezza del campo, e le due cose vanno pesate insieme, non una alla volta.',
        ],
      },
      {
        h2: 'Il rake mangia il vantaggio, non la varianza',
        paragrafi: [
          'È una distinzione che sembra accademica e non lo è. La varianza descrive quanto i risultati oscillano attorno alla media; il rake sposta la media verso il basso senza toccare l\'ampiezza dell\'oscillazione. Detto altrimenti: le curve restano larghe uguale, ma partono più in basso.',
          'Da qui discendono due conseguenze concrete. La prima è che il punto in cui vai in pari arriva più tardi, quindi serve un campione più lungo prima che i numeri dicano qualcosa di te. La seconda è che il fondo che ti serve si allarga, perché passi più tempo sotto zero prima che il vantaggio si manifesti.',
          'Quando provi a stimare i tuoi risultati con un simulatore, questo è l\'errore più comune: inserire un vantaggio calcolato al lordo. La curva che ne esce è più ottimistica di quella vera, e lo è in modo sistematico — non in modo casuale — quindi non si corregge da sola guardando più a lungo.',
        ],
      },
      {
        h2: 'Confrontare il rake fra due strutture senza prendersi in giro',
        paragrafi: [
          'La percentuale da sola non basta a dire dove conviene giocare. Due tavoli con lo stesso rake possono avere scale di moltiplicatori diverse, e la scala decide quanta parte del montepremi finisce negli eventi rari che quasi non vedrai mai. A parità di costo, una distribuzione più concentrata sui moltiplicatori bassi rende i risultati più leggibili; una più estrema li rende più rumorosi.',
          'Conta anche la soglia oltre cui il montepremi si divide fra più posti invece di andare tutto al primo, perché cambia la forma dei risultati e non solo la loro media. E contano le condizioni pratiche: quanti tavoli sono realmente popolati alla tua ora, quanto aspetti per iniziare, quanto è duro chi trovi.',
          'Il confronto onesto, allora, non è «dove il rake è più basso» ma «dove il conto complessivo funziona meglio per come gioco io». È una domanda con più variabili, e conviene rispondere guardandole insieme invece di ottimizzarne una e scoprire dopo che se ne è rotta un\'altra.',
        ],
      },
      {
        h2: 'Le restituzioni di rake, lette per quello che sono',
        paragrafi: [
          'Esistono meccanismi che restituiscono una parte del rake pagato, sotto forme diverse: programmi a punti, livelli di fedeltà, accordi di varia natura. Sul piano dei conti sono tutti la stessa cosa — una riduzione del costo — e vanno letti così: non sono un guadagno, sono uno sconto su una spesa che hai già sostenuto.',
          'La distinzione non è pedanteria. Un giocatore che pareggia e riceve indietro una parte del rake non sta guadagnando: sta perdendo meno. Trattare quella cifra come un risultato positivo è il modo più rapido per non accorgersi che il gioco, da solo, non sta funzionando — e per continuare a giocarlo più a lungo di quanto converrebbe.',
          'Il modo utile di usarla è un altro: sottrarla dal costo per ottenere il rake effettivo, e poi rifare i conti con quel numero. Se con il rake effettivo il vantaggio resta positivo, la restituzione ha reso più solida una situazione già sana. Se il vantaggio diventa positivo solo grazie a quella, il gioco non sta pagando: sta pagando lo sconto.',
        ],
      },
      {
        h2: 'Che cosa farne, in pratica',
        paragrafi: [
          'Tre cose, tutte a costo zero. La prima: calcola una volta quanto rake hai pagato nell\'ultimo mese, con la stima grezza di poco fa. Non serve precisione al centesimo, serve l\'ordine di grandezza, e di solito è sufficiente a cambiare qualche decisione.',
          'La seconda: quando stimi i risultati futuri, usa un vantaggio già al netto. La terza: considera il rake come uno dei criteri con cui scegli il livello a cui giochi, insieme al fondo che hai e alla durezza del campo — non come l\'unico, e non come l\'ultimo.',
          'Resta una cosa che nessun conto sul rake può fare: renderti un giocatore migliore. Il costo si ottimizza una volta e poi è fermo; il vantaggio si costruisce sulle decisioni che ripeti centinaia di volte, ed è la parte su cui puoi ancora lavorare quando sul resto non c\'è più niente da limare.',
        ],
      },
    ],
    strumenti: [
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le tabelle preflop', href: '/tabelle/' },
      { testo: 'gli esercizi di allenamento', href: '/allenamento/' },
    ],
    faq: [
      {
        q: 'Quanto rake si paga su uno Spin & Go?',
        a: 'L\'ordine di grandezza è il sette-dieci per cento dell\'iscrizione, e in genere la percentuale cala salendo di buy-in. Non compare come voce separata: paghi una cifra tonda e la divisione fra montepremi e commissione avviene dietro le quinte. La cifra esatta è pubblicata da chi organizza il tavolo dove giochi, ed è il primo numero da cercare prima di scegliere dove giocare a volume.',
      },
      {
        q: 'Il rake si paga anche se perdo?',
        a: 'Sì, e non è un dettaglio: è la caratteristica che lo distingue da ogni altro costo. Si paga al momento dell\'iscrizione, quindi vale identico se vinci il torneo, se arrivi secondo o se esci alla prima mano. Per questo va valutato sul volume totale di tornei giocati e non sul risultato di una sessione.',
      },
      {
        q: 'Il rake aumenta la varianza?',
        a: 'No: sposta la media verso il basso senza cambiare quanto i risultati oscillano attorno a essa. L\'effetto pratico è che il punto di pareggio arriva più tardi e il fondo necessario si allarga, perché resti sotto zero più a lungo prima che il vantaggio si veda. Simulare con un vantaggio al lordo del rake dà una curva sistematicamente più ottimistica di quella vera.',
      },
      {
        q: 'Conviene salire di buy-in per pagare meno rake?',
        a: 'Solo se il resto regge. La percentuale trattenuta in genere cala salendo, quindi il costo relativo scende; ma sale anche la durezza del campo, e un vantaggio più piccolo su un costo più basso può valere meno di quello che avevi prima. Sono due effetti di segno opposto e vanno pesati insieme, insieme al fondo di cui disponi.',
      },
      {
        q: 'Una restituzione di rake mi rende un giocatore vincente?',
        a: 'No: riduce una spesa, non produce un risultato. Il modo corretto di usarla è sottrarla dal costo per ottenere il rake effettivo e poi rifare i conti con quel numero. Se il vantaggio resta positivo, hai reso più solida una situazione già sana; se diventa positivo solo grazie a quella, il gioco in sé non sta pagando.',
      },
      {
        q: 'Il rake dei Twister è uguale a quello degli Spin & Go?',
        a: 'La struttura è la stessa — una percentuale dell\'iscrizione trattenuta da chi organizza — ma il valore preciso, la scala dei moltiplicatori e la soglia oltre cui il montepremi si divide fra più posti cambiano da un operatore all\'altro. Confrontarli guardando solo la percentuale è fuorviante: vanno guardati insieme, perché incidono sullo stesso conto.',
      },
    ],
    correlate: [
      'strategia-spin-and-go',
      'bankroll-spin-and-go',
      'varianza-spin-and-go',
      'spin-and-go-vs-twister',
    ],
  },
  // ⚠️ Query confermata il 19/09/2026: `spin and go hud`, `spin and go hud pt4`,
  // `spin and go hud hand2note`, `spin and go tracker`, `spin and go hand
  // history`. Questa guida e' anche l'unico ingresso editoriale verso /docs
  // (che ospita i filtri e i report PT4 e non era linkato da nessuna pagina di
  // contenuto) e verso /replayer.
  // ⚠️ Sugli strumenti in tempo reale la guida NON dice «usali»: dice di
  // verificare il regolamento di dove si gioca. Molte sale li limitano o li
  // vietano su questo formato, e una guida che lo tacesse manderebbe qualcuno
  // a violare un regolamento per un vantaggio che qui e' quasi nullo.
  {
    slug: 'tracker-hud-spin-and-go',
    titolo: 'Tracker e HUD negli Spin & Go: cosa serve davvero',
    descrizione:
      'HUD dal vivo, tracker e revisione delle mani negli Spin & Go: dove il software aiuta davvero, dove non serve a niente e cosa guardare dopo la sessione.',
    occhiello: 'Strumenti di studio',
    h1: 'Tracker e HUD negli Spin & Go: cosa serve davvero, e cosa no',
    lead: 'La domanda arriva sempre nella stessa forma: «quale HUD uso per gli Spin & Go?». È la domanda sbagliata, e non per una questione di gusti. In un formato dove incroci un avversario per venti mani e poi non lo rivedi più, le statistiche in tempo reale dicono pochissimo; quello che sposta i risultati è il lavoro che fai dopo, sulle tue mani, con calma. Questa guida separa le due cose.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'Perché un HUD dal vivo qui serve meno che altrove',
        paragrafi: [
          'Una statistica ha senso quando è costruita su abbastanza mani da essere stabile. In un cash game si siede allo stesso tavolo per ore e si accumulano centinaia di mani sullo stesso avversario; qui un torneo dura pochi minuti, gli avversari cambiano a ogni tavolo e il campione su ciascuno resta minuscolo.',
          'Su venti o trenta mani una percentuale di apertura non è un\'informazione, è rumore: può valere il doppio o la metà del valore vero per puro caso. Decidere una spinta al limite sulla base di quel numero non è giocare informati — è dare un peso preciso a una misura imprecisa, che è un modo elegante di sbagliare.',
          'Va aggiunta una cosa che riguarda le regole e non la strategia: molte sale limitano o vietano gli strumenti che leggono il tavolo in tempo reale, e su questo formato in particolare. Prima di installare qualunque cosa, il regolamento di dove giochi è il primo posto da guardare — un vantaggio quasi nullo non vale il rischio di un conto chiuso.',
        ],
      },
      {
        h2: 'Dove un tracker serve davvero: la revisione, non la partita',
        paragrafi: [
          'Lo stesso software che dal vivo dice poco diventa prezioso quando la sessione è finita. Lì il campione non è più quello di un avversario in venti mani: è il tuo, su migliaia di mani, ed è abbastanza grande da raccontare qualcosa di vero.',
          'Il valore sta nel filtrare. Non «quanto ho vinto», che lo sai già, ma: quante volte mi sono trovato nel piccolo buio contro un\'apertura dal bottone a dieci big blind, e cosa ho fatto ogni volta. È una domanda a cui a memoria non si risponde, e a cui un filtro risponde in pochi secondi.',
          'È anche il modo in cui si scoprono gli errori che costano davvero, che non sono quelli clamorosi. Un errore che fai una volta a sessione e ti costa tre big blind si nota subito; uno che fai in una situazione che si ripresenta ottanta volte al giorno, e che ti costa un decimo di big blind per volta, non lo vedi mai — e pesa molto di più.',
        ],
      },
      {
        h2: 'Le tre domande a cui far rispondere il tracker',
        paragrafi: [
          'Un tracker aperto senza una domanda è una schermata di numeri che non cambia niente. Con una domanda diventa uno strumento. Queste tre bastano per i primi mesi, e si rispondono tutte con dei filtri.',
        ],
        lista: [
          'Quali situazioni si ripresentano più spesso? Sono quelle che valgono la pena di studiare per prime, indipendentemente da quanto sembrano interessanti.',
          'In quelle situazioni, cosa faccio davvero? Non cosa penso di fare: la differenza fra le due è il grosso di quello che c\'è da correggere.',
          'Il mio campione è abbastanza grande perché il risultato voglia dire qualcosa? Se la risposta è no, la cosa utile non è cambiare strategia ma continuare a misurare.',
        ],
      },
      {
        h2: 'Rivedere una mano, non una statistica',
        paragrafi: [
          'C\'è un livello che nessun aggregato raggiunge: rivedere una singola mano dall\'inizio, con gli stack veri e le azioni nell\'ordine in cui sono avvenute. Le statistiche dicono che in una certa situazione fai una certa cosa troppo spesso; solo rivedendo le mani si capisce perché la fai.',
          'È anche il modo in cui una mano diventa una domanda da portare a qualcun altro. «Perdo troppo dal piccolo buio» non è una domanda a cui si possa rispondere; questa mano, con questi stack, con questa sequenza, lo è — e la risposta vale anche per le prossime cinquanta volte che la situazione si ripresenta.',
          'Su questo sito le mani si caricano ed è possibile rivederle passo per passo, con il piatto e gli stack ricalcolati a ogni azione. Non serve un abbonamento e i file sono quelli che il tuo software salva già da solo.',
        ],
      },
      {
        h2: 'Che cosa un tracker non può dirti',
        paragrafi: [
          'Non può dirti se sei un giocatore vincente. Può dirti quanto hai vinto o perso finora, che è un\'altra cosa: in un formato con questa varianza, un risultato positivo o negativo su qualche migliaio di tornei è compatibile con molti livelli di bravura diversi. Serve un campione grande, e nel frattempo il numero va letto con prudenza.',
          'Non può dirti che cosa fare. Un filtro mostra che in una certa situazione passi il settanta per cento delle volte; se quel settanta sia troppo, troppo poco o giusto, lo dice la strategia di riferimento per quel nodo — non il tracker, che registra e basta.',
          'E non può distinguere una serie sfortunata da un errore, quando il campione è corto. È esattamente per questo che ha senso affiancargli due cose: una tabella di riferimento con cui confrontare le proprie scelte, e un\'idea concreta di quanto possa essere lunga una serie negativa del tutto normale.',
        ],
      },
      {
        h2: 'Da dove cominciare, senza comprare niente',
        paragrafi: [
          'Il primo passo non è scegliere il software: è decidere la domanda. Prendi la situazione che ti capita più spesso e che ti lascia più insicuro — nella maggior parte dei casi è la difesa da uno dei due bui a stack corto — e guarda cosa fai, contro cosa dice la tabella di riferimento per quel nodo.',
          'Il secondo è prendere l\'abitudine di salvare e rivedere le mani che ti hanno lasciato un dubbio, invece di archiviarle. Cinque mani riviste con attenzione insegnano più di cinquecento giocate distrattamente, ed è l\'unico esercizio che funziona anche se il tuo volume è piccolo.',
          'Il terzo, se usi già un tracker, è smettere di guardare la schermata dei risultati e cominciare a usare i filtri. I materiali di supporto della scuola comprendono filtri e report pronti per questo formato: servono a saltare la parte noiosa, che è configurare lo strumento, e ad arrivare subito alla parte utile.',
        ],
      },
    ],
    strumenti: [
      { testo: 'i materiali e i filtri da scaricare', href: '/docs/' },
      { testo: 'il replayer delle mani', href: '/replayer/' },
      { testo: 'le tabelle preflop', href: '/tabelle/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
    ],
    faq: [
      {
        q: 'Serve un HUD per giocare gli Spin & Go?',
        a: 'No, e in questo formato serve meno che in qualunque altro: incroci un avversario per venti o trenta mani, e su quel campione una statistica è rumore più che informazione. Va aggiunto che molte sale limitano o vietano gli strumenti in tempo reale proprio su questo formato: il regolamento di dove giochi è il primo posto da controllare, prima di installare qualsiasi cosa.',
      },
      {
        q: 'Allora un tracker non serve a niente?',
        a: 'Serve moltissimo, ma dopo la sessione e non durante. Lì il campione non è quello di un avversario sconosciuto: è il tuo, su migliaia di mani, ed è abbastanza grande da dire qualcosa di vero. Il valore sta nel filtrare per situazione e vedere cosa fai davvero quando quella situazione si ripresenta, che è una domanda a cui a memoria non si risponde.',
      },
      {
        q: 'Quali errori si scoprono con la revisione e non giocando?',
        a: 'Quelli piccoli e ripetuti, che sono i più costosi. Un errore clamoroso si nota da solo; uno che fai in una situazione che torna ottanta volte al giorno, e che costa un decimo di big blind per volta, non si vede mai al tavolo e pesa molto di più sul risultato finale. È il tipo di cosa che solo un filtro su un campione grande porta a galla.',
      },
      {
        q: 'Il tracker può dirmi se sono un giocatore vincente?',
        a: 'Può dirti quanto hai vinto o perso finora, che non è la stessa cosa. In un formato con questa varianza un risultato su qualche migliaio di tornei è compatibile con livelli di bravura molto diversi. Prima di trattare quel numero come un giudizio conviene capire quanto grande debba essere il campione, e un simulatore di varianza serve esattamente a questo.',
      },
      {
        q: 'Da dove comincio se non ho mai usato un tracker?',
        a: 'Non dal software ma dalla domanda: prendi la situazione che ti capita più spesso e che ti lascia più insicuro, di solito la difesa da un buio a stack corto, e confronta cosa fai con la strategia di riferimento per quel nodo. Poi prendi l\'abitudine di rivedere le mani dubbie invece di archiviarle: cinque mani riviste con attenzione insegnano più di cinquecento giocate distrattamente.',
      },
      {
        q: 'Servono file di configurazione particolari per questo formato?',
        a: 'I filtri e i report generici sono pensati per cash game e tornei lunghi, quindi su un 3-max hyper turbo mostrano spesso le cose sbagliate o non trovano abbastanza mani. Avere filtri già tarati sul formato fa risparmiare la parte noiosa, che è configurare lo strumento: nella sezione materiali della scuola ce ne sono di pronti da scaricare.',
      },
    ],
    correlate: [
      'strategia-spin-and-go',
      'errori-comuni-spin-and-go',
      'varianza-spin-and-go',
      'push-fold-spin-and-go',
    ],
  },
  // ⚠️⚠️ QUESTA GUIDA E' LA PIU' ESPOSTA DEL SITO SUL PIANO LEGALE, e va letta
  // prima di toccarla. Query confermata (`twister poker truccato`), intento
  // emotivo, quasi nessuna fonte seria a rispondere. Pubblicata il 19/09/2026
  // su decisione esplicita dell'owner, con quattro paletti che NON sono stile:
  //   1. nessun nome di sala, di rete o di operatore, in nessuna forma;
  //   2. nessun invito a giocare, nessuna promessa, nessun «conviene»;
  //   3. il rischio economico dichiarato dentro il testo, non in una nota;
  //   4. il taglio e' probabilistico e psicologico — perche' SEMBRA truccato —
  //      e mai una difesa di qualcuno: non si scrive che un operatore e'
  //      affidabile, si scrive come funziona una distribuzione asimmetrica.
  // Spostare uno di questi quattro significa riaprire la valutazione art. 9
  // DL 87/2018, non «ritoccare il tono».
  {
    slug: 'spin-and-go-truccati',
    titolo: 'Gli Spin & Go sono truccati? Cosa dicono i numeri',
    descrizione:
      'Perché gli Spin & Go e i Twister sembrano truccati: la distribuzione dei moltiplicatori, la memoria selettiva e come controllare il proprio campione.',
    occhiello: 'Domande ricorrenti',
    h1: 'Gli Spin & Go e i Twister sono truccati? Cosa dicono i numeri',
    lead: 'È la domanda che torna in ogni forum e in ogni chat, quasi sempre dopo una serie negativa: il moltiplicatore alto non arriva mai, gli avversari sembrano trovare sempre la carta giusta, il conto scende. Vale la pena prendere la domanda sul serio invece di liquidarla, perché la sensazione è reale anche quando la spiegazione non è quella che sembra. Questa pagina separa le tre cose che di solito vengono chiamate con la stessa parola.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'Tre cose diverse chiamate con la stessa parola',
        paragrafi: [
          'Quando si dice «è truccato» si intendono, in genere, tre cose molto diverse fra loro, e confonderle è il motivo per cui la discussione non porta mai da nessuna parte.',
          'La prima è la manipolazione vera: un\'estrazione o una distribuzione di carte alterata contro un giocatore preciso. La seconda è una struttura sfavorevole ma dichiarata: scale di moltiplicatori, soglie, commissioni — condizioni pubblicate che quasi nessuno legge prima di sedersi e che spiegano da sole gran parte dei risultati. La terza è la varianza, cioè il fatto che una serie negativa lunghissima è normale in un formato con questa struttura.',
          'Delle tre, solo la prima sarebbe un imbroglio. Le altre due sono il gioco così com\'è scritto, e sono anche le due che producono quasi tutte le sensazioni da cui nasce il sospetto. Vale la pena guardarle in quest\'ordine, perché la seconda e la terza si possono verificare da soli.',
        ],
      },
      {
        h2: 'Perché il moltiplicatore alto sembra non arrivare mai',
        paragrafi: [
          'Il montepremi viene estratto prima della prima mano, e la distribuzione delle estrazioni è fortemente asimmetrica: i moltiplicatori bassi escono quasi sempre, quelli altissimi sono rari in modo che l\'intuito fatica a rappresentarsi. Non è un difetto del sistema, è il modo in cui il formato è costruito — e la scala precisa è pubblicata da chi organizza il tavolo.',
          'La conseguenza è contro-intuitiva e vale la pena scriverla chiaramente: un giocatore può giocare per anni, a volume alto, e non vedere mai il moltiplicatore massimo. Non perché sia sfortunato, ma perché con quelle probabilità il risultato più probabile, per la maggior parte delle persone, è proprio non vederlo mai. La media del formato è tirata su da un evento che quasi nessuno sperimenta.',
          'Da qui nasce metà della sensazione di essere presi in giro. Ci si aspetta, senza dirlo esplicitamente, che il proprio campione somigli alla media pubblicizzata; ma in una distribuzione così sbilanciata la media non descrive quasi nessuno. Quello che descrive la maggior parte delle persone è la mediana, che è molto più bassa — e nessuno la mette in vetrina.',
        ],
      },
      {
        h2: 'La memoria non è una prova, ed è costruita male apposta',
        paragrafi: [
          'La seconda metà della sensazione è il modo in cui ricordiamo. Le mani perse in modo doloroso — lo sfavorito che trova la carta al river, il piatto grosso scivolato via — si fissano; le decine di volte in cui la stessa situazione è andata come doveva non lasciano traccia. È un meccanismo noto e non ha nulla a che vedere col poker: vale per qualunque sequenza di eventi in cui alcuni esiti fanno male e altri no.',
          'Su un formato dove si giocano centinaia di tornei al mese, l\'effetto è amplificato. Un evento che capita una volta su venti si presenta comunque decine di volte in una settimana di volume: abbastanza spesso da sembrare sistematico, mai abbastanza da esserlo davvero. E siccome le volte «normali» non si contano, il rapporto che si ha in testa fra le due è sbilanciato in partenza.',
          'Non è una debolezza personale ed è inutile combatterla a forza di buona volontà. L\'unico rimedio che funziona è smettere di affidarsi al ricordo e cominciare a contare, che è esattamente quello che si può fare in mezz\'ora.',
        ],
      },
      {
        h2: 'Come si controlla davvero, invece di indovinare',
        paragrafi: [
          'Il controllo è alla portata di chiunque e non richiede software particolari. Serve il proprio storico dei tornei giocati e la scala delle probabilità pubblicata per il formato dove si gioca. Si contano quanti tornei sono usciti per ciascun livello di moltiplicatore e si confronta con la frequenza dichiarata.',
          'Qui arriva il passaggio che quasi nessuno fa, ed è quello decisivo: prima di concludere qualcosa da uno scostamento, bisogna sapere quanto è grande lo scostamento normale su un campione di quella dimensione. Su poche centinaia di tornei le differenze sono enormi anche a estrazione perfettamente regolare, e leggerle come un segnale è come giudicare un dado da dieci lanci.',
          'Vale lo stesso per il risultato economico. Un simulatore mostra quanti percorsi su cento, partendo da un vantaggio reale, finiscono comunque sotto zero dopo il numero di tornei che hai giocato tu. Quando quel numero è alto — e su campioni corti lo è quasi sempre — il fatto di essere in perdita non è un indizio di niente: è il risultato più comune.',
        ],
      },
      {
        h2: 'Su che cosa conviene essere sospettosi davvero',
        paragrafi: [
          'C\'è una forma di sospetto che è ben riposta, e non riguarda l\'estrazione. Riguarda le condizioni: quanto viene trattenuto su ogni iscrizione, come è fatta la scala dei moltiplicatori, oltre quale soglia il montepremi si divide fra più posti, quali strumenti sono ammessi e quali no. Sono tutte informazioni pubblicate, e sono anche quelle che decidono se un vantaggio tecnico può sopravvivere oppure no.',
          'È un sospetto migliore perché è verificabile e perché porta a una decisione. «Forse è truccato» non si può né dimostrare né usare; «qui viene trattenuto il dieci per cento e la scala è molto sbilanciata» è un dato che si legge prima di sedersi e su cui si può agire.',
          'E va detta una cosa che nessuna analisi cambia: il poker comporta un rischio economico reale. Nessuna verifica sull\'estrazione, nessun simulatore e nessun percorso di studio lo tolgono. Quello che si può fare è ridurre gli errori evitabili e sapere in anticipo quanto può essere larga l\'oscillazione — il che è utile, ma è un\'altra cosa dall\'avere una garanzia.',
        ],
      },
      {
        h2: 'Che cosa fare quando la sensazione torna',
        paragrafi: [
          'La sensazione torna, ed è normale che torni: arriva dopo una serie negativa, cioè nel momento in cui si è meno lucidi e più stanchi. Per questo vale la pena decidere prima cosa farne, invece di deciderlo mentre si è dentro.',
          'Tre cose funzionano. La prima è fermarsi: una sessione giocata mentre si pensa che il gioco sia contro di te è una sessione in cui si prendono decisioni peggiori, e questo peggiora il risultato per davvero — l\'unico modo in cui il sospetto diventa profezia. La seconda è contare invece di ricordare, come sopra. La terza è portare due o tre mani concrete a qualcuno che le guardi: quasi sempre la sensazione di ingiustizia si concentra su spot in cui c\'era anche qualcosa da correggere, e vederlo toglie più peso di qualunque rassicurazione.',
        ],
      },
    ],
    strumenti: [
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'il replayer delle mani', href: '/replayer/' },
      { testo: 'le tabelle preflop', href: '/tabelle/' },
    ],
    faq: [
      {
        q: 'Gli Spin & Go sono truccati?',
        a: 'Le sensazioni da cui nasce il sospetto si spiegano quasi sempre con due fatti che non hanno nulla di occulto: la distribuzione dei moltiplicatori è fortemente asimmetrica, quindi la media del formato è portata da eventi rarissimi che la maggior parte dei giocatori non vedrà mai; e la memoria conserva le mani perse male e non quelle andate come dovevano. Prima di concludere qualcosa conviene contare il proprio campione e confrontarlo con le frequenze pubblicate, tenendo presente che su campioni corti gli scostamenti normali sono enormi.',
      },
      {
        q: 'Perché non mi esce mai il moltiplicatore alto?',
        a: 'Perché con quelle probabilità il risultato più probabile, per la maggior parte delle persone, è proprio non vederlo mai — nemmeno giocando a volume alto per anni. È il modo in cui funziona una distribuzione molto sbilanciata: la media del formato viene tirata su da un evento che quasi nessuno sperimenta, mentre quello che vive la maggioranza somiglia alla mediana, che è molto più bassa.',
      },
      {
        q: 'Ho perso venti tornei di fila: è normale?',
        a: 'In un formato dove si gioca in tre e quasi sempre paga solo il primo, anche un giocatore forte vince una minoranza dei tornei: serie negative lunghe fanno parte della struttura, non sono un segnale. Il modo di verificarlo è guardare quanti percorsi, partendo da un vantaggio reale, restano sotto zero dopo il numero di tornei che hai giocato: su campioni corti sono moltissimi.',
      },
      {
        q: 'Come faccio a controllare se le estrazioni sono regolari?',
        a: 'Conta quanti dei tuoi tornei sono usciti per ciascun livello di moltiplicatore e confronta con le frequenze pubblicate per il formato dove giochi. Il passaggio che quasi nessuno fa, ed è quello che conta, è chiedersi quanto sia grande lo scostamento normale su un campione di quella dimensione: su poche centinaia di tornei è enorme anche a estrazione perfettamente regolare.',
      },
      {
        q: 'Allora non c\'è niente di cui diffidare?',
        a: 'Al contrario, ma non dell\'estrazione: delle condizioni. Quanto viene trattenuto su ogni iscrizione, com\'è fatta la scala dei moltiplicatori, oltre quale soglia il montepremi si divide fra più posti, quali strumenti sono ammessi. Sono informazioni pubblicate, si leggono prima di sedersi, e sono quelle che decidono se un vantaggio tecnico può sopravvivere. È un sospetto migliore perché è verificabile e perché porta a una decisione.',
      },
      {
        q: 'Studiare mi mette al riparo da queste serie?',
        a: 'No, e chi dice il contrario sta vendendo qualcosa. Il poker comporta un rischio economico reale e le oscillazioni restano larghe anche giocando bene: quello che si riduce è la quota di errori evitabili, e quello che si guadagna è sapere in anticipo quanto può essere lunga una serie negativa normale. Sono due cose utili, ma nessuna delle due è una garanzia sul risultato.',
      },
    ],
    correlate: [
      'strategia-spin-and-go',
      'varianza-spin-and-go',
      'moltiplicatori-spin-and-go',
      'rake-spin-and-go',
    ],
  },
  // ⚠️ Query confermate: `spin and go multiplier odds`, `spin and go odds`,
  // `spin and go jackpot`, `spin and go payout structure`, `pokerstars spin and
  // go jackpot` (quest'ultima NON si insegue: contiene un nome di sala).
  // ⚠️ Nessuna tabella di probabilita' concreta: cambiano da operatore a
  // operatore e invecchiano in silenzio. La guida insegna a LEGGERE la scala
  // pubblicata, non la ricopia — una cifra sbagliata qui sarebbe peggio
  // dell'assenza, e una cifra giusta riferita a un operatore preciso lo
  // nominerebbe.
  {
    slug: 'moltiplicatori-spin-and-go',
    titolo: 'I moltiplicatori degli Spin & Go: come funzionano e quanto sono rari',
    descrizione:
      'Come viene estratto il montepremi negli Spin & Go e nei Twister, perché i moltiplicatori alti sono così rari e cosa cambia quando il premio si divide.',
    occhiello: 'Struttura del formato',
    h1: 'I moltiplicatori degli Spin & Go: come funzionano, e quanto sono rari davvero',
    lead: 'Il moltiplicatore è la cosa che rende questo formato diverso da qualunque altro torneo: non sai quanto vale il tavolo finché non ti siedi. È anche la parte che più spesso viene fraintesa — non perché sia complicata, ma perché le probabilità in gioco sono di quelle che l\'intuito rappresenta male. Vale la pena capirla bene, perché decide la forma dei tuoi risultati più di qualunque scelta al tavolo.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'Come viene deciso il montepremi',
        paragrafi: [
          'Ti iscrivi per una cifra fissa, il tavolo si forma con tre giocatori e a quel punto viene estratto un moltiplicatore. Il montepremi è la tua iscrizione moltiplicata per quel numero, e la mano comincia. Non c\'è nulla da scegliere e nulla da aspettare: l\'estrazione avviene una volta sola, prima che vengano distribuite le carte.',
          'La scala dei moltiplicatori disponibili e la frequenza con cui esce ciascuno sono pubblicate da chi organizza il tavolo, e cambiano da un operatore all\'altro. È il primo documento da leggere prima di decidere dove giocare a volume, insieme alla percentuale trattenuta sull\'iscrizione — e sono due informazioni che vanno lette insieme, perché incidono sullo stesso conto.',
          'Nella grande maggioranza delle estrazioni esce il moltiplicatore più basso della scala, o uno vicino. È il caso normale, quello su cui si gioca quasi sempre, ed è anche quello su cui ha senso costruire la propria strategia.',
        ],
      },
      {
        h2: 'Perché i moltiplicatori alti sono più rari di quanto sembri',
        paragrafi: [
          'Una distribuzione in cui pochi eventi valgono moltissimo e quasi tutti gli altri valgono poco si comporta in un modo che l\'intuito non rappresenta bene. Il punto non è che i moltiplicatori alti siano «difficili»: è che la loro frequenza è di un ordine di grandezza per cui il numero di tornei necessario a vederne uno supera, spesso, il volume di una vita di gioco.',
          'Ne segue una cosa che vale la pena scrivere in chiaro: il fatto che a te non sia mai uscito non è un\'anomalia. Con probabilità di quel tipo, non vederlo mai è il risultato più probabile per la maggior parte delle persone, e non dice niente né su di te né su chi organizza il tavolo.',
          'C\'è anche un effetto meno ovvio. Siccome una parte consistente del valore complessivo del formato è concentrata in quegli eventi rari, la media dichiarata non descrive l\'esperienza tipica: la descrive la mediana, che è più bassa. Costruire aspettative sulla media significa costruirle su un\'esperienza che quasi nessuno vivrà.',
        ],
      },
      {
        h2: 'Quando il montepremi non va tutto al primo',
        paragrafi: [
          'Nella maggior parte dei tavoli vince tutto chi arriva primo, e il secondo non prende nulla. Sopra una certa soglia di moltiplicatore, però, il montepremi si divide fra più posti — la soglia cambia da un operatore all\'altro, e in alcuni casi dipende anche dalla cifra dell\'iscrizione.',
          'È l\'unico caso in cui la strategia cambia davvero per via del moltiplicatore. Quando esiste un premio anche per chi non vince, le fiches che metti a rischio valgono più di quelle che puoi vincere, e conviene stringere in alcuni spot: è la situazione, e l\'unica, in cui le correzioni di cui si parla sotto il nome di ICM hanno senso.',
          'Nel caso normale — premio tutto al primo — quelle correzioni non si applicano affatto, e applicarle costa. È il motivo per cui una parte del materiale che circola su questo formato è tarato sulla situazione sbagliata: si occupa del caso raro e lascia scoperto quello che si presenta quasi sempre.',
        ],
      },
      {
        h2: 'Che cosa cambia, e che cosa non cambia, quando esce un moltiplicatore alto',
        paragrafi: [
          'La risposta breve è: quasi niente, tranne nel caso appena visto. Se il premio va comunque tutto al primo, il valore delle fiches resta lineare — raddoppiare lo stack raddoppia quanto vale la tua posizione — e la strategia corretta è la stessa che useresti al moltiplicatore base. Cambia quanto vale il torneo, non come si gioca.',
          'Quello che cambia sul serio è la testa. Vedere una cifra grande accende l\'idea che quella mano vada «protetta», e la protezione al tavolo si traduce quasi sempre in giocare più stretto di quanto convenga, nel formato in cui aspettare è già la strategia perdente. È un errore caro perché si presenta proprio nei tornei che valgono di più.',
          'La regola pratica è breve: leggi il moltiplicatore, controlla se sei sopra la soglia in cui il premio si divide, e se non lo sei gioca esattamente come giocheresti al tavolo da pochi euro. È più facile a dirsi che a farsi, ed è uno dei motivi per cui rivedere le proprie mani dopo ha senso.',
        ],
      },
      {
        h2: 'Perché inseguire il moltiplicatore non è una strategia',
        paragrafi: [
          'Ogni tanto si legge di persone che cercano di «trovare» i tavoli col moltiplicatore alto, o che giocano di più nella speranza che arrivi. L\'estrazione è indipendente da quella precedente: non esiste un credito che matura, né un tavolo più caldo di un altro, e nessuna sequenza passata rende più vicino un evento futuro.',
          'Giocare più tornei aumenta il numero di estrazioni, quindi in senso stretto aumenta la probabilità di vederne uno; ma aumenta anche il rake pagato e l\'esposizione alla varianza, e lo fa in proporzione. Se il gioco è in perdita al netto delle commissioni, farne di più non avvicina il moltiplicatore: accelera la perdita.',
          'Il modo sano di guardarlo è l\'opposto: costruire un risultato che stia in piedi sul caso normale — il moltiplicatore basso, quello che esce quasi sempre — e trattare gli eventi rari per quello che sono, cioè qualcosa che può capitare e su cui non si programma nulla. Il poker comporta un rischio economico reale, e una strategia che dipende da un evento raro è il modo più rapido per trasformarlo in una perdita certa.',
        ],
      },
    ],
    strumenti: [
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
      { testo: 'le tabelle preflop', href: '/tabelle/' },
      { testo: 'gli esercizi di allenamento', href: '/allenamento/' },
    ],
    faq: [
      {
        q: 'Come viene deciso il moltiplicatore di uno Spin & Go?',
        a: 'Viene estratto quando il tavolo si forma, una volta sola, prima che vengano distribuite le carte: il montepremi è la tua iscrizione moltiplicata per quel numero. La scala dei moltiplicatori disponibili e la frequenza di ciascuno sono pubblicate da chi organizza il tavolo e cambiano da un operatore all\'altro — vanno lette insieme alla percentuale trattenuta sull\'iscrizione, perché incidono sullo stesso conto.',
      },
      {
        q: 'Quanto è probabile che esca il moltiplicatore massimo?',
        a: 'Abbastanza poco da rendere il numero di tornei necessario a vederne uno superiore, spesso, al volume di una vita di gioco. La cifra esatta la pubblica chi organizza il tavolo. La conseguenza pratica è che non averlo mai visto non è un\'anomalia: con probabilità di quell\'ordine è il risultato più probabile per la maggior parte delle persone.',
      },
      {
        q: 'Con un moltiplicatore alto devo giocare diversamente?',
        a: 'Solo se sei sopra la soglia in cui il montepremi si divide fra più posti, perché lì le fiches che rischi valgono più di quelle che puoi vincere. Se il premio va comunque tutto al primo il valore delle fiches resta lineare e la strategia corretta è identica a quella del moltiplicatore base: cambia quanto vale il torneo, non come si gioca.',
      },
      {
        q: 'Giocare più tornei aumenta le probabilità di prendere il jackpot?',
        a: 'Aumenta il numero di estrazioni, ma nella stessa proporzione aumenta il rake pagato e l\'esposizione alla varianza. Le estrazioni sono indipendenti: non matura alcun credito e nessun tavolo è più caldo di un altro. Se il gioco è in perdita al netto delle commissioni, aumentare il volume non avvicina il moltiplicatore alto — rende la perdita più rapida.',
      },
      {
        q: 'Perché la media dichiarata non somiglia ai miei risultati?',
        a: 'Perché una parte consistente del valore del formato è concentrata in eventi rarissimi, e la media li include. Quello che descrive l\'esperienza della maggioranza è la mediana, che è più bassa e che nessuno mette in vetrina. Costruire aspettative sulla media significa costruirle su un\'esperienza che quasi nessuno vivrà.',
      },
      {
        q: 'La scala dei moltiplicatori è uguale ovunque?',
        a: 'No: cambiano i valori disponibili, le frequenze e la soglia oltre cui il premio si divide fra più posti, e in alcuni casi la soglia dipende anche dalla cifra dell\'iscrizione. Per questo il confronto fra due strutture non si fa guardando solo la commissione trattenuta: una scala più concentrata sui moltiplicatori bassi rende i risultati più leggibili, una più estrema li rende più rumorosi.',
      },
    ],
    correlate: [
      'strategia-spin-and-go',
      'come-giocare-spin-and-go',
      'icm-spin-and-go',
      'spin-and-go-truccati',
    ],
  },
  // ⚠️ Query confermate: `spin and go vs sit and go`, `spin and go vs cash
  // game`, `spin and go vs`. Completa `spin-and-go-vs-twister`, che confronta
  // due nomi dello STESSO gioco; questa confronta giochi diversi.
  {
    slug: 'spin-and-go-vs-sit-and-go',
    titolo: 'Spin & Go o Sit & Go: le differenze che contano',
    descrizione:
      'Spin & Go, Sit & Go e cash game a confronto: struttura, durata, varianza e quanto di quello che sai in un formato si trasferisce davvero nell\'altro.',
    occhiello: 'Formati a confronto',
    h1: 'Spin & Go, Sit & Go e cash game: le differenze che contano davvero',
    lead: 'Sono tutti poker e sono tre giochi diversi. Cambiano il numero di avversari, la profondità degli stack, il tempo che hai per decidere e — soprattutto — come si distribuisce il premio. Chi passa da uno all\'altro porta con sé abitudini che nel formato nuovo costano, e quasi sempre sono abitudini corrette nel formato di partenza. Questa pagina dice che cosa si trasferisce e che cosa no.',
    aggiornata: '2026-09-19',
    sezioni: [
      {
        h2: 'La differenza che genera tutte le altre: come si divide il premio',
        paragrafi: [
          'In un Sit & Go classico il montepremi è noto in anticipo e diviso fra più posti: arrivare secondo o terzo vale qualcosa. In uno Spin & Go il montepremi viene estratto quando il tavolo si forma e, salvo i casi rari sopra una certa soglia, paga soltanto chi arriva primo.',
          'È da qui che discende quasi tutto il resto. Quando esiste un premio per chi non vince, le fiches che rischi valgono più di quelle che potresti vincerne, e conviene stringere man mano che ci si avvicina ai posti pagati — è il ragionamento che sta dietro alle correzioni di cui si parla sotto il nome di ICM. Quando paga solo il primo, quel ragionamento non si applica: le fiches valgono in modo lineare e non c\'è nessun secondo posto da proteggere.',
          'Chi arriva dai Sit & Go porta con sé quella prudenza e la applica dove non serve, giocando più stretto del necessario in un formato dove aspettare è già di per sé la strategia perdente. È il singolo errore più costoso nel passaggio fra i due, e non si vede: ogni singola mano passata sembra una scelta ragionevole.',
        ],
      },
      {
        h2: 'Tre giocatori invece di sei o nove',
        paragrafi: [
          'In tre, i bui ti passano addosso una volta ogni tre mani invece che una ogni nove. Una mano che a un tavolo pieno è facilmente scartabile diventa, a tre, una mano con cui si apre — non perché sia diventata più forte, ma perché il costo di non giocare è triplicato.',
          'Cambia anche quanto spesso ti trovi a decidere. In un formato a tre partecipi a una quota molto più alta dei piatti, quindi il numero di decisioni per ora è molto maggiore, e con esso il peso degli errori ripetuti. Una scelta marginale sbagliata in un cash game a sei si presenta qualche volta a sessione; qui si presenta decine di volte.',
          'E cambia chi hai davanti: con due soli avversari, l\'idea di «tavolo medio» perde significato. Ogni tavolo è due persone specifiche, e la parte della strategia che dipende da chi hai di fronte pesa molto di più.',
        ],
      },
      {
        h2: 'Stack corti, livelli rapidi, e la scomparsa del postflop',
        paragrafi: [
          'Uno Spin & Go parte da venticinque big blind con livelli che salgono ogni pochi minuti; un Sit & Go tradizionale parte molto più profondo e sale lentamente; un cash game è profondo e non sale mai. Sono tre giochi diversi anche solo per questo.',
          'Con stack corti le decisioni postflop diventano poche e arrivano con gran parte dei soldi già in mezzo. La conseguenza è che il peso relativo del preflop cresce enormemente: nello Spin & Go una parte molto grande di quello che si guadagna o si perde si decide prima del flop, mentre in un cash game profondo il preflop è soltanto il primo di quattro momenti.',
          'Ne segue anche un ordine di studio diverso. Chi gioca cash investe presto sul postflop perché è lì che si decide; qui investire presto sul postflop significa lavorare sulla parte più piccola del margine, prima di avere solide le aperture e le spinte.',
        ],
      },
      {
        h2: 'Che cosa si trasferisce davvero',
        paragrafi: [
          'Non tutto va buttato: alcune cose valgono ovunque, e sono le più difficili da costruire.',
        ],
        lista: [
          'Il ragionamento sulle probabilità e sull\'equity: quanto vale una mano contro un ventaglio di mani non cambia col formato.',
          'La gestione del bankroll come disciplina, anche se i numeri cambiano parecchio: il formato a varianza più alta chiede più buy-in.',
          'La capacità di leggere un avversario e di adattarsi, che anzi in tre pesa di più che a un tavolo pieno.',
          'L\'abitudine a rivedere le proprie mani invece di fidarsi del ricordo.',
        ],
      },
      {
        h2: 'Che cosa non si trasferisce, e costa',
        paragrafi: [
          'I range, prima di tutto: un range di apertura è la risposta a un gioco preciso, e cambiando numero di giocatori, profondità e struttura del premio cambia la risposta. Riusarli è il modo più silenzioso di perdere, perché nessuna singola mano sembra un errore.',
          'Poi la pazienza come virtù. In un cash game profondo saltare una mano marginale costa quasi nulla; in un 3-max hyper turbo costa un buio ogni tre mani, e sommato su centinaia di tornei è gran parte del risultato.',
          'E infine le aspettative sulla lettura dei risultati. Un cash player abituato a valutarsi su un numero di mani enorme si trova qui con campioni molto più rumorosi: i tornei sono pochi rispetto alle mani, e il moltiplicatore aggiunge un secondo elemento casuale sopra quello delle carte. Serve molto più tempo prima che i numeri dicano qualcosa.',
        ],
      },
      {
        h2: 'Quale ha più senso per chi comincia',
        paragrafi: [
          'Non esiste una risposta valida per tutti, e la domanda utile non è quale sia «il migliore» ma quale si adatti al tempo che hai e a come ti trovi a giocare. Un formato che dura pochi minuti a torneo si presta a sessioni corte e spezzate; uno che dura un\'ora e mezza chiede una finestra di tempo continua.',
          'Sul piano dello studio, un formato a stack corti e decisioni concentrate prima del flop ha un vantaggio pratico: l\'insieme delle situazioni da imparare è finito e si può coprire per intero. È più difficile dire lo stesso di un cash game profondo, dove l\'albero delle possibilità si allarga a ogni strada.',
          'Quello che vale in ogni caso è non tenere il piede in due scarpe all\'inizio. I due formati chiedono abitudini opposte su alcune cose importanti, e alternarli prima di averne assimilato uno significa costruirsi due mezze competenze che si disturbano a vicenda.',
        ],
      },
    ],
    strumenti: [
      { testo: 'le tabelle preflop', href: '/tabelle/' },
      { testo: 'gli esercizi di allenamento', href: '/allenamento/' },
      { testo: 'il simulatore di varianza', href: '/simulatore-varianza/' },
    ],
    faq: [
      {
        q: 'Qual è la differenza fra Spin & Go e Sit & Go?',
        a: 'La più importante è come si divide il premio: in un Sit & Go il montepremi è noto in anticipo e pagato a più posti, in uno Spin & Go viene estratto quando il tavolo si forma e salvo casi rari va tutto al primo. Da lì discendono le altre: tre giocatori invece di sei o nove, venticinque big blind di partenza, livelli che salgono ogni pochi minuti e quindi quasi tutte le decisioni concentrate prima del flop.',
      },
      {
        q: 'Posso usare la stessa strategia nei due formati?',
        a: 'No, e l\'errore più caro è portare negli Spin & Go la prudenza che nei Sit & Go è corretta. Là esiste un premio anche per chi non vince, quindi stringere avvicinandosi ai posti pagati ha senso; qui paga solo il primo, le fiches valgono in modo lineare e giocare stretto in un formato dove i bui passano una mano su tre costa ogni giro.',
      },
      {
        q: 'Gli Spin & Go hanno più varianza dei Sit & Go?',
        a: 'Sì, e di parecchio: ci sono due elementi casuali sovrapposti invece di uno — le carte e il moltiplicatore estratto a ogni torneo — e quasi sempre paga solo il primo, quindi mancano i piazzamenti che smussano la curva. La conseguenza pratica è che serve un fondo più ampio in numero di buy-in e un campione molto più grande prima che i risultati dicano qualcosa.',
      },
      {
        q: 'Cosa si trasferisce da un cash game agli Spin & Go?',
        a: 'Il ragionamento su probabilità ed equity, la disciplina sul bankroll, la capacità di adattarsi all\'avversario e l\'abitudine di rivedere le proprie mani. Non si trasferiscono i range, che sono la risposta a un gioco preciso, né la pazienza come virtù: in un cash profondo saltare una mano marginale costa quasi nulla, in un 3-max hyper turbo costa un buio ogni tre mani.',
      },
      {
        q: 'Conviene giocare entrambi i formati insieme?',
        a: 'All\'inizio è meglio di no. Chiedono abitudini opposte su alcune cose importanti — quanto aprire, quando stringere, quanto pesa arrivare secondi — e alternarli prima di averne assimilato uno porta a costruirsi due mezze competenze che si disturbano a vicenda. Una volta che uno dei due è solido, il passaggio diventa molto più gestibile.',
      },
      {
        q: 'Quale formato richiede meno tempo per imparare?',
        a: 'Nessuno è «facile», ma un formato a stack corti ha un vantaggio pratico nello studio: le decisioni si concentrano prima del flop e l\'insieme delle situazioni da imparare è finito, quindi si può coprire per intero. In un cash game profondo l\'albero delle possibilità si allarga a ogni strada, e il percorso non ha un punto in cui si può dire di averlo chiuso.',
      },
    ],
    correlate: [
      'strategia-spin-and-go',
      'come-giocare-spin-and-go',
      'icm-spin-and-go',
      'spin-and-go-vs-twister',
    ],
  },
];

export function guidaBySlug(slug: string): Guide | undefined {
  return GUIDE.find((g) => g.slug === slug);
}

/** Gli slug noti al build: sorgente di `getPrerenderParams` in app.routes.server.ts. */
export function slugGuide(): string[] {
  return GUIDE.map((g) => g.slug);
}
