import compression from "compression";
import express from "express";
import crypto from "node:crypto";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMenu, updateCampaign, updateItem } from "./src/store.js";

const root = path.dirname(fileURLToPath(import.meta.url));

/* Varsa .env dosyasını yükle. Barındırma servislerinde değişkenler ortamdan gelir ve
   loadEnvFile ortamda tanımlı olanı ezmez; ikisi bir arada sorunsuz çalışır. */
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // .env yok — ortam değişkenleriyle devam.
}

const port = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "zaytung123";
const SESSION_TTL = 12 * 60 * 60 * 1000;

/** Aktif oturumlar: token -> son kullanma zamanı. Sunucu yeniden başlayınca sıfırlanır. */
const sessions = new Map();

/** Kaba kuvvet denemelerini yavaşlatmak için: IP -> { count, at }. */
const failedLogins = new Map();

function createSession() {
  const now = Date.now();
  // Süresi dolmuş oturumlar erişilmedikçe silinmiyordu; yeni girişte temizliyoruz.
  for (const [token, expiresAt] of sessions) if (expiresAt < now) sessions.delete(token);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, now + SESSION_TTL);
  return token;
}

function isLoggedIn(req) {
  const token = req.cookies?.zz_session;
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireLogin(req, res, next) {
  if (!isLoggedIn(req)) return res.status(401).json({ error: "Oturum gerekli." });
  next();
}

// Yayında varsayılan şifreyle açılmasın — panel herkese açık kalırdı.
if (process.env.NODE_ENV === "production" && ADMIN_PASS === "zaytung123") {
  console.error("HATA: ADMIN_PASSWORD ayarlanmadan production modunda başlatılamaz.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
// Ters vekil (nginx, Render, Railway…) arkasındaysak gerçek ziyaretçi IP'sini oradan alalım,
// yoksa giriş deneme sayacı bütün ziyaretçileri tek IP sanar.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.use(compression());
app.use(express.json({ limit: "16kb" }));

// Ufak çerez okuyucu — tek bir çerez kullandığımız için kütüphaneye gerek yok.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))])
  );
  next();
});

// --- API ---

/* Menü yalnızca admin kaydettiğinde değişiyor. Her istekte 129 KB'ı yeniden JSON'a çevirip
   sıkıştırmak yerine bir kez hazırlayıp saklıyoruz; istek başına iş sadece hazır tamponu
   yazmaya iniyor. Kayıt sonrası menuCache=null ile tazeleniyor. */
let menuCache = null;

function getMenuCache() {
  if (menuCache) return menuCache;
  const menu = readMenu();
  const json = Buffer.from(
    JSON.stringify({
      campaigns: menu.campaigns.filter((campaign) => campaign.enabled),
      categories: menu.categories
        .filter((category) => category.enabled)
        .map((category) => ({ ...category, items: category.items.filter((item) => item.enabled) }))
        .filter((category) => category.items.length > 0),
    })
  );
  menuCache = {
    json,
    gzip: zlib.gzipSync(json),
    etag: `W/"${crypto.createHash("sha1").update(json).digest("base64")}"`,
  };
  return menuCache;
}

app.get("/api/menu", (req, res) => {
  const cache = getMenuCache();
  res.set("ETag", cache.etag);
  res.set("Cache-Control", "no-cache");
  res.set("Vary", "Accept-Encoding");
  // Menü değişmediyse tarayıcıya tek bayt bile göndermiyoruz.
  if (req.headers["if-none-match"] === cache.etag) return res.status(304).end();
  res.type("application/json");
  if (/\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    res.set("Content-Encoding", "gzip");
    return res.end(cache.gzip);
  }
  res.end(cache.json);
});

app.post("/api/login", (req, res) => {
  // Bot taramaları aylar içinde IP biriktirmesin diye eski kayıtları at.
  if (failedLogins.size > 1000) {
    const esik = Date.now() - 15 * 60 * 1000;
    for (const [ip, kayit] of failedLogins) if (kayit.at < esik) failedLogins.delete(ip);
  }

  const attempt = failedLogins.get(req.ip);
  if (attempt && attempt.count >= 8 && Date.now() - attempt.at < 15 * 60 * 1000) {
    return res.status(429).json({ error: "Çok fazla deneme yaptınız. 15 dakika sonra tekrar deneyin." });
  }

  const { username = "", password = "" } = req.body || {};
  const ok =
    username.trim().toLowerCase() === ADMIN_USER.toLowerCase() &&
    password.length === ADMIN_PASS.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASS));

  if (!ok) {
    const previous = attempt && Date.now() - attempt.at < 15 * 60 * 1000 ? attempt.count : 0;
    failedLogins.set(req.ip, { count: previous + 1, at: Date.now() });
    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }
  failedLogins.delete(req.ip);
  res.cookie("zz_session", createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL,
    path: "/",
  });
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  sessions.delete(req.cookies?.zz_session);
  res.clearCookie("zz_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/admin/menu", requireLogin, (_req, res) => res.json(readMenu()));

app.patch("/api/admin/item/:id", requireLogin, (req, res) => {
  const updated = updateItem(req.params.id, req.body || {});
  if (!updated) return res.status(400).json({ error: "Ürün bulunamadı veya veri geçersiz." });
  menuCache = null;
  res.json(updated);
});

app.patch("/api/admin/campaign/:id", requireLogin, (req, res) => {
  const updated = updateCampaign(req.params.id, req.body || {});
  if (!updated) return res.status(400).json({ error: "Kampanya bulunamadı veya veri geçersiz." });
  menuCache = null;
  res.json(updated);
});

// --- Sayfalar ---

app.use(
  express.static(path.join(root, "public"), {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".usdz")) {
        res.setHeader("Content-Type", "model/vnd.usdz+zip");
      } else if (filePath.endsWith(".glb")) {
        res.setHeader("Content-Type", "model/gltf-binary");
      }
    },
  })
);

/* Panel sayfaları statik dosyalar (Cloudflare Pages sürümüyle aynı olsun diye).
   İçlerinde veri yok; korunan şey /api/admin/* uçları. */
app.get("/admin", (req, res) =>
  res.sendFile(path.join(root, "public", isLoggedIn(req) ? "admin.html" : "login.html"))
);
app.get("/login", (_req, res) => res.sendFile(path.join(root, "public", "login.html")));

// /kampanya/<slug> — QR kodları doğrudan bir kampanyanın 3D görünümünü açsın diye.
app.get("/kampanya/:slug", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));

// Eski sitenin adresleri: basılmış QR kodlar hâlâ bunlara bakıyor olabilir.
app.get("/qr", (_req, res) => res.redirect(301, "/"));
app.get("/qr/campaign/:slug", (req, res) => res.redirect(301, `/kampanya/${req.params.slug}`));

app.use((_req, res) => res.status(404).sendFile(path.join(root, "public", "index.html")));

app.listen(port, () => console.log(`Zaytung Zone menü:  http://localhost:${port}  (panel: /admin)`));
