import { json, readMenu, requireLogin } from "../../_lib.js";

/** Panelin gördüğü tam menü: kapalı ve tükenmiş ürünler dahil. */
export async function onRequestGet({ request, env }) {
  const reddet = await requireLogin(request, env);
  if (reddet) return reddet;
  return json(await readMenu(env));
}
