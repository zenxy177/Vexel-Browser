# ZNY Browser 🚀
**Arc Stili, Multi-View Havuzlu, Düşük RAM Tüketen Chromium Masaüstü Tarayıcısı**

![ZNY Browser logo](public/zny-mark.svg)

ZNY Browser; Electron ve React ile geliştirilmiş, Arc Browser'ın modern dikey sekme ve çalışma alanı (Spaces) deneyimini, Chromium'un gücü, gerçek süreç bellek ölçümü, çoklu görünüm havuzu (Multi-View Pool) ve yerel Google Chrome yer imi aktarımı ile birleştiren masaüstü web tarayıcısıdır.

---

## ✨ Mimari ve Temel Özellikler

### 1. 🗂️ Multi-View Sekme Havuzu & Durum Korunumu
- **Multi-View DOM Havuzu:** Etkin webview'ler DOM üzerinde tutulur. Normal sekme geçişlerinde sayfa yeniden yüklenmez; form verileri, kaydırma (scroll) konumu ve sayfa oturumu korunur. Uzun süre boşta kalan sekmeler uykuya alınırken webview kapatılır; uyandırıldığında sayfa URL'sinden yeniden yüklenir, bu nedenle sayfaya özel geçici durum korunmayabilir.
- **Dikey Kenar Çubuğu (Vertical Sidebar):** İsteğe bağlı olarak tek tıkla daraltılabilir veya genişletilebilir.
- **Kalıcı Oturum ve Durum (State Persistence):** Açık sekmeler, aktif çalışma alanı, yer imleri ve tercihler yerel depolamada saklanır; tarayıcı yeniden başlatıldığında sekmeleriniz geri yüklenir.
- **Bölünmüş Ekran (Split View):** Aynı pencere içinde iki sekmeyi yan yana açarak çoklu görevleri hızlandırın.

### 2. 🗂️ Akıllı Çalışma Alanları (Spaces)
- *Kişisel*, *İş & Proje* ve *Araştırma* alanları arasında hızlı geçiş.
- Alan değiştirildiğinde, seçilen alana ait en son kullanılan aktif sekme otomatik olarak görüntülenir; alanlar arası sekme karışıklığı önlenir.

### 3. ⚡ Sabitlenmemiş Sekmeler İçin RAM Uyku Modu (Hibernation)
- 3 dakikadan uzun süre kullanılmayan **sabitlenmemiş** sekmelerin webview öğesi kapatılır; Chromium kaynakları serbest bırakabilir, ancak anlık RAM tasarrufu garanti edilmez.
- Sabitlenmiş (pinned) sekmeler, aktif sekme ve bölünmüş ekran sekmeleri hiçbir zaman uyutulmaz.
- Askıya alınan sekme seçildiğinde URL'sinden yeniden yüklenerek uyandırılır.
- **Gerçek RAM Göstergesi:** Başlık çubuğundaki RAM sayacı sahte formüller yerine Electron ana sürecinden (`app.getAppMetrics()` ve `process.getProcessMemoryInfo()`) IPC aracılığıyla alınan anlık gerçek Chromium süreç bellek kullanımını gösterir.

### 4. 🔖 Kalıcı Yer İmleri Koleksiyonu & Chrome Aktarımı
- **Yer İmleri Kitaplığı:** Kenar çubuğunda "Yer İmleri" görünümüyle tüm kayıtlı bağlantılarınıza klasör hiyerarşisiyle birlikte erişin.
- **Chrome Aktarıcısı:** Yerel Chrome profillerini adlarıyla seçip seçili profilin yer imlerini ve ziyaret/arama geçmişini aktarabilirsiniz. Profil otomatik bulunamazsa klasör elle seçilebilir.
- **Gezinme Geçmişi:** ZNY ziyaretleri yerel olarak kaydeder; geçmiş Ctrl+H ile aranabilir, tekil kayıtlar veya tüm geçmiş silinebilir. Chrome geçmişi içe aktarıldığında, arama terimleri mevcutsa kayıtlarda ayrıca gösterilir.

### 5. 🛡️ Güvenlik, Gizlilik ve Site İzolasyonu
- **Chromium Site İzolasyonu:** Multi-process güvenlik sınırları korunur; güvensiz izolasyon kapatma bayrakları kullanılmaz.
- **Uygulama Arayüzü Güvenliği:** Renderer CSP ile sınırlandırılır; Electron ana penceresi ve webview sandbox/context isolation kullanır. Webview eklenirken kaynak URL'si HTTP/HTTPS ile sınırlandırılır, preload ana süreççe atanır ve Node entegrasyonu, eklentiler ile güvensiz içerik çalıştırma kapalı tutulur.
- **Sıkı IPC Yetkilendirmesi:** IPC yalnızca ana pencerenin ana frame'inden ve beklenen yerel uygulama belgesinden (geliştirmede tanımlı Vite origin/path) kabul edilir.
- **Doğrulanmış HTTPS Göstergesi:** Adres çubuğu URL şemasını denetler; geçerli `https://` bağlantılar için yeşil kilit, şifrelenmemiş `http://` bağlantılar için uyarı gösterir.
- **Güvenli Gezinme & Site İzinleri:** `will-navigate` kancası yetkisiz şemaları engeller. HTTPS ana sayfalar kamera, mikrofon, konum, bildirim ve pano okuma izinlerini site bazında sorar; kullanıcı seçimini o oturum için veya kalıcı olarak hatırlayabilir. HTTP sayfaları ve gömülü çerçeveler reddedilir.
- **Güvenli Popup / Pencere Politikası:** Sayfaların `window.open` ve `target="_blank"` çağrıları kontrolsüz pencereler açmak yerine güvenli şekilde yeni sekmede açılır; reklam filtresinde eşleşen hedeflere giden açılır pencereler sekme oluşturmadan engellenir. Açılışta güvenli görünen bir popup daha sonra engellenen bir adrese yönlenirse, yalnızca o popup sekmesi kapatılır.
- **Web Sayfası Sağ Tık Menüsü:** Bağlantıyı yeni sekmede açma/adresini kopyalama, resim açma/kopyalama/kaydetme, seçili metni kopyalama veya Google'da arama, metin alanlarında standart düzenleme ve sayfa gezinme komutları sunulur. Yeni sekmede açma yalnızca HTTP/HTTPS adreslerini kabul eder; indirmeler için kaydetme konumu sorulur.
- **İndirme Yöneticisi:** İndirme ilerlemesini izleyin, indirmeyi duraklatın/sürdürün/iptal edin; tamamlanan dosyayı açın veya klasöründe gösterin.
- **Sayfada Bul:** `Ctrl + F` ile açık sayfada eşleşmeleri sayarak arayın ve sonuçlar arasında ilerleyin.
- **Uygulama İçi Güncelleme:** Güvenlik panelinden GitHub Releases sürümleri denetlenebilir ve indirme ilerlemesi izlenebilir. İndirme tamamlandığında “Yeniden başlat ve yükle” seçeneği güncellemeyi kurar; uygulamayı elle kapatıp açmak gerekmez. Bu akış paketlenmiş sürümlerde çalışır ve Release'e Windows kurulum dosyalarıyla birlikte `latest.yml` eklenmesini gerektirir.
- **Açık Kaynaklı Reklam & İzleyici Engelleyici:** Ghostery’nin Electron uyumlu motoru EasyList/uBlock biçimli ağ ve kozmetik filtrelerini kullanır; motor güvenli HTTPS üzerinden güncellenir, yerel önbelleğe alınır ve çevrimdışıyken son başarılı sürümle çalışır. Reklam filtrelerinde eşleşen popup hedefleri sekme oluşturmadan engellenir; sonradan engellenen bir adrese yönlenen geçici popup sekmesi de kapatılır. Güvenlik panelinden filtreleri elle güncelleyebilir, son engellemeleri ve site istisnalarını görebilirsiniz. İstek geçmişi bellekte tutulur ve uygulama kapandığında silinir. Engelleme filtre listelerinin kapsamına bağlıdır ve her sitedeki her reklam için garanti vermez.
- **Siteye Özel Kalkan İstisnası:** Güvenlik panelinden etkin sitenin alan adı için reklam/izleyici filtresini devre dışı bırakabilir veya istisnayı kaldırabilirsiniz. İstisnalar yerel olarak saklanır; HTTPS yükseltme davranışı bu tercihten etkilenmez.
- **Şeffaf Veri İletimi Tercihleri:** Google canlı arama önerileri ve seçili metin çevirisi harici servislere veri gönderdiğinden, Güvenlik Kalkanı penceresinden dilediğiniz zaman bu özellikleri açıp kapatabilirsiniz. İstekler 8 saniyede zaman aşımına uğrar, yanıt durum/kapsam sınırları kontrol edilir ve öneri hataları yeniden denenebilir.

### 6. 🈳 Bağlamsal Çeviri ve Google Hub
- **Metin Seçimiyle Çeviri:** Sayfa içinde bir metin seçildiğinde imlecin yanında bağlamsal çeviri penceresi görüntülenir; hata durumunda yeniden deneme butonu ve erişilebilir bildirim sağlar. Pano kopyalama hatası da kullanıcıya bildirilir (Gizlilik ayarlarından kapatılabilir).
- **Hata Geri Bildirimi:** Yaygın sayfa bağlantı hataları Türkçe, eyleme dönük mesajlarla gösterilir; beklenen gezinme iptalleri hata sayılmaz. Depolama, pencere kontrolü, bellek ölçümü ve güvenlik istatistikleri hataları da sessizce yok sayılmak yerine görünür bildirim üretir.
- **Performans:** Chromium bellek ölçümü 10 saniyede, güvenlik sayaçları 5 saniyede yenilenir. Değişmeyen değerler renderer state güncellemesi oluşturmaz; boşta sekme taraması da sekme uyumadığında yeni state üretmez. Webview bileşenleri ilgisiz arayüz render'larını atlar.
- **Görsel Tasarım:** Tarayıcı kabuğu gece grafiti yüzeyleri ve buz mavisi vurgu rengiyle sadeleştirildi. Sekme listelerinde dekoratif kart sınırları azaltıldı; adres çubuğu ve aktif sekme hiyerarşisi belirginleştirildi.
- **Sayfayı Çevir:** Adres çubuğundaki çeviri butonuyla yabancı sayfalar tek tıkla Türkçeye çevrilebilir.
- **Google Servisleri Paneli:** Gmail, YouTube, Google Drive, Gemini AI, Haritalar ve Takvim'e hızlı erişim kısayolları sunan temiz 3 sütunlu kılavuz.

---

## ⌨️ Klavye Kısayolları

| Kısayol | İşlev |
| :--- | :--- |
| `Ctrl + T` | **Yeni Sekme:** Doğrudan yeni bir sekme oluşturur ve odaklar |
| `Ctrl + K` / `Ctrl + E` | **Komut Paleti:** Google araması yapın, açık sekmeleri bulun veya URL açın |
| `Ctrl + L` / `Alt + D` / `F6` | Adres çubuğuna odaklanır ve mevcut adresi seçer |
| `Alt + Enter` (adres çubuğunda) | Yazılan URL'yi veya aramayı yeni sekmede açar |
| `Ctrl + Enter` (adres çubuğunda) | Tek kelimeyi `www.<kelime>.com` olarak açar |
| `Ctrl + Tab` / `Ctrl + Page Down` | Etkin çalışma alanındaki sonraki sekmeye geçer |
| `Ctrl + Shift + Tab` / `Ctrl + Page Up` | Etkin çalışma alanındaki önceki sekmeye geçer |
| `Ctrl + 1` – `Ctrl + 8` | Etkin çalışma alanındaki ilgili sekmeye geçer |
| `Ctrl + 9` | Etkin çalışma alanındaki son sekmeye geçer |
| `Ctrl + W` / `Ctrl + F4` | Etkin sekmeyi kapatır |
| `Ctrl + Shift + W` | Tarayıcı penceresini kapatır |
| `Ctrl + Shift + T` | Son kapatılan sekmeyi yeniden açar |
| `Alt + Sol` / `Alt + Sağ` | Etkin sekmede geri / ileri gider |
| `Alt + Home` | Google ana sayfasını açar |
| `Ctrl + R` / `F5` | Etkin sayfayı yeniler |
| `Ctrl + Shift + R` | Önbelleği yok sayarak sayfayı yeniler |
| `Ctrl + +` / `Ctrl + -` / `Ctrl + 0` | Sayfayı yakınlaştırır / uzaklaştırır / varsayılana sıfırlar |
| `Ctrl + Fare Tekerleği` | Sayfayı yakınlaştırır veya uzaklaştırır |
| `F11` | Tam ekranı açar veya kapatır |
| `Ctrl + D` | Etkin sayfayı yer imlerine ekler |
| `Ctrl + Shift + D` | Etkin çalışma alanındaki sekmeleri yer imlerine ekler |
| `Ctrl + Shift + O` | Kenar çubuğunda Yer İmleri görünümünü açar |
| `Ctrl + H` | Aranabilir gezinme geçmişini açar |
| `Ctrl + F` | Açık sayfada metin arar |
| `Ctrl + G` / `F3` | Sayfa içi aramada sonraki eşleşmeye gider |
| `Ctrl + Shift + G` / `Shift + F3` | Sayfa içi aramada önceki eşleşmeye gider |
| `Ctrl + J` | İndirme yöneticisini açar |
| `Esc` | Açık olan modalları, çeviri panelini ve komut paletini kapatır |
| Bağlantıda `Ctrl + tıklama` / orta tık | Bağlantıyı arka planda yeni sekmede açar |
| Bağlantıda `Ctrl + Shift + tıklama` | Bağlantıyı önde yeni sekmede açar |
| Sekmede orta tık | Sekmeyi kapatır |

---

## 🛠️ Nasıl Çalıştırılır?

ZNY Browser'ı başlatmak için klasördeki `launch-zny-browser.bat` dosyasına çift tıklayabilir veya terminalden aşağıdaki komutları kullanabilirsiniz:

```bash
# Bağımlılıkları yükleme
npm install

# Saf mantık birim testlerini çalıştırma (44 test)
npm test

# TypeScript tip kontrolü
npm run typecheck

# Üretim derlemesi
npm run build

# Windows x64 NSIS kurulum paketi oluşturma (imzasız)
npm run dist:win

# ZNY Browser'ı Başlatma (otomatik olarak derlemeyi kontrol eder)
npm start
```

Geliştirme ve Windows paketleme için Node.js **22.12 veya üzeri** kullanın.
Windows kurulum paketi `release/` klasörüne yazılır. Kod imzalama sertifikası yapılandırılmadığı için üretilen kurulum dosyası imzasızdır; Windows SmartScreen uyarılarını kaldırmak için yayıncı sertifikası ve imzalama yapılandırması ayrıca gerekir.

Güncellemeleri yayınlamak için `package.json` sürümünü artırın, `npm run dist:win` ile kurulum dosyasını üretin ve GitHub'da yeni bir Release oluşturup `release/` içindeki kurulum `.exe` dosyasını, `.blockmap` dosyasını ve `latest.yml` dosyasını ekleyin. Uygulama bu depodaki Release'i kontrol eder; güncelleme indirilip hazır olduğunda kullanıcı **Yeniden başlat ve yükle** seçeneğiyle kurulumu başlatabilir.
