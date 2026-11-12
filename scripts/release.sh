#!/bin/bash
# Numer wersji w index.html (?v= przy plikach aplikacji) i w version.json — wymusza świeże pliki w przeglądarkach
# i uruchamia pasek „Jest nowa wersja” na otwartych stronach.
# Publikacja na GitHub Pages robi to sama przy każdym wdrożeniu; lokalnie uruchamiaj przed commitem albo do testów.
# Opcjonalny argument: własny numer wersji.
set -e
cd "$(dirname "$0")/.."
V="${1:-$(TZ=Europe/Warsaw date +%Y.%m.%d.%H%M)}"
sed -i.bak -E "s#(app/(core\.js|ui\.js|app\.css))(\?v=[^\"]*)?\"#\1?v=$V\"#g" index.html && rm -f index.html.bak
printf '{ "version": "%s" }\n' "$V" > version.json
echo "Wersja $V"
