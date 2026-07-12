import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (m) => m.LandingComponent,
      ),
    title: 'Best Fish Forever — Scuola di Poker Spin & Go',
    data: {
      description:
        'Best Fish Forever è la scuola italiana di poker dedicata a Spin & Go e Twister: lezioni video, tabelle GTO e una community di studio su Discord.',
    },
  },
  {
    path: 'tabelle',
    loadComponent: () =>
      import('./features/tables/tables.component').then(
        (m) => m.TablesComponent,
      ),
    title: 'Tabelle — Best Fish Forever',
    data: {
      description:
        'Tabelle GTO preflop per Spin & Go e Twister: range di apertura, push/fold e raise per ogni stack, posizione e formato (ante, asimmetrico).',
    },
  },
  {
    // Pubblica di proposito: strumento gratuito ad alto valore (SEO/condivisione/conversione).
    path: 'simulatore-varianza',
    loadComponent: () =>
      import('./features/varianza/varianza.component').then(
        (m) => m.VarianzaComponent,
      ),
    title: 'Simulatore di Varianza — Best Fish Forever',
    data: {
      description:
        'Simulatore di varianza per Spin & Go e Twister lottery: migliaia di percorsi Monte Carlo per capire swing, downswing e bankroll necessario. Gratis, senza registrazione.',
      // Card OG dedicata (public/og-varianza.png). Aiuta Google subito; per gli
      // scraper social puri diventa efficace solo con l'SSG (leggono l'HTML iniziale).
      ogImage: 'https://bestfishforever.it/og-varianza.png',
    },
  },
  {
    path: 'chi-siamo',
    loadComponent: () =>
      import('./features/about/about.component').then((m) => m.AboutComponent),
    title: 'Chi siamo — Best Fish Forever',
    data: {
      description:
        'Scopri Best Fish Forever: coach, metodo e community della scuola italiana di poker dedicata a Spin & Go e Twister.',
    },
  },
  {
    path: 'allenamento',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/drills/drill-config/drill-config.component').then(
            (m) => m.DrillConfigComponent,
          ),
        title: 'Allenamento — Best Fish Forever',
      },
      {
        path: 'sessione',
        loadComponent: () =>
          import('./features/drills/drill-runner/drill-runner.component').then(
            (m) => m.DrillRunnerComponent,
          ),
        title: 'Allenamento in corso — Best Fish Forever',
      },
      {
        path: 'risultati',
        loadComponent: () =>
          import('./features/drills/drill-results/drill-results.component').then(
            (m) => m.DrillResultsComponent,
          ),
        title: 'Risultati allenamento — Best Fish Forever',
      },
    ],
  },
  {
    path: 'lezioni',
    loadComponent: () =>
      import('./features/lessons/lessons.component').then(
        (m) => m.LessonsComponent,
      ),
    canActivate: [authGuard],
    title: 'Lezioni — Best Fish Forever',
  },
  {
    path: 'live',
    loadComponent: () =>
      import('./features/live/live.component').then((m) => m.LiveComponent),
    canActivate: [authGuard],
    title: 'Live — Best Fish Forever',
  },
  {
    // Sala on-site (LIVEKIT). Il gate per tier vero è il 403 del backend sul
    // token; authGuard impedisce solo l'accesso da anonimo.
    path: 'live/:id/stanza',
    loadComponent: () =>
      import('./features/live-room/live-room.component').then(
        (m) => m.LiveRoomComponent,
      ),
    canActivate: [authGuard],
    title: 'Sala live — Best Fish Forever',
  },
  {
    // Pubblica di proposito: prezzi visibili a tutti (SEO/condivisione/conversione).
    // L'acquisto è gated lato componente (anonimo → login) + API (request/me sotto JWT).
    path: 'abbonati',
    loadComponent: () =>
      import('./features/subscribe/subscribe.component').then(
        (m) => m.SubscribeComponent,
      ),
    title: 'Abbonati — Best Fish Forever',
    data: {
      description:
        'Abbonati a Best Fish Forever: lezioni video, tabelle GTO, allenamento e live on-site per Spin & Go e Twister. Piani Pesce Rosso e Squalo.',
    },
  },
  {
    path: 'news',
    loadComponent: () =>
      import('./features/news/news-list/news-list.component').then(
        (m) => m.NewsListComponent,
      ),
    title: 'News — Best Fish Forever',
    data: {
      description:
        'News e aggiornamenti dalla scuola di poker Best Fish Forever: strategie per Spin & Go e Twister, novità e vita della community.',
    },
  },
  {
    path: 'docs',
    loadComponent: () =>
      import('./features/docs/docs.component').then((m) => m.DocsComponent),
    canActivate: [authGuard],
    title: 'Docs — Best Fish Forever',
  },
  {
    path: 'affiliazioni',
    loadComponent: () =>
      import('./features/affiliations/affiliations.component').then(
        (m) => m.AffiliationsComponent,
      ),
    title: 'Affiliazioni — Best Fish Forever',
    data: {
      description:
        'Affiliazioni e offerte rakeback consigliate da Best Fish Forever per chi gioca a Spin & Go e Twister.',
    },
  },
  {
    // Spendere punti richiede una sessione → authGuard (a differenza di /abbonati).
    path: 'negozio',
    loadComponent: () =>
      import('./features/shop/shop.component').then((m) => m.ShopComponent),
    canActivate: [authGuard],
    title: 'Negozio — Best Fish Forever',
  },
  {
    path: 'news/:id',
    loadComponent: () =>
      import('./features/news/news-detail/news-detail.component').then(
        (m) => m.NewsDetailComponent,
      ),
    title: 'News — Best Fish Forever',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
    canActivate: [guestGuard],
    title: 'Accedi — Best Fish Forever',
  },
  {
    path: 'registrazione',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
    canActivate: [guestGuard],
    title: 'Registrati — Best Fish Forever',
  },
  {
    path: 'verifica-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent,
      ),
    title: 'Verifica email — Best Fish Forever',
  },
  {
    path: 'recupera-verifica',
    loadComponent: () =>
      import(
        './features/auth/resend-verification/resend-verification.component'
      ).then((m) => m.ResendVerificationComponent),
    title: 'Reinvia verifica — Best Fish Forever',
  },
  {
    path: 'password-dimenticata',
    loadComponent: () =>
      import(
        './features/auth/forgot-password/forgot-password.component'
      ).then((m) => m.ForgotPasswordComponent),
    title: 'Password dimenticata — Best Fish Forever',
  },
  {
    path: 'reimposta-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Reimposta password — Best Fish Forever',
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./features/account/account.component').then(
        (m) => m.AccountComponent,
      ),
    canActivate: [authGuard],
    title: 'Il mio account — Best Fish Forever',
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [roleGuard(['ADMIN'])],
    title: 'Admin — Best Fish Forever',
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/privacy/privacy.component').then(
        (m) => m.PrivacyComponent,
      ),
    title: 'Informativa privacy — Best Fish Forever',
    data: {
      description:
        'Informativa sulla privacy di Best Fish Forever: come trattiamo e proteggiamo i dati personali degli utenti.',
    },
  },
  {
    path: 'cookie-policy',
    loadComponent: () =>
      import('./features/legal/cookie-policy/cookie-policy.component').then(
        (m) => m.CookiePolicyComponent,
      ),
    title: 'Cookie policy — Best Fish Forever',
    data: {
      description:
        'Cookie policy di Best Fish Forever: quali cookie usiamo e come gestire le preferenze.',
    },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
    title: 'Pagina non trovata — Best Fish Forever',
  },
];
