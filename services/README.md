# App-/Service-Template

Jede App in QUniverse lebt in einem eigenen Verzeichnis unter `services/`,
nach demselben Muster, das sich bereits in Qu's eigenen `examples/`
etabliert hat (`<app>-lib.mjs` + `<app>-lib.test.mjs` + `app.mjs`) —
erweitert um ein `manifest.mjs`, mit dem sich eine App gegenüber der
Ökosystem-Shell registriert.

```
services/<name>/<name>-lib.mjs      Reine Logik, Node-testbar (put/set/Zeit-Sharding
                                     nach Qu-README §7). Baut auf Qu's
                                     src/modules/space-membership.js (ensureSpace/
                                     notifyMembers), src/modules/profiles.js
                                     (Verzeichnis-Teilnahme) und src/modules/spaces.js
                                     (Rechteverwaltung) auf, statt diese neu zu bauen.
services/<name>/<name>-lib.test.mjs node --test, echte In-Memory-Qu-Instanzen
                                     (kein Mocking — Qu-Repo-Konvention).
services/<name>/app.mjs             Browser-UI — importiert qu-core/src/ui/session-bootstrap.js
                                     (geteilte Identität) und qu-core/src/ui/hash-router.js
                                     bzw. eine injizierte Hash-Quelle (sobald die
                                     Ökosystem-Shell existiert).
services/<name>/manifest.mjs        Exportiert das App-Manifest-Objekt (siehe unten).
services/<name>/index.html          Eigenständige Shell — nur falls die App zusätzlich
                                     als installierbare Standalone-PWA laufen soll.
```

## App-Manifest

Das Manifest-Format ist in Qu selbst definiert
(`qu-core/server/service-registry.mjs`, Dateikopf-Kommentar) — additiv zum
bestehenden Service-Katalog-Format:

```js
// services/<name>/manifest.mjs
export default {
  id: 'forum',
  category: 'service',
  label: 'Forum',
  description: 'Zeit-geshardetes Forum mit Boards/Topics.',
  entry: '/services/forum/index.html', // heutiges Standardmuster: eigene Seite, kein In-Shell-Mount
  icon: '💬',
  navOrder: 10,
  spaceMode: 'perInstance', // 'fixed' | 'perUser' | 'perInstance' — siehe Qu's APP-GUIDE.md Schritt 3
  notificationTopics: ['reply', 'mention'],
  usesCms: false,
};
```

Registrierung in `server.mjs`: den Manifest-Export in
`createServiceRegistry(definitions)`s Array aufnehmen (code-seitig, wie
jeder andere `service-registry.mjs`-Eintrag) — oder, für einen rein
link-basierten Eintrag ohne eigenen Code in diesem Repo, als
laufzeit-veränderlicher `relay-services/<id>`-QuBit (siehe
`service-registry.mjs`s `attachStore()`).

## Noch offen (spätere Phasen)

Die Ökosystem-Shell (Router-Dispatch, `<qu-app-shell>`, Navigations-
Dropdown, Notification-Feed) existiert noch nicht — bis dahin ist `entry`
(eine eigenständige, per Redirect erreichbare Seite) der einzige
Registrierungsweg. Ein `mount`-Feld für In-Shell-Embedding ist im
Manifest-Format bereits vorgesehen, aber erst nutzbar, sobald die Shell
selbst gebaut ist.
