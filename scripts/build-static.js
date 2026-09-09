import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const menuDataPath = path.join(rootDir, "data", "menu.json");
const publicDir = path.join(rootDir, "public");
const apiDir = path.join(publicDir, "api");

if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

// 1. Menü verisini filtreleyip statik JSON dosyaları olarak hazırla
const rawMenu = JSON.parse(fs.readFileSync(menuDataPath, "utf-8"));
const staticMenu = {
  campaigns: rawMenu.campaigns.filter((c) => c.enabled),
  categories: rawMenu.categories
    .filter((cat) => cat.enabled)
    .map((cat) => ({ ...cat, items: cat.items.filter((i) => i.enabled) }))
    .filter((cat) => cat.items.length > 0),
};

const jsonString = JSON.stringify(staticMenu);

// Hem api/menu.json hem de api/menu olarak kaydet (her iki istek biçimi de çalışsın)
fs.writeFileSync(path.join(apiDir, "menu.json"), jsonString, "utf-8");
fs.writeFileSync(path.join(apiDir, "menu"), jsonString, "utf-8");

// 2. GitHub Pages için .nojekyll dosyası oluştur (Jekyll asset filtrelemesini engeller)
fs.writeFileSync(path.join(publicDir, ".nojekyll"), "", "utf-8");

console.log("Static menu and .nojekyll generated successfully in public/!");
