import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Placeholder: i conteggi mensili arriveranno in un lotto dedicato. La voce
 * esiste già in sidebar col chip "Presto" così la struttura della dashboard è
 * quella definitiva.
 */
@Component({
  selector: 'app-admin-conteggi-mensili',
  imports: [IconComponent],
  template: `
    <div class="card card--pad admin-soon">
      <app-icon name="calendar-days" [size]="34" />
      <h2>Conteggi mensili</h2>
      <p>Sezione in costruzione — presto disponibile.</p>
      <p class="admin-soon__hint">
        Qui arriveranno i riepiloghi di fine mese: conteggi economici e report
        periodici della scuola.
      </p>
    </div>
  `,
  styles: `
    .admin-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding-block: 3rem;
      text-align: center;
      color: var(--text-muted);

      .app-icon {
        color: var(--copper-600);
      }

      h2 {
        margin: 0;
        font-size: 1.3rem;
      }

      p {
        margin: 0;
      }
    }

    .admin-soon__hint {
      font-size: 0.9rem;
      color: var(--text-faint);
      max-width: 46ch;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConteggiMensiliComponent {}
