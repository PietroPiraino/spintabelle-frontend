import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  AWARDS_CATEGORIE,
  AwardsCategoria,
  AwardsFase,
  AwardsMio,
  DateAwards,
  EdizioneAwards,
  PropostaAwards,
} from '../../core/models/awards.models';
import { AuthService } from '../../core/services/auth.service';
import { AwardsService } from '../../core/services/awards.service';
import { SeoService } from '../../core/services/seo.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import { HeroCardsComponent } from '../../shared/ui/hero-cards/hero-cards.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  CATEGORIE_AWARDS,
  CategoriaAwards,
  DATE_AWARDS_2026,
  FAQ_AWARDS,
  GRUPPI_AWARDS,
  REGOLE_AWARDS,
} from './awards.data';

type Bozza = Partial<Record<AwardsCategoria, string>>;

/** Una categoria in cui l'utente è candidato e può ritirarsi. */
interface MiaCategoria {
  chiave: string;
  candidatoId: string;
  nickname: string;
  categoria: AwardsCategoria;
  etichetta: string;
}

/** Un passo del calendario: la fase che lo accende e le sue date. */
interface Passo {
  id: 'PROPOSTE' | 'CONTATTI' | 'VOTO' | 'PREMIAZIONE';
  titolo: string;
  quando: string;
  testo: string;
}

const FMT_GIORNO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Rome',
});
const FMT_GIORNO_ANNO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Rome',
});

/** «10 novembre». ⚠️ Nel fuso di Roma, non in quello del browser o del build. */
export function giornoAwards(iso: string, conAnno = false): string {
  return (conAnno ? FMT_GIORNO_ANNO : FMT_GIORNO).format(new Date(iso));
}

/**
 * `/awards` — i 3 Max Hyper Awards (voce di registro A20).
 *
 * ⚠️ La pagina è UNA per tutti, al contrario di `/docs`: regolamento,
 * calendario e categorie stanno fuori da ogni condizione sull'utente, perché
 * sono l'HTML che legge chi arriva da Google o da una card condivisa. Solo il
 * blocco della fase cambia fra anonimo e iscritto.
 *
 * ⚠️ `GET /awards/edizione` parte anche in prerender (è pubblica) ed è esclusa
 * dalla transfer cache: la fase cambia con l'orologio, non con un deploy.
 */
@Component({
  selector: 'app-awards',
  imports: [RouterLink, HeroCardsComponent],
  templateUrl: './awards.component.html',
  styleUrl: './awards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AwardsComponent {
  private readonly api = inject(AwardsService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categorie = CATEGORIE_AWARDS;
  protected readonly gruppi = GRUPPI_AWARDS;
  protected readonly regole = REGOLE_AWARDS;
  protected readonly faq = FAQ_AWARDS;

  /** `undefined` = in volo; un errore di rete diventa «non disponibile». */
  private readonly edizione = toSignal<EdizioneAwards | undefined>(
    this.api
      .edizione()
      .pipe(
        catchError(() =>
          of<EdizioneAwards>({ disponibile: false, motivo: '' }),
        ),
      ),
  );

  /**
   * ⚠️ Tre stati e non due: lo scheletro occupa la stessa scatola del blocco
   * vero, e «non disponibile» si decide solo dopo una risposta. Collassare
   * attesa e assenza farebbe comparire e sparire il blocco.
   */
  protected readonly statoEdizione = computed<'attesa' | 'pronto' | 'assente'>(
    () => {
      const e = this.edizione();
      if (e === undefined) return 'attesa';
      return e.disponibile ? 'pronto' : 'assente';
    },
  );

  protected readonly fase = computed<AwardsFase | null>(() => {
    const e = this.edizione();
    return e?.disponibile ? e.fase : null;
  });

  protected readonly raccoltaAttiva = computed(() => {
    const e = this.edizione();
    return e?.disponibile ? e.raccoltaAttiva : false;
  });

  /** Le date dell'API; finché non risponde, quelle decise per il 2026. */
  protected readonly date = computed<DateAwards>(() => {
    const e = this.edizione();
    return e?.disponibile ? e.date : DATE_AWARDS_2026;
  });

  protected readonly passi = computed<Passo[]>(() => {
    const d = this.date();
    const g = (iso: string) => giornoAwards(iso);
    return [
      {
        id: 'PROPOSTE',
        titolo: 'Proposte',
        quando: `dal ${g(d.proposteDal)} al ${g(d.proposteAl)}`,
        testo: 'Gli iscritti indicano, in privato, un nickname per categoria.',
      },
      {
        id: 'CONTATTI',
        titolo: 'Candidature',
        quando: `fino al ${g(d.contattiAl)}`,
        testo:
          'Contattiamo i giocatori più proposti: partecipa solo chi accetta.',
      },
      {
        id: 'VOTO',
        titolo: 'Voto',
        quando: `dal ${g(d.votoDal)} al ${giornoAwards(d.votoAl, true)}`,
        testo: 'Un voto per categoria fra i finalisti. Il voto è segreto.',
      },
      {
        id: 'PREMIAZIONE',
        titolo: 'Premiazione',
        quando: `${giornoAwards(d.cerimoniaAt, true)}, in diretta`,
        testo:
          'I vincitori in diretta sul nostro canale YouTube, poi nell’albo d’oro.',
      },
    ];
  });

  /** Il passo acceso dalla fase corrente. */
  protected readonly passoAttivo = computed<Passo['id'] | null>(() => {
    switch (this.fase()) {
      case 'PROPOSTE':
        return 'PROPOSTE';
      case 'CONTATTI':
      case 'ATTESA_VOTO':
        return 'CONTATTI';
      case 'VOTO':
        return 'VOTO';
      case 'ATTESA_RISULTATI':
      case 'RISULTATI':
        return 'PREMIAZIONE';
      case 'PRIMA':
      case null:
        return null;
    }
  });

  protected categorieDi(formato: CategoriaAwards['formato']) {
    return this.categorie.filter((c) => c.formato === formato);
  }

  protected giorno(iso: string, conAnno = false): string {
    return giornoAwards(iso, conAnno);
  }

  // ── Le proposte dell'iscritto ─────────────────────────────────────────────

  /** `null` = non ancora caricate; l'errore ha il suo signal (mai un «vuoto»). */
  protected readonly salvate = signal<Bozza | null>(null);
  protected readonly bozza = signal<Bozza>({});
  protected readonly erroreCaricamento = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly erroreSalvataggio = signal<string | null>(null);

  /** Categorie la cui bozza differisce da quanto salvato. */
  private readonly modificate = computed<AwardsCategoria[]>(() => {
    const salvate = this.salvate() ?? {};
    const bozza = this.bozza();
    return AWARDS_CATEGORIE.filter(
      (c) => (bozza[c] ?? '').trim() !== (salvate[c] ?? ''),
    );
  });

  protected readonly sporco = computed(() => this.modificate().length > 0);
  protected readonly quanteSalvate = computed(
    () => Object.values(this.salvate() ?? {}).filter((v) => !!v).length,
  );

  /** Le proposte sono già state caricate per questo utente. */
  private caricatoPer: string | null = null;

  // ── La candidatura dell'iscritto ──────────────────────────────────────────

  private readonly candidature = signal<AwardsMio['candidature']>([]);

  /** Solo le categorie ACCETTATE: sono le sole da cui ci si può ritirare. */
  protected readonly mieCategorie = computed<MiaCategoria[]>(() => {
    const etichette = new Map(
      this.categorie.map((c) => [c.categoria, c.etichetta]),
    );
    return this.candidature().flatMap((cand) =>
      cand.categorie
        .filter((k) => k.stato === 'ACCETTATA')
        .map((k) => ({
          chiave: `${cand.id}:${k.categoria}`,
          candidatoId: cand.id,
          nickname: cand.nickname,
          categoria: k.categoria,
          etichetta: etichette.get(k.categoria) ?? k.categoria,
        })),
    );
  });

  protected readonly confermaRitiro = signal<string | null>(null);
  protected readonly ritirando = signal(false);
  protected readonly erroreRitiro = signal<string | null>(null);

  constructor() {
    this.seo.setJsonLd('ld-awards-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    this.destroyRef.onDestroy(() => this.seo.removeJsonLd('ld-awards-faq'));

    // ⚠️ Gated su `auth.user()` (idioma di /docs): la rotta non ha guard, il
    // componente monta anche per un anonimo e in prerender, e `GET /awards/me`
    // vuole il JWT. Guardia «già caricato per questo id»: un refresh della
    // sessione rimette un oggetto `User` nuovo e non deve ricaricare niente.
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.caricatoPer = null;
        this.salvate.set(null);
        this.bozza.set({});
        this.candidature.set([]);
        return;
      }
      if (this.caricatoPer === user.id) return;
      this.caricatoPer = user.id;
      untracked(() => this.caricaProposte());
    });
  }

  protected caricaProposte(): void {
    this.erroreCaricamento.set(null);
    this.api.mio().subscribe({
      next: (mio) => {
        this.applicaSalvate(mio.proposte);
        this.candidature.set(mio.candidature);
      },
      error: (err: unknown) =>
        this.erroreCaricamento.set(
          apiErrorMessage(err, 'Non siamo riusciti a leggere le tue proposte.'),
        ),
    });
  }

  private applicaSalvate(proposte: PropostaAwards[]): void {
    const mappa: Bozza = {};
    for (const p of proposte) mappa[p.categoria] = p.nickname;
    this.salvate.set(mappa);
    this.bozza.set({ ...mappa });
  }

  protected onInput(categoria: AwardsCategoria, event: Event): void {
    const valore = (event.target as HTMLInputElement).value;
    this.bozza.update((b) => ({ ...b, [categoria]: valore }));
    this.erroreSalvataggio.set(null);
  }

  /** Manda solo le categorie cambiate; un campo svuotato toglie la proposta. */
  protected salva(): void {
    const cambiate = this.modificate();
    if (cambiate.length === 0 || this.salvando()) return;
    const bozza = this.bozza();
    this.salvando.set(true);
    this.erroreSalvataggio.set(null);
    this.api
      .salvaProposte(
        cambiate.map((categoria) => ({
          categoria,
          nickname: (bozza[categoria] ?? '').trim(),
        })),
      )
      .subscribe({
        next: (proposte) => {
          this.salvando.set(false);
          this.applicaSalvate(proposte);
          this.toast.success('Proposte salvate.');
        },
        error: (err: unknown) => {
          this.salvando.set(false);
          // ⚠️ Il messaggio del server si stampa così com'è: dice quale
          // categoria e quale regola, o che la fase è chiusa e quando.
          this.erroreSalvataggio.set(
            apiErrorMessage(err, 'Non siamo riusciti a salvare le proposte.'),
          );
        },
      });
  }

  /**
   * Il ritiro da una categoria (revoca del consenso, art. 7.3). ⚠️ Sempre
   * disponibile, anche a raccolta sospesa: revocare deve funzionare sempre.
   */
  protected ritira(c: MiaCategoria): void {
    if (this.ritirando()) return;
    this.ritirando.set(true);
    this.erroreRitiro.set(null);
    this.api.ritira(c.candidatoId, [c.categoria]).subscribe({
      next: () => {
        this.ritirando.set(false);
        this.confermaRitiro.set(null);
        this.candidature.update((elenco) =>
          elenco.map((cand) =>
            cand.id !== c.candidatoId
              ? cand
              : {
                  ...cand,
                  categorie: cand.categorie.map((k) =>
                    k.categoria === c.categoria
                      ? { ...k, stato: 'RITIRATA' as const }
                      : k,
                  ),
                },
          ),
        );
        this.toast.success(`Ti sei ritirato da «${c.etichetta}».`);
      },
      error: (err: unknown) => {
        this.ritirando.set(false);
        // ⚠️ Si disarma la conferma: lo stesso errore non cambia riprovando.
        this.confermaRitiro.set(null);
        this.erroreRitiro.set(
          apiErrorMessage(err, 'Non siamo riusciti a ritirarti.'),
        );
      },
    });
  }
}
