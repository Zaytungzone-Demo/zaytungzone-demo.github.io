import { publicMenu, readMenu } from "../_lib.js";

/* Müşterinin gördüğü menü. Cloudflare sıkıştırmayı kendisi yapıyor, biz sadece
   ETag veriyoruz ki değişmediğinde tarayıcı 304 alıp hiç indirmesin. */
export async function onRequestGet({ request, env }) {
  const menu = await readMenu(env);
  const body = JSON.stringify(publicMenu(menu));

  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
  const etag = `W/"${btoa(String.fromCharCode(...new Uint8Array(digest)))}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, "cache-control": "no-cache" } });
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache",
      etag,
    },
  });
}
