import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { EdizioneAwards } from '../../../core/models/awards.models';
import { AwardsService } from '../../../core/services/awards.service';

/** Il pulsante dei premi, quando una fase chiede di accedere per partecipare. */
interface InvitoPremi {
  testo: string;
  pulsante: string;
}

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  templateUrl: './verify-email.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  private readonly awards = inject(AwardsService);

  /** Query param impostato dal redirect del backend: ok | errore */
  readonly esito = input<string>();

  protected readonly success = computed(() => this.esito() === 'ok');

  /**
   * La fase dei premi, letta solo a verifica riuscita (`GET /awards/edizione`
   * è pubblica). Serve perché il link di conferma non sa da dove si veniva, e
   * spesso si apre in un altro browser (l'app di posta apre il predefinito,
   * non quello di Instagram): senza, chi si era registrato per proporre finiva
   * in home dopo l'accesso. Un errore qui vale «nessun invito», mai un blocco.
   */
  private readonly edizione = toSignal(
    toObservable(this.success).pipe(
      switchMap((ok) =>
        ok
          ? this.awards.edizione().pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
    { initialValue: null as EdizioneAwards | null },
  );

  protected readonly invitoPremi = computed<InvitoPremi | null>(() => {
    const e = this.edizione();
    if (!e?.disponibile || !e.raccoltaAttiva) return null;
    switch (e.fase) {
      case 'PROPOSTE':
        return {
          testo:
            'Sono aperte le proposte dei 3 Max Hyper Awards: accedi e indica, in privato, i tuoi candidati.',
          pulsante: 'Accedi e proponi',
        };
      case 'VOTO':
        return {
          testo:
            'Il voto dei 3 Max Hyper Awards è aperto: accedi e scegli un finalista per categoria.',
          pulsante: 'Accedi e vota',
        };
      default:
        return null;
    }
  });
}
