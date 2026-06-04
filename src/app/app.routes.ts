import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/auth.guard';

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
];
