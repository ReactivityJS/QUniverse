// The `~<fp>`/`u/<fp>` screen — a plain render function, not a Custom
// Element: unlike qu-nav-dropdown.mjs (a generic, independently reusable
// display primitive) this screen is entirely owned by qu-app-shell.mjs's
// own route dispatch, which already knows `fingerprint` and re-renders on
// every route change — same "plain function, not a component" precedent
// Qu's own examples/people/app.mjs uses for its profile-view modal. Less
// lifecycle ceremony (no observedAttributes/connectedCallback), same
// testability (none — DOM-only, verified via a real browser, see the
// Phase 1 plan's own verification section).

import { isValidFingerprint, DIRECTORY_ID } from 'qu-core/src/index.js';

/**
 * Renders into `container` (cleared first). `qu` is the shell's shared,
 * already-connected Qu instance (see qu-app-shell.mjs) — this function
 * assumes `container` lives inside `qu-app-shell`'s own subtree, so any
 * `<qu-profile-card>` it appends resolves `.qu` via the normal findQu()
 * walk-up with zero extra wiring.
 */
export function renderIdentityView(container, { qu, fingerprint }) {
  container.textContent = '';

  if (!isValidFingerprint(fingerprint)) {
    const err = document.createElement('p');
    err.className = 'qu-identity-error';
    err.textContent = `Ungültiger Fingerprint: "${fingerprint}"`;
    container.appendChild(err);
    return;
  }

  const card = document.createElement('qu-profile-card');
  card.setAttribute('fp', fingerprint);

  const fpLine = document.createElement('p');
  fpLine.className = 'qu-identity-fp';
  const fpCode = document.createElement('code');
  fpCode.textContent = fingerprint;
  fpLine.append('Fingerprint: ', fpCode);

  const appsHeading = document.createElement('h3');
  appsHeading.textContent = 'Apps';
  const appsList = document.createElement('ul');
  appsList.className = 'qu-identity-apps';

  container.append(card, fpLine, appsHeading, appsList);

  const isOwn = fingerprint === qu.fingerprint;
  if (isOwn) {
    container.appendChild(renderVisibilityToggle(qu));
  }

  renderAppParticipation(qu, fingerprint, appsList);
}

function renderVisibilityToggle(qu) {
  const wrap = document.createElement('label');
  wrap.className = 'qu-identity-visibility';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.disabled = true; // enabled once the current state has actually loaded — never toggle blind
  wrap.append(checkbox, ' Im Verzeichnis sichtbar (öffentlich auffindbar)');

  // Same two-part shape src/ui/profile-components.js's own doc comment
  // documents: `.on()` alone only ever reports FUTURE changes (no
  // `initial: true`, see core/subscribe-with-options.js) — and even
  // `initial: true` wouldn't help for a path that doesn't exist YET (the
  // catch-up query simply finds nothing, no callback fires either way,
  // see that file's own `for (const q of existing) callback(q)` loop). So:
  // one explicit one-shot read for the CURRENT state (enables the checkbox
  // either way, visible or not, existing or not), then a plain live `.on()`
  // for whatever changes from here on (including from another tab/device).
  const path = `${DIRECTORY_ID}/entries/${qu.fingerprint}`;
  qu.get(path).then((q) => {
    checkbox.checked = !!q?.value?.visible;
    checkbox.disabled = false;
  }).catch((e) => { console.error('[identity-screen] initial directory-visibility read failed:', e); checkbox.disabled = false; });
  qu.get(path).on((q) => { checkbox.checked = !!q?.value?.visible; });

  checkbox.addEventListener('change', () => {
    checkbox.disabled = true;
    qu.setDirectoryVisible(checkbox.checked)
      .catch((e) => { console.error('[identity-screen] setDirectoryVisible failed:', e); })
      .finally(() => { checkbox.disabled = false; });
  });

  return wrap;
}

async function renderAppParticipation(qu, fingerprint, listEl) {
  let attrs = {};
  try {
    attrs = await qu.listProfileAttrs(fingerprint);
  } catch (e) {
    console.error('[identity-screen] listProfileAttrs failed:', e);
  }
  if (!listEl.isConnected) return;

  // Documented ecosystem convention (see src/modules/README.md's
  // notifications.js entry / Phase 0 design doc): an app writes
  // `app-<appId>` the first time a user meaningfully participates. No app
  // in QUniverse writes this yet, so this is HONESTLY empty today for
  // every fingerprint — never fabricated placeholder content.
  const appKeys = Object.keys(attrs).filter((k) => k.startsWith('app-'));
  if (appKeys.length === 0) {
    const li = document.createElement('li');
    li.className = 'qu-identity-apps-empty';
    li.textContent = 'Noch keine Apps.';
    listEl.appendChild(li);
    return;
  }
  for (const key of appKeys) {
    const li = document.createElement('li');
    li.textContent = key.slice('app-'.length);
    listEl.appendChild(li);
  }
}
