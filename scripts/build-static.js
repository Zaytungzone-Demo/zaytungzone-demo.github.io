import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const menuDataPath = path.join(rootDir, "data", "menu.json");
const publicDir = path.join(rootDir, "public");
const apiDir = path.join(publicDir, "api");
const adminDir = path.join(publicDir, "admin");
const loginDir = path.join(publicDir, "login");

for (const dir of [publicDir, apiDir, adminDir, loginDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

// Hem api/menu.json hem de api/menu olarak kaydet
fs.writeFileSync(path.join(apiDir, "menu.json"), jsonString, "utf-8");
fs.writeFileSync(path.join(apiDir, "menu"), jsonString, "utf-8");

// Kök dizindeki api klasörüne de yaz (yerel testler için)
const rootApiDir = path.join(rootDir, "api");
if (fs.existsSync(rootApiDir)) {
  fs.writeFileSync(path.join(rootApiDir, "menu.json"), jsonString, "utf-8");
  fs.writeFileSync(path.join(rootApiDir, "menu"), jsonString, "utf-8");
}

// 2. HTML ve alt yönlendirme dosyalarını senkronize et
const copyFileSafe = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
};

copyFileSafe(path.join(rootDir, "admin.html"), path.join(publicDir, "admin.html"));
copyFileSafe(path.join(rootDir, "admin.html"), path.join(adminDir, "index.html"));
copyFileSafe(path.join(rootDir, "login.html"), path.join(publicDir, "login.html"));
copyFileSafe(path.join(rootDir, "login.html"), path.join(loginDir, "index.html"));
copyFileSafe(path.join(rootDir, "404.html"), path.join(publicDir, "404.html"));
copyFileSafe(path.join(rootDir, "index.html"), path.join(publicDir, "index.html"));
copyFileSafe(path.join(rootDir, "sw.js"), path.join(publicDir, "sw.js"));

// 3. JS ve CSS dizinlerini senkronize et
const copyDirRecursive = (src, dest) => {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const sPath = path.join(src, item);
    const dPath = path.join(dest, item);
    if (fs.statSync(sPath).isDirectory()) {
      copyDirRecursive(sPath, dPath);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  }
};

copyDirRecursive(path.join(rootDir, "js"), path.join(publicDir, "js"));
copyDirRecursive(path.join(rootDir, "css"), path.join(publicDir, "css"));

// 4. GitHub Pages için .nojekyll dosyası oluştur
fs.writeFileSync(path.join(publicDir, ".nojekyll"), "", "utf-8");

console.log("Static menu, admin/login routing, and .nojekyll generated successfully in public/!");
