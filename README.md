# KHOREI — wykrojnik

Narzędzie w przeglądarce do budowania wykrojników pudełek, poprawiania plików i układania impozycji pod ploter SINAJET DF1007-MT.

- **Pudełko** z wymiarów zewnętrznych (szerokość, wysokość, głębokość), grubości materiału i sposobu robienia zgięć; ścianki, klejenia, zakładki i klapki dodawane plusem
- **Rysowanie**: prostokąt, elipsa, linia, wielokąt; skalowanie, obrót, wyrównywanie, rozkładanie, kopiuj / wklej
- **Punkty**: Enter albo dwuklik otwiera edycję punktów (także na pudełku — przesunięcia trzymają się przy zmianie wymiarów)
- **Import**: SVG, DXF, pierwsza strona PDF (rodzaj linii po kolorze obrysu lub warstwie)
- **Impozycja**: arkusz, margines, odstęp, obrót, róg startowy, znaczniki pasowania
- **Eksport**: DXF (warstwy CUT, CREASE, VCUT, PERF, KISSCUT, REG), PDF, SVG

## Pliki

| Plik | Rola |
|---|---|
| `index.html` | szkielet strony |
| `app/core.js` | geometria i formaty plików, bez przeglądarki (testowalne w Node) |
| `app/ui.js` | interfejs |
| `app/app.css` | wygląd (wzór: edytor brandmanuala) |
| `tests/run.js` | testy geometrii i interfejsu (jsdom) |

## Wersja i publikacja

Każdy push na `main` uruchamia workflow `pages.yml`: najpierw testy, po zielonych publikacja na GitHub Pages.
Numer wersji (`version.json`, `?v=` w `index.html`) nadaje workflow przy wdrożeniu z czasu commita. Otwarta strona co minutę
porównuje swój numer z `version.json` i pokazuje pasek „Jest nowa wersja”. `scripts/release.sh` nadaje numer lokalnie.

Workflow wymaga ustawienia Settings → Pages → Source: **GitHub Actions**.

Testy lokalnie: `cd tests && npm install && npm test`.
