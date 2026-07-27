# QUniverse

Ein Qu-basiertes Ökosystem: ein zentraler Relay/Domain-Einstiegspunkt,
ein gemeinsames Nutzerverzeichnis (opt-in), Cross-App-Benachrichtigungen und
mehrere unabhängig entwickelte, aber zusammen funktionierende Apps (Forum,
Chat, Messenger, ToDo, Kalender, Kontakte, CMS, Geo-Chase, …) — alle auf
Basis des [Qu-Frameworks](https://github.com/ReactivityJS/Qu).

**Qu ist der Core** (Identität, Spaces, ACL/Verschlüsselung, Netzwerk/Relay,
wiederverwendbare App-Bausteine wie Spaces/Membership/Profiles/Chat/
Notifications, reaktive `<qu-*>`-Components) — dieses Repo ist das darauf
aufbauende **Produkt**: eine konkrete Relay-Deployment-Konfiguration, ein
Ökosystem-Shell (Willkommensseite, Navigation, Notifications — folgt in
einer späteren Phase), ein erweitertes Relay-Admin-Dashboard, und die
konkreten Apps selbst.

Das vollständige Architektur-/Phasenkonzept steht in Qu's eigenem Repo,
Branch [`claude/quniverse-ecosystem-architecture-cd289p`](https://github.com/ReactivityJS/Qu/tree/claude/quniverse-ecosystem-architecture-cd289p).

## Status

**Phase 0 (Fundament)** — abgeschlossen auf Qu-Seite: geteilte
Identity-Bootstrap-Konvention, generisches Notifications-Modul,
Relay-Rate-Limit/Connection-Limit als laufzeit-konfigurierbare
Admin-Features, erweitertes App-/Service-Manifest-Format
(`server/service-registry.mjs`).

Dieses Repo enthält bisher nur das Grundgerüst (`server.mjs`, `services/`)
— die eigentliche Ökosystem-Shell (Router, `<qu-app-shell>`,
Navigations-Dropdown, Notification-Feed) sowie die konkreten Apps folgen in
den nächsten Phasen (siehe Phasenplan in Qu's Architektur-Dokument).

## Abhängigkeit von Qu

`package.json` referenziert Qu direkt per GitHub-Branch (kein npm-Package
veröffentlicht):

```json
"dependencies": {
  "qu-core": "github:ReactivityJS/Qu#claude/quniverse-ecosystem-architecture-cd289p"
}
```

Sobald der Phase-0-Branch nach `main` gemerged ist, sollte diese Referenz
auf `main` (oder einen Release-Tag, sobald verfügbar) umgestellt werden.
Für Browser-Code (die künftige Shell) ist stattdessen Qu's dokumentierte
CDN-Bundle-Pipeline (`dist`-Branch über jsDelivr) der vorgesehene Weg — siehe
Qu's README, Abschnitt "Installation".

## Struktur

```
server.mjs      Relay-Deployment-Einstiegspunkt — importiert createRelay()
                aus Qu, konfiguriert relayAdmins/Rate-Limit/Connection-Limit
                über Umgebungsvariablen (dieselben Namen wie in Qu's
                eigenem index.js: QU_RELAY_ADMINS, QU_RATE_LIMIT_MAX,
                QU_RATE_LIMIT_WINDOW_MS, QU_MAX_CONNECTIONS,
                QU_ALLOWED_FINGERPRINTS), registriert die konkrete
                Service-Liste dieses Ökosystems.
services/       Ein Verzeichnis pro App, nach dem App-/Service-Template
                (siehe services/README.md) — noch leer, erste Apps folgen
                in einer späteren Phase.
```

## Lokal starten

```
npm install
npm start
```

Startet einen Relay auf `ws://localhost:8788/relay` (Port über `PORT`
konfigurierbar). Ohne `QU_RELAY_ADMINS` gesetzt hat niemand
Admin-Rechte (Services togglen, Rate-Limit/Connection-Limit ändern) — siehe
Qu's `examples/relay-admin` für ein Referenz-Dashboard, das gegen diesen
Relay läuft.
