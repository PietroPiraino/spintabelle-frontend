// La metà Karma della guardia su «Per approfondire».
//
// ⚠️ L'ALTRA METÀ È `scripts/lib/guide-links.test.mjs`, e le due NON si
// sovrappongono per pigrizia: là gira la copia dell'edge
// (`functions/lib/guide-links.mjs`), qui la sorgente canonica. I casi di
// comportamento sono deliberatamente gli **stessi**, perché è l'unico modo di
// accorgersi che una delle due implementazioni è cambiata da sola — cioè che le
// due stesure della pagina hanno smesso di proporre le stesse guide.
//
// ⚠️ E qui c'è una cosa che di là non si può fare: confrontare gli slug e i
// titoli con `GUIDE` **importandolo davvero**, invece di rileggerne il sorgente
// con un'espressione regolare.

import { NEWS_CATEGORIES } from '../../core/models/api.models';
import {
  GUIDE_CORRELABILI,
  MAX_GUIDE,
  RIPIEGO_CATEGORIA,
  RIPIEGO_PREDEFINITO,
  guideCorrelate,
  normalizzaTesto,
} from './guide-links';
import { GUIDE, guidaBySlug } from './guides.data';

describe('guide-links — la mappa', () => {
  it('⚠️ ogni slug proposto è una guida che esiste davvero', () => {
    // `guide/:slug` usa PrerenderFallback.None: uno slug sbagliato non è un
    // link brutto, è un 404 vero su tutto l'archivio e per sempre.
    for (const g of GUIDE_CORRELABILI) {
      expect(guidaBySlug(g.slug))
        .withContext(`«${g.slug}» non esiste: /guide/${g.slug}/ risponde 404`)
        .toBeTruthy();
    }
  });

  it('⚠️ il testo del collegamento è ancora il titolo della guida', () => {
    // È duplicato perché la copia dell'edge non può importare `guides.data.ts`.
    // Se invecchia, l'ancora promette una pagina e ne apre un'altra.
    for (const g of GUIDE_CORRELABILI) {
      expect(g.titolo).toBe(guidaBySlug(g.slug)!.titolo);
    }
  });

  it('nessuna guida è elencata due volte', () => {
    const slug = GUIDE_CORRELABILI.map((g) => g.slug);
    expect(new Set(slug).size).toBe(slug.length);
  });

  it('⚠️ tutte e otto le categorie hanno un ripiego', () => {
    // Una categoria scoperta non romperebbe niente a vista: cadrebbe sul
    // predefinito, e ogni articolo di quella categoria proporrebbe la stessa
    // guida introduttiva senza che nessuno se ne accorga.
    for (const categoria of NEWS_CATEGORIES) {
      expect(RIPIEGO_CATEGORIA[categoria])
        .withContext(`categoria «${categoria}» senza ripiego`)
        .toBeTruthy();
    }
  });

  it('ogni ripiego punta a una guida proponibile', () => {
    const proponibili = new Set(GUIDE_CORRELABILI.map((g) => g.slug));
    for (const slug of Object.values(RIPIEGO_CATEGORIA)) {
      expect(proponibili.has(slug)).withContext(slug).toBeTrue();
    }
    expect(proponibili.has(RIPIEGO_PREDEFINITO)).toBeTrue();
  });

  it('⚠️ le dieci guide sono tutte proponibili: nessuna resta senza ingressi', () => {
    // Non è pedanteria: una guida che nessun articolo può linkare è una pagina
    // che il flusso di news non irrora — cioè non partecipa alla ragione per
    // cui questo meccanismo esiste.
    expect(GUIDE_CORRELABILI.length).toBe(GUIDE.length);
  });
});

describe('guide-links — la scelta', () => {
  it('una parola nel titolo pesa più della stessa nel corpo', () => {
    const scelte = guideCorrelate({
      titolo: 'Il downswing più lungo della stagione',
      corpo: 'Un accenno al preflop e nulla più.',
      categoria: 'online',
    });
    expect(scelte[0].slug).toBe('varianza-spin-and-go');
  });

  it('al massimo due guide, mai di più', () => {
    const scelte = guideCorrelate({
      titolo:
        'Downswing, bankroll, heads-up, preflop, twister e moltiplicatore',
      corpo: 'icm errori push fold',
      categoria: 'strategia',
    });
    expect(scelte.length).toBe(MAX_GUIDE);
  });

  it('⚠️ senza alcun aggancio si propone UNA sola guida, quella della categoria', () => {
    // Due ripieghi sarebbero due link identici in coda a ogni pezzo che non
    // aggancia niente: il boilerplate che il tetto di due serve a evitare.
    const scelte = guideCorrelate({
      titolo: 'Notizia senza parole chiave',
      corpo: 'Testo neutro.',
      categoria: 'live',
    });
    expect(scelte.length).toBe(1);
    expect(scelte[0].slug).toBe(RIPIEGO_CATEGORIA.live);
  });

  it('⚠️ categoria assente: ripiego predefinito, mai zero guide', () => {
    // `.lean()` non applica i default di schema: una riga anteriore al campo
    // arriva senza `categoria`, e il blocco sparirebbe in silenzio.
    const scelte = guideCorrelate({
      titolo: 'Notizia neutra',
      corpo: 'Testo neutro.',
    });
    expect(scelte.length).toBe(1);
    expect(scelte[0].slug).toBe(RIPIEGO_PREDEFINITO);
  });

  it('il confronto è per parola intera e regge accenti e Markdown', () => {
    expect(normalizzaTesto('**Perché** l’ICM…')).toBe('perche l icm');
    const scelte = guideCorrelate({
      titolo: 'Icmizzare non è una parola',
      corpo: 'Testo.',
      categoria: 'mtt',
    });
    expect(scelte.length).toBe(1);
    expect(scelte[0].slug).toBe(RIPIEGO_CATEGORIA.mtt);
  });

  it('la scelta è deterministica', () => {
    const articolo = {
      titolo: 'Bankroll e varianza',
      corpo: 'preflop',
      categoria: 'strategia',
    };
    expect(guideCorrelate(articolo)).toEqual(guideCorrelate(articolo));
  });
});
