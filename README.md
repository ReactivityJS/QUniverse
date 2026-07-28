# QUniverse — umgezogen in das Qu-Repo

**Dieses Repo wird nicht mehr weiterentwickelt und ist nicht mehr
lauffähig.** QUniverse lebt jetzt als Unterordner im
[`ReactivityJS/Qu`](https://github.com/ReactivityJS/Qu)-Repo:

👉 **[`ReactivityJS/Qu` → `quniverse/`](https://github.com/ReactivityJS/Qu/tree/claude/quniverse-ecosystem-architecture-cd289p/quniverse)**

## Warum der Umzug

`package.json` referenzierte Qu bisher per `github:`-npm-Abhängigkeit
(`"qu-core": "github:ReactivityJS/Qu#..."`). Das funktioniert nur, wenn
`npm install` intern den `git`-Befehl aufrufen kann (`child_process.spawn`)
— fehlt `git` auf dem `PATH` oder ist es nicht erreichbar, schlägt die
Installation mit `ENOENT: spawn git` fehl, noch bevor irgendein Code lädt.
Da Qu (noch) keine Release-Tags/kein veröffentlichtes npm-Paket hat und
sich mit praktisch jedem Commit ändert, gab es dafür in einem separaten
Repo keinen stabilen, git-freien Bezugspunkt.

Die Lösung: QUniverse lebt jetzt als Unterordner direkt im Qu-Repo, mit
reinen relativen ES-Module-Importen (`../src/index.js` usw.) statt einer
Paket-Abhängigkeit — kein `package.json`, kein `npm install`, kein
`node_modules/`, keine `git`-Abhängigkeit mehr nötig.

## Was jetzt tun

- Quellcode, Doku, Umgebungsvariablen, Start-Anleitung: siehe
  [`quniverse/README.md`](https://github.com/ReactivityJS/Qu/blob/claude/quniverse-ecosystem-architecture-cd289p/quniverse/README.md)
  im Qu-Repo.
- Dieses Repo (`ReactivityJS/QUniverse`) bleibt aus historischen Gründen
  bestehen, wird aber **nicht gelöscht und nicht weiter aktualisiert** —
  neue Issues/PRs bitte gegen `ReactivityJS/Qu` stellen.
