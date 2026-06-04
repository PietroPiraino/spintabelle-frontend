import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { News } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NewsService } from '../../core/services/news.service';
import { NewsCardComponent } from '../../shared/ui/news-card/news-card.component';
import { Hero3dComponent } from './hero-3d/hero-3d.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Hero3dComponent, NewsCardComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  protected readonly auth = inject(AuthService);
  private readonly newsApi = inject(NewsService);

  // TODO: sostituire con i link reali (come nel footer)
  protected readonly youtubeUrl = 'https://www.youtube.com/@bestfishforever';
  protected readonly discordUrl = 'https://discord.gg/bestfishforever';

  protected readonly latestNews = toSignal(
    this.newsApi.getLatest(3).pipe(catchError(() => of([] as News[]))),
    { initialValue: [] as News[] },
  );

  protected readonly valueProps = [
    {
      suit: '♠',
      title: 'Studio guidato',
      text: 'Percorsi di lezioni video tenuti dai coach della scuola: dal preflop ai spot ICM più complessi, in italiano.',
    },
    {
      suit: '♦',
      title: 'Tabelle di gioco',
      text: 'Le tabelle GTO per Spin & Go e Twister, consultabili ovunque: la teoria sempre in tasca, anche tra un game e l’altro.',
    },
    {
      suit: '♣',
      title: 'Community vera',
      text: 'Discord attivo, review delle mani, sessioni condivise e il canale YouTube con contenuti gratuiti ogni settimana.',
    },
  ];
}
