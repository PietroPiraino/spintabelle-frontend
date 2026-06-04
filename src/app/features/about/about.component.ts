import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Coach {
  nickname: string;
  role: string;
  bio: string;
  suit: string;
}

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  // TODO: sostituire con i coach reali (nickname, ruolo, bio, foto)
  protected readonly coaches: Coach[] = [
    {
      nickname: 'Coach Uno',
      role: 'Head Coach · Spin & Go',
      bio: 'Regular dei mid-high stakes, cura il percorso di studio preflop e la teoria GTO della scuola.',
      suit: '♠',
    },
    {
      nickname: 'Coach Due',
      role: 'Coach · Twister',
      bio: 'Specialista del formato a tre, guida le review di sessione e l’analisi degli spot postflop.',
      suit: '♥',
    },
    {
      nickname: 'Coach Tre',
      role: 'Coach · Mental game',
      bio: 'Si occupa di gestione del bankroll, tilt e routine: la parte del gioco che non si vede nelle tabelle.',
      suit: '♣',
    },
  ];
}
