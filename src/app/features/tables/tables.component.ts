import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-tables',
  imports: [RouterLink],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesComponent {
  protected readonly auth = inject(AuthService);
}
