import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminActionLogEntry,
  AdminUser,
  AdminUsersPage,
  Incassante,
  LessonViewSummary,
  Paginated,
  Role,
  SubscriptionRequest,
  SubscriptionTier,
  UserLiveAttendance,
} from '../models/api.models';

const API = environment.API_URL;

/** Gestione iscritti dal pannello admin (rotte ADMIN-only su /admin/users). */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);

  list(filters?: {
    q?: string;
    role?: Role;
    expiring?: number;
    page?: number;
    limit?: number;
  }): Observable<AdminUsersPage> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.expiring) params = params.set('expiring', filters.expiring);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<AdminUsersPage>(`${API}/admin/users`, { params });
  }

  updateRole(id: string, role: Role): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/admin/users/${id}/role`, { role });
  }

  /** Imposta (ISO) o rimuove (null) la scadenza abbonamento. */
  setSubscriptionExpiry(
    id: string,
    expiresAt: string | null,
    notify?: boolean,
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/admin/users/${id}/subscription`, {
      expiresAt,
      ...(notify ? { notify: true } : {}),
    });
  }

  /** Concessione manuale di un abbonamento (tier + scadenza assoluta). */
  /**
   * Concede un abbonamento a mano, e — se in contanti — ne REGISTRA l'incasso.
   *
   * ⚠️ I quattro campi del contante sono arrivati qui il 10/09/2026, e fino ad
   * allora questa chiamata non li mandava: il server li accettava da sempre, ma
   * **dall'interfaccia un incasso in contanti non si poteva registrare**. Il
   * lotto dei contanti era completo lato backend e muto lato UI.
   *
   * ⚠️ Si mandano SOLO se presenti, come già per `sostituisciRichiestaInAttesa`:
   * `forbidNonWhitelisted` è globale, e un campo che il server non conosce fa
   * fallire l'INTERA chiamata con un 400.
   *
   * ⚠️ Con `metodo: 'contanti'` importo e incassante sono OBBLIGATORI lato
   * server, e per una ragione che vale la pena conoscere: chi registra un
   * contante deve snapshottare i due prezzi, o l'espressione dell'incasso
   * ricade sul listino e un contante da 80 € risulta 125 €.
   */
  grantSubscription(
    id: string,
    tier: SubscriptionTier,
    expiresAt: string,
    note?: string,
    sostituisciRichiestaInAttesa?: boolean,
    incasso?: {
      // ⚠️ Il campo del DTO si chiama `paymentMethod`, non `metodo`: con il
      // nome sbagliato `forbidNonWhitelisted` risponde 400 «property metodo
      // should not exist» sull'INTERA chiamata. Nessun tipo lo coglie — il
      // corpo è un oggetto libero — e infatti l'ha colto solo la prova a mano.
      paymentMethod: 'contanti';
      importoEur: number;
      incassatoDa: Incassante;
      dataIncasso?: string;
    },
  ): Observable<AdminUser> {
    return this.http.post<AdminUser>(
      `${API}/admin/users/${id}/grant-subscription`,
      {
        tier,
        expiresAt,
        ...(note ? { note } : {}),
        ...(incasso
          ? {
              paymentMethod: incasso.paymentMethod,
              importoEur: incasso.importoEur,
              incassatoDa: incasso.incassatoDa,
              ...(incasso.dataIncasso
                ? { dataIncasso: incasso.dataIncasso }
                : {}),
            }
          : {}),
        // Solo se true: un `false` mandato sempre farebbe fallire l'INTERA
        // chiamata (400 da `forbidNonWhitelisted`) contro un backend piu'
        // vecchio, cioe' anche la concessione normale.
        ...(sostituisciRichiestaInAttesa
          ? { sostituisciRichiestaInAttesa: true }
          : {}),
      },
    );
  }

  /** Rettifica email / nickname / verificato. */
  updateProfile(
    id: string,
    patch: { email?: string; nickname?: string; verified?: boolean },
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${API}/admin/users/${id}/profile`,
      patch,
    );
  }

  /** Storico richieste di abbonamento dell'utente. */
  subscriptionRequests(id: string): Observable<SubscriptionRequest[]> {
    return this.http.get<SubscriptionRequest[]>(
      `${API}/admin/users/${id}/subscription-requests`,
    );
  }

  /** Storico azioni admin sull'utente (audit). */
  auditLog(id: string): Observable<AdminActionLogEntry[]> {
    return this.http.get<AdminActionLogEntry[]>(
      `${API}/admin/users/${id}/audit`,
    );
  }

  /** Live on-site a cui l'utente ha partecipato (chi, quando, per quanto). */
  liveAttendance(id: string): Observable<UserLiveAttendance[]> {
    return this.http.get<UserLiveAttendance[]>(
      `${API}/admin/users/${id}/live-attendance`,
    );
  }

  /** Video-lezioni che l'utente ha aperto (non quanto le ha guardate). */
  lessonViews(id: string): Observable<LessonViewSummary[]> {
    return this.http.get<LessonViewSummary[]>(
      `${API}/admin/users/${id}/lesson-views`,
    );
  }

  /** Log globale paginato di tutte le azioni admin. */
  auditAll(
    page = 1,
    limit = 25,
  ): Observable<Paginated<AdminActionLogEntry>> {
    let params = new HttpParams();
    params = params.set('page', page);
    params = params.set('limit', limit);
    return this.http.get<Paginated<AdminActionLogEntry>>(`${API}/admin/audit`, {
      params,
    });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/admin/users/${id}`);
  }

  resendVerification(id: string): Observable<unknown> {
    return this.http.post(`${API}/admin/users/${id}/resend-verification`, {});
  }
}
