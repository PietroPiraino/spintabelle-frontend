import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  ANNUNCI_AWARDS,
  AWARDS_CATEGORIE,
  AnnuncioAwards,
  AwardsCategoria,
  AwardsFase,
  CandidatoAdmin,
  CardFormato,
  CategoriaRosa,
  CategoriaSpoglio,
  CategoriaVoti,
  DateAwards,
  EdizioneAwardsAdmin,
  EsitoRosa,
  FinalistaVoti,
  RiepilogoVoti,
  RosaAdmin,
  StatoAnnuncio,
  StatoCandidatura,
  StatoInvito,
  VoceSpoglio,
  Votante,
} from '../../../core/models/awards.models';
import { AwardsService } from '../../../core/services/awards.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import {
  messaggioErroreBlob,
  scaricaBlob,
} from '../../../core/utils/scarica-blob';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CATEGORIE_AWARDS } from '../../awards/awards.data';
import { TonoStato } from '../admin-stato';

type Vista = 'proposte' | 'candidati' | 'rosa' | 'voti' | 'edizione';
type CampoData = keyof DateAwards;

const CAMPI_DATA: readonly { campo: CampoData; etichetta: string }[] = [
  { campo: 'proposteDal', etichetta: 'Proposte: apertura' },
  { campo: 'proposteAl', etichetta: 'Proposte: chiusura' },
  { campo: 'contattiAl', etichetta: 'Fine dei contatti (scadenza dei link)' },
  { campo: 'votoDal', etichetta: 'Voto: apertura' },
  { campo: 'votoAl', etichetta: 'Voto: chiusura' },
  { campo: 'cerimoniaAt', etichetta: 'Cerimonia' },
];

/** ISO → valore di un `<input type="datetime-local">`, nel fuso del browser. */
export function aDataLocale(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function etichettaStatoCandidatura(s: StatoCandidatura | null): string {
  switch (s) {
    case 'INVITATO':
      return 'In attesa';
    case 'ACCETTATA':
      return 'Accettata';
    case 'RIFIUTATA':
      return 'Rifiutata';
    case 'RITIRATA':
      return 'Ritirata';
    case null:
      return '—';
  }
}

function tonoStatoCandidatura(s: StatoCandidatura | null): TonoStato {
  switch (s) {
    case 'INVITATO':
      return 'attesa';
    case 'ACCETTATA':
      return 'ok';
    case 'RIFIUTATA':
      return 'allarme';
    case 'RITIRATA':
      return 'neutro';
    case null:
      return 'spento';
  }
}

function etichettaInvito(s: StatoInvito): string {
  switch (s) {
    case 'VALIDO':
      return 'Link valido';
    case 'USATO':
      return 'Ha risposto';
    case 'SCADUTO':
      return 'Link scaduto';
    case 'ASSENTE':
      return 'Nessun link';
  }
}

function tonoInvito(s: StatoInvito): TonoStato {
  switch (s) {
    case 'VALIDO':
      return 'attesa';
    case 'USATO':
      return 'concluso';
    case 'SCADUTO':
      return 'neutro';
    case 'ASSENTE':
      return 'spento';
  }
}

function etichettaEsitoRosa(e: EsitoRosa, n: number): string {
  switch (e) {
    case 'OK':
      return `${n} finalisti`;
    case 'NON_ASSEGNATA':
      return 'Non assegnata';
    case 'POCHI':
      return n === 1 ? '1 finalista: pochi' : `${n} finalisti: pochi`;
    case 'TROPPI':
      return `${n} finalisti: troppi`;
  }
}

function tonoEsitoRosa(e: EsitoRosa): TonoStato {
  switch (e) {
    case 'OK':
      return 'ok';
    case 'NON_ASSEGNATA':
      return 'spento';
    case 'POCHI':
    case 'TROPPI':
      return 'allarme';
  }
}

export function etichettaAnnuncio(t: AnnuncioAwards): string {
  switch (t) {
    case 'proposte-aperte':
      return 'Sono aperte le proposte';
    case 'voto-aperto':
      return 'Il voto è aperto';
  }
}

function etichettaFase(f: AwardsFase): string {
  switch (f) {
    case 'PRIMA':
      return 'Prima delle proposte';
    case 'PROPOSTE':
      return 'Proposte aperte';
    case 'CONTATTI':
      return 'Contatti in corso';
    case 'ATTESA_VOTO':
      return 'In attesa del voto';
    case 'VOTO':
      return 'Voto aperto';
    case 'ATTESA_RISULTATI':
      return 'Voto chiuso';
    case 'RISULTATI':
      return 'Risultati pubblicati';
  }
}

/**
 * «Awards» — lo spoglio delle proposte, i candidati e le date dell'edizione
 * (voce di registro A20).
 *
 * ⚠️ Lo spoglio è privato: vive solo qui, e non esiste una rotta pubblica che
 * ne restituisca le cifre.
 * ⚠️ Il link d'invito si vede UNA volta, nella modale che l'ha generato: chi lo
 * possiede può accettare a nome della persona, quindi non lo conserviamo e non
 * lo rimostriamo. Per questo la modale col link aperto è «sporca» finché il
 * link non è stato copiato: Escape chiede conferma invece di buttarlo via.
 * ⚠️ Dentro una modale gli esiti sono bande, mai toast: il `<dialog>` sta nel
 * top layer e un toast dipingerebbe dietro il fondale.
 */
@Component({
  selector: 'app-admin-awards',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    IconComponent,
    ModalComponent,
    SchedeComponent,
  ],
  templateUrl: './admin-awards.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    '../admin-cruscotto.scss',
    './admin-awards.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAwardsComponent {
  private readonly api = inject(AwardsService);
  private readonly toast = inject(ToastService);

  protected readonly schede: readonly VoceScheda<Vista>[] = [
    { valore: 'proposte', etichetta: 'Proposte' },
    { valore: 'candidati', etichetta: 'Candidati' },
    { valore: 'rosa', etichetta: 'Rosa finale' },
    { valore: 'voti', etichetta: 'Voti' },
    { valore: 'edizione', etichetta: 'Edizione' },
  ];
  protected readonly vista = signal<Vista>('proposte');
  protected readonly categorie = CATEGORIE_AWARDS;
  protected readonly campiData = CAMPI_DATA;

  protected readonly edizione = signal<EdizioneAwardsAdmin | null>(null);
  protected readonly spoglio = signal<CategoriaSpoglio[] | null>(null);
  protected readonly candidati = signal<CandidatoAdmin[] | null>(null);
  protected readonly errore = signal<string | null>(null);

  protected readonly totaleProposte = computed(
    () => this.spoglio()?.reduce((s, c) => s + c.totale, 0) ?? 0,
  );

  constructor() {
    this.ricarica();
  }

  protected ricarica(): void {
    this.errore.set(null);
    const fallito = (err: unknown) =>
      this.errore.set(apiErrorMessage(err, 'Non riusciamo a leggere i premi.'));
    this.api.edizioneAdmin().subscribe({
      next: (e) => {
        this.edizione.set(e);
        this.riempiDate(e);
      },
      error: fallito,
    });
    this.api.spoglio().subscribe({
      next: (s) => this.spoglio.set(s),
      error: fallito,
    });
    this.api.candidati().subscribe({
      next: (c) => this.candidati.set(c),
      error: fallito,
    });
  }

  protected scegliVista(v: Vista): void {
    this.vista.set(v);
    // Lo stato dell'email si legge entrando nella scheda: conta gli iscritti,
    // e chi apre il pannello per lo spoglio non ne ha bisogno.
    if (v === 'edizione' && !this.annuncio() && !this.caricandoAnnuncio()) {
      // A voto aperto l'email che serve è quella del voto.
      if (this.edizione()?.fase === 'VOTO') this.tipoAnnuncio.set('voto-aperto');
      this.caricaAnnuncio();
    }
    // Rosa e voti si leggono entrando (e si rileggono a ogni ingresso: sono
    // numeri che cambiano mentre il pannello resta aperto).
    if (v === 'rosa') this.caricaRosa();
    if (v === 'voti') this.caricaVoti();
  }

  // ── Etichette ─────────────────────────────────────────────────────────────

  protected statoCand = etichettaStatoCandidatura;
  protected tonoCand = tonoStatoCandidatura;
  protected statoInvito = etichettaInvito;
  protected tonoInvito = tonoInvito;
  protected fase = etichettaFase;
  protected esitoRosa = etichettaEsitoRosa;
  protected tonoRosa = tonoEsitoRosa;
  protected etichettaAnnuncio = etichettaAnnuncio;
  protected readonly annunci = ANNUNCI_AWARDS;

  protected riassunto(c: CandidatoAdmin): string {
    const conta = (s: StatoCandidatura) =>
      c.categorie.filter((k) => k.stato === s).length;
    const parti = [
      [conta('ACCETTATA'), 'accettate'],
      [conta('INVITATO'), 'in attesa'],
      [conta('RIFIUTATA'), 'rifiutate'],
      [conta('RITIRATA'), 'ritirate'],
    ]
      .filter(([n]) => (n as number) > 0)
      .map(([n, l]) => `${n} ${l}`);
    return parti.join(' · ') || 'nessuna categoria';
  }

  // ── Edizione ──────────────────────────────────────────────────────────────

  protected readonly date = signal<Partial<Record<CampoData, string>>>({});
  private dateOriginali: Partial<Record<CampoData, string>> = {};
  protected readonly salvandoDate = signal(false);
  protected readonly erroreDate = signal<string | null>(null);

  protected readonly dateCambiate = computed(() =>
    CAMPI_DATA.filter(
      ({ campo }) => this.date()[campo] !== this.dateOriginali[campo],
    ).map(({ campo }) => campo),
  );

  private riempiDate(e: EdizioneAwardsAdmin): void {
    const locali: Partial<Record<CampoData, string>> = {};
    for (const { campo } of CAMPI_DATA) locali[campo] = aDataLocale(e[campo]);
    this.dateOriginali = { ...locali };
    this.date.set(locali);
  }

  protected scriviData(campo: CampoData, event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.date.update((d) => ({ ...d, [campo]: v }));
    this.erroreDate.set(null);
  }

  /** Manda SOLO le date toccate: le altre conservano i loro secondi. */
  protected salvaDate(): void {
    const cambiate = this.dateCambiate();
    if (cambiate.length === 0 || this.salvandoDate()) return;
    const corpo: Partial<DateAwards> = {};
    for (const campo of cambiate) {
      const v = this.date()[campo];
      if (!v) {
        this.erroreDate.set('Tutte le date sono obbligatorie.');
        return;
      }
      corpo[campo] = new Date(v).toISOString();
    }
    this.salvandoDate.set(true);
    this.api.aggiornaEdizione(corpo).subscribe({
      next: (e) => {
        this.salvandoDate.set(false);
        this.edizione.set(e);
        this.riempiDate(e);
        this.toast.success('Date dei premi aggiornate.');
      },
      error: (err: unknown) => {
        this.salvandoDate.set(false);
        this.erroreDate.set(
          apiErrorMessage(err, 'Non siamo riusciti a salvare le date.'),
        );
      },
    });
  }

  // ── Email agli iscritti ──────────────────────────────────────────────────

  /** Quale email: ognuna ha il suo testo, la sua fase e il suo cursore. */
  protected readonly tipoAnnuncio = signal<AnnuncioAwards>('proposte-aperte');
  protected readonly annuncio = signal<StatoAnnuncio | null>(null);
  protected readonly caricandoAnnuncio = signal(false);
  protected readonly erroreAnnuncio = signal<string | null>(null);
  /**
   * Quante email per pressione. ⚠️ 90 e non 100: col piano gratuito di Resend
   * il tetto è di 100 al giorno, e ci devono stare anche le email di verifica
   * dei nuovi iscritti che il lancio porta.
   */
  protected readonly quanteEmail = signal(90);
  protected readonly confermaInvio = signal(false);
  protected readonly invioInVolo = signal<'prova' | 'invio' | null>(null);
  protected readonly esitoAnnuncio = signal<{
    testo: string;
    errore: boolean;
  } | null>(null);

  /** Quante partirebbero davvero: il numero scelto, ma non oltre i restanti. */
  protected readonly prossimi = computed(() =>
    Math.min(this.quanteEmail(), this.annuncio()?.restanti ?? 0),
  );

  protected caricaAnnuncio(): void {
    this.caricandoAnnuncio.set(true);
    this.erroreAnnuncio.set(null);
    this.api.statoAnnuncio(this.tipoAnnuncio()).subscribe({
      next: (a) => {
        this.caricandoAnnuncio.set(false);
        this.annuncio.set(a);
      },
      error: (err: unknown) => {
        this.caricandoAnnuncio.set(false);
        this.erroreAnnuncio.set(
          apiErrorMessage(err, 'Non riusciamo a leggere lo stato dell’email.'),
        );
      },
    });
  }

  protected scegliAnnuncio(event: Event): void {
    const t = (event.target as HTMLSelectElement).value as AnnuncioAwards;
    if (t === this.tipoAnnuncio()) return;
    this.tipoAnnuncio.set(t);
    this.annuncio.set(null);
    this.esitoAnnuncio.set(null);
    this.confermaInvio.set(false);
    this.caricaAnnuncio();
  }

  protected scriviQuante(event: Event): void {
    const n = Math.floor(Number((event.target as HTMLInputElement).value));
    this.quanteEmail.set(Number.isFinite(n) ? Math.min(1000, Math.max(1, n)) : 1);
    this.confermaInvio.set(false);
  }

  protected mandaProva(): void {
    if (this.invioInVolo()) return;
    this.invioInVolo.set('prova');
    this.esitoAnnuncio.set(null);
    this.api.inviaAnnuncio(this.tipoAnnuncio(), { prova: true }).subscribe({
      next: (es) => {
        this.invioInVolo.set(null);
        this.annuncio.set(es.stato);
        this.esitoAnnuncio.set(
          es.errore
            ? {
                testo: `La prova non è partita. Resend ha risposto: «${es.errore}»`,
                errore: true,
              }
            : {
                testo:
                  'Prova inviata al tuo indirizzo: controlla la casella (anche lo spam) prima di mandarla a tutti.',
                errore: false,
              },
        );
      },
      error: (err: unknown) => this.invioFallito(err),
    });
  }

  protected chiediInvio(): void {
    if (this.prossimi() > 0) this.confermaInvio.set(true);
  }

  protected annullaInvio(): void {
    this.confermaInvio.set(false);
  }

  protected invia(): void {
    if (this.invioInVolo() || this.prossimi() === 0) return;
    this.invioInVolo.set('invio');
    this.esitoAnnuncio.set(null);
    this.api
      .inviaAnnuncio(this.tipoAnnuncio(), { limite: this.quanteEmail() })
      .subscribe({
        next: (es) => {
          this.invioInVolo.set(null);
          this.confermaInvio.set(false);
          this.annuncio.set(es.stato);
          const fatte = `${es.inviati} ${es.inviati === 1 ? 'email inviata' : 'email inviate'}`;
          const resto =
            es.stato.restanti > 0
              ? ` Ne restano ${es.stato.restanti}.`
              : ' Hanno ricevuto l’email tutti gli iscritti.';
          this.esitoAnnuncio.set(
            es.errore
              ? {
                  testo: `${fatte}, poi l’invio si è fermato. Resend ha risposto: «${es.errore}». Riprendi più tardi: si riparte da dove si è fermato.`,
                  errore: true,
                }
              : { testo: `${fatte}.${resto}`, errore: false },
          );
        },
        error: (err: unknown) => this.invioFallito(err),
      });
  }

  private invioFallito(err: unknown): void {
    this.invioInVolo.set(null);
    this.confermaInvio.set(false);
    this.esitoAnnuncio.set({
      testo: apiErrorMessage(err, 'Non siamo riusciti a mandare l’email.'),
      errore: true,
    });
  }

  // ── Rosa finale ──────────────────────────────────────────────────────────

  protected readonly rosa = signal<RosaAdmin | null>(null);
  protected readonly erroreRosa = signal<string | null>(null);
  /** La casella in volo (`id:categoria`): una alla volta. */
  protected readonly finalistaInVolo = signal<string | null>(null);
  protected readonly confermaPubblica = signal(false);
  protected readonly pubblicando = signal(false);
  protected readonly cardInVolo = signal<string | null>(null);

  /** Categorie che impediscono la pubblicazione (1-2 finalisti, o più di 5). */
  protected readonly rosaBloccata = computed(
    () =>
      this.rosa()?.categorie.filter(
        (c) => c.esito === 'POCHI' || c.esito === 'TROPPI',
      ) ?? [],
  );
  protected readonly rosaVuota = computed(
    () => !!this.rosa()?.categorie.every((c) => c.esito === 'NON_ASSEGNATA'),
  );

  protected caricaRosa(): void {
    this.erroreRosa.set(null);
    this.api.rosa().subscribe({
      next: (r) => this.rosa.set(r),
      error: (err: unknown) =>
        this.erroreRosa.set(
          apiErrorMessage(err, 'Non riusciamo a leggere la rosa finale.'),
        ),
    });
  }

  protected impostaFinalista(
    cat: CategoriaRosa,
    voce: CategoriaRosa['accettati'][number],
    event: Event,
  ): void {
    const casella = event.target as HTMLInputElement;
    const finalista = casella.checked;
    if (this.finalistaInVolo()) {
      casella.checked = !finalista;
      return;
    }
    this.finalistaInVolo.set(`${voce.id}:${cat.categoria}`);
    this.erroreRosa.set(null);
    this.api.impostaFinalista(voce.id, cat.categoria, finalista).subscribe({
      next: (c) => {
        this.finalistaInVolo.set(null);
        this.sostituisci(c);
        this.caricaRosa();
      },
      error: (err: unknown) => {
        this.finalistaInVolo.set(null);
        // ⚠️ La casella torna com'era: il server non ha scritto niente.
        casella.checked = !finalista;
        this.erroreRosa.set(
          apiErrorMessage(err, 'Non siamo riusciti a cambiare la rosa.'),
        );
      },
    });
  }

  protected pubblica(): void {
    if (this.pubblicando()) return;
    this.pubblicando.set(true);
    this.erroreRosa.set(null);
    this.api.pubblicaFinalisti().subscribe({
      next: () => {
        this.pubblicando.set(false);
        this.confermaPubblica.set(false);
        this.caricaRosa();
        this.api.edizioneAdmin().subscribe({
          next: (e) => this.edizione.set(e),
          error: () => undefined,
        });
        this.toast.success(
          'Rosa finale pubblicata: la pagina Awards la mostra fra qualche minuto.',
        );
      },
      error: (err: unknown) => {
        this.pubblicando.set(false);
        // ⚠️ Si disarma la conferma: lo stesso errore non cambia riprovando.
        this.confermaPubblica.set(false);
        this.erroreRosa.set(
          apiErrorMessage(err, 'Non siamo riusciti a pubblicare la rosa.'),
        );
      },
    });
  }

  /** L'anteprima della card, anche prima della pubblicazione. */
  protected scaricaCard(
    id: string,
    categoria: AwardsCategoria,
    formato: CardFormato,
  ): void {
    if (this.cardInVolo()) return;
    this.cardInVolo.set(`${id}:${categoria}:${formato}`);
    this.api.cardAdmin(id, categoria, formato).subscribe({
      next: (blob) => {
        this.cardInVolo.set(null);
        scaricaBlob(blob, `awards-2026-${categoria}-${formato}.png`);
      },
      error: (err: unknown) => {
        this.cardInVolo.set(null);
        void messaggioErroreBlob(err, 'Card non generata.').then((m) =>
          this.erroreRosa.set(m),
        );
      },
    });
  }

  // ── Voti (controllo antifrode) ───────────────────────────────────────────

  protected readonly voti = signal<RiepilogoVoti | null>(null);
  protected readonly erroreVoti = signal<string | null>(null);

  protected caricaVoti(): void {
    this.erroreVoti.set(null);
    this.api.riepilogoVoti().subscribe({
      next: (r) => this.voti.set(r),
      error: (err: unknown) =>
        this.erroreVoti.set(apiErrorMessage(err, 'Non riusciamo a leggere i voti.')),
    });
  }

  /** La modale dei votanti di un finalista. */
  protected readonly votantiDi = signal<{
    categoria: CategoriaVoti;
    finalista: FinalistaVoti;
  } | null>(null);
  protected readonly votanti = signal<Votante[] | null>(null);
  protected readonly erroreVotanti = signal<string | null>(null);
  /** Il voto in conferma d'annullamento, e il motivo che si sta scrivendo. */
  protected readonly annullaId = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly annullando = signal(false);

  protected apriVotanti(categoria: CategoriaVoti, finalista: FinalistaVoti): void {
    this.votantiDi.set({ categoria, finalista });
    this.annullaId.set(null);
    this.motivo.set('');
    this.caricaVotanti();
  }

  protected caricaVotanti(): void {
    const v = this.votantiDi();
    if (!v) return;
    this.votanti.set(null);
    this.erroreVotanti.set(null);
    this.api.votanti(v.categoria.categoria, v.finalista.id).subscribe({
      next: (l) => this.votanti.set(l),
      error: (err: unknown) =>
        this.erroreVotanti.set(
          apiErrorMessage(err, 'Non riusciamo a leggere i votanti.'),
        ),
    });
  }

  protected chiudiVotanti(): void {
    this.votantiDi.set(null);
    this.votanti.set(null);
    this.annullaId.set(null);
  }

  protected chiediAnnulla(v: Votante): void {
    this.annullaId.set(v.votoId);
    this.motivo.set('');
    this.erroreVotanti.set(null);
  }

  protected scriviMotivo(event: Event): void {
    this.motivo.set((event.target as HTMLInputElement).value);
  }

  protected annulla(): void {
    const id = this.annullaId();
    const motivo = this.motivo().trim();
    if (!id || motivo.length < 3 || this.annullando()) return;
    this.annullando.set(true);
    this.erroreVotanti.set(null);
    this.api.annullaVoto(id, motivo).subscribe({
      next: () => {
        this.annullando.set(false);
        this.annullaId.set(null);
        this.caricaVotanti();
        this.caricaVoti();
      },
      error: (err: unknown) => {
        this.annullando.set(false);
        this.annullaId.set(null);
        // ⚠️ Dentro la modale: banda, mai toast (il toast dipinge dietro).
        this.erroreVotanti.set(
          apiErrorMessage(err, 'Non siamo riusciti ad annullare il voto.'),
        );
      },
    });
  }

  // ── Modale: invito nuovo e scheda del candidato ──────────────────────────

  protected readonly modale = signal<'invito' | 'scheda' | null>(null);
  protected readonly nickname = signal('');
  protected readonly scelte = signal<ReadonlySet<AwardsCategoria>>(new Set());
  protected readonly inVolo = signal(false);
  protected readonly erroreModale = signal<string | null>(null);
  /** Il link appena generato: si mostra una volta, e poi si dimentica. */
  protected readonly link = signal<string | null>(null);
  protected readonly copiato = signal(false);
  protected readonly schedaId = signal<string | null>(null);
  protected readonly confermaRimozione = signal(false);

  protected readonly scheda = computed(
    () => this.candidati()?.find((c) => c.id === this.schedaId()) ?? null,
  );

  /** Le categorie che si possono ancora aggiungere al candidato aperto. */
  protected readonly mancanti = computed(() => {
    const presenti = new Set(this.scheda()?.categorie.map((c) => c.categoria));
    return this.categorie.filter((c) => !presenti.has(c.categoria));
  });

  /** ⚠️ Un link mostrato e non ancora copiato è un lavoro da non perdere. */
  protected readonly sporco = computed(() => !!this.link() && !this.copiato());

  /** «Invita» dallo spoglio: precompila le categorie in cui è stato proposto. */
  protected apriInvito(voce: VoceSpoglio): void {
    const dove = new Set<AwardsCategoria>();
    for (const cat of this.spoglio() ?? []) {
      if (cat.voci.some((v) => v.nicknameKey === voce.nicknameKey)) {
        dove.add(cat.categoria);
      }
    }
    this.nickname.set(voce.nickname);
    this.scelte.set(dove);
    this.apri('invito');
  }

  protected apriScheda(c: CandidatoAdmin): void {
    this.schedaId.set(c.id);
    this.scelte.set(new Set());
    this.apri('scheda');
  }

  private apri(m: 'invito' | 'scheda'): void {
    this.link.set(null);
    this.copiato.set(false);
    this.erroreModale.set(null);
    this.confermaRimozione.set(false);
    this.modale.set(m);
  }

  protected chiudi(): void {
    this.modale.set(null);
    this.link.set(null);
    this.schedaId.set(null);
  }

  protected scriviNickname(event: Event): void {
    this.nickname.set((event.target as HTMLInputElement).value);
  }

  protected scegli(c: AwardsCategoria, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.scelte.update((s) => {
      const n = new Set(s);
      if (on) n.add(c);
      else n.delete(c);
      return n;
    });
  }

  private ordinate(): AwardsCategoria[] {
    return AWARDS_CATEGORIE.filter((c) => this.scelte().has(c));
  }

  protected creaInvito(): void {
    if (this.inVolo() || this.scelte().size === 0) return;
    this.inVolo.set(true);
    this.erroreModale.set(null);
    this.api.creaCandidato(this.nickname(), this.ordinate()).subscribe({
      next: ({ candidato, link }) => {
        this.inVolo.set(false);
        this.link.set(link);
        this.candidati.update((l) => [...(l ?? []), candidato]);
        this.ricaricaSpoglio();
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non siamo riusciti a creare l’invito.'),
        );
      },
    });
  }

  protected aggiungi(): void {
    const id = this.schedaId();
    if (!id || this.inVolo() || this.scelte().size === 0) return;
    this.inVolo.set(true);
    this.erroreModale.set(null);
    this.api.aggiungiCategorie(id, this.ordinate()).subscribe({
      next: (c) => {
        this.inVolo.set(false);
        this.scelte.set(new Set());
        this.sostituisci(c);
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non siamo riusciti ad aggiungere le categorie.'),
        );
      },
    });
  }

  protected rinnova(): void {
    const id = this.schedaId();
    if (!id || this.inVolo()) return;
    this.inVolo.set(true);
    this.erroreModale.set(null);
    this.api.rinnovaInvito(id).subscribe({
      next: ({ candidato, link }) => {
        this.inVolo.set(false);
        this.sostituisci(candidato);
        this.copiato.set(false);
        this.link.set(link);
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non siamo riusciti a generare il link.'),
        );
      },
    });
  }

  protected rimuovi(): void {
    const id = this.schedaId();
    if (!id || this.inVolo()) return;
    this.inVolo.set(true);
    this.erroreModale.set(null);
    this.api.rimuoviCandidato(id).subscribe({
      next: () => {
        this.inVolo.set(false);
        const nome = this.scheda()?.nickname ?? 'Il candidato';
        this.candidati.update((l) => (l ?? []).filter((c) => c.id !== id));
        this.chiudi();
        this.ricaricaSpoglio();
        // A modale chiusa il toast si vede.
        this.toast.success(`${nome} tolto dai premi.`);
      },
      error: (err: unknown) => {
        this.inVolo.set(false);
        // ⚠️ Si disarma la conferma: lo stesso errore non cambia riprovando.
        this.confermaRimozione.set(false);
        this.erroreModale.set(
          apiErrorMessage(err, 'Non siamo riusciti a togliere il candidato.'),
        );
      },
    });
  }

  private sostituisci(c: CandidatoAdmin): void {
    this.candidati.update((l) => (l ?? []).map((x) => (x.id === c.id ? c : x)));
  }

  private ricaricaSpoglio(): void {
    this.api.spoglio().subscribe({
      next: (s) => this.spoglio.set(s),
      error: () => undefined,
    });
  }

  /**
   * Copia il link. ⚠️ `navigator.clipboard` manca fuori da un contesto sicuro:
   * si ripiega sul campo, che resta comunque visibile e selezionabile. L'esito
   * è una riga nella modale, mai un toast.
   */
  protected copia(campo: HTMLInputElement): void {
    const testo = this.link();
    if (!testo) return;
    const ok = () => this.copiato.set(true);
    const clip = navigator.clipboard as Clipboard | undefined;
    if (clip?.writeText) {
      clip.writeText(testo).then(ok, () => this.copiaRipiego(campo, ok));
      return;
    }
    this.copiaRipiego(campo, ok);
  }

  private copiaRipiego(campo: HTMLInputElement, ok: () => void): void {
    campo.select();
    let riuscito = false;
    try {
      riuscito = document.execCommand('copy');
    } catch {
      riuscito = false;
    }
    if (riuscito) ok();
    else this.erroreModale.set('Copia non riuscita: seleziona il link a mano.');
  }
}
