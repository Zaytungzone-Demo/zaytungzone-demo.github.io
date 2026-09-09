import { json, readMenu, requireLogin, writeMenu } from "../../../_lib.js";

const gecerliFiyat = (deger) => Number.isInteger(deger) && deger >= 0 && deger <= 10_000_000;

export async function onRequestPatch({ request, env, params }) {
  const reddet = await requireLogin(request, env);
  if (reddet) return reddet;

  const { originalPriceKurus, campaignPriceKurus, enabled } = await request.json().catch(() => ({}));
  const menu = await readMenu(env);
  const campaign = menu.campaigns.find((entry) => entry.id === params.id);

  if (!campaign || !gecerliFiyat(originalPriceKurus) || !gecerliFiyat(campaignPriceKurus)) {
    return json({ error: "Kampanya bulunamadı veya veri geçersiz." }, { status: 400 });
  }

  campaign.originalPriceKurus = originalPriceKurus;
  campaign.campaignPriceKurus = campaignPriceKurus;
  campaign.enabled = Boolean(enabled);
  await writeMenu(env, menu);
  return json(campaign);
}
