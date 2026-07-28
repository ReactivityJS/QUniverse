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

    this._services = undefined; // populated once /relay/services resolves — see _renderGenericSpaceDefault()'s own use below
    this._routeGen = 0; // bumped on every _renderRoute() call, so a stale async space-manifest read can tell it's no longer current, see _renderGenericSpaceDefault()

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
      .then((services) => { this._services = services; router.setServices(services); })
      .catch((e) => { console.error('[qu-app-shell] failed to load /relay/services:', e); this._services = []; router.setServices([]); });
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
    const gen = ++this._routeGen; // see _renderGenericSpaceDefault()'s own use of this
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

    // `space-default`: a Space-id was given (either a `~fp` User-Space or a
    // generic Space-UUID) but no second (appId) segment — decideRoute()
    // itself never reaches into a Space's manifest (pure, no I/O), so THIS
    // is where that default gets decided. A `~fp` always defaults to the
    // built-in identity screen (no manifest read needed — the identity IS
    // the space); a generic Space-UUID needs an actual (async) manifest
    // read for its own optional `appId` field (see spaces.js's buildManifest(),
    // which now preserves such caller-supplied extra fields verbatim).
    if (decision.kind === 'space-default') {
      if (decision.spaceId.startsWith('~')) {
        renderIdentityView(screen, { qu: this.qu, fingerprint: decision.spaceId.slice(1) });
      } else {
        this._renderGenericSpaceDefault(screen, decision.spaceId, gen);
      }
      return;
    }

    // `app` (legacy bare fixed-app bookmark, e.g. `#/chat`) and `space`
    // (space-first with a resolved appId, e.g. `#/~fp/cms/home` or
    // `#/board-42/forum`) both resolve to the exact same Phase-1 action:
    // redirect to the app's own standalone `entry` page. Phase 1 apps are
    // `entry`-redirects only (see file doc) — passing `spaceId` through to
    // the target app (so it renders THAT space rather than its own default)
    // is real, but deliberately deferred to whenever a service actually
    // needs it (Phase 4's reference migration), not built speculatively here.
    if (decision.kind === 'app' || decision.kind === 'space') {
      const redirecting = document.createElement('p');
      redirecting.textContent = `Weiterleitung zu ${decision.appId} …`;
      screen.appendChild(redirecting);
      location.href = decision.entry;
      return;
    }

    if (decision.kind === 'unknown') {
      const unknown = document.createElement('p');
      unknown.className = 'qu-shell-unknown';
      unknown.textContent = decision.spaceId
        ? `Unbekannte App "${decision.appId}" für Space "${decision.spaceId}"`
        : `Unbekannte App: "${decision.appId}"`;
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

  /**
   * A generic (non-`~fp`) Space-UUID with no appId segment given
   * (`space-default`) — reads that Space's own manifest for an optional
   * `appId` field (a caller-set convention: `qu.createSpace({..., appId})`,
   * see spaces.js's buildManifest()) to decide what renders it by default.
   * No such field, or the field doesn't resolve against the current
   * catalog -> a plain "no default app" message, never a crash or an
   * infinite loading spinner.
   *
   * `gen` guards against a race: if the hash changes again while this
   * manifest read is in flight, a NEWER `_renderRoute()` call already
   * bumped `this._routeGen` and owns `screen` — this stale continuation
   * must not clobber it.
   */
  async _renderGenericSpaceDefault(screen, spaceId, gen) {
    const loading = document.createElement('p');
    loading.textContent = 'Lädt …';
    screen.appendChild(loading);

    let manifest = null;
    try {
      const q = await this.qu.get(spaceId);
      manifest = q?.value ?? null;
    } catch (e) {
      console.error('[qu-app-shell] space manifest read failed:', e);
    }
    if (gen !== this._routeGen) return; // route moved on while this was in flight

    screen.textContent = '';
    const appId = manifest?.appId;
    const match = appId && this._services?.find((s) => s.id === appId && s.enabled !== false && s.entry);
    if (match) {
      const redirecting = document.createElement('p');
      redirecting.textContent = `Weiterleitung zu ${appId} …`;
      screen.appendChild(redirecting);
      location.href = match.entry;
      return;
    }

    const msg = document.createElement('p');
    msg.className = 'qu-shell-unknown';
    msg.textContent = manifest
      ? `Dieser Space hat keine Standard-App konfiguriert (Space: "${spaceId}").`
      : `Unbekannter Space: "${spaceId}"`;
    const home = document.createElement('a');
    home.href = buildPath();
    home.textContent = 'Zur Startseite';
    screen.append(msg, home);
  }
}

if (!customElements.get('qu-app-shell')) customElements.define('qu-app-shell', QuAppShellElement);
