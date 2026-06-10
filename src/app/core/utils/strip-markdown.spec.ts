import { stripMarkdown } from './strip-markdown';

describe('stripMarkdown', () => {
  it('rimuove heading ed emphasis mantenendo il testo', () => {
    expect(stripMarkdown('## Titolo\n\nCorpo **forte** e _vero_.')).toBe(
      'Titolo Corpo forte e vero.',
    );
  });

  it('riduce i link al solo testo e toglie le immagini', () => {
    expect(stripMarkdown('![alt](i.png) Vai a [Best](https://x.it)')).toBe(
      'Vai a Best',
    );
  });

  it('appiattisce gli elenchi puntati e numerati', () => {
    expect(stripMarkdown('- uno\n- due\n1. tre')).toBe('uno due tre');
  });

  it('toglie i backtick del codice inline', () => {
    expect(stripMarkdown('usa `ng test` ora')).toBe('usa ng test ora');
  });

  it('lascia il testo semplice quasi invariato (collassa solo gli a-capo)', () => {
    expect(stripMarkdown('Riga uno\nRiga due')).toBe('Riga uno Riga due');
  });

  it('rimuove le citazioni a inizio riga', () => {
    expect(stripMarkdown('> citazione\ntesto')).toBe('citazione testo');
  });

  it('gestisce la stringa vuota', () => {
    expect(stripMarkdown('')).toBe('');
  });
});
