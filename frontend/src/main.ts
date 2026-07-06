// src/main.ts
import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent }         from './app/app.component';
import { appConfig }            from './app/app.config';

// In dev, `ng serve` doesn't emit ngsw-worker.js, but a service worker left
// registered from a prior production build on this origin keeps trying to
// re-fetch it → repeated 404 / "registration failed" noise. Remove any such
// leftover worker. Guarded by isDevMode() so production's SW is never touched.
if (isDevMode() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => { /* nothing we can do; ignore */ });
}

bootstrapApplication(AppComponent, appConfig).catch(console.error);
