import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Depoyla gelen başlangıç menüsü. Panelden yapılan değişiklikler buraya değil, DATA_FILE'a yazılır;
   böylece her deploy'da depo sürümü canlı fiyatların üzerine yazmaz. */
const seedFile = path.join(repoRoot, "data", "menu.json");

/* Canlı veri. Kalıcı diski olan bir sunucuda DATA_FILE'ı o diske gösterin
   (ör. DATA_FILE=/var/data/menu.json), yoksa depo içindeki dosya kullanılır. */
const file = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : seedFile;

// İlk açılışta hedef dosya yoksa başlangıç menüsünden oluştur.
if (file !== seedFile && !existsSync(file)) {
  mkdirSync(path.dirname(file), { recursive: true });
  copyFileSync(seedFile, file);
  console.log(`Menü ilk kez oluşturuldu: ${file}`);
}

/** Menü küçük olduğu için tamamını bellekte tutuyoruz; yazarken diske geri basıyoruz. */
let menu = JSON.parse(readFileSync(file, "utf8"));

export function readMenu() {
  return menu;
}

function save() {
  // Önce geçici dosyaya yaz, sonra taşı — yazma sırasında elektrik giderse menü bozulmasın.
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(menu, null, 2));
  renameSync(temporary, file);
}

const isPrice = (value) => Number.isInteger(value) && value >= 0 && value <= 10_000_000;

export function updateItem(id, { priceKurus, enabled, soldOut }) {
  const item = menu.categories.flatMap((category) => category.items).find((entry) => entry.id === id);
  if (!item || !isPrice(priceKurus)) return null;
  item.priceKurus = priceKurus;
  item.enabled = Boolean(enabled);
  item.soldOut = Boolean(soldOut);
  save();
  return item;
}

export function updateCampaign(id, { originalPriceKurus, campaignPriceKurus, enabled }) {
  const campaign = menu.campaigns.find((entry) => entry.id === id);
  if (!campaign || !isPrice(originalPriceKurus) || !isPrice(campaignPriceKurus)) return null;
  campaign.originalPriceKurus = originalPriceKurus;
  campaign.campaignPriceKurus = campaignPriceKurus;
  campaign.enabled = Boolean(enabled);
  save();
  return campaign;
}
