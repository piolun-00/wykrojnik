# Edytor wykrojników 2D

Draft narzędzia w przeglądarce do poprawiania wykrojników i układania impozycji pod ploter SINAJET DF1007-MT.

- Import: SVG, DXF, pierwsza strona PDF (typ linii po kolorze obrysu lub warstwie)
- Typy linii: cięcie, bigowanie, perforacja, nacinanie, pomiń
- Edycja: ścieżki i węzły, łączenie odcinków, miarka, korekta o grubość materiału
- Impozycja: arkusz, margines, odstęp, obrót, znaczniki pasowania
- Eksport: DXF (warstwy CUT, CREASE, PERF, KISSCUT, REG), PDF, SVG

- Pudełko: szerokość, wysokość, głębokość (zewnętrzne) i grubość materiału; ścianki dodawane plusem

Przy każdej zmianie podbij wersję w `index.html` (`VERSION`) i w `version.json` — otwarta strona pokaże wtedy przycisk „Nowa wersja”.

Całość to jeden plik `index.html`, bez serwera. Pliki zostają w przeglądarce.
