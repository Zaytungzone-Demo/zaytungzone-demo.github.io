import { json, readMenu, requireLogin, writeMenu } from "../../../_lib.js";

const gecerliFiyat = (deger) => Number.isInteger(deger) && deger >= 0 && deger <= 10_000_000;

export async function onRequestPatch({ request, env, params }) {
  const reddet = await requireLogin(request, env);
  if (reddet) return reddet;

  const { priceKurus, enabled, soldOut } = await request.json().catch(() => ({}));
  const menu = await readMenu(env);
  const item = menu.categories.flatMap((category) => category.items).find((entry) => entry.id === params.id);

  if (!item || !gecerliFiyat(priceKurus)) {
    return json({ error: "Ürün bulunamadı veya veri geçersiz." }, { status: 400 });
  }

  item.priceKurus = priceKurus;
  item.enabled = Boolean(enabled);
  item.soldOut = Boolean(soldOut);
  await writeMenu(env, menu);
  return json(item);
}
