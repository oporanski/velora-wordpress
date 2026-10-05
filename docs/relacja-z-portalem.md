# Co łączy to repozytorium z portalem Velora

Dokument dla człowieka, który za pół roku zapomni, dlaczego te dwa repozytoria
jeszcze o sobie wiedzą. Stan: 2026-10-05, zaraz po rozdzieleniu.

- **To repozytorium** (`velora-wordpress`) — dwie wtyczki WordPressa i wspólny
  bundel JS. Publiczne, GPL v2.
- **Portal** (`velora`) — monorepo z backendem, frontendem i aplikacją mobilną.
  Prywatne.

Po rozdzieleniu zostały **cztery** punkty styku. Żaden z nich nie jest zależnością
w kodzie — każdy jest zależnością operacyjną.

## 1. Publiczne API — jedyna zależność czasu działania

Wtyczki nie mają własnego backendu. Wszystko, co pokazują, pobierają z publicznej
bramy portalu:

- adres domyślny: `https://velora.pet` (ustawiany w panelu wtyczki, opcje
  `velora_{breeder,club}_api_base`); ta sama brama odpowiada też na
  `https://api.velora.pet`;
- ścieżki: `/v1/breeders/:slug/...`, `/v1/clubs/:slug/...`, `/v1/captcha/...`;
- odczyt (zwierzęta, ogłoszenia, galeria, wydarzenia) idzie **z przeglądarki
  odwiedzającego** i nie wymaga klucza;
- wysłanie formularza kontaktowego idzie **z serwera strony** (`wp_remote_post`),
  z kluczem `vk_live_…` w nagłówku `Authorization`, żeby klucz nigdy nie trafił
  do przeglądarki.

**Konsekwencja:** zmiana kształtu odpowiedzi `/v1/*` w portalu psuje wtyczki,
a repozytorium wtyczek o tym nie wie. Kontrakt API jest niepisany — jeśli ruszasz
`external-api` w portalu, sprawdź `core/src/api-client.ts` tutaj.

## 2. Paczki ZIP w `velora.pet/downloads/`

Wtyczki nie są (jeszcze) w katalogu WordPress.org, więc użytkownicy pobierają je
ze strony pomocy portalu. Artykuł `apps/frontend/src/pages/help/articles/embed.tsx`
w repozytorium portalu linkuje do:

- `/downloads/velora-breeder-widgets.zip`
- `/downloads/velora-club-widgets.zip`

Te pliki **powstają tutaj**, a lądują w repozytorium portalu:

```bash
make wp-package                          # publikuje do ../velora (domyślnie)
VELORA_PORTAL_DIR=/ścieżka/do/velora make wp-package
VELORA_PORTAL_DIR=none make wp-package   # tylko dist/, bez publikacji
```

Skrypt kopiuje ZIP do `$VELORA_PORTAL_DIR/apps/frontend/public/downloads/` pod
nazwą wersjonowaną **i** pod stałym aliasem. Jeśli ten katalog nie istnieje,
skrypt **kończy się błędem** — cicha porażka znaczyłaby „wydałem nową wtyczkę,
a ludzie dalej pobierają starą".

**To nie kończy wydania.** Pliki trafiają tylko do drzewa roboczego portalu.
Do użytkowników docierają dopiero po commicie i wdrożeniu **portalu**.

## 3. Lokalny stos deweloperski wymaga backendu z sąsiedniego checkoutu

`make wp-up` startuje WordPressa, ale nie backend. Formularze kontaktowe i
widżety wymagające klucza działają lokalnie dopiero, gdy:

1. w checkoucie portalu stoi stos: `cd ../velora && make up`;
2. tutaj odpalisz `make wp-seed-keys`.

`docker/wp-dev/seed-api-keys.sh` wchodzi `docker exec` do kontenera
`velora-backend` (czyli kontenera portalu), tworzy klucze API przez Prismę
i zapisuje je przez `wp-cli` w opcjach obu WordPressów. Skrypt zakłada, że ten
kontener istnieje i nazywa się `velora-backend` — to jedyne miejsce w tym
repozytorium, które sięga do cudzego kontenera po nazwie.

Do pracy z danymi produkcyjnymi backend lokalny jest zbędny: wystarczy zostawić
adres API na domyślnym `https://velora.pet`.

## 4. SonarQube — wspólna instancja, osobny projekt

`sonar.projectKey=velora-wp-plugins` celowo się **nie zmienił** przy
przeprowadzce, więc historia projektu w SonarQube przetrwała rozdzielenie.
Klucz projektu w SonarQube to `velora-wp-plugins` — ten sam co przed
wydzieleniem, więc historia analiz przeżyła przeprowadzkę.

## Czego NIE ma (żeby nie szukać)

- **Brak mechanizmu auto-aktualizacji.** `Velora_Base_Updater` i
  `update-manifest.json` zostały usunięte przy przygotowaniu do katalogu
  WordPress.org — wytyczna #8 zabrania wtyczce aktualizować się spoza katalogu
  (Plugin Check ma na to regułę `plugin_updater_detected`). Paczka w
  `velora.pet/downloads/` jest wygodnym plikiem do pobrania, **nie** kanałem
  aktualizacji. Szczegóły: `docs/wordpress-org-submission.md`.
- **Brak dostępu do bazy portalu.** Wtyczki widzą wyłącznie to, co wystawia
  publiczne `/v1/*`. Danych operacyjnych hodowli (mioty, planowane kojarzenia)
  nie ma tam w ogóle i nie wolno ich tam dodać.
- **Brak wspólnych zależności npm/composer.** Oba repozytoria instalują swoje
  paczki osobno.
