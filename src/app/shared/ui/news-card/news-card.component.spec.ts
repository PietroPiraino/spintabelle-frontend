import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { NewsCardComponent } from './news-card.component';

const FOTO = 'https://bff-assets.b-cdn.net/foto-vera.webp';
const TARGA = 'https://cdn.bestfishforever.it/news/6a88f4b67dceda4b62165148/cover.png';

function articolo(extra: Partial<News> = {}): News {
  return {
    _id: '6a88f4b67dceda4b62165148',
    title: 'Moneymaker eliminato in bolla al Main Event WSOP',
    body: 'Chris Moneymaker è uscito in bolla dal Main Event delle World Series of Poker.',
    createdAt: '2026-08-22T10:00:00.000Z',
    ...extra,
  } as News;
}

describe('NewsCardComponent — l’immagine della card', () => {
  let fixture: ComponentFixture<NewsCardComponent>;

  function monta(news: News): HTMLElement {
    TestBed.configureTestingModule({
      imports: [NewsCardComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    fixture = TestBed.createComponent(NewsCardComponent);
    fixture.componentRef.setInput('news', news);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('con una FOTO vera mostra la foto, e NON la scatola della targa', () => {
    // ⚠️ Il verso che protegge i tre articoli storici: hanno una foto scelta a
    // mano, e la targa non deve rubarle il posto nell'elenco.
    const img = monta(articolo({ coverImageUrl: FOTO, ogImageUrl: TARGA }))
      .querySelector<HTMLImageElement>('img.news-card__cover');
    expect(img).withContext('la card deve avere un’immagine').not.toBeNull();
    expect(img!.getAttribute('src')).toBe(FOTO);
    expect(img!.classList.contains('news-card__cover--targa'))
      .withContext('una foto usa la scatola 21:9, non quella 16:9 della targa')
      .toBeFalse();
  });

  it('senza foto mostra la TARGA, con la scatola 16:9 che non la ritaglia', () => {
    // ⚠️ Questa classe non è cosmetica: la scatola delle foto è 21:9 e la targa
    // è 16:9, quindi senza di essa `object-fit: cover` taglierebbe 81px sopra e
    // 80 sotto — e la prima cosa che sparisce è il marchio in alto.
    const img = monta(articolo({ ogImageUrl: TARGA }))
      .querySelector<HTMLImageElement>('img.news-card__cover');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(TARGA);
    expect(img!.classList.contains('news-card__cover--targa')).toBeTrue();
  });

  it('senza foto NÉ targa non rende alcun <img>', () => {
    // Gli articoli pubblicati prima delle copertine, e quelli in cui la
    // generazione è fallita: nessuna URL di ripiego viene persistita, quindi la
    // card resta di solo testo invece di puntare a un’immagine che non c’è.
    const host = monta(articolo());
    expect(host.querySelector('img.news-card__cover')).toBeNull();
  });

  it('⚠️ una `coverImageUrl` STRINGA VUOTA ricade sulla targa (`||`, non `??`)', () => {
    // Lo schema ha `trim: true`: un campo con soli spazi arriva come ''. Con
    // `??` quella stringa vuota vincerebbe e la card renderebbe un <img> senza
    // sorgente al posto della targa che esiste.
    const img = monta(articolo({ coverImageUrl: '', ogImageUrl: TARGA }))
      .querySelector<HTMLImageElement>('img.news-card__cover');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(TARGA);
    expect(img!.classList.contains('news-card__cover--targa')).toBeTrue();
  });

  it('l’`alt` resta vuoto: la targa stampa il titolo, che il titolo ripete', () => {
    // Un `alt` col titolo lo farebbe leggere due volte di fila a uno screen
    // reader — l’immagine e poi il <h3> subito sotto.
    const img = monta(articolo({ ogImageUrl: TARGA }))
      .querySelector<HTMLImageElement>('img.news-card__cover');
    expect(img!.getAttribute('alt')).toBe('');
  });
});
