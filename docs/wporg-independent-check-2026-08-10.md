# Niezależna kontrola gotowości wtyczek WP do katalogu WordPress.org

**Data:** 2026-08-10 · **Zakres:** `{club,breeder,shared,core,tests}`
**Tryb:** adwersarialny — celem było podważenie, nie potwierdzenie, twierdzeń poprzedniej sesji.
**Środowisko:** worktree `.worktrees/wporg-check` (gałąź `agent/wporg-check`), stack `make wp-up`
(WordPress 6.6.2, Plugin Check 2.0.0), kontenery montują kopię z tego worktree.

> **Uwaga o ścieżkach (dopisane 2026-10-05).** To jest zapis kontroli z 2026-08-10,
> wykonanej jeszcze w monorepo. Ścieżki `apps/wp-plugins/...` przepisano na względne
> wobec korzenia tego repozytorium (`club/`, `core/`, `shared/`, `tests/`). Nazwy celów
> `make` pozostawiono **tak, jak brzmiały w dniu kontroli** — dziś odpowiadają im:
> `make test-wp-plugins` → `make test`, `make coverage-wp-plugins` → `make coverage`,
> `make wp-plugins-build` → `make build-base`. Liczby (124 testy, 341 asercji) to pomiar
> z 2026-08-10, nie stan dzisiejszy.

Żaden dokument w repozytorium ani żaden raport poprzedniej sesji nie był traktowany jako źródło
prawdy. Podstawą są cztery strony WordPress.org przeczytane w całości oraz kod i zachowanie
wtyczek na żywo.

---

## 1. Dyscyplina dowodowa — co udowodniono o samych narzędziach

Każde narzędzie, zanim jego wynik pozytywny został przyjęty, musiało pokazać wynik negatywny.

### 1.1 Plugin Check UMIE zaświecić na czerwono

Kopia paczki klubu (`velora-broken-canary`) z celowo wstrzykniętymi defektami: wywołanie funkcji
`eval` na zawartości `$_POST`, `echo` nieescapowanego `$_GET`, zapytanie `$wpdb->query()` sklejone
z `$_GET`, oraz `Tested up to: 4.0`.

```
36 ERROR, 16 WARNING
40,5   ERROR  Generic.PHP.ForbiddenFunctions.Found                The use of function eval() is forbidden
41,10  ERROR  WordPress.Security.EscapeOutput.OutputNotEscaped    All output should be run through an escaping function ... found '$_GET['unescaped']'
42,12  ERROR  PluginCheck.Security.DirectDB.UnescapedDBParameter  Unescaped parameter $_GET['id'] used in $wpdb->query()
42,49  ERROR  WordPress.DB.PreparedSQL.NotPrepared                Use placeholders and $wpdb->prepare(); found $_GET
0,0    ERROR  outdated_tested_upto_header                         Tested up to: 4.0 < 7.0. ...
```

Przy okazji potwierdzone: Plugin Check zna **WP 7.0** jako wersję bieżącą.

### 1.2 …ale Plugin Check NIE WIDZI kodu JavaScript

Do tej samej kopii dopisano do `assets/embed.js` literał adresu jsDelivr do pliku `.wasm` oraz
wywołanie `fetch()` na adres unpkg, a do PHP — `wp_enqueue_script()` z adresem jsDelivr.

Wynik — **jedno** trafienie, wyłącznie z PHP:

```
45,61  ERROR  PluginCheck.CodeAnalysis.EnqueuedResourceOffloading.OffloadedContent
       Found call to wp_enqueue_script() with external resource. Offloading scripts ... is disallowed.
```

Literał CDN i `fetch()` w pliku `.js` przeszły **niezauważone**.

> **Wniosek metodologiczny.** „Plugin Check czysty" jest zgodne zarówno z „bundle nie dotyka CDN-u",
> jak i z „bundle wali prosto w jsDelivr". Wytyczna #8 dotyczy głównie bundla JS — czyli dokładnie
> tego obszaru, którego to narzędzie nie bada. Rozstrzyga tylko czytanie bundla i podgląd ruchu
> sieciowego. Obie te kontrole wykonano (§3.2, §4).

### 1.3 Testy UMIEJĄ zejść na czerwono (dowód mutacyjny, na kopiach — bez `git checkout`)

| Mutacja | Wynik |
|---|---|
| usunięcie `data-velora-config` z `widget_markup()` | PHPUnit **3 failures** / 124, m.in. `PluginIsolationTest::test_every_widget_mount_point_names_its_own_config_global` |
| `showCredit: false` → `true` w `core/src/config.ts` | vitest **1 failed** / 140 (`expect(cfg.showCredit).toBe(false)`) |

Drzewo po przywróceniu: `git status --short` puste.

### 1.4 Tłumaczenia — paczka językowa rdzenia obecna, twierdzenie zweryfikowane eksperymentem

`wp language core install pl_PL` → *„Language 'pl_PL' already installed"*, `switch_to_locale('pl_PL')`
zwraca `true`. Czyli tym razem test mierzy tłumaczenia, a nie brak paczki. Szczegóły w §6 (T2).

---

## 2. Moja lista kontrolna wyprowadzona ze źródeł

Wyprowadzona z: `wordpress.org/plugins/developers/add/`, `plugin-developer-faq`,
`detailed-plugin-guidelines` (18 punktów), `wordpress.org/plugins/plugin-check/`.

| # | Wymóg | Klub | Hodowca | Uwaga |
|---|---|---|---|---|
| A1 | Nieescapowany output | ✅ | ✅ | Plugin Check 0 ERROR; `esc_html_e`/`esc_attr` konsekwentnie |
| A2 | Niesanityzowane wejście | ✅ | ✅ | `sanitize_*` na każdym argumencie REST; `wp_unslash` na `$_SERVER` |
| A3 | Formularz bez nonce | ✅ | ✅ | Panel: `settings_fields()`. Trasa REST jest publiczna i bezstanowa dla WP — nonce nieadekwatny |
| G1 | Licencja GPL-kompatybilna | ⚠️ | ⚠️ | Nagłówki OK; **plik `LICENSE` to skrót, nie GPLv2** — F2 |
| G2 | Odpowiedzialność za biblioteki | ⚠️ | ⚠️ | Apache-2.0 (`@cap.js/*`) → zgodne przez „or later"/GPLv3; decyzja właściciela — F15 |
| G3 | Stabilna wersja w katalogu | n/d | n/d | przed zgłoszeniem |
| G4 | Kod czytelny, brak obfuskacji | ✅ | ✅ | `minify: false`; 2720 linii, własny kod z komentarzami. Jedna linia 6498 zn. = wbudowany `cap.min.js` (źródło publiczne) |
| G5 | Zakaz trialware | ✅ | ✅ | Brak blokad czasowych/płatnych |
| G6 | SaaS dozwolony, udokumentowany + ToS | ✅ | ✅ | Sekcja „External services" + linki `/privacy`, `/terms` |
| G7 | Kontakt z serwerem zewn. tylko za zgodą | ✅ | ✅ | Wyłącznie `apiBase` + własny CDN; wyzwanie captchy przy ładowaniu **jest** ujawnione w readme |
| G8 | Zakaz kodu z serwerów trzecich | ✅ | ✅ | `grep -c jsdelivr dist/embed.js` = **0**; wasm same-origin (dowód §4) |
| G9 | Etyka / brak black-hat | ✅ | ✅ | — |
| G10 | Kredyty opcjonalne, domyślnie off | ⚠️ | ⚠️ | „Powered by Velora" wzorcowo opt-in. **Plakietka Cap.js — nieusuwalna, dofollow** — F15 |
| G11 | Zakaz przejmowania panelu | ✅ | ✅ | Jedna strona ustawień, assety tylko na niej (`$hook !== admin_hook()`), zero notice'ów |
| G12 | Readme bez spamu, ≤5 tagów | ✅ | ✅ | Klub 5, hodowca 5; brak afiliacji |
| G13 | Biblioteki z rdzenia WP | ✅ | ✅ | Brak własnego jQuery |
| G14 | Rozsądne commity do SVN | n/d | n/d | — |
| G15 | Inkrementacja wersji, `Stable tag` | ✅ | ✅ | `1.0.0` spójne: nagłówek PHP, stała, readme |
| G16 | Wtyczka kompletna | ✅ | ✅ | 8 i 7 shortcode'ów działa |
| G17 | Znaki towarowe w slugu | ✅ | ✅ | `velora-*` = własna marka |
| G18 | Prawa katalogu | n/d | n/d | — |
| R1 | Nagłówki readme komplet | ✅ | ✅ | `Requires at least/Tested up to/Requires PHP/Stable tag/License` obecne |
| R2 | `Tested up to` ≤ wersja bieżąca | ⚠️ | ⚠️ | 7.0 wydane 2026-05-20 → formalnie OK, ale **testowano na 6.6.2** — F9 |
| R3 | Changelog + Upgrade Notice | ✅ | ✅ | — |
| R4 | Zgodność text-domain ze slugiem | ✅ | ✅ | Canary udowodnił, że kontrola działa |
| R5 | Zrzuty ekranu | ❌ | ❌ | Brak (znane, nieblokujące) |
| R6 | ZIP < 10 MB, bez zbędnych plików | ✅ | ✅ | 84 KB / 88 KB; `.distignore` usuwa `tests`, `.wordpress-org` |
| R7 | `WP_DEBUG` czysty | ✅ | ✅ | 15 shortcode'ów, `debug.log` nie powstał |
| R8 | Deinstalacja sprząta | ✅ | ✅ | `uninstall.php` z `WP_UNINSTALL_PLUGIN`, kasuje opcje + legacy |
| R9 | Obie wtyczki naraz na jednej instalacji | ⚠️ | ⚠️ | PHP bez kolizji; **globale JS kolidują** — F5 |

---

## 3. Wyniki narzędzi na PACZKACH DYSTRYBUCYJNYCH

Paczki odtworzone krokami `package-plugin.sh` w katalogu tymczasowym (bez brudzenia drzewa
i bez publikowania ZIP-ów do `apps/frontend/public/downloads/`). Każdą paczkę sprawdzono
w kontenerze, w którym jej slug **nie** jest montowany — badany jest ZIP, nie katalog roboczy.

### 3.1 Plugin Check — obie paczki, severity 0, checki eksperymentalne

```
$ wp plugin check velora-club-widgets --severity=0 --include-experimental \
    --include-low-severity-errors --include-low-severity-warnings
FILE: includes/class-base-plugin.php
182,9,WARNING,PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound
```

Identyczny wynik dla `velora-breeder-widgets`. **0 ERROR, 1 WARNING** w obu.
`grep -i "fatal\|parse error"` → brak. `wp plugin list` → obie `active`.

### 3.2 Hosty w zbudowanym bundlu `dist/embed.js`

```
6 https://schema.org        (JSON-LD @context — nie jest pobierane)
3 https://velora.pet        (domyślny apiBase + link „Powered by")
3 https://capjs.js.org      (link atrybucyjny w DOM — F15)
2 http://www.w3.org         (namespace SVG dla createElementNS)
1 https://images.velora.pet (CDN obrazków)
jsdelivr / unpkg / cdnjs → 0 trafień
```

### 3.3 Bramki

| Bramka | Wynik |
|---|---|
| `make test-wp-plugins` | **OK (124 testy, 341 asercji)** |
| `make coverage-wp-plugins` | Lines 99.73% (742/744) · Methods 100.0% (127/127) — progi spełnione |
| `npm run test` (core) | **140 testów, 8 plików, zielone** |
| `npm run build` (core) | OK — `embed.js` 131.88 kB, `embed.css` 23.80 kB, `cap_wasm_bg.wasm` 36.03 kB |

**Zapadka progów nie została naruszona.** Historia: PHP `38/61 → 72/89 → 97/96 → 99/99 → 99.73/100`;
vitest `18/72/55 → 18/73/60 → 24/81/81`. Wszystkie ruchy w górę. Ale patrz F6 — próg 24% linii
jest zapadką założoną na katalogu, który jest prawie nietestowany.

---

## 4. Zachowanie na żywo — obie wtyczki na jednej instalacji

Strona z 15 shortcode'ami (`http://localhost:8081/wporg-audit/`), obie wtyczki aktywne.

**Ruch sieciowy (Playwright — Chrome DevTools MCP miał zajęty profil):**

```
 8. GET  /wp-content/plugins/velora-breeder-widgets/assets/embed.js      200
 9. GET  /wp-content/plugins/velora-club-widgets/assets/embed.js         200
11. GET  /wp-content/plugins/velora-breeder-widgets/assets/cap_wasm_bg.wasm  200
12. GET  /wp-content/plugins/velora-club-widgets/assets/cap_wasm_bg.wasm     200
15-20. GET  http://localhost:4000/v1/breeders/...        200   (apiBase hodowcy)
21-27. GET  https://velora.pet/v1/clubs/...              404   (apiBase klubu = domyślny)
31-37. GET  https://dev.velora.pet/img/*.webp            200   (obrazki z odpowiedzi API — F12)
38-41. POST {apiBase}/v1/captcha/{challenge,redeem}      201
42. POST /wp-json/velora-breeder/v1/contact              500
```

Zero żądań do jsDelivr, unpkg, capjs.js.org, Google Fonts czy jakiegokolwiek innego obcego hosta.
**Każda wtyczka pobrała własną kopię wasm, same-origin** — twierdzenie o binarce w paczce się broni.

**Captcha rozwiązuje się na wasm, nie na awaryjnym solverze JS:** po kliknięciu widgetu token
pojawił się po **17 ms** (`widgetState: "done"`, `"Zweryfikowano"`). Solver czysto-JS liczący PoW
przez `crypto.subtle.digest` potrzebowałby rzędów wielkości więcej.

**`data-velora-config` na wszystkich 15 shortcode'ach — 0 braków:**

```
OK velora-breeder-*  (7) -> VeloraBreederEmbedConfig
OK velora-club-*     (8) -> VeloraClubEmbedConfig
Brakuje data-velora-config w 0 z 15 shortcode.
```

Jest to zabezpieczone konstrukcyjnie: wszystkie 15 handlerów kończy się `widget_markup()`, który
dokleja atrybut centralnie (`shared/class-base-plugin.php:141-148`).

**`WP_DEBUG`:** `WP_DEBUG=true`, `WP_DEBUG_LOG=true`. Po wywołaniu wszystkich 15 shortcode'ów
przez `wp eval` plik `wp-content/debug.log` **nie powstał**.

---

## 5. Znaleziska

Uszeregowane wagą. „Blokuje" = moja ocena, czy zatrzyma zgłoszenie do katalogu WordPress.org.

### F1 — Zgoda na formularzu kontaktowym nie jest egzekwowana, a payload zawsze deklaruje `consent: true` 🔴

`core/src/widgets/club-contact.ts:38,69-72,146-176` ·
`core/src/widgets/breeder-contact.ts:37,158`

Checkbox zgody dostaje `input.required = true` (`club-contact.ts:138`), ale formularz ma
`form.noValidate = true`, co kasuje walidację natywną w całości. `handleSubmit()` sprawdza
**wyłącznie** honeypot i token captchy — nigdy nie odczytuje `fd.get('consent')` — a do payloadu
wpisuje `consent: true` na sztywno.

Dowód empiryczny (żywa strona, formularz hodowcy):

```
before: { consentChecked: false, consentRequired: true, formValid: false, noValidate: true }
sieć:   42. POST http://localhost:8081/wp-json/velora-breeder/v1/contact => 500
komunikat: „(Plugin is not configured. Set API base and key in plugin settings.)"
```

Żądanie **wyszło** mimo niezaznaczonej zgody; 500 wrócił wyłącznie z braku klucza API w kontenerze
testowym. Na poprawnie skonfigurowanej stronie wiadomość zostałaby dostarczona — czyli zgoda nie
była egzekwowana **nigdzie**.

**Sprostowanie (2026-08-10, po weryfikacji przy naprawie).** Pierwsza wersja tego akapitu dodawała,
że „Velora zapisałaby zgodę, której odwiedzający nie udzielił". To było nieprawdziwe i jest tym
groźniejsze, że brzmi wiarygodnie: proxy WP odbudowuje payload z zamkniętej listy pól
(`handle_contact` w `shared/class-base-rest.php`) i **wycina `consent`**, a kontrakt
`apps/external-api/src/v1/contact/contact.controller.ts` w ogóle nie zna takiego pola. Ścieżką
wtyczkową Velora nie dostaje i nie przechowuje żadnego zapisu zgody. Defekt polegał więc na braku
egzekwowania po stronie widgetu — jedynym miejscu, w którym cokolwiek tę zgodę sprawdza — a nie na
zapisaniu fałszywej zgody po stronie serwera. Osobne pytanie, czy Velora **powinna** taki zapis
przechowywać, zostaje otwarte (patrz F16).

Uboczny skutek tej samej linii: `noValidate` wyłącza walidację **wszystkich** pól — `name`, `email`,
`message` i `subject` też przechodzą puste.

**Sprzeczne z tekstem czytanym przez człowieka:** „A consent checkbox is mandatory on the contact
form before it can be submitted" (`club/readme.txt`, analogicznie `breeder/readme.txt`).

**Blokuje zgłoszenie: nie** (recenzent WP.org nie audytuje logiki JS). **Ale** to defekt prywatności
i fałszywe twierdzenie w readme — wg zasad projektu klasa P0. **Wymagane działanie:** odczytać zgodę
w `handleSubmit()` i przerwać wysyłkę, gdy niezaznaczona (albo usunąć `noValidate` i zawołać
`reportValidity()`); przekazywać faktyczną wartość zamiast literału; dopisać testy — dziś oba pliki
mają 0% pokrycia (F6).

### F2 — `LICENSE` nie jest tekstem GPLv2, a kopia klubu jest okrojona mocniej niż hodowcy 🟠

`club/LICENSE` (19 linii) · `breeder/LICENSE` (25 linii)

Plik otwiera się nagłówkiem „GNU GENERAL PUBLIC LICENSE / Version 2, June 1991" i notą praw
autorskich FSF, po czym zamiast tekstu licencji (384 linie w rdzeniu WordPressa) podaje
czteroakapitowe streszczenie i link. Podaje się więc za dokument licencji, którym nie jest.

Kopia klubu — tej, która idzie do katalogu **pierwsza** — dodatkowo nie zawiera:

```
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.
```

oraz akapitu „You should have received a copy of the GNU General Public License…". Pierwsza z tych
klauzul zabrania wprost tego, co tu zrobiono.

**Blokuje: nie** (katalog czyta nagłówek `License:`, a ten jest poprawny). **Wymagane działanie:**
wstawić dosłowny tekst GPLv2 do obu wtyczek; koszt minutowy, a usuwa łatwy zarzut recenzenta.

### F3 — „Test connection" twierdzi, że waliduje klucz API, a nigdy go nie wysyła 🟠

`club/admin/test-connection.js:13-15,71-77` (plik identyczny w obu wtyczkach)

Komentarz: *„POST {apiBase}/v1/captcha/challenge — only run if step 1 passed AND a key is set.
Validates the key + origin in one shot"*. Kod:

```js
if (apiKey) {
  const capRes = await fetch(apiBase + '/v1/captcha/challenge', { method: 'POST' })
```

Brak nagłówka `Authorization`. `apiKey` służy wyłącznie jako warunek `if` — jego wartość nie
opuszcza przeglądarki. Wpisanie dowolnego śmiecia jako klucza daje komunikat sukcesu
(„Connected. Club: %s"), a formularz kontaktowy i tak nie zadziała.

**Blokuje: nie.** **Wymagane działanie:** albo faktycznie zweryfikować klucz (endpoint wymagający
auth, najlepiej przez proxy serwerowe), albo poprawić komunikat i komentarz, żeby nie obiecywały
walidacji, której nie ma.

### F4 — Limit zgłoszeń obchodzi się nagłówkiem `X-Forwarded-For`, a ta sama wartość trafia do API Velory 🟠

`shared/class-base-rest.php:162-185` (`client_ip()`) oraz `:103-115` (przekazanie dalej)

`client_ip()` czyta `HTTP_CF_CONNECTING_IP` i `HTTP_X_FORWARDED_FOR` **bezwarunkowo**, bez pojęcia
zaufanego proxy. Na stronie, która nie stoi za Cloudflare, są to nagłówki w pełni kontrolowane przez
klienta. Dowód:

```
7 żądań z tym samym X-Forwarded-For: 9.9.9.9   → 500 500 500 500 500 429 429   (limit działa)
7 żądań, każde z innym X-Forwarded-For         → 500 500 500 500 500 500 500   (limit nie działa)
```

Ta sama, podrobiona wartość jest następnie wysyłana do API Velory jako `X-Forwarded-For` „used for
anti-spam rate limiting" (cytat z readme) — obejście lokalne staje się zatruciem limitera po stronie
serwera.

Realną obroną pozostaje captcha PoW (działa, §4) i honeypot. **Blokuje: nie.** **Wymagane
działanie:** ufać nagłówkom proxy tylko przy jawnym opt-inie administratora, w przeciwnym razie
używać `REMOTE_ADDR`.

### F5 — Globale JS kolidują między wtyczkami; PHP zabezpieczono, JS nie 🟠

Dowód z żywej strony z obiema wtyczkami:

```
[WARNING] [cap] the cap-widget element has already been defined, skipping re-defining it.
window.CAP_CUSTOM_WASM_URL = ".../plugins/velora-club-widgets/assets/cap_wasm_bg.wasm"
window.VeloraEmbed = { version, widgets, mount, mountAll }
```

Trzy współdzielone punkty: `customElements.define('cap-widget')` (rejestruje się tylko pierwsza
wtyczka — druga używa cudzej klasy widgetu), `window.CAP_CUSTOM_WASM_URL` (ostatni zapis wygrywa —
widget hodowcy rozwiąże PoW na binarce **klubu**) oraz `window.VeloraEmbed` (ostatni zapis wygrywa).

Dziś nieszkodliwe, bo obie paczki niosą identyczne bajty. Ale uzasadnieniem prefiksowania klas PHP
było wprost to, że **obie wtyczki aktualizują się na WordPress.org niezależnie**. Ten sam argument
stosuje się do JS i nie został tam zastosowany: gdy klub podbije `@cap.js/wasm`, a hodowca nie,
jedna wtyczka po cichu wykona kod i binarkę drugiej.

Uwaga osobno: fallback w `config.ts` sięga po wspólny global `VeloraEmbedConfig`, gdy nazwany nie
istnieje. Dziś żadna wtyczka go nie publikuje, a `data-velora-config` jest na wszystkich 15
mount-pointach, więc scenariusz „zgłoszenie hodowcy do proxy klubu" jest nieosiągalny —
sprawdziłem i potwierdzam. Bezpieczeństwo opiera się jednak w 100% na dyscyplinie „każdy shortcode
przez `widget_markup()`".

**Blokuje: nie.** **Wymagane działanie:** namespace'ować globale per wtyczka albo świadomie
udokumentować, że pierwszy ładowany bundle obsługuje oba.

### F6 — 10 z 11 plików widgetów ma 0% pokrycia; wśród nich oba formularze kontaktowe 🟠

```
 src/widgets       |    4.96 |    64.28 |   44.44 |    4.96 |
  ...er-contact.ts |       0 |        0 |       0 |       0 | 1-187
  club-contact.ts  |       0 |        0 |       0 |       0 | 1-202
  about.ts / club-breeders.ts / events.ts / gallery.ts /
  listings.ts / posts.ts / club-documents.ts / breeder-animals.ts  → 0%
```

Pokrycie całości 24.78% przy progu 24. Progi nigdy nie spadły (zapadka respektowana), ale
zapisano nimi stan, w którym cała warstwa widoczna dla użytkownika jest nietestowana. To dlatego
F1 przeszedł przez wszystkie zielone bramki.

**Blokuje: nie.** **Wymagane działanie:** testy dla `*-contact.ts` razem z poprawką F1.

### F7 — Nieścisłości w readme i na stronie pomocy 🟡

| Miejsce | Twierdzenie | Stan faktyczny |
|---|---|---|
| oba readme | „Most shortcodes accept optional `slug=`, `limit=`, `theme=`" + lista wyjątków | `about` i `contact` (w obu wtyczkach) **nie mają** `limit=`, a nie są wymienione jako wyjątki |
| `breeder/readme.txt` | atrybuty `[velora-breeder-contact]` | `litter_id=` istnieje w kodzie (`breeder/includes/class-plugin.php:206`), nieudokumentowany |
| `breeder/readme.txt:25` | „with optional pre-filled breed and litter context" | proxy PHP odcina `preferredBreed`/`litterId` — do skrzynki nie docierają |
| `club/readme.txt:20` | „table for 20+ entries" | kod: `length > 20`, więc dokładnie 20 daje karty |
| `help/articles/embed.tsx` | „sortowanie … ustawiasz w panelu po prawej stronie [bloku]" | sortowanie to runtime'owy dropdown widgetu, nie atrybut bloku ani shortcode'a |

**Blokuje: nie.** **Wymagane działanie:** poprawić zdania; przy okazji zdecydować, czy `litter_id`
ma zostać nieudokumentowany celowo.

### F8 — Tłumaczenia PL niekompletne (~45% pustych wpisów) 🟡

```
club:    65 msgid w .pot / 65 w .po / 29 pustych msgstr
breeder: 63 msgid w .pot / 63 w .po / 27 pustych msgstr
```

Puste są m.in. widoczne w panelu: „Test connection", „Auto", „Light", „Dark" oraz komunikaty
błędów proxy („Could not reach Velora API.", „Too many submissions. Try again later.",
„Plugin is not configured…"). Polski administrator zobaczy interfejs mieszany PL/EN, a odwiedzający
— angielski komunikat błędu przy nieudanej wysyłce.

Mechanizm ładowania działa poprawnie (§6, T2). **Blokuje: nie.**

### F9 — `Tested up to: 7.0` nie zostało zweryfikowane 🟡

Deklaracja jest formalnie poprawna (WP 7.0 wydane 2026-05-20, Plugin Check jej nie kwestionuje),
ale całe środowisko dev to **WordPress 6.6.2** — nikt nie uruchomił wtyczek na 7.0. Nagłówek
„Tested up to" jest oświadczeniem o wykonanym teście.

**Blokuje: nie.** **Wymagane działanie:** podnieść obraz `docker/wp-dev` do 7.0.x i powtórzyć
przebieg z §4, albo obniżyć deklarację do faktycznie przetestowanej wersji.

> **ZAMKNIĘTE 2026-08-10.** Obraz obu serwisów podniesiony do `wordpress:7.0-apache`, stack
> postawiony od zera i cały przebieg z §4 powtórzony na **WP 7.0.2**: 15 shortcode'ów renderuje się
> z własnym `data-velora-config`, `debug.log` nie powstał, Plugin Check na obu PACZKACH daje
> 0 ERROR i to samo jedno znane ostrzeżenie, tłumaczenia PL ładują się w obu wtyczkach, a na żywo
> zgoda blokuje wysyłkę (zero żądań) i przepuszcza po zaznaczeniu (jeden POST), captcha rozwiązuje
> się na wasm w 404 ms, plakietka Cap.js pozostaje ukryta i nieklikalna, a trasa `/test-connection`
> poprawnie rozróżnia brak klucza / zły klucz / zły slug / zły schemat URL.
>
> Przy pierwszym czystym starcie wyszedł uśpiony defekt stacku, niezwiązany z wtyczkami:
> `docker/wp-dev/mariadb-init.sh` nie miał w gicie bitu wykonywalności, więc baza `wp_club` nigdy
> nie powstawała. Widać to było wyłącznie po `make wp-reset` — stary wolumen niósł obie bazy
> z dawnego uruchomienia. Naprawione w tym samym commicie.
>
> Nadal testujemy tylko 7.0, choć wtyczki deklarują `Requires at least: 6.0`. Świadomie: przegląd
> wszystkich wywoływanych funkcji WordPressa nie wykazał ani jednego API nowszego niż 6.0, nie ma
> `block.json` z progiem `apiVersion`, a suita PHPUnit nie bootuje WordPressa, więc jest
> wersjo-agnostyczna. `Tested up to` jest oświadczeniem o teście, `Requires at least` — deklaracją
> progu wsparcia; to drugie nie wymaga stałego stanowiska testowego.

### F10 — Brak zrzutów ekranu 🟡

`.wordpress-org/` zawiera tylko ikony i banery. Zgodne z opisem w zadaniu. Zrzuty nie są wymagane,
ale są jedynym materiałem wizualnym na stronie wtyczki. **Blokuje: nie.**

### F11 — Wzorce glob w `.distignore` nie działają 🟢

`docker/wp-dev/package-plugin.sh` wykonuje `rm -rf "$STAGE/$SLUG/$line"` z cudzysłowem, więc wpisy
`*.log`, `*.lock` traktowane są jako dosłowne nazwy plików i nigdy nic nie usuwają. Dziś bez skutku
(takich plików nie ma). Dodatkowo komentarz w `club/.distignore` mówi „Used by
`make wp-package-breeder`" — pozostałość po kopiowaniu. **Blokuje: nie.**

### F12 — Host obrazków nie jest w pełni określony przez wtyczkę 🟢

Readme wymienia jako źródło obrazków `images.velora.pet`. W rzeczywistości `imgSrc()`
(`core/src/image.ts`) przepisuje na CDN wyłącznie adresy `*.velora.pet/uploads/...`; każdy inny
absolutny URL z odpowiedzi API zwracany jest bez zmian. Na żywo widać to jako
`https://dev.velora.pet/img/cat18.webp`. Zbiór hostów obrazków zależy więc od danych API,
nie od kodu wtyczki. **Blokuje: nie.**

### F13 — Brak bramki na dryf plików generowanych i ręcznie duplikowanych 🟢

`make wp-plugins-build` generuje sześć kopii klas bazowych, a `make test-wp-plugins` i
`make coverage-wp-plugins` mają go w zależnościach — czyli **po cichu nadpisują** śledzone pliki
zamiast paść przy rozjeździe. Sprawdziłem: kopie są dziś zsynchronizowane (odtworzyłem transformację
`sed` i porównałem — 6/6 „IN SYNC").

Poza generatorem zostają trzy pliki duplikowane **ręcznie**, bez żadnego mechanizmu:

```
IDENTYCZNE  admin/test-connection.js
IDENTYCZNE  admin/test-connection.css
RÓŻNE       blocks/editor.js   (celowo — inne bloki)
```

Poprawka F3 zrobiona w jednej wtyczce rozjedzie je bezgłośnie. **Blokuje: nie.**

### F14 — Brak testu regresyjnego na zbudowanym `dist/embed.js` 🟢

Plugin Vite `capWasmAsset()` (`core/vite.config.ts:54-98`) jest jedyną obroną przed powrotem
literału CDN po aktualizacji `@cap.js/widget`. Zaprojektowany fail-closed (`buildEnd()` rzuca, gdy
nic nie przepisano; `buildStart()` rzuca przy rozjeździe wersji wasm) i **działa** — zweryfikowałem
na artefakcie. Ale testuje sam siebie: `src/__tests__/captcha.test.ts` mockuje całą bibliotekę,
więc żaden test nie sprawdza po realnym buildzie, że `grep -c jsdelivr dist/embed.js` = 0.
**Blokuje: nie.**

### F15 — Plakietka kredytowa Cap.js: nieusuwalny, dofollow link na publicznej stronie ⚠️ DECYZJA WŁAŚCICIELA

`dist/embed.js:1088` (kod pochodzi z `@cap.js/widget`, ale jest bundlowany i wysyłany w paczce):

```html
<a part="attribution" aria-label="Secured by Cap" href="https://capjs.js.org/" class="credits"
   target="_blank" rel="follow noopener" title="Secured by Cap: Self-hosted CAPTCHA for the modern web.">Cap</a>
```

CSS wymusza widoczność (`display:block!important`), biblioteka nie ma atrybutu wyłączającego.

**Oceniam to inaczej niż poprzednia sesja.** Wytyczna #10 brzmi: *„All 'Powered By' or credit
displays and links included in the plugin code must be optional and default to not show on users'
front-facing websites"*. Ten link jest kredytem, jest w kodzie wtyczki, pokazuje się na publicznej
stronie i **nie jest opcjonalny** — spełnia definicję wprost.

Precedens plakietki reCAPTCHA nie przenosi się czysto. Wytyczna kończy się zdaniem *„Services may
brand their own output"* — u Google plakietkę renderuje skrypt pobierany z serwerów usługi, która
faktycznie obsługuje wyzwanie. Tutaj wyzwanie obsługuje **API Velory**, a plakietka promuje
`capjs.js.org`, czyli stronę dokumentacji biblioteki, która w czasie działania nie robi nic.
To „branding cudzego produktu w kodzie wtyczki", a nie „branding własnego wyjścia usługi".

Licencja Apache-2.0 **zezwala** na modyfikację, więc ukrycie plakietki (CSS w `embed.css` albo patch
w pluginie Vite) jest dopuszczalne prawnie. Czy usunąć cudzą atrybucję z projektu OSS — to decyzja
etyczna i produktowa, **nie moja**.

**Blokuje: możliwe.** Rekomendacja: przed zgłoszeniem albo (a) uczynić plakietkę opcjonalną wraz
z „Powered by Velora" i domyślnie wyłączoną, albo (b) zapytać `plugins@wordpress.org` mailem przed
wysłaniem — odpowiedź jest darmowa, a ponowne zgłoszenie po odrzuceniu kosztuje kolejny cykl
recenzji (1–10 dni, bez możliwości przyspieszenia).

### F16 — Velora nie przechowuje ŻADNEGO zapisu zgody z formularzy wtyczki ⚠️ DECYZJA WŁAŚCICIELA

Znalezione dopiero przy naprawie F1, przez Critica bramki — dlatego numeracja jest doklejona.

`shared/class-base-rest.php` → `handle_contact()` buduje payload do API z zamkniętej listy sześciu
pól (`name`, `email`, `message`, `subject`, `phone`, `captchaToken`). `consent` do niej nie należy,
a `apps/external-api/src/v1/contact/contact.controller.ts` nie zna takiego pola w kontrakcie. Efekt:
odwiedzający zaznacza zgodę, formularz jej pilnuje (po naprawie F1), ale **nic tej zgody nigdzie nie
utrwala** — nie ma czego okazać, gdyby ktoś o nią zapytał.

To nie jest wymóg WordPress.org i **nie blokuje zgłoszenia**. Jest natomiast pytaniem produktowym
i formalnym: czy zgoda zbierana na cudzej stronie WordPress ma zostawiać ślad po stronie Velory.
Odpowiedź „tak" oznacza zmianę kontraktu `external-api` i backendu, czyli osobny temat poza
`**` — dlatego nie została podjęta przy tej naprawie.

Ta sama zamknięta lista pól wycinała również `department` (klub) oraz `preferredBreed`/`litterId`
(hodowca) — jedna przyczyna trzech osobno zgłaszanych objawów.

> **ZAMKNIĘTE 2026-08-10 (decyzja właściciela: „jeżeli nie wysyłamy, to bez sensu pytamy").**
> Wszystkie trzy pola **usunięte z formularzy** zamiast przepuszczone przez proxy: oba formularze
> kontaktowe są teraz zwykłymi formularzami — imię, e-mail, telefon opcjonalnie, temat wiadomości,
> treść, zgoda, captcha — i mają identyczny kształt payloadu (jeden typ `ContactPayload`).
> Poprawione zostały też wszystkie teksty, które obiecywały co innego: `readme.txt` obu wtyczek
> oraz **żywa strona pomocy** `apps/frontend/src/pages/help/articles/embed.tsx` w PL i EN — ta
> ostatnia była przeoczonym bliźniakiem, złapanym dopiero przez Critica bramki.
>
> **Otwarte zostaje wyłącznie samo F16**: Velora nadal nie przechowuje żadnego zapisu zgody.
> Zmiana tego wymaga kontraktu `external-api` i backendu, więc jest osobnym tematem.

---

## 6. Twierdzenia poprzedniej sesji — które się obroniły

| # | Twierdzenie | Werdykt | Dowód |
|---|---|---|---|
| T1 | Klasy bazowe generowane `sed`-em z prefiksem per wtyczka | **Broni się w zamierzonym zakresie** | 6/6 kopii „IN SYNC"; obie wtyczki aktywne bez fatala. **Ale** transformacja podmienia wyłącznie literał `Velora_Base_` — każdy przyszły symbol globalny w `shared/` o innej nazwie (funkcja, stała, trait) przejdzie nietknięty i wróci jako `Cannot redeclare`. Brak bramki na dryf (F13) |
| T2 | `load_plugin_textdomain()` przywrócone mimo ostrzeżenia — tłumaczenia PL działają | **Broni się, potwierdzone falsyfikacją** | Z wywołaniem: „Domyślny slug klubu", „Pokaż odnośnik „Powered by Velora"". Po zablokowaniu wywołania w paczce w kontenerze: **wszystkie** stringi po angielsku. Uwaga: `is_textdomain_loaded()` zwraca `false` mimo działających tłumaczeń (nowy backend l10n w WP 6.6) — nie używać go jako wskaźnika. Uzupełnienie: ostrzeżenie Plugin Check stanie się słuszne, gdy tłumaczenia zaczną przychodzić z translate.wordpress.org — warto wrócić do decyzji po publikacji. Osobno: same tłumaczenia są niekompletne (F8) |
| T3 | Binarka wasm w paczce + przepisanie literału CDN przez plugin Vite | **Broni się** | `grep -c jsdelivr dist/embed.js` = 0; na żywo obie wtyczki pobrały własny `cap_wasm_bg.wasm` same-origin; captcha rozwiązana w 17 ms (wasm, nie solver JS). Mechanizm jest fail-closed we wszystkich zbadanych scenariuszach zmiany zależności. Kruchość realna, ale inna niż zakładano: nie „cichy powrót do CDN", tylko brak testu na artefakcie (F14) |
| T4 | `data-velora-config` na 15 shortcode'ach — żaden nie gubi | **Broni się** | 15/15 na żywo, poprawne wartości per wtyczka; zabezpieczone konstrukcyjnie przez wspólny `widget_markup()` |
| T5 | „Powered by Velora" opt-in, domyślnie wyłączone | **Broni się na trzech poziomach** | `register_setting(..., 'default' => false)`, `get_option(..., false)`, `buildFooter()` zwraca pusty fragment; test wychwytuje zmianę domyślnej wartości (mutacja §1.3) |
| T6 | Bundle nieminifikowany jako odpowiedź na wymóg czytelności | **Broni się z zastrzeżeniem** | `minify: false`, 2720 linii, własny kod z komentarzami. Najdłuższa linia to 6498 znaków — wbudowany `cap.min.js`, przychodzący z npm już zminifikowany. Źródło jest publiczne, więc duch wytycznej #4 zachowany, ale warto mieć tę odpowiedź gotową |
| T7 | Link kredytowy `capjs.js.org` — wytyczna o kredytach go nie dotyczy | **NIE broni się** | Patrz F15. Link spełnia definicję z wytycznej #10 wprost, a precedens reCAPTCHA nie przenosi się, bo plakietka promuje stronę, która w czasie działania nie świadczy usługi |

**Znane, świadomie nienaprawione — opis się zgadza:**
- „preferowana rasa" renderowana i odcinana przez proxy — potwierdzone (`shared/class-base-rest.php`
  buduje payload z sześciu pól, bez `preferredBreed`/`litterId`). Uzupełnienie: to samo dotyczy pola
  `department` w formularzu klubu, co jest zgodne z FAQ. Ale opis w `breeder/readme.txt:25` sugeruje
  co innego (F7).
- Brak zrzutów ekranu — potwierdzone (F10).

---

## 7. Werdykt

**Czy wtyczka klubu nadaje się do zgłoszenia dzisiaj? — Technicznie tak, ale odradzam
zgłoszenie przed rozstrzygnięciem F15 i naprawą F1/F2.**

Co jest gotowe: paczka dystrybucyjna 84 KB przechodzi Plugin Check bez błędu przy najniższym
progu severity i z checkami eksperymentalnymi; nie ma fatala, nie ma wpisu w `debug.log` po
wywołaniu wszystkich shortcode'ów, obie wtyczki współistnieją na jednej instalacji, żaden zasób nie
jest pobierany z obcego hosta, kredyt własny jest prawidłowo opt-in, wszystkie bramki testowe są
zielone i **udowodniono, że umieją zejść na czerwono**.

Co powstrzymuje:

1. **F15 (plakietka Cap.js)** — jedyne znalezisko, które realnie może zablokować zgłoszenie.
   Wymaga decyzji właściciela, nie poprawki technicznej. Recenzja trwa 1–10 dni i nie da się jej
   przyspieszyć, więc zapytanie `plugins@wordpress.org` z wyprzedzeniem jest tańsze niż odrzucenie.
2. **F1 (zgoda)** — nie zablokuje recenzji, ale wysyła do produkcji formularz zapisujący zgodę,
   której użytkownik nie udzielił, przy jednoczesnym twierdzeniu w readme, że jest wymagana.
   Zgłoszenie wtyczki oznacza wypuszczenie tego na cudze strony.
3. **F2 (LICENSE)** — kilka minut pracy, usuwa oczywisty zarzut recenzenta.

Kolejność, którą rekomenduję: F1 + testy → F2 → decyzja o F15 → zgłoszenie klubu → F3, F4, F5, F7,
F8 przed zgłoszeniem hodowcy.

**Czego NIE zmieniałem.** Kontrola nie wprowadziła żadnej zmiany w kodzie — poza tym raportem
drzewo robocze pozostaje czyste. Mutacje testowe wykonano na kopiach i przywrócono; `git status`
zweryfikowany po każdej.

**Uwaga o skutkach ubocznych kontroli.** Widget klubu w kontenerze testowym miał domyślny
`apiBase = https://velora.pet`, więc podczas ładowania strony testowej poszły do produkcji dwa
żądania captchy (`POST /v1/captcha/challenge`, `/v1/captcha/redeem`, oba 201) i siedem odczytów
nieistniejącego slugu klubu (404). Żadnej wiadomości kontaktowej nie wysłano; żaden zapis
w produkcji nie powstał.
