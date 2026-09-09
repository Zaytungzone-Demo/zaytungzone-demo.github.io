/* Pages Functions için ortak katman.
   Alt çizgiyle başlayan dosyalar Pages tarafından adres olarak sunulmaz. */

import seed from "../data/menu.json";

const MENU_KEY = "menu";
const SESSION_TTL = 12 * 60 * 60 * 1000;
const encoder = new TextEncoder();

// --- Menü deposu (KV) ---

/** KV boşsa depoyla gelen menüyle doldurur; sonraki okumalar KV'den gelir. */
export async function readMenu(env) {
  const saved = await env.MENU_KV.get(MENU_KEY, "json");
  if (saved) return saved;
  await env.MENU_KV.put(MENU_KEY, JSON.stringify(seed));
  return seed;
}

export async function writeMenu(env, menu) {
  await env.MENU_KV.put(MENU_KEY, JSON.stringify(menu));
}

/** Müşteriye giden hâli: kapalı kategori ve ürünler ayıklanmış. */
export function publicMenu(menu) {
  return {
    campaigns: menu.campaigns.filter((campaign) => campaign.enabled),
    categories: menu.categories
      .filter((category) => category.enabled)
      .map((category) => ({ ...category, items: category.items.filter((item) => item.enabled) }))
      .filter((category) => category.items.length > 0),
  };
}

// --- Oturum ---
// Workers'da istekler arasında bellek paylaşılmadığı için oturumu sunucuda tutamayız.
// Bunun yerine bitiş zamanını HMAC ile imzalayıp çerezde taşıyoruz: doğrulama için
// sadece gizli anahtar yeterli, hiçbir yerde durum saklamıyoruz.

const base64url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64url = (text) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const hmacKey = (secret) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function createSession(secret) {
  const expiresAt = String(Date.now() + SESSION_TTL);
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(expiresAt));
  return `${expiresAt}.${base64url(signature)}`;
}

export async function isLoggedIn(request, env) {
  const token = readCookie(request, "zz_session");
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) < Date.now()) return false;
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await hmacKey(sessionSecret(env)),
      fromBase64url(signature),
      encoder.encode(expiresAt)
    );
  } catch {
    return false;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/** Oturum çerezi imzasının anahtarı. Ayarlanmazsa şifreden türetilir. */
export function sessionSecret(env) {
  return env.SESSION_SECRET || `zz:${env.ADMIN_PASSWORD}`;
}

/** Uzunluk sızdırmadan sabit zamanda karşılaştırma. */
export function safeEqual(a = "", b = "") {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

// --- Yanıt yardımcıları ---

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init.headers },
  });

export const unauthorized = () => json({ error: "Oturum gerekli." }, { status: 401 });

/** Panel uçlarını tek yerden koruyoruz. */
export async function requireLogin(request, env) {
  return (await isLoggedIn(request, env)) ? null : unauthorized();
}
