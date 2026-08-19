import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { adminTabCompatGuard } from './features/admin/admin-tab-compat.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (m) => m.LandingComponent,
      ),
    // ⚠️ Parola chiave PRIMA del marchio (16/08/2026). Prima era
    // "Best Fish Forever — Scuola di Poker Spin & Go": il marchio non è ancora
    // noto e occupava la posizione di testa, quella che pesa di più e che in
    // SERP si legge per prima. Chi cerca "scuola spin and go" non sa chi siamo:
    // deve vedere prima cosa trova, poi da chi.
    title: 'Scuola di poker Spin & Go e Twister — Best Fish Forever',
    data: {
      description:
        'La scuola italiana di poker dedicata a Spin & Go e Twister: lezioni video dei coach in italiano, tabelle GTO preflop, allenamento e lezioni dal vivo. Iscriversi è gratis.',
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
    // ⚠️ Niente `authGuard`, ed è una scelta necessaria, non una svista: una
    // rotta guardata NON è prerenderizzabile (il guard aspetta `ready$`, che in
    // Node non emette mai → la rotta non si attiva e il prerender non
    // stabilizza). Con il guard, Cloudflare serviva qui la shell CSR: 13 parole
    // con titolo e canonical DELLA HOME, e Search Console la scartava come
    // duplicato della homepage. Il gate è nel componente (ramo anonimo con
    // teaser + CTA) e i dati restano protetti dal backend, dove
    // `GET /lessons` è `@UseGuards(JwtAuthGuard)`. Stesso modello di /abbonati.
    path: 'lezioni',
    loadComponent: () =>
      import('./features/lessons/lessons.component').then(
        (m) => m.LessonsComponent,
      ),
    title: 'Lezioni di poker per Spin & Go e Twister — Best Fish Forever',
    data: {
      description:
        'Le lezioni video della scuola, in italiano: preflop, postflop e ICM per Spin & Go e Twister. Una parte è aperta a tutti gli iscritti, la registrazione è gratis.',
    },
  },
  {
    // Niente `authGuard`: vedi il commento sulla rotta `lezioni`. ⚠️ Questa ha
    // richiesto anche di cambiare la regola in `public/_redirects` da `/live/*`
    // a `/live/:id/stanza`: lo splat catturava pure `/live/` e le avrebbe
    // servito la shell vuota al posto del suo HTML prerenderizzato.
    path: 'live',
    loadComponent: () =>
      import('./features/live/live.component').then((m) => m.LiveComponent),
    title: 'Lezioni di poker dal vivo per Spin & Go — Best Fish Forever',
    data: {
      description:
        'Le sessioni dal vivo della scuola, in una sala interna al sito: si guarda, si fanno domande e si condivide lo schermo con i coach. Calendario per gli iscritti.',
    },
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
    // Sezione guide: contenuto evergreen, distinto dalle news. ⚠️ Il contenuto
    // vive in `features/guides/guides.data.ts`, non nel CMS: deve stare
    // nell'HTML prerenderizzato sempre, e le news non lo garantiscono (un
    // articolo pubblicato fra due build non e' nel manifest).
    path: 'guide',
    loadComponent: () =>
      import('./features/guides/guides-list.component').then(
        (m) => m.GuidesListComponent,
      ),
    title: 'Guide di strategia per Spin & Go e Twister — Best Fish Forever',
    data: {
      description:
        'Guide gratuite in italiano su Spin & Go e Twister: preflop e push/fold, bankroll, varianza e ICM. Spiegate per intero, senza registrazione.',
    },
  },
  {
    // ⚠️ Una sola rotta per N pagine: title, description e canonical NON possono
    // arrivare dai `data` qui, li imposta il componente da `guides.data.ts`
    // (stesso schema di news/:id). Il prerender enumera gli slug dal file
    // locale — vedi app.routes.server.ts.
    path: 'guide/:slug',
    loadComponent: () =>
      import('./features/guides/guide-detail.component').then(
        (m) => m.GuideDetailComponent,
      ),
    title: 'Guide — Best Fish Forever',
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
    // Niente `authGuard`: vedi il commento sulla rotta `lezioni` — una rotta
    // guardata non è prerenderizzabile, e senza prerender Google riceveva la
    // shell CSR col canonical della home. Gate nel componente, dati protetti
    // dal backend (`GET /documents` è JwtAuthGuard, il download è firmato).
    path: 'docs',
    loadComponent: () =>
      import('./features/docs/docs.component').then((m) => m.DocsComponent),
    title: 'Materiali e filtri PT4 per Spin & Go — Best Fish Forever',
    data: {
      description:
        'Filtri e report per PokerTracker 4, PDF e fogli di calcolo per studiare Spin & Go e Twister lontano dal tavolo. Riservati agli iscritti, registrazione gratuita.',
    },
  },
  {
    path: 'affiliazioni',
    loadComponent: () =>
      import('./features/affiliations/affiliations.component').then(
        (m) => m.AffiliationsComponent,
      ),
    // ⚠️ Testo deliberatamente NEUTRO: questa pagina è prerenderizzata, quindi
    // title e description finiscono nell'HTML indicizzabile e nella SERP. Qui
    // niente marchi di operatore, niente nomi di formato e niente linguaggio
    // promozionale sulle condizioni: le offerte vere stanno dietro login.
    // Non "migliorare" per SEO — vedi PLAN-affiliazioni.md §9.3 e §11.
    title: 'Affiliazioni — Best Fish Forever',
    data: {
      description:
        'Il programma di affiliazione di Best Fish Forever: come funziona e come si richiede dal tuo account. Condizioni riservate agli iscritti. 18+, gioca responsabilmente.',
      // ⚠️ noindex: la pagina è prerenderizzata E linkata dalla nav di OGNI
      // pagina, quindi la sola esclusione dalla sitemap (gen-sitemap.mjs,
      // ESCLUSE) non la teneva fuori dall'indice — una sitemap dice a Google
      // cosa guardare, non cosa ignorare. Il programma invia per email link
      // affiliati a sale da gioco: promuoverlo in ricerca è esattamente ciò
      // che l'art. 9 del DL 87/2018 vieta. `follow` resta, così i link verso
      // il resto del sito continuano a valere.
      noindex: true,
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
    // Dashboard admin: la shell (sidebar) è il padre, ogni sezione una rotta
    // figlia lazy. ⚠️ I children DEVONO restare un array letterale inline con
    // path letterali: la guardia rotte (scripts/lib/route-inventory.mjs) li
    // appiattisce così — `loadChildren` le è INVISIBILE e via _redirects la
    // rotta tornerebbe a ricevere l'HTML della home, in silenzio. Ogni figlio
    // dichiara il suo `title` (il listener SEO scende alla foglia).
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [roleGuard(['ADMIN'])],
    children: [
      {
        // Panoramica; la guard traduce i vecchi ?tab= delle email inviate
        path: '',
        canActivate: [adminTabCompatGuard],
        loadComponent: () =>
          import('./features/admin/admin-overview/admin-overview.component').then(
            (m) => m.AdminOverviewComponent,
          ),
        title: 'Admin — Best Fish Forever',
      },
      {
        path: 'lezioni',
        loadComponent: () =>
          import('./features/admin/admin-lessons/admin-lessons.component').then(
            (m) => m.AdminLessonsComponent,
          ),
        title: 'Admin · Lezioni — Best Fish Forever',
      },
      {
        path: 'live',
        loadComponent: () =>
          import('./features/admin/admin-live/admin-live.component').then(
            (m) => m.AdminLiveComponent,
          ),
        title: 'Admin · Live — Best Fish Forever',
      },
      {
        path: 'news',
        loadComponent: () =>
          import('./features/admin/admin-news/admin-news.component').then(
            (m) => m.AdminNewsComponent,
          ),
        title: 'Admin · News — Best Fish Forever',
      },
      {
        path: 'documenti',
        loadComponent: () =>
          import(
            './features/admin/admin-documents/admin-documents.component'
          ).then((m) => m.AdminDocumentsComponent),
        title: 'Admin · Documenti — Best Fish Forever',
      },
      {
        path: 'negozio',
        loadComponent: () =>
          import('./features/admin/admin-shop/admin-shop.component').then(
            (m) => m.AdminShopComponent,
          ),
        title: 'Admin · Negozio — Best Fish Forever',
      },
      {
        path: 'iscritti',
        loadComponent: () =>
          import('./features/admin/admin-users/admin-users.component').then(
            (m) => m.AdminUsersComponent,
          ),
        title: 'Admin · Iscritti — Best Fish Forever',
      },
      {
        path: 'richieste',
        loadComponent: () =>
          import(
            './features/admin/admin-subscription-requests/admin-subscription-requests.component'
          ).then((m) => m.AdminSubscriptionRequestsComponent),
        title: 'Admin · Richieste — Best Fish Forever',
      },
      {
        path: 'sconti',
        loadComponent: () =>
          import(
            './features/admin/admin-discounts/admin-discounts.component'
          ).then((m) => m.AdminDiscountsComponent),
        title: 'Admin · Sconti — Best Fish Forever',
      },
      {
        path: 'affiliazioni',
        loadComponent: () =>
          import(
            './features/admin/admin-affiliations/admin-affiliations.component'
          ).then((m) => m.AdminAffiliationsComponent),
        title: 'Admin · Affiliazioni — Best Fish Forever',
      },
      {
        path: 'partecipazione',
        loadComponent: () =>
          import(
            './features/admin/admin-participation/admin-participation.component'
          ).then((m) => m.AdminParticipationComponent),
        title: 'Admin · Partecipazione — Best Fish Forever',
      },
      {
        path: 'stakings',
        loadComponent: () =>
          import(
            './features/admin/admin-stakings/admin-stakings.component'
          ).then((m) => m.AdminStakingsComponent),
        title: 'Admin · Stakings — Best Fish Forever',
      },
      {
        path: 'conteggi-mensili',
        loadComponent: () =>
          import(
            './features/admin/admin-conteggi-mensili/admin-conteggi-mensili.component'
          ).then((m) => m.AdminConteggiMensiliComponent),
        title: 'Admin · Conteggi mensili — Best Fish Forever',
      },
      {
        path: 'statistiche',
        loadComponent: () =>
          import('./features/admin/admin-stats/admin-stats.component').then(
            (m) => m.AdminStatsComponent,
          ),
        title: 'Admin · Statistiche — Best Fish Forever',
      },
      {
        path: 'log',
        loadComponent: () =>
          import('./features/admin/admin-audit/admin-audit.component').then(
            (m) => m.AdminAuditComponent,
          ),
        title: 'Admin · Log — Best Fish Forever',
      },
    ],
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
    // ⚠️ Rotta di PRIMO LIVELLO, non `/news/redazione`: quest'ultima
    // collide con la rotta parametrica dell'articolo (`news/:id`) e
    // finirebbe dentro l'include `/news/*` della Pages Function.
    path: 'redazione',
    loadComponent: () =>
      import('./features/legal/redazione/redazione.component').then(
        (m) => m.RedazioneComponent,
      ),
    title: 'Redazione — Best Fish Forever',
    data: {
      description:
        'Chi scrive le notizie di Best Fish Forever, chi ne risponde e a chi scrivere per segnalazioni e rettifiche.',
    },
  },
  {
    path: 'policy-editoriale',
    loadComponent: () =>
      import(
        './features/legal/policy-editoriale/policy-editoriale.component'
      ).then((m) => m.PolicyEditorialeComponent),
    title: 'Policy editoriale — Best Fish Forever',
    data: {
      description:
        'Come citiamo le fonti, come usiamo l\'intelligenza artificiale, come correggiamo un errore e come chiedere una rettifica.',
    },
  },
  {
    // 404 lato client (navigazione interna verso un URL inesistente). Il 404
    // vero, con lo status HTTP giusto, lo serve public/404.html: Cloudflare
    // Pages lo restituisce sugli URL che non corrispondono a nessun asset ne'
    // a nessuna regola di _redirects.
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
    title: 'Pagina non trovata — Best Fish Forever',
    data: {
      description:
        'La pagina che cercavi non esiste o è stata spostata. Torna alla home di Best Fish Forever.',
      noindex: true,
    },
  },
];
