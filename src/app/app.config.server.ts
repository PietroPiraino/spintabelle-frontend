import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

// Config lato server: la config client + il rendering server con la mappa
// RenderMode (prerender vs client) delle rotte. In outputMode 'static' non
// gira alcun server a runtime: serve solo a generare gli HTML al build.
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
