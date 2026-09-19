import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoYoutubeComponent } from './video-youtube.component';

/**
 * ⚠️⚠️ **Queste prove non difendono una funzione: difendono due frasi
 * pubblicate.** La cookie policy dice che prima del clic il browser non
 * contatta Google, e l'informativa che Google entra in gioco solo quando
 * l'utente avvia il video. Reggono su una condotta di questo componente, e
 * la condotta si verifica qui (`gdpr/valutazione-analytics.md` §10.2,
 * condizione operativa 17).
 */
describe('VideoYoutubeComponent — la facciata', () => {
  let fixture: ComponentFixture<VideoYoutubeComponent>;

  const VIDEO = {
    videoId: 'dQw4w9WgXcQ',
    titolo: 'Spin & Go 25€: il field è davvero così duro?',
    miniaturaUrl: 'https://cdn.bestfishforever.it/canale/dQw4w9WgXcQ/thumb-ab12cd34.jpg',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoYoutubeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(VideoYoutubeComponent);
    fixture.componentRef.setInput('video', VIDEO);
    fixture.detectChanges();
  });

  it('⚠️ PRIMA DEL CLIC non esiste alcun iframe', () => {
    // Se questa prova diventa rossa, non è un difetto di interfaccia: è
    // l'esimente dell'art. 122 che non regge più, e due testi pubblicati che
    // diventano falsi.
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('⚠️ prima del clic nessun elemento punta a un dominio di Google', () => {
    // Non basta «niente iframe»: anche una copertina servita da i.ytimg.com
    // farebbe contattare Google senza che nessuno abbia cliccato (§10.3).
    const html = fixture.nativeElement.innerHTML as string;
    for (const dominio of ['ytimg', 'youtube', 'googleapis', 'gstatic', 'google.com']) {
      expect(html).not.toContain(dominio);
    }
  });

  it('la copertina mostrata è quella sul nostro CDN', () => {
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(VIDEO.miniaturaUrl);
  });

  it('dopo il clic monta l’iframe, e su youtube-nocookie', () => {
    const bottone = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    bottone.click();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const src = iframe.getAttribute('src') ?? '';
    // ⚠️ Il dominio è la differenza fra zero cookie e sei cookie piantati
    // prima di qualunque riproduzione (misurato il 19/09/2026).
    expect(src).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src).not.toContain('://www.youtube.com/embed');
  });

  it('⚠️ un videoId malformato NON produce alcun iframe', () => {
    // `bypassSecurityTrustResourceUrl` spegne il sanitizer di Angular: se un
    // giorno l'API restituisse spazzatura, questo è l'unico punto in cui
    // diventerebbe un'iniezione. La validazione della forma è la difesa.
    fixture.componentRef.setInput('video', {
      ...VIDEO,
      videoId: '"><script>alert(1)</script>',
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('il nome accessibile nomina il video, non dice «Play»', () => {
    const bottone = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(bottone.textContent).toContain(VIDEO.titolo);
  });

  it('⚠️ nessuna etichetta parla di consenso', () => {
    // Il clic è una richiesta esplicita del servizio, NON un consenso ex art.
    // 7 GDPR: scriverlo cambierebbe il presupposto giuridico di tutta la voce.
    const testo = (fixture.nativeElement.textContent ?? '').toLowerCase();
    for (const parola of ['acconsent', 'consenso', 'accetti']) {
      expect(testo).not.toContain(parola);
    }
  });
});
