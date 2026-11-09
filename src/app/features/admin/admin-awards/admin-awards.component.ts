import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AWARDS_CATEGORIE,
  AwardsCategoria,
  AwardsFase,
  CandidatoAdmin,
  CategoriaSpoglio,
  DateAwards,
  EdizioneAwardsAdmin,
  StatoCandidatura,
  StatoInvito,
  VoceSpoglio,
} from '../../../core/models/awards.models';
import { AwardsService } from '../../../core/services/awards.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CATEGORIE_AWARDS } from '../../awards/awards.data';
import { TonoStato } from '../admin-stato';

type Vista = 'proposte' | 'candidati' | 'edizione';
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
  }

  // ── Etichette ─────────────────────────────────────────────────────────────

  protected statoCand = etichettaStatoCandidatura;
  protected tonoCand = tonoStatoCandidatura;
  protected statoInvito = etichettaInvito;
  protected tonoInvito = tonoInvito;
  protected fase = etichettaFase;

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
