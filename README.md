# Zaytung Zone — QR Menü

Masadaki QR koddan açılan dijital restoran menüsü. Telefon önceliklidir, masaüstünde de çalışır.

## Çalıştırma

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # dosya değişince kendini yeniden başlatır
```

Yönetim paneli: `http://localhost:3000/admin`

## Ayarlar

Ortam değişkenleriyle yapılandırılır:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `PORT` | `3000` | Sunucu portu |
| `ADMIN_USERNAME` | `admin` | Panel kullanıcı adı |
| `ADMIN_PASSWORD` | `zaytung123` | Panel şifresi — **yayında zorunlu**, ayarlanmazsa sunucu açılmaz |
| `NODE_ENV` | — | `production`: çerez yalnızca HTTPS üzerinden gider, zayıf şifre reddedilir |
| `TRUST_PROXY` | — | Ters vekil arkasındaysanız `1`; gerçek ziyaretçi IP'si için |
| `DATA_FILE` | `data/menu.json` | Canlı menünün yazılacağı yol. Kalıcı disk varsa oraya gösterin |

Aynı klasörde `.env` dosyası varsa otomatik okunur. Barındırma servisinin panelinden
tanımladığınız değişkenler `.env`'i ezer, ikisi bir arada sorunsuz çalışır.

```bash
ADMIN_PASSWORD="uzun-ve-rastgele-bir-sifre" NODE_ENV=production npm start
```

## Yapı

```
data/menu.json      Başlangıç menüsü — 38 kategori, 325 ürün, 6 kampanya

functions/          CLOUDFLARE PAGES SÜRÜMÜ (yayında bu çalışır)
  _lib.js           KV deposu, imzalı oturum, ortak yardımcılar
  api/              /api/menu, /api/login, /api/admin/*
  qr/               eski adreslerin yönlendirmeleri

server.js           NODE SÜRÜMÜ (yerel geliştirme ve yedek)
src/store.js        Node sürümünün dosya tabanlı deposu

public/
  index.html        QR menü
  admin.html        Yönetim paneli
  login.html        Panel girişi
  css/style.css     Tüm ekranların stilleri
  js/menu.js        Menü arayüzü
  js/admin.js       Panel arayüzü
  js/icons.js       Kullanılan ikonların SVG'leri
  images/           Ürün, kampanya ve marka görselleri
  models/           Kampanyaların .glb 3D modelleri
  vendor/           <model-viewer> (3D + AR)
```

Derleme adımı yok: tarayıcıya giden dosyalar olduğu gibi sunulur.

## Neler var

- **Kampanyalar** — altı kampanya; her biri 3D olarak döndürülebilir, destekleyen telefonlarda AR ile masaya yerleştirilebilir.
- **Menü** — 38 kategori, 325 ürün. Kategori şeridi kaydırdıkça kendini işaretler.
- **Arama** — Türkçe karakterleri ve büyük/küçük harfi yok sayar; "sogus" yazınca "Soğuş" bulunur.
- **Dil** — Türkçe / İngilizce; seçim tarayıcıda hatırlanır.
- **Tema** — sistem → açık → koyu sırayla döner; seçim hatırlanır.
- **QR derin bağlantısı** — `/kampanya/<slug>` doğrudan o kampanyanın 3D görünümünü açar. Örn. `/kampanya/sezar-wrap`.
- **Panel** — ürün ve kampanya fiyatları, yayında/tükendi durumları. Kayıt anında menüye yansır.

## Veri

Her şey tek bir JSON dosyasında durur (`DATA_FILE`, varsayılan `data/menu.json`). Panelden yapılan değişiklik önce geçici dosyaya yazılıp sonra taşınır;
yazma sırasında sunucu kapanırsa menü bozulmaz.

Fiyatlar **kuruş** cinsinden tam sayıdır (`42900` = ₺429). Kayan noktalı sayı kullanılmaz, kuruş kaybı olmaz.

Yedek almak için bu dosyayı kopyalamak yeterlidir.

## Cloudflare Pages'e yayına alma

Menü KV'de saklanır; ilk istekte `data/menu.json` içinden otomatik doldurulur.

**1. KV ad alanını oluşturun** ve çıkan id'yi `wrangler.toml` içindeki `id` alanına yazın:

```bash
npx wrangler kv namespace create MENU_KV
```

**2. Gizli değişkenleri tanımlayın** (Pages panelinden Settings → Variables and Secrets,
ya da komutla). Bunlar `.env`'den okunmaz, Cloudflare'a ayrıca girilir:

| Değişken | Açıklama |
| --- | --- |
| `ADMIN_USERNAME` | Panel kullanıcı adı |
| `ADMIN_PASSWORD` | Panel şifresi |
| `SESSION_SECRET` | Oturum çerezini imzalayan anahtar. Uzun ve rastgele olsun — değiştirirseniz açık oturumlar düşer |

**3. Yayına alın:**

```bash
npm run cf:deploy
```

### Yerel geliştirme

```bash
npm run cf:dev     # Pages Functions + yerel KV, tıpkı yayındaki gibi
npm run dev        # Node sürümü (dosya tabanlı, KV gerekmez)
```

`cf:dev` değişkenleri `.dev.vars` dosyasından okur (`.gitignore`'da).

### Bilinmesi gerekenler

- **KV eventually consistent.** Panelden fiyat değiştirdiğinizde diğer bölgelerdeki
  müşterilerin görmesi 60 saniyeyi bulabilir. Restoran menüsü için sorun değil.
- **Oturum sunucuda tutulmaz.** Workers'da istekler arasında bellek paylaşılmadığı için
  oturum, bitiş zamanı HMAC ile imzalanmış bir çerezde taşınır.
- **Giriş denemesi sınırlaması Cloudflare tarafında.** KV'nin günlük yazma kotasını
  saldırganın tüketmemesi için sayaç koda konmadı. Panelden bir hız sınırlama kuralı
  ekleyin: Security → WAF → Rate limiting rules, `/api/login` yoluna IP başına
  10 saniyede birkaç istek. Ücretsiz planda 1 kural hakkınız var.
- **Statik dosyalar CDN'den dağıtılır**, bant genişliği ölçülmez. Görseller ve 3D
  modeller (müşteri başına 2–7 MB) bu yüzden ücretsiz planda sorun çıkarmaz.
