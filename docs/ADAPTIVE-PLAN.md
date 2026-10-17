# GenUX GenUX uyarlanabilir mimari planı

Durum: **KAYNAK MİMARİSİ UYGULANDI; BİLEŞEN DOĞRULAMASI VE YAYIN AYRI İZLENİR**. Tarih: 2026-10-16. Bu belge test kanıtı değildir ve DONE iddiası taşımaz. Kaynak yazarları hiçbir kontrol çalıştırmadı; sonuçların yetkili kaynağı `adaptive-20261016` altındaki conductor makbuzları ve GitHub'daki gerçek CI/yayın durumudur.

## Recovery acceptance — human decision 2026-10-16

Authoritative source: `docs/decisions/current.json`, revision `human-2026-10-16-recovery-2-inline`; it outranks this document and older entries, and proposal authors never edit it. The iframe ban supersedes the older isolated-iframe preview contract. Status is source-level only: IMPLEMENTED (SOURCE ONLY) means the source for the row is integrated; it does not claim that all 61 components, CI, main, live or physical devices are verified. No row is verified or DONE without a root receipt in private `evidence/recovery-20261016`; final authoritative results are the private conductor receipts and the actual GitHub state, never a hardcoded future pass.

- **IMPLEMENTED (SOURCE ONLY)** — Decision guard `tools/docs-decisions.mjs` checks the fresh record digest and AST facts, including plain primitive entries and detached getters, through the docs-data build and CI. Receipt: guard run, `docs:build`, CI job.
- **IMPLEMENTED (SOURCE ONLY)** — Zero iframes; real components render as direct children of `DeviceFrame` in the same React subtree, never fetched HTML, cloned demos or reparented documents. Receipt: decision guard, docs-reference cases.
- **IMPLEMENTED (SOURCE ONLY)** — Four explicit references, phone, tablet, computer and tv, with no physical device or user-agent inference; TV is an illustrative 1920x1080 screen with 1600 content. Receipt: decision guard, geometry case.
- **IMPLEMENTED (SOURCE ONLY)** — Preserved MacBook geometry: 1440x900 screen, 1024 content with 208px margins, 1520x942 device, rails at most 200px, Actual from 1920, otherwise Fit plus Expand. Receipt: `browser/preview-geometry.spec.ts` in three engines.
- **IMPLEMENTED (SOURCE ONLY)** — Visual facts unchanged: existing palette and black dark shell, Outfit 14 CSS px minimum, weights 300/400, radius 5px with 0/3px/5px/100%, sizes 48/56/64, 32/40/48, 20/26/32. Receipt: `docs:check`, `docs:lint`, decision guard.
- **IMPLEMENTED (SOURCE ONLY)** — Local preview theme and token recipe separate from the page and the global 30-day ThemeBuilder, which is unchanged. Receipt: docs-reference cases.
- **IMPLEMENTED (SOURCE ONLY)** — Standalone preview routes are four real links with embeddable CSR; selected code imports the actual small, medium, large or tv entry and excludes private form state. Receipt: docs-reference cases.
- **IMPLEMENTED (SOURCE ONLY)** — TV loads only the existing conditional living-room module and shared modality, with Up/Down navigation; pointer, Tab, pen, caret and APG ownership unchanged. Receipt: input unit cases, `browser/adaptive-ui.spec.ts`.
- **IMPLEMENTED (SOURCE ONLY)** — Runtime IME composition and Back layer handling. Receipt: input unit cases.
- **IMPLEMENTED (SOURCE ONLY)** — Virtual keyboard resize keeps the phone journey, including the five-step keyboard-open sequence. Receipt: policy or input unit case.
- **IMPLEMENTED (SOURCE ONLY)** — Vertical text and caret handling on the TV reference. Receipt: browser case.
- **IMPLEMENTED (SOURCE ONLY)** — Metadata Choice as an accessible combobox; generic coarse touch targets. Receipt: browser case.
- **IMPLEMENTED (SOURCE ONLY)** — Outfit with the 14 CSS px minimum from the decision record; legacy stored 12/13 values migrate without discarding saved recipes. Receipt: existing typography test.
- **IMPLEMENTED (SOURCE ONLY)** — Consumable local Ant Design UI package with optional GenUX, SSR and Frappe canonical ports. Receipt: `node tools/build-library.mjs` plus the locally packed consumer check (types, SSR, stylesheet rule coverage and local asset presence); no npm publication, SSR hosting, live Frappe or model call is claimed.

Receipt status: IMPLEMENTED (SOURCE ONLY) does not prove acceptance. The latest private conductor receipts and the actual GitHub CI and Pages state are authoritative; this document records no check counts, pass results or open failures. Standalone preview profiles are server-rendered (SSR); selected code entries are embeddable CSR; generic embedded SSR hydration is not verified. The TV reference is a logical 1920x1080 screen regardless of the host viewport used by any browser check. Per-component status for the 61 components, physical-device QA, CI, main and live states are never inferred from this metadata.

Test budget: the existing 2 policy, 4 input and 2 delivery unit cases, the existing typography test, 2 docs-reference cases, 1 geometry case and ONE decision guard; no new deep matrix and no rewritten visual baselines. A read-only reviewer is required. Proposal, implemented source, local checks, CI, main, live and physical devices are distinct states; a stale proposal needs a manual root revalidation record. Never claim all 61 components verified. This metadata changes no application styles, services, automation, license or Git authorship.

## Yol haritası ve destek defteri

Üç durum ayrı izlenir ve birbirinden türetilmez:

1. **Kaynak uygulaması**: mimari aşağıdaki dosyalarda entegredir.
2. **Bileşen başına doğrulama**: 61 runtime bileşeni ve 40 doküman slug'ı ortak sözleşmeyle kapsanır; her bileşenin ayrı tarayıcı doğrulaması pending'dir ve metadata'dan `verified` türetilmez.
3. **Yayın**: yalnız tüm gate'ler geçtikten sonra yetkilidir; son CI ve yayın durumu GitHub status'undan veya doğrulanmış makbuzdan okunur, bu belgeye sabit yazılmaz.

### Kaynak dosyaları

- Politika ve ortam: `docs/src/adaptive/policy.json`, `docs/src/adaptive/policy.ts`, `docs/src/adaptive/environment.ts` (`EnvironmentStore`).
- SSR ve koşullu teslim: `docs/src/adaptive/server.ts` (`resolveServerAdaptive`, `loadServerAdaptive`), `docs/src/adaptive/delivery.ts` (`layoutLoaders`, `DeliveryController`, `baselineDelivery`, `InitialLayout`).
- Kapsam: `docs/src/adaptive/component-coverage.ts` (`ADAPTIVE_COMPONENT_COVERAGE`, `DOC_SLUG_COVERAGE`, `assertAdaptiveCoverage`).
- React: `docs/src/react/AdaptiveProvider`, `docs/src/react/AdaptiveShell.tsx`, `docs/src/react/AdaptiveLab` ve kilitli profilli önizleme tüketicisi `PreviewDocument`.
- Giriş ve GenUX: `docs/src/input-modality.ts` (`requestSpatialInputModality`), `docs/src/genux/adaptive.ts`, `docs/src/react/genux/GenUXSurface.tsx`, `docs/src/react/genux/native/` altındaki native sunum ve üç native overlay adaptörü.
- Stil: `docs/src/styles/adaptive-components.scss`, `docs/src/styles/adaptive-lab.scss`; Sass eşik map'i `policy.json` dosyasından üretilir.
- Kaynak girişleri: `docs/src/adaptive/index.ts` ve `docs/src/react/adaptive.ts` server ve delivery API'lerini dışa aktarır. npm'de yayımlanmış paket yoktur; kök klasik build değişmez.
- Sayfa: `docs/src/pages/adaptive.astro`; statik lab muhafazakâr baseline'ı render eder.

### Kapsam ve doğrulama durumu

- 61 runtime bileşeni (49 native + 12 generic) ve 40 doküman slug'ı ortak `AdaptiveProvider`, native sunum, Sass katmanı ve container davranışlarıyla kaynakta kapsanır. Her kayıt `implemented-unverified` ile başlar; 61 bileşen için tek tek tarayıcı sertifikası iddia edilmez.
- Komutlar: kök betikler `docs:format`, `docs:lint`, `docs:check`, `docs:build` ve açık tarayıcı tip komutu.
- Node birim (node:test; Vitest yok): `docs/tests/adaptive-policy.test.mjs`, `docs/tests/adaptive-input.test.mjs`, `docs/tests/adaptive-delivery.test.mjs`; güncel küme 8 vakadır.
- Tarayıcı: `docs/browser/adaptive-ui.spec.ts` yazılmıştır; 3 vaka Chromium, Firefox ve WebKit'te 14 genişlik, durum, tema ve odak üzerinden production build'in gerçek CSS+JS ağ isteklerini ve metadata'sını doğrular.
- Sonuçlar yalnız conductor makbuzlarında `pass`, `fail`, `not_run` veya `not_applicable` olarak tutulur; CI yalnız gerçekten koşan işleri raporlar.
- Pending: fiziksel TV/webOS, kalem, göz takibi, gerçek macOS/iOS Safari ve Android. Bunlar hariç tutulmadı.
- Bağımsız inceleme bu belgede sabit bir durum olarak tutulmaz; sonucu yalnız gerçek conductor inceleme makbuzlarından okunur.
- İnsan görsel onayı ayrıca pending'dir. Gelecekteki onay, CI veya yayın sonucu bu belgede iddia edilmez.

## 0. Kaynak ve kapsam

- Doğrudan son insan görevi: **tüm GenUX bileşenleri** capability-first uyarlanabilir mimariye güncellenir. Bu görev, önceki yalnız-doküman iki vaka kapsamının yerine geçer.
- Sözleşme kaynakları: `GELISTIRME-SOZLESMESI` satır 60-118, 141-178, 180-261, 263-294, 296-368. Bu paket bu aralıkların içeriğini yeniden doğrulamadı; her uygulama paketi ilgili aralığı okuyup uyumu kendi kanıtında belgeler.
- Kurulu sürümler: Node 24.21, TypeScript 5.9.3, React 19.2, Ant Design 6.6.6, Ant Design X 2.9, Astro 7.3.8; Sass 1.105.2 exact devpin olarak eklendi. Framework, model, kimlik bilgisi, deploy ve servis değişikliği kapsam dışıdır.
- `docs` altındaki kaynak gerçek React runtime'dır. Kök `src` eski klasik HTML olarak kalır; bu plan onu taşımaz.
- Yazarlık: Claude kod ve test yazarıdır; Codex komutları çalıştırır; kök Temporal entegratör exact CAS ile birleştirir ve başkalarının değişikliklerini korur. İlgisiz tarihsel test dalgası açılmaz.

## 1. Değişmez kısıtlar

- Renk paleti değişmez. Outfit font listesinde ilk sıradadır; okunabilir metin en az 14 CSS px'tir; mevcut ağırlık, boyut ve radius değerleri korunur.
- Hareket merkezi tokenlardan gelir: simetrik easeInOut Cubic `cubic-bezier(.65, 0, .35, 1)`, iki yönde pozitif süre, semantik durum anında güncellenir, reduced-motion istisnası uygulanır.
- Odak: normal temalarda çevreleyen halka yoktur. Görsel odak modunu genelde yalnız Tab/Shift+Tab açar (açık living-room istisnası aşağıda); pointerdown/touchstart yalnız görsel modu kapatır; tek istisna `forced-colors: active` + klavye modu + `:focus-visible` için `outline: 2px solid CanvasText`. Ek global odak sahibi eklenmez; mevcut merkezi odak durumu tek kaynaktır.
- **TV yön tuşu odak istisnası YETKİLİ (insan yanıtı 2026-10-16: `hem tab, hem tv`).** Tab/Shift+Tab her yerde geçerlidir; yalnız açık `data-adaptive-surface=living-room` sınırında bir widget'ın gerçekten işlediği yön tuşu `requestSpatialInputModality` ile AYNI halkasız merkezi odak modunu açabilir. Genişlik TV anlamına gelmez; genel web oklarında mod açılmaz, halka eklenmez, ikinci yazıcı veya storage yoktur; kompozit widget içinde APG ok davranışı korunur.
- Model tarafından üretilen keyfi import, DOM veya CSS kabul edilmez; ham yürütülebilir içerik yoktur. UI primitive'leri backend, auth veya servis çağrısı yapmaz.
- Mevcut 8 KiB vanilla controller bütçesi korunur. 120KB/250KB gibi örnek bütçeler benimsenmez; ölçülen değerler raporlanır.
- Kapılar zayıflatılmaz; test, lint ve tip kontrolleri kaldırılmaz veya gevşetilmez.

## 2. Envanter: iki ayrı liste

| Liste               | Sayı                        | Not                                                       |
| ------------------- | --------------------------- | --------------------------------------------------------- |
| Runtime bileşenleri | 61 = 49 native + 12 generic | Hepsi ortak `GenUXProvider` sarmalayıcısı altında çalışır |
| Doküman sayfaları   | 40                          | Sayfa bileşen değildir; runtime sayısıyla toplanmaz       |

Kapsam koddadır: `component-coverage.ts` her bileşen ve slug için aile, container davranışı, giriş sözleşmesi ve ortak sahip dosyasını taşır; `assertAdaptiveCoverage` eksik, fazla veya yinelenen kaydı reddeder. Fark çıkarsa sayılar sessizce düzeltilmez, raporlanır.

## 3. Mimari

### 3.1 Ortak çekirdek

Tek bir business, state, token, validation ve action çekirdeği vardır. Profil kabukları yalnız sunum ve etkileşimi değiştirir. Beş ayrı iş kodu kopyası üretilmez; sabit dosya sayısı dogması yoktur.

### 3.2 Profil, yüzey ve giriş

- Başlangıçta **tek ve dışlayıcı** bir yerleşim profili seçilir: `phone | tablet | laptop | desktop | wide | living-room`. Giriş katmanları ekleyicidir: `coarse | precision | spatial`.
- CSS viewport, container genişliği ve yetenekler bağımsız değerlendirilir.
- `ProductSurface` açıktır: `web | living-room`. **1920 genişlik asla TV anlamına gelmez**; `living-room` profili yalnız `surface: living-room` ile seçilir.
- Bilinmeyen dürüsttür: `activeInput` `unknown` ile başlar; fine/hover gibi sorgulardan klavye varlığı çıkarılmaz.
- VisualViewport küçülmesi (sanal klavye, pinch-zoom) yalnız `usableWidth/usableHeight` değerini değiştirir; yerleşim profili değişmez.
- `lockedProfile`, profili kilitler (örneğin bir oturum boyunca veya test için).
- Sınıflandırma yalnız genişliğe dayanır; kısa yükseklik veya coarse işaretçiden telefon tahmini yapılmaz (`isCoarseLandscapePhone` yalnız ipucudur, `resolveAdaptive` onu çağırmaz). İlk ölçümde 768x300 `tablet`, 1280x400 `desktop` olur. MDM, user-agent veya cihaz adı tahmini yoktur.
- Telefon yolculuğu sürekliliği `AdaptiveProvider`'a aittir: ölçülen telefon yolculuğu otomatik tutulur ve döndürüldüğünde phone kalır; süreklilik sıfırlama seçeneği veya `useAdaptive().releaseJourney` onu bırakır. Açık `lockedProfile: 'phone'` aynı yolculuğu baştan kilitler.
- `AdaptiveShell` `options` yalnız `surface` ve `lockedProfile` alır ve devralınan ortamı yeniden çözer; süreklilik ve bırakma Shell'e ait değildir.
- Saf politika viewport'u, bileşenin kendi container'ını, giriş katmanlarını ve ürün yüzeyini ayrı girdiler olarak tutar; biri diğerinden çıkarılmaz.
- Doküman önizlemesi bilinen, güvenilir referans profilidir: `small → phone`, `medium → tablet`, `large → desktop`. Başlangıç ortamı `serverEnvironment` + önizleme ekranının CSS genişlik/yüksekliğidir; fiziksel yetenek emülasyonu yapılmaz ve iş alt ağacı profil değişiminde remount edilmez.

### 3.3 Dondurulmuş paylaşılan API (takip eden yazarlar için)

`policy.json` (sürüm 1):

| Anahtar            | Değerler                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| widths             | base 320, widePhone 480, smallTablet 600, tablet 768, laptop 960, desktop 1280, wideDesktop 1600, ultraWide 1920, expansive 2560 |
| antd               | xs 480, sm 600, md 768, lg 960, xl 1280, xxl 1600, xxxl 1920                                                                     |
| shortHeight        | 480                                                                                                                              |
| verificationWidths | 320, 375, 430, 480, 599, 600, 768, 959, 960, 1279, 1280, 1600, 1920, 2560                                                        |

`policy.ts` dışa aktarımları (tüm bildirimler export edilir):

- `LayoutProfile`, `ProductSurface`, `ActiveInput` (`unknown | mouse | touch | pen | keyboard | remote`).
- `AdaptiveEnvironment`: `width, height, visualWidth, visualHeight, coarse, fine, hover, anyHover, reducedMotion, forcedColors` (boolean), `saveData` (boolean veya null), `activeInput`.
- `AdaptiveOptions`: `surface?`, `lockedProfile?`.
- `AdaptiveResolution`: `band, layout, inputLayers, orientation (portrait | landscape), shortHeight, usableWidth, usableHeight`.
- `resolveAdaptive(environment, options?)`: saf fonksiyon; yan etkisi ve tarayıcı erişimi yoktur.
- `adaptiveBreakpointTokens`: aynı JSON'dan türetilir; elle kopyalanmaz.
- `serverEnvironment`: dondurulmuş, muhafazakâr 320x480; tüm yetenek boolean'ları false, `saveData` null, `activeInput` unknown.

`environment.ts` dışa aktarımları:

- `class EnvironmentStore`: constructor `(view?: Window, initial?: AdaptiveEnvironment)`; değer değişmedikçe aynı referansı döndüren `getSnapshot` ve `getServerSnapshot`; `subscribe(callback)` bir unsubscribe fonksiyonu döndürür.
- `getEnvironmentStore(view?: Window)`: document-window anahtarlı WeakMap ile pencere başına tek store.

### 3.4 SSR

- Modül başlatmada `window`, `document`, `matchMedia` veya `visualViewport` erişimi yoktur; dinleyiciler yalnız `subscribe` içinde bağlanır.
- İlk istemci render'ı `getServerSnapshot` ile sunucuyla aynıdır; hydration sonrası gerçek ortama geçilir. Snapshot'lar `useSyncExternalStore` için stabildir.
- Güvenilir request-time SSR host'u `await loadServerAdaptive(hints)` çağırabilir: sonuç `environment`, `options`, `resolution` ve yalnız literal `layoutLoaders` kaydından okunan profilin serileştirilebilir `InitialLayout` değeridir (sınıf, gezinme, derlenmiş CSS; fonksiyon yok). `AdaptiveShell` `initialLayout` değerini yalnız çözülen profille eşleşirse SSR sınıfı, gezinmesi ve stili olarak sunar; eşleşmeyen tohum yok sayılır.
- GitHub Pages statik kalır: request-time SSR barındırma, sunucu ipucu veya yayımlanmış npm paketi iddia edilmez. Statik lab profil CSS'ini SSR etmez; muhafazakâr paylaşılan baseline'da kalır.

### 3.5 Durum sürekliliği

İş alt ağacı profil değişiminde stabil kalır; yalnız görünüm kabuğu yeniden render edilir. Paylaşılan iş durumu key'siz context ve sabit slotlarla (`navigation`, `children`, `context`) tek kopyadır. Remount veya DOM snapshot ile durum taşınmaz. Form girdisi, odak, açık panel ve ana eylemler profil veya yön değişiminde korunur.

### 3.6 Etkileşim

Semantik click temeldir. TV modalitesi tek merkezi köprüden geçer ve en yakın `data-adaptive-surface` sınırıyla korunur; body'ye portal edilen katmanlar Provider'a ait kayıt ve havuzlanmış spatial adaptörle doğru sınıra bağlanır. Web okları, APG kompozitleri ve caret sahibi alanlar değişmez; iç içe Shell'lerde Back tuşu `defaultPrevented` ve `repeat` korumasıyla bir kez işlenir. Özel işaretçi etkileşimleri ortak Pointer Events mantığını kullanır; touch ve click çift tetiklenmez. Kamera, göz takibi veya dwell girdisi uydurulmaz. Hover hiçbir eylemin tek yolu değildir.

### 3.7 Sorumluluk ayrımı

- Yaşam döngüsü olan store ve controller'lar sınıftır (`EnvironmentStore`, `DeliveryController`, mevcut odak modu controller'ı).
- Hook'lar ViewModel rolündedir; görünüm bileşenleri fonksiyon bileşenleridir. React sınıf kalıtımı kullanılmaz.
- Frappe erişimi `GenUXProvider` üzerinden enjekte edilen bir port ile soyutlanır. Bu plan çalışan bir Frappe backend'i veya deploy iddia etmez. Ant Design X kayıtlı fixture'ı isteğe bağlıdır ve yalnız açık yüklemeyle gelir.
- Yeni katman, sınıf veya arayüz yalnız somut ihtiyaçla eklenir.

### 3.8 Stil

- Önce Ant Design `ConfigProvider` teması ve semantik `classNames/styles` API'leri kullanılır.
- SCSS ayrı bir `@layer` tanımlamaz: `adaptive-components.scss` ve profil SCSS'leri GenUX'a ait semantik sınıfları hedefler ve mevcut düz cascade'e modüle bağlı derlenmiş stillerle katılır. Yeni cascade layer eklenmez; vendor stilleri fork edilmez veya kopyalanmaz.
- `docs/src/react/genux/native/NativeStyles.tsx` yalnız native sunuma özgü CSS'i `?inline` ile isteğe bağlı GenUX JS'ine derler; bu stil React 19 style kaynağı olarak yalnız `GenUXSurface` render edildiğinde ve tekilleştirilerek SSR'a/belgeye girer. Paylaşılan `GenUXCascader` kendi normal CSS importuna sahiptir; native adaptör onu devralır, isteğe bağlı özel CSS'e taşınmaz. Bu düzeltme kaynak dosyalarını ve CSS değerlerini değiştirmez; 9 palet eşdeğerliği korunur.
- Sass, sabitlenmiş kaynak sürümünden build zincirinde derlenir. SCSS eşik map'i `policy.json` dosyasından üretilir; elle kopyalanan eşik yoktur ve üretilen dosya ile JSON arasındaki fark bir testte FAIL olur.
- Tek palet: renkler mevcut merkezi semantik token kaynağından gelir; SCSS ve profil kabukları ikinci bir palet, sabit renk veya eşik tanımlamaz.

### 3.9 Koşullu teslim

- Altı profil (`phone`, `tablet`, `laptop`, `desktop`, `wide`, `living-room`) yalnız literal `layoutLoaders` kaydından yüklenir. Her girdi bir JS modülüdür ve SCSS'ini `?inline` derlenmiş CSS olarak taşır; stil yalnız Shell kökünün owner document'ına kurulur ve yalnız istenen profilin modülü attach eder.
- İlk HTML baseline'dır ve altı profil CSS'inin hiçbirini içermez. Ziyaret edilen profiller önbellekte kalır; `data-loaded-layouts` bunu olduğu gibi raporlar.
- Production adaptive sahiplik grafiği birden çok sahipli veya yabancı varlığı reddeder. Tarayıcı kanıtı hem dış istekleri hem ilk HTML ve kurulu stylesheet CSS'ini doğrular; `display:none` kanıt sayılmaz.

## 4. Paketler

Paket sırası kaynak yol haritasıdır; kaynak durumu doğrulama sonucu değildir.

1. adaptive-policy: `policy.json`, `policy.ts`, `environment.ts`; kaynak uygulandı, Node birim testleri.
2. ssr-provider: `AdaptiveProvider`, `server.ts`, `PreviewDocument`, Frappe portu enjeksiyonu; kaynak uygulandı.
3. phone-320-families-scss: 61 runtime bileşeni ve 40 slug, SCSS katmanı, üretilen eşikler; kaynak uygulandı, bileşen başına doğrulama pending.
4. input-spatial-webos: giriş katmanları, remote/spatial, webOS `living-room` yüzeyi; kaynak uygulandı, fiziksel TV pending.
5. conditional-delivery-state: koşullu teslim, durum sürekliliği; kaynak uygulandı, ağ kanıtı tarayıcı spec'inde.
6. ai-admission-lab: onaylı registry ile AI admission, salt okunur lab; kaynak uygulandı.
7. verification-ledger-publication: 14 genişlik matrisi, destek defteri, yayın; Codex çalıştırır, kök Temporal entegre eder, insan görsel onay verir.

Claude kod ve test yazarıdır; kök entegratör sırayla ve exact CAS ile birleştirir, başkalarının değişikliklerini korur. Sonuçlar yalnız conductor makbuzlarındadır.

## 5. Fazlar ve kabul ölçütleri (önce başarısız test)

### P1 Politika, breakpoint, SSR ve ortam

Uygulanan eşleme (`policy.ts`): `band`, genişliği aşmayan en büyük `widths` anahtarıdır (yarı açık aralıklar); yerleşim `<600 phone`, `600-959 tablet`, `960-1279 laptop`, `1280-1919 desktop`, `>=1920 wide`; `living-room` yalnız açık yüzeyle seçilir ve web yüzeyinde `living-room` kilidi yok sayılır. Yatay telefon: genişlik veya yükseklikten telefon tahmini yapılmaz (ilk 768x300 `tablet`, 1280x400 `desktop`); ölçülen telefon yolculuğu Provider tarafından tutulur ve döndürüldüğünde phone kalır, `releaseJourney` veya süreklilik sıfırlaması onu bırakır.

Önce yazılacak başarısız testler:

- `width 1920, surface web` sonucu `living-room` değildir; `surface living-room` her genişlikte `living-room` döndürür.
- `visualWidth/visualHeight` küçülünce `layout` ve `band` aynı kalır, yalnız `usableWidth/usableHeight` küçülür.
- `fine + hover + anyHover` true olsa bile `activeInput unknown` kalır; klavye çıkarılmaz.
- `lockedProfile`, genişlik değişse de korunur.
- `serverEnvironment` frozen'dır ve 320x480, yetenekler false, `saveData` null'dır.
- `adaptiveBreakpointTokens`, `policy.json` ile birebir eşittir; üretilen SCSS map aynı değerleri taşır.
- Her sınırda N−1/N/N+1: 479/480/481, 599/600/601, 767/768/769, 959/960/961, 1279/1280/1281, 1599/1600/1601, 1919/1920/1921; `height` 479/480/481 için `shortHeight`.
- Tarayıcı globali olmayan ortamda modül importu hata vermez; `getSnapshot` art arda aynı referansı döndürür; unsubscribe sonrasında callback çağrılmaz; `getEnvironmentStore` aynı pencere için aynı örneği döndürür.

### P2 320 aileleri ve SCSS

Bileşen aileleri (form, seçim/dropdown, tablo, gezinme, geri bildirim, AI yüzeyleri) önce 320'de kabul edilir, sonra genişlikler artırılır. Markalı select paneli korunur; native açılır menü kullanılmaz. Sayfada yatay taşma yoktur; tablo kendi kapsayıcısında kayar ve kelime ortasından bölünmez.

### P3 Giriş, spatial ve webOS

Katmanlar ekleyicidir; hibrit giriş desteklenir. Remote girişi yalnız `living-room` yüzeyinde spatial katman ekler. Açık living-room yüzeyinde işlenmiş yön tuşu aynı halkasız odak modunu açabilir (insan yanıtı 2026-10-16); testler web yüzeyinde, 1920 genişlikte, spatial katmansız kilitli profilde ve bağlantısız sınırda okların modu açmadığını, pointer girişinin modu kapattığını kontrol eder.

### P4 Koşullu teslim ve durum

Başka profilin özel paketi indirilmez; dinamik import ve CSS yüklemesi ağ kaydıyla doğrulanır. `display:none` indirmeme kanıtı sayılmaz. Profil ve yön değişiminde form verisi, odak ve açık panel korunur.

### P5 AI admission ve lab

Akış: intent/model, sonra policy/validation, sonra onaylı component/capability registry, sonra deterministik UI. Registry dışı bileşen, keyfi import, DOM veya CSS reddedilir ve kullanıcıya görünür biçimde raporlanır. Lab salt okunur prototiptir; canlı AI veya mutation gibi sunulmaz.

### P6 Doğrulama

Zorunlu 14 genişlik: 320, 375, 430, 480, 599, 600, 768, 959, 960, 1279, 1280, 1600, 1920, 2560. Saf politika riskleri birim testinde, yerleşim/etkileşim/ağ riskleri tarayıcıda (Chromium, Firefox, WebKit; fare, dokunma, klavye, hibrit) doğrulanır. Yatay görünüm, kısa yükseklik, sanal klavye, safe area, zoom, reduced motion ve görünür klavye odağı ayrı kontrol edilir. Fiziksel cihaz kontrolleri emülasyondan ayrı raporlanır ve yapılana kadar pending kalır.

Gerçek QA yolları: birim testleri node:test ile `docs/tests/adaptive-policy.test.mjs`, `docs/tests/adaptive-input.test.mjs`, `docs/tests/adaptive-delivery.test.mjs` (8 vaka); tarayıcı spec'i `docs/browser/adaptive-ui.spec.ts` (3 vaka × Chromium, Firefox, WebKit). Kök betikler `docs:check`, `docs:lint`, `docs:format`, `docs:build` ve açık tarayıcı tip komutu kullanılır. Vitest yoktur; reddedilen `src/*.test.ts` önerileri mevcut değildir. CI yalnız gerçekten koşan işleri raporlar; sonuç bu belgeye sabit yazılmaz.

## 6. Temel kritik yolculuklar

1. Form: girdi, doğrulama hatası, gönderim; profil değişiminde veri ve odak korunur.
2. Kategori AI: istek, admission, registry eşleşmesi, deterministik sonuç, reddedilen öğe raporu.
3. Tablo: kendi kapsayıcısında yatay kaydırma, okunabilir minimum sütunlar, uzun model adlarıyla gerçek içerik.

## 7. Destek defteri

Yalnız şu durumlar kullanılır: `planned`, `implemented`, `automation-pass`, `physical-pass`, `fail`, `pending`, `excluded-by-human`. Donanım yokluğu `pending` demektir, `unsupported` değildir. `excluded-by-human` yalnız açık insan kararıyla yazılır. Her satır tarayıcı, OS, viewport, giriş profili, komut ve kanıt bağlantısı taşır.

## 8. Bütçeler

Mevcut 8 KiB vanilla controller bütçesi korunur. Profil başına aktarılan baytlar ölçülüp raporlanır; çelişen örnek bütçeler (120KB/250KB) benimsenmez. Yeni bütçe ancak açık ölçüm koşuluyla ve insan kararıyla eklenir.

## 9. Yayın ve iddia sınırları

- Exact main yayını, tüm gate'ler geçtikten sonra yetkilidir; son CI ve yayın durumu GitHub status'undan veya doğrulanmış makbuzdan okunur. İnsan görsel onayı pending'dir.
- Frappe backend'i, deploy veya Pages üzerinde request-time SSR iddia edilmez.
- Çalışmayan CI, tarayıcı veya fiziksel cihaz kontrolü geçmiş sayılmaz.

## 10. Açık insan kararları

- Yok. TV/living-room yön tuşu odak istisnası 2026-10-16'da insan tarafından yanıtlandı (`hem tab, hem tv`); fiziksel TV kontrolleri pending.

## 11. P1 eşlemesinin sözleşme uyumu

- §5 P1'deki band'den profile eşleme ve kilitli telefon kuralı `policy.ts` içinde uygulanmıştır; `GELISTIRME-SOZLESMESI` ile çelişirse sözleşme esas alınır, fark raporlanır ve politika ile testleri birlikte düzeltilir.
