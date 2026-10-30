# Präsentationsdaten / Datenlizenz

Dieses Verzeichnis enthält ein komprimiertes, reproduzierbares Datenpaket für
Berlin, München, Frankfurt am Main, Köln und Detmold. Es enthält keine
Zugangsdaten, Nutzer-Messungen oder persönlichen Standorte.

- `archive.jsonl.gz`: historische Preisänderungen von **Tankerkönig**, ausgewertet
  als tägliche Preisintegrale und bekannte Gültigkeitssekunden, 01.10.2025 bis
  30.09.2026. 673 Stationen, 734.607 tägliche Kraftstoffdatensätze.
  Quelle: https://data.tankerkoenig.de/tankerkoenig-organization/tankerkoenig-data
  / https://www.tankerkoenig.de/
- `kaggle-2022.jsonl.gz`: auf die fünf Städte beschränkte Monatsmittel des
  Datensatzes **Petrol/Gas Stations Germany, Ole und Mitwirkende**, Version 2,
  ursprüngliche Preisquelle Tankerkönig. 617 Stationen, 21.461 Monatsmittel.
  Quelle: https://www.kaggle.com/datasets/oles04/petrol-station-germany
- `manifest.json`: Formatversion, Zeilenzahlen und SHA-256-Prüfsummen.

**Lizenz dieser Datendateien: Creative Commons BY-NC-SA 4.0**
https://creativecommons.org/licenses/by-nc-sa/4.0/

Namensnennung, nicht-kommerzielle Nutzung und Weitergabe unter gleichen
Bedingungen gemäß verlinkter Lizenz. Die Lizenz bezieht sich auf diese
Datendateien, nicht pauschal auf den übrigen Quellcode.

Bearbeitung durch FuelAnalytics: Ortsauswahl und Vereinheitlichung der Stadtnamen,
Prüfung der Quelldaten, Verdichtung der Änderungsdaten zu zeitgewichteten
Tagesintegralen. Keine erfundenen Zwischenpreise. Die ältere Kaggle-Aggregation
wird unverändert als Quell-Monatsmittel behandelt. Ihre ursprünglichen
Ausschlusszahlen/Dateiprüfsummen beziehen sich auf die vollständige Quelldatei;
dieses Paket ist ausdrücklich eine Städteauswahl.

Erzeugung aus den lokal validierten Quelldaten:
`py -3 scripts/build_bundled_history.py`. Ursprüngliche Downloads und
persönliche Zugangsdaten bleiben außerhalb von Git.
