import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  // TODO: sostituire con i link reali del canale e del server
  protected readonly youtubeUrl = 'https://www.youtube.com/@bestfishforever';
  protected readonly discordUrl = 'https://discord.gg/bestfishforever';
  protected readonly year = new Date().getFullYear();
}
