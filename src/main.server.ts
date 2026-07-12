import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// Entry-point del prerender/SSG. In Angular 22 il bootstrap server DEVE ricevere
// e inoltrare il BootstrapContext (altrimenti NG0401: "Missing Platform").
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context);

export default bootstrap;
