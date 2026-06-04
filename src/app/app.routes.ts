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
  },
  {
    path: 'tabelle',
    loadComponent: () =>
      import('./features/tables/tables.component').then(
        (m) => m.TablesComponent,
      ),
    title: 'Tabelle — Best Fish Forever',
  },
  {
    path: 'chi-siamo',
    loadComponent: () =>
      import('./features/about/about.component').then((m) => m.AboutComponent),
    title: 'Chi siamo — Best Fish Forever',
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
    path: 'news',
    loadComponent: () =>
      import('./features/news/news-list/news-list.component').then(
        (m) => m.NewsListComponent,
      ),
    title: 'News — Best Fish Forever',
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
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [roleGuard(['ADMIN'])],
    title: 'Admin — Best Fish Forever',
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
