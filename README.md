# QUniverse — umgezogen in das Qu-Repo

**Dieses Repo wird nicht mehr weiterentwickelt und ist nicht mehr
lauffähig.** QUniverse lebt jetzt direkt im Repo-Root von
[`ReactivityJS/Qu`](https://github.com/ReactivityJS/Qu) — kein Unterordner
mehr, ein einziger Server-Prozess (`index.js`) für Relay UND Shell:

👉 **[`ReactivityJS/Qu`](https://github.com/ReactivityJS/Qu)**

## Warum der Umzug

`package.json` referenzierte Qu bisher per `github:`-npm-Abhängigkeit
(`"qu-core": "github:ReactivityJS/Qu#..."`). Das funktioniert nur, wenn
`npm install` intern den `git`-Befehl aufrufen kann (`child_process.spawn`)
— fehlt `git` auf dem `PATH` oder ist es nicht erreichbar, schlägt die
Installation mit `ENOENT: spawn git` fehl, noch bevor irgendein Code lädt.
Da Qu (noch) keine Release-Tags/kein veröffentlichtes npm-Paket hat und
sich mit praktisch jedem Commit ändert, gab es dafür in einem separaten
Repo keinen stabilen, git-freien Bezugspunkt.

Die Lösung: QUniverse lebt jetzt direkt im Qu-Repo-Root, mit reinen
relativen ES-Module-Importen (`./src/index.js` usw.) statt einer
Paket-Abhängigkeit — kein `package.json`, kein `npm install`, kein
`node_modules/`, keine `git`-Abhängigkeit mehr nötig. In einem zweiten
Schritt wurde zusätzlich der bis dahin separate Relay-Prozess
(`quniverse/server.mjs`) in Qu's eigenes, bereits admin-feature-reiches
`index.js` zusammengelegt — genau EIN Server-Einstiegspunkt, genau EIN
`sw.js`, drei unabhängige Umgebungsvariablen (`QU_SERVE_QUNIVERSE`/
`QU_SERVE_DOCS`/`QU_SERVE_EXAMPLES`) schalten die HTTP-Inhaltsbereiche
(QUniverse-Shell/Apps, Dokumentation, Qu's Lern-Demos) unabhängig
voneinander ein oder aus.

## Was jetzt tun

- Quellcode, Doku, Umgebungsvariablen, Start-Anleitung: siehe Qu's eigenem
  [`README.md`](https://github.com/ReactivityJS/Qu/blob/main/README.md)
  (Abschnitt "QUniverse") und
  [`services/README.md`](https://github.com/ReactivityJS/Qu/blob/main/services/README.md)
  (App-/Service-Template).
- Dieses Repo (`ReactivityJS/QUniverse`) bleibt aus historischen Gründen
  bestehen, wird aber **nicht gelöscht und nicht weiter aktualisiert** —
  neue Issues/PRs bitte gegen `ReactivityJS/Qu` stellen.
