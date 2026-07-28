// `<qu-app-shell>` — the ecosystem's own entry point. Unlike every other
// Qu-Component this repo composes (`<qu-profile-card>`, `<qu-people-search>`,
// …), which all expect an ANCESTOR to already have set `.qu`, this element
// is the FIRST one in the whole tree to establish it: it bootstraps the
// shared identity (qu-core/src/ui/session-bootstrap.js), installs the
// plugins the rest of the shell needs, connects to this deployment's own
// relay, and only THEN sets `this.qu` — every `<qu-profile-card>`/
// `<qu-people-search>` rendered inside it resolves `.qu` via the normal
// findQu() parent-walk with zero extra wiring, same as any other Qu app.
//
// Light DOM only, no attachShadow() — `qu-profile-open`/
// `qu-people-search-results` (fired by <qu-profile-card>/<qu-people-search>)
// are `bubbles:true` but explicitly NOT `composed:true`, so a shadow
// boundary anywhere in this element's render tree would silently swallow
// them before they ever reach the listeners this element attaches to
// itself below. This is the first place in the ecosystem that nests these
// existing bubbling-event components inside a NEW wrapping element, so
// it's worth stating as a real constraint, not an assumed default.
//
// Phase 1 scope: apps are `entry`-redirects only (`location.href = entry`)
// — there is no in-shell mounting yet (a `mount` manifest field exists for
// a LATER phase, unused here).

import {
  createNetworkPlugin, createSpacesPlugin, createProfilesPlugin, createWebSocketChannel,
  createRouter, buildPath,
} from 'qu-core/src/index.js';
import { loadOrCreateIdentity, relayUrl } from 'qu-core/src/ui/session-bootstrap.js';
import { createWindowHashSource } from 'qu-core/src/ui/router-browser.js';
import { renderIdentityView } from './identity-screen.mjs';

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

export class QuAppShellElement extends HTMLElement {
  connectedCallback() {
    this.textContent = '';
    const loading = document.createElement('p');
    loading.className = 'qu-shell-loading';
    loading.textContent = 'Lädt …';
    this.appendChild(loading);

    this._init().catch((e) => {
      console.error('[qu-app-shell] startup failed:', e);
      this.textContent = '';
      const err = document.createElement('p');
      err.className = 'qu-shell-error';
      err.textContent = `Start fehlgeschlagen: ${e.message}`;
      this.appendChild(err);
    });
  }

  disconnectedCallback() {
    this._stopRouter?.();
  }

  async _init() {
    const qu = (await loadOrCreateIdentity())
      .use(createNetworkPlugin())
      .use(createSpacesPlugin())
      .use(createProfilesPlugin());
    this.qu = qu; // MUST be set before any descendant <qu-*> element renders — see file doc above

    this._buildLayout();

    this.addEventListener('qu-profile-open', (e) => {
      location.hash = buildPath(`~${e.detail.fingerprint}`);
    });
    this.addEventListener('qu-app-select', (e) => {
      location.href = e.detail.entry;
    });

    const router = createRouter({ ...createWindowHashSource(), services: undefined });
    router.onRoute((decision) => this._renderRoute(decision));
    this._stopRouter = router.start();

    this._connectWithRetry(qu).catch((e) => console.error('[qu-app-shell] connect failed permanently:', e));

    fetch('/relay/services')
      .then((res) => res.json())
      .then((services) => router.setServices(services))
      .catch((e) => { console.error('[qu-app-shell] failed to load /relay/services:', e); router.setServices([]); });
  }

  /** Persistent header (nav dropdown + own profile card) + the screen area the router swaps content into — built once, right after `.qu` is set. */
  _buildLayout() {
    this.textContent = '';

    const header = document.createElement('header');
    header.className = 'qu-shell-header';
    const brand = document.createElement('span');
    brand.className = 'qu-shell-brand';
    brand.textContent = 'QUniverse';
    const nav = document.createElement('qu-nav-dropdown');
    const ownCard = document.createElement('qu-profile-card');
    ownCard.setAttribute('href', buildPath(`~${this.qu.fingerprint}`));
    header.append(brand, nav, ownCard);

    this._screenEl = document.createElement('main');
    this._screenEl.className = 'qu-shell-screen';

    this.append(header, this._screenEl);
  }

  async _connectWithRetry(qu) {
    for (let attempt = 0; ; attempt++) {
      try {
        const channel = createWebSocketChannel(relayUrl());
        await Promise.race([
          channel.connect(),
          wait(10000).then(() => { throw new Error('Zeitüberschreitung beim Verbindungsaufbau'); }),
        ]);
        await qu.connect(channel, { pushTopics: [''] });
        return;
      } catch (e) {
        console.error('[qu-app-shell] connect failed, retrying:', e);
        await wait(Math.min(1000 * 2 ** attempt, 15000));
      }
    }
  }

  _renderRoute(decision) {
    const screen = this._screenEl;
    if (!screen) return; // not laid out yet (still bootstrapping) — the router's own first emission can race _buildLayout(), a later route change will re-render correctly once it's up
    screen.textContent = '';

    if (decision.kind === 'home') {
      const welcome = document.createElement('p');
      welcome.className = 'qu-shell-welcome';
      welcome.textContent = `Willkommen, ${this.qu.fingerprint}.`;
      const search = document.createElement('qu-people-search');
      search.setAttribute('mode', 'browse');
      // A literal `{fp}` TEMPLATE, not buildPath('u', '{fp}') — buildPath()
      // URL-encodes every segment, which would turn the placeholder into
      // `%7Bfp%7D` and break <qu-profile-card>'s own literal
      // href.replace('{fp}', ...) templating. Matches buildPath()'s own
      // `#/u/<fp>` output shape, just written by hand since one segment
      // here is a placeholder, not a real value.
      search.setAttribute('href', '#/u/{fp}');
      screen.append(welcome, search);
      return;
    }

    if (decision.kind === 'identity') {
      renderIdentityView(screen, { qu: this.qu, fingerprint: decision.fingerprint });
      return;
    }

    if (decision.kind === 'app') {
      const redirecting = document.createElement('p');
      redirecting.textContent = `Weiterleitung zu ${decision.appId} …`;
      screen.appendChild(redirecting);
      location.href = decision.entry;
      return;
    }

    if (decision.kind === 'unknown') {
      const unknown = document.createElement('p');
      unknown.className = 'qu-shell-unknown';
      unknown.textContent = `Unbekannte App: "${decision.appId}"`;
      const home = document.createElement('a');
      home.href = buildPath();
      home.textContent = 'Zur Startseite';
      screen.append(unknown, home);
      return;
    }

    // 'pending' — catalog not loaded yet, nothing to decide conclusively
    const loading = document.createElement('p');
    loading.textContent = 'Lädt …';
    screen.appendChild(loading);
  }
}

if (!customElements.get('qu-app-shell')) customElements.define('qu-app-shell', QuAppShellElement);
