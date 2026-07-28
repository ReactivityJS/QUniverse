// QUniverse's own relay deployment — composes Qu's generic, app-agnostic
// relay (qu-core/relay/relay.mjs) with THIS ecosystem's concrete
// configuration (admins, rate/connection limits, the actual app catalog).
// Mirrors qu-core's own index.js bootstrap (env var names match on purpose,
// so existing deployment docs/tooling for a Qu relay apply unchanged), but
// trimmed to just the relay + service catalog — no docs/examples static
// server, no test-runner endpoint, none of which belongs to a product
// deployment.
//
// Phase 0 scope: this boots a working relay with a service catalog. The
// actual ecosystem shell (welcome page, nav dropdown, notification feed,
// router) is a later phase — see the architecture doc in Qu's own repo,
// branch claude/quniverse-ecosystem-architecture-cd289p.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QuIdentity, QuStore, MemoryAdapter, NullAdapter, MemoryFileStorageAdapter,
  isValidFingerprint, createRateLimiter, createConnectionGate, enableConsoleDebug,
} from 'qu-core/src/index.js';
import { createRelay } from 'qu-core/relay/relay.mjs';
import { bridgeWebSocketServer } from 'qu-core/relay/node-ws-bridge.mjs';
import { startServer } from 'qu-core/server/static-server.mjs';
import { createRelayInfoRoutes } from 'qu-core/server/relay-info-routes.mjs';
import { createServiceRegistry } from 'qu-core/server/service-registry.mjs';
import { createPlatformRegistry } from 'qu-core/server/platform-registry.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8788;

if (process.env.QU_DEBUG === '1') enableConsoleDebug();

// Same comma-list-with-quote-stripping convention as qu-core's own
// index.js (QU_RELAY_ADMINS/QU_ALLOWED_FINGERPRINTS parsing there) —
// duplicated here rather than imported, since it's a few lines of
// deployment-script logic, not a reusable library function.
const QUOTE_RE = /^['"]|['"]$/g;
function parseFingerprintList(envVar, label) {
  const list = (process.env[envVar] || '')
    .split(',')
    .map((s) => s.trim().replace(QUOTE_RE, '').trim().toLowerCase())
    .filter(Boolean);
  for (const fp of list) {
    if (!isValidFingerprint(fp)) {
      console.warn(`[QUniverse] ${envVar} entry "${fp}" doesn't look like a valid fingerprint (expected 24 hex characters) — check for stray quotes/whitespace.`);
    }
  }
  return list;
}

const relayAdmins = parseFingerprintList('QU_RELAY_ADMINS', 'admins');

const rateLimiter = process.env.QU_RATE_LIMIT === '0' ? null : createRateLimiter({
  maxPerWindow: Number(process.env.QU_RATE_LIMIT_MAX) || 200,
  windowMs: Number(process.env.QU_RATE_LIMIT_WINDOW_MS) || 1000,
});

const maxConnectionsEnv = process.env.QU_MAX_CONNECTIONS ? Number(process.env.QU_MAX_CONNECTIONS) : null;
const allowedFingerprintsEnv = parseFingerprintList('QU_ALLOWED_FINGERPRINTS', 'allowlist');
const connectionGate = (maxConnectionsEnv != null || allowedFingerprintsEnv.length)
  ? createConnectionGate({ maxConnections: maxConnectionsEnv, allowedFingerprints: allowedFingerprintsEnv.length ? allowedFingerprintsEnv : null })
  : null;

// THIS ecosystem's concrete app catalog — one entry per app under
// `services/<id>/`, following the App-/Service-Template (services/README.md).
// Empty for now: no real QUniverse-native app exists yet (Phase 4 migrates
// the first ones in) — each with its own manifest.mjs (server/service-
// registry.mjs's QUniverse App Manifest fields — icon, spaceMode,
// notificationTopics, …). Phase 1's shell/nav-dropdown/router was verified
// end-to-end against a TEMPORARY entry pointing at Qu's own already-running
// example app (cross-origin), then reverted — see the Phase 1 plan's own
// verification section for why that stayed out of the committed catalog.
const registry = createServiceRegistry([
  // { id: 'forum', category: 'service', label: 'Forum', entry: '/services/forum/index.html', icon: '💬', spaceMode: 'perInstance' },
]);

// Optional PLATFORM features (contacts, CMS-homepage, notification
// aggregation, directory, incognito) — separate from the app catalog above:
// this toggles which pieces of the ecosystem SHELL itself a deployment
// wants active, administered the same way (admin/config/platform-modules,
// examples/relay-admin's own panel in qu-core). All enabled by default;
// QU_PLATFORM_MODULES_DISABLED narrows it at startup, same convention as
// qu-core's own index.js. The shell doesn't read this yet (no real
// feature screens exist to gate — see qu-core's own platform-registry.mjs
// commit message for why that's deliberately deferred), but the toggle
// mechanism itself is live from day one, same as the (currently empty)
// service catalog above.
const platformRegistry = createPlatformRegistry();
for (const id of (process.env.QU_PLATFORM_MODULES_DISABLED || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  platformRegistry.setEnabled(id, false);
}

const relayIdentity = await QuIdentity.generate(); // ephemeral for now — pin a persisted identity (see qu-core's own index.js) before a real deployment

let relayApi;

const server = startServer({
  root, port,
  routes: [
    ...createRelayInfoRoutes({
      fingerprint: relayIdentity.fingerprint,
      epub: await crypto.subtle.exportKey('jwk', relayIdentity.encryptionKey),
      admins: relayAdmins,
      getAdminConfig: () => relayApi?.getAdminConfig?.() ?? null,
    }),
    {
      match: (p) => p === '/relay/services',
      handle: (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(registry.toJSON()));
      },
    },
  ],
});

const store = new QuStore([
  { prefix: '', adapter: new MemoryAdapter() }, // swap for a durable adapter (e.g. qu-core/src/adapters/node-fs.js's FileSystemStorageAdapter) before a real deployment
  { prefix: 'signal/', adapter: new NullAdapter() },
  { prefix: 'admin/', adapter: new NullAdapter(), replicate: false },
]);

relayApi = await createRelay({
  store,
  fileStorage: new MemoryFileStorageAdapter(),
  identity: relayIdentity,
  allowDynamicSubscribe: true, // apps mint their own Space ids at runtime (qu.createSpace()) — see qu-core's README on allowDynamicSubscribe
  rateLimiter,
  connectionGate,
  relayAdmins,
  serviceRegistry: registry,
  platformRegistry,
});
await relayApi.relay.publishProfile();
bridgeWebSocketServer(server, relayApi, { path: '/relay' });

console.log(`[QUniverse] Relay listening on ws://localhost:${port}/relay (fingerprint: ${relayIdentity.fingerprint})`);
console.log(relayAdmins.length
  ? `[QUniverse] Admin fingerprints configured (${relayAdmins.length}): ${relayAdmins.join(', ')}`
  : '[QUniverse] No QU_RELAY_ADMINS configured — no admin write access to relay-services/ or admin/');
