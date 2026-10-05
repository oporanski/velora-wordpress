# Zgłoszenie wtyczek do katalogu WordPress.org

Runbook dla `velora-club-widgets` i `velora-breeder-widgets`.
Źródło reguł: [wytyczne katalogu](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/),
[FAQ dla deweloperów](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/),
[formularz zgłoszenia](https://wordpress.org/plugins/developers/add/).

> **Uwaga o ścieżkach (2026-10-05).** Wtyczki mieszkają od tej daty we własnym
> repozytorium `velora-wordpress`; ścieżki typu `club/`, `core/`, `tests/` liczone
> są od jego korzenia. Ścieżki `apps/frontend/...` ORAZ `docs/user-guide/`
> wskazują **repozytorium portalu Velora** (osobny checkout), nie to repozytorium
> — patrz `docs/relacja-z-portalem.md`.

## Ustalenia projektowe

| | |
|---|---|
| Konto WordPress.org | **`velorapet`** (potwierdzone przez właściciela 2026-08-09) |
| Kolejność zgłoszeń | **najpierw klub**, potem hodowca |
| Slugi | `velora-club-widgets`, `velora-breeder-widgets` — oba sprawdzone jako wolne |

**Dlaczego po kolei, a nie naraz:** FAQ katalogu ogranicza dewelopera do **jednego aktywnego
zgłoszenia**. Limit rośnie dopiero powyżej miliona aktywnych instalacji. Próba obejścia przez
drugie konto kończy się zawieszeniem wszystkich kont pobocznych — nie robimy tego.

## Zanim wyślesz

1. Zbuduj paczkę:
   ```
   bash docker/wp-dev/package-plugin.sh club
   ```
   Wynik: `dist/velora-club-widgets-<wersja>.zip`. Limit katalogu to 10 MB — nasza paczka jest
   rzędu setek kilobajtów, więc zapas jest ogromny. (Rozmiar urósł nieco po przejściu na
   nieskompresowany bundle, patrz „Czego NIE wolno wnieść z powrotem".)

2. Przepuść ją przez oficjalne narzędzie. Kontener dev ma je zainstalowane:
   ```
   docker exec velora-wp-breeder wp plugin list --allow-root | grep velora
   docker exec velora-wp-breeder wp plugin check <ścieżka> --allow-root --slug=velora-club-widgets --format=csv
   ```
   🔴 **Najpierw sprawdź, czy wtyczka jest `active`.** Gdy PHP wywali się fatalem, Plugin Check
   zwraca „0 błędów, 0 ostrzeżeń" — bo nie obejrzał ani jednego pliku. Zero błędów przy
   niedziałającej wtyczce wygląda identycznie jak zero błędów przy poprawnej.

3. Sprawdź `WP_DEBUG`. FAQ wymaga tego wprost: *„All plugins must be tested with `WP_DEBUG`
   enabled"*. Kontenery dev mają `WORDPRESS_DEBUG=1`:
   ```
   docker exec velora-wp-club sh -c 'rm -f /var/www/html/wp-content/debug.log'
   # wywołaj każdy shortcode, np.:
   docker exec velora-wp-club wp eval "echo do_shortcode('[velora-club-events]');" --allow-root
   docker exec velora-wp-club sh -c 'cat /var/www/html/wp-content/debug.log 2>/dev/null || echo CZYSTO'
   ```

## Wysyłka

Formularz: <https://wordpress.org/plugins/developers/add/> (trzeba być zalogowanym jako `velorapet`).

Slug powstaje z nagłówka `Plugin Name` w głównym pliku wtyczki. **Po zatwierdzeniu sluga nie da
się zmienić.** Przed rozpoczęciem przeglądu można go raz poprawić samodzielnie; później wymaga
kontaktu z zespołem.

Slug decyduje o czterech rzeczach naraz: adresie strony wtyczki, nazwie katalogu w
`wp-content/plugins/`, adresie repozytorium SVN i domenie tekstowej i18n. Nasza domena tekstowa
(`Text Domain: velora-club-widgets`) już się z nim zgadza.

## Czas przeglądu

- Formularz zgłoszenia mówi o **1–10 dniach**, z celem 5 dni roboczych.
- FAQ dodaje, że poprawna i niewielka wtyczka powinna zostać zatwierdzona **w ciągu 14 dni od
  rozpoczęcia przeglądu**, a zespół odpowiada na korespondencję w ciągu 10 dni roboczych.
- Zgłoszenie nierozstrzygnięte przez 3 miesiące jest odrzucane (można wysłać ponownie).
- **Przyspieszyć się nie da** — wyjątkiem są wyłącznie sprawy bezpieczeństwa i prawne.

Temat maila z przeglądem: `[WordPress Plugin Directory] Review in Progress: {nazwa wtyczki}`.
**Sprawdź spam** — to najczęstsza przyczyna „ciszy" po stronie zgłaszającego.

Gdy przegląd zwróci uwagi: **odpowiadasz na tego maila, nie zgłaszasz wtyczki ponownie.**

## Po zatwierdzeniu — SVN

Dostajesz repozytorium SVN o strukturze:

```
/assets/          ← ikony, banery, zrzuty ekranu (NIE trafiają do ZIP-a)
/tags/            ← zamrożone wydania: /tags/1.0.0/
/trunk/           ← bieżący kod
```

**Kod idzie prosto do `trunk/`**, bez zagnieżdżania w podkatalogu — zagnieżdżenie psuje generator
ZIP-ów. `readme.txt` i główny plik wtyczki muszą leżeć bezpośrednio w `trunk/`.

Zasoby graficzne z `club/.wordpress-org/` kopiujesz do SVN `/assets/`:

| Plik | Wymiary | Stan |
|---|---|---|
| `icon-128x128.png` | 128 × 128 | ✅ jest |
| `icon-256x256.png` | 256 × 256 | ✅ jest |
| `banner-772x250.png` | 772 × 250 | ✅ jest |
| `banner-1544x500.png` | 1544 × 500 | ✅ jest |
| `screenshot-1..5.png` | 1280 × 720 | ❌ brak — sekcja `== Screenshots ==` została usunięta z readme |

Zrzuty można dodać później **bez wydawania nowej wersji wtyczki** — leżą w SVN `/assets/`, a nie
w paczce. Wymagają wtedy przywrócenia sekcji `== Screenshots ==` w `readme.txt`.

### Zasady pracy z SVN

- **Commit do SVN = publikacja natychmiastowa.** Nie ma przycisku „wyłącz" poza zamknięciem
  wtyczki. Nie wypychaj kodu, którego nie chcesz mieć u użytkowników w tej sekundzie.
- **`Stable tag` nie może wskazywać `trunk`** — ma wskazywać katalog w `tags/`.
- **Każde wydanie = wyższy numer wersji.** Bez tego użytkownicy nie dostaną powiadomienia.
- **Nie używaj SVN externals** — nie wchodzą do generowanego ZIP-a.
- **Commituj rzadko.** SVN służy wydaniom, nie codziennej pracy — od tego jest git.
- Trzymaj w SVN tylko bieżące i poprzednie wydanie; historia mieszka w gicie.

## Po publikacji — czego się spodziewać

- Wtyczka pojawia się w wyszukiwarce katalogu **6–14 dni** po pierwszym commicie do SVN
  (parsowanie danych + cache). Nowa wtyczka bez instalacji startuje nisko w rankingu.
- Aktualizacje katalogu propagują się kilka–kilkanaście minut; przed zgłaszaniem problemu
  odczekaj **6 godzin**.

## Do zrobienia po zatwierdzeniu pierwszej wtyczki

1. **Zaktualizować artykuł pomocy** `apps/frontend/src/pages/help/articles/embed.tsx`. Mówi dziś
   *„Wtyczki nie są jeszcze opublikowane w katalogu WordPress.org — w tym okresie pobierz ZIP
   bezpośrednio"*. Zdanie jest prawdziwe teraz i stanie się nieprawdziwe w dniu publikacji.
   Pamiętaj o obu wersjach językowych (PL i EN w tym samym pliku) oraz o
   `docs/user-guide/` — to dwa różne artefakty.
2. **Zgłosić drugą wtyczkę** (hodowca) — dopiero gdy pierwsza przestanie być aktywnym zgłoszeniem.
3. **Rozważyć zrzuty ekranu** dla obu wtyczek.

## Czego NIE wolno wnieść z powrotem

Usunięte świadomie przy przygotowaniu do katalogu — przywrócenie oznacza odrzucenie wtyczki:

- **Własny mechanizm auto-aktualizacji** (`Velora_Base_Updater`, `update-manifest.json`). Plugin
  Check ma na to dedykowaną regułę: `plugin_updater_detected` — *„These are not permitted in
  WordPress.org hosted plugins"*. Wytyczne #3 i #8.
- **Minifikacja bundla** (`core/vite.config.ts` → `minify: false`). Wytyczna #4
  wymaga kodu czytelnego dla człowieka. Koszt utrzymania tego stanu to ~6 KB po gzipie.
- **Pobieranie binarki captchy z CDN-a.** `@cap.js/widget` domyślnie ściąga swój solver
  WebAssembly z `cdn.jsdelivr.net` — czyli kod wykonywalny z obcego serwera na stronie klienta,
  wprost zakazany wytyczną #8 („Plugins cannot … use third-party CDNs for non-font assets").
  Trzymają to trzy rzeczy i wszystkie trzy muszą zostać: plugin `capWasmAsset()`
  w `vite.config.ts` (emituje binarkę obok `embed.js`, przepisuje adres CDN-owy w kodzie
  widgetu i pilnuje zgodności wersji), `core/src/cap-wasm.ts` (ustawia
  `window.CAP_CUSTOM_WASM_URL` **przed** importem widgetu) oraz kopiowanie
  `cap_wasm_bg.wasm` do `assets/` w `docker/wp-dev/package-plugin.sh`.
  Kolejność importów w `src/captcha.ts` jest częścią mechanizmu, nie kosmetyką — widget czyta
  tę zmienną w trakcie własnej ewaluacji. Odwrócenie kolejności łapie test
  `src/__tests__/captcha.test.ts`, a znikającą binarkę — bramka w `buildEnd`.
  Sprawdzenie po każdym `npm run build`:
  ```
  grep -c "cdn.jsdelivr.net" core/dist/embed.js   # musi być 0
  ```
- **Link „Powered by Velora" włączony domyślnie.** Wytyczna #10: kredyty muszą być opcjonalne
  i **domyślnie ukryte**.

## Czego NIE wolno USUNĄĆ, mimo że narzędzie to zgłasza

- **`load_plugin_textdomain()`** w `shared/class-base-plugin.php`. Plugin Check raportuje je jako
  `DiscouragedFunctions.load_plugin_textdomainFound` — to **ostrzeżenie, nie błąd**, i jest u nas
  świadomie zaakceptowane. Reguła „od WordPressa 4.6 zbędne" dotyczy tłumaczeń pobranych
  z translate.wordpress.org do `wp-content/languages/plugins/`. Nasze `.mo` jadą **w paczce**,
  w `languages/`, a `WP_Textdomain_Registry` zna wyłącznie `WP_LANG_DIR` oraz ścieżki
  zarejestrowane przez `load_plugin_textdomain()`. Nagłówek `Domain Path` niczego nie rejestruje
  — WordPress 6.6 czyta go tylko przy renderowaniu ekranu „Wtyczki". Zmierzone w kontenerze
  na WP 6.6: sam nagłówek → `WP_Textdomain_Registry::get()` zwraca `false` i menu admina jest
  po angielsku; z wywołaniem → zwraca katalog wtyczki i `__('Velora Breeder')` daje
  „Velora Hodowca". Usunięcie tej linijki cofa polskie tłumaczenia PHP **po cichu** — nic nie
  pęka, tekst po prostu zostaje angielski.
