import { Role } from './api.models';
import { haScadenza, ROLE_ORDER, roleSatisfies } from './roles';

/**
 * Lo specchio client della scala dei ruoli. ⚠️ Nessun test può verificare che
 * combaci col server — sono due repo — quindi qui si pinnano le CONSEGUENZE
 * visibili: chi vede l'upsell «Abbonati», quale card del Negozio è comprabile,
 * quali voci compaiono nella tendina del pannello. Sono tutti difetti muti: il
 * build resta verde e la pagina mostra la cosa sbagliata alla persona sbagliata.
 */
describe('Scala dei ruoli (client)', () => {
  it('Stakato e Coach superano ogni gate di contenuto', () => {
    for (const ruolo of ['STAKATO', 'COACH'] as const) {
      expect(roleSatisfies(ruolo, 'USER')).toBe(true);
      expect(roleSatisfies(ruolo, 'PESCE_ROSSO')).toBe(true);
      expect(roleSatisfies(ruolo, 'SQUALO')).toBe(true);
    }
  });

  it('Stakato e Coach NON superano il livello admin', () => {
    // Il pannello resta chiuso: `roleGuard(['ADMIN'])` e `auth.isAdmin()` usano
    // comunque l'uguaglianza stretta, ma anche per rango non passerebbero.
    expect(roleSatisfies('STAKATO', 'ADMIN')).toBe(false);
    expect(roleSatisfies('COACH', 'ADMIN')).toBe(false);
  });

  it('un ruolo assente vale meno di USER (sessione non caricata, o rollback)', () => {
    expect(roleSatisfies(null, 'USER')).toBe(false);
    expect(roleSatisfies(undefined, 'USER')).toBe(false);
  });

  it('ROLE_ORDER contiene ogni ruolo, una volta sola', () => {
    // ⚠️ È la lista che alimenta la tendina del ruolo e il filtro in /admin/iscritti:
    // se ne perde uno, quel ruolo non è assegnabile da nessuna parte del sito.
    // La guardia vera è di TIPO (in roles.ts) e non compila; questa protegge
    // dal caso opposto, un duplicato, che il tipo non vede.
    expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length);
    for (const r of [
      'USER',
      'PESCE_ROSSO',
      'SQUALO',
      'STAKATO',
      'COACH',
      'ADMIN',
    ] as Role[]) {
      expect(ROLE_ORDER).toContain(r);
    }
  });

  it('solo i due tier acquistabili hanno una scadenza', () => {
    expect(haScadenza('PESCE_ROSSO')).toBe(true);
    expect(haScadenza('SQUALO')).toBe(true);
    // ⚠️ Da qui dipende cosa scrive la colonna «Scadenza» del pannello: per uno
    // Stakato deve dire «Mai», che è un'informazione — non restare vuota, che
    // si legge come un dato mancante.
    expect(haScadenza('STAKATO')).toBe(false);
    expect(haScadenza('COACH')).toBe(false);
    expect(haScadenza('USER')).toBe(false);
    expect(haScadenza('ADMIN')).toBe(false);
  });

  describe('la regola del Negozio: comprare un abbonamento darebbe qualcosa?', () => {
    // Copia della regola di `shop.component.ts` `isDowngrade`, che è a sua
    // volta quella del server: «lo soddisfa già ma non è esattamente quello».
    const giaIncluso = (role: Role, tier: 'PESCE_ROSSO' | 'SQUALO') =>
      role !== tier && roleSatisfies(role, tier);

    it('a chi ha già accesso pieno senza averlo comprato non si vende niente', () => {
      // ⚠️ È il caso che la vecchia tabella di ranghi locale sbagliava: a rango
      // pari il confronto `>` dava false, quindi la card «Squalo» restava
      // acquistabile e il rifiuto arrivava dal server dopo il clic.
      expect(giaIncluso('STAKATO', 'SQUALO')).toBe(true);
      expect(giaIncluso('COACH', 'SQUALO')).toBe(true);
      expect(giaIncluso('ADMIN', 'SQUALO')).toBe(true);
    });

    it('il rinnovo dello stesso tier resta possibile', () => {
      expect(giaIncluso('SQUALO', 'SQUALO')).toBe(false);
      expect(giaIncluso('PESCE_ROSSO', 'PESCE_ROSSO')).toBe(false);
    });

    it("l'upgrade resta possibile, il downgrade no", () => {
      expect(giaIncluso('PESCE_ROSSO', 'SQUALO')).toBe(false);
      expect(giaIncluso('SQUALO', 'PESCE_ROSSO')).toBe(true);
    });
  });
});
