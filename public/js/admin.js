import { icon } from "./icons.js";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

// --- 1. Güvenlik ve Yetki Kontrolü ---
const isAuth =
  sessionStorage.getItem("zz-session") === "authenticated" ||
  localStorage.getItem("zz-admin-auth") === "1" ||
  document.cookie.includes("zz_session=authenticated");

if (!isAuth) {
  location.replace("/login");
  await new Promise(() => {}); // Yönlendirme bitene kadar sonraki kodları dondur
}

let menu = { campaigns: [], categories: [] };

function normalizeSearch(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const formatPrice = (priceKurus) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: priceKurus % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format((priceKurus || 0) / 100);

/** "129,90" ya da "129.9" gibi girdileri kuruşa çevirir; geçersizse null. */
function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

function notify(kind, text) {
  $("notice-slot").innerHTML = `<div class="admin-notice ${kind}" role="status">${escapeHtml(text)}<button>×</button></div>`;
  $("notice-slot").querySelector("button")?.addEventListener("click", () => ($("notice-slot").innerHTML = ""));
}

function persistMenu() {
  localStorage.setItem("zz-menu-data", JSON.stringify(menu));
  window.dispatchEvent(new CustomEvent("menu-updated"));
}

async function save(url, body, button) {
  if (button) button.disabled = true;
  persistMenu();

  // Arka uç API'si varsa istek at
  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      location.href = "/login";
      return false;
    }
  } catch (err) {
    // Statik ortamda API olmaması normaldir, localStorage güncellendi
  }

  if (button) button.disabled = false;
  notify("ok", "Değişiklik kaydedildi ve QR menüye yansıdı.");
  return true;
}

// --- 2. Kampanyalar ---

function renderCampaigns() {
  if (!menu.campaigns || menu.campaigns.length === 0) {
    $("campaign-admin-grid").innerHTML = `<p style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--ink-soft);">Henüz kampanya bulunmuyor.</p>`;
    return;
  }

  $("campaign-admin-grid").innerHTML = menu.campaigns
    .map(
      (campaign, index) => `
      <form data-campaign="${campaign.id}">
        <div>
          <span>0${campaign.order || index + 1}</span>
          <h3>${escapeHtml(campaign.title?.tr || campaign.title)}</h3>
          <p>${escapeHtml(campaign.subtitle?.tr || campaign.subtitle || "")}</p>
        </div>
        <div class="campaign-price-fields">
          <label>Normal<input name="original" inputmode="decimal" value="${(campaign.originalPriceKurus || 0) / 100}" /><i>₺</i></label>
          <label>Kampanya<input name="price" inputmode="decimal" value="${(campaign.campaignPriceKurus || 0) / 100}" /><i>₺</i></label>
        </div>
        <footer>
          <label class="switch"><input type="checkbox" name="enabled" ${campaign.enabled ? "checked" : ""} /><span></span>Yayında</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="submit" title="Kaydet">${icon("save", 16)} Kaydet</button>
            <button type="button" class="icon-btn-danger btn-delete-campaign" data-id="${campaign.id}" title="Kampanyayı Sil">${icon("trash", 16)}</button>
          </div>
        </footer>
      </form>`
    )
    .join("");
}

$("campaign-admin-grid").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const campaign = menu.campaigns.find((entry) => entry.id === form.dataset.campaign);
  if (!campaign) return;

  const originalPriceKurus = parsePrice(form.original.value);
  const campaignPriceKurus = parsePrice(form.price.value);

  if (originalPriceKurus === null || campaignPriceKurus === null) {
    return notify("error", "Geçerli kampanya fiyatları girin.");
  }

  const body = { originalPriceKurus, campaignPriceKurus, enabled: form.enabled.checked };
  Object.assign(campaign, body);
  await save(`/api/admin/campaign/${campaign.id}`, body, form.querySelector('button[type="submit"]'));
  renderCampaigns();
});

$("campaign-admin-grid").addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".btn-delete-campaign");
  if (!deleteBtn) return;
  const id = deleteBtn.dataset.id;
  const campaign = menu.campaigns.find((c) => c.id === id);
  const title = campaign ? (campaign.title?.tr || campaign.title) : "bu kampanyayı";
  if (!confirm(`"${title}" kampanyasını silmek istediğinize emin misiniz?`)) return;

  menu.campaigns = menu.campaigns.filter((c) => c.id !== id);
  persistMenu();
  renderCampaigns();
  updateStats();
  notify("ok", "Kampanya silindi.");
});

// --- 3. Ürünler ---

function visibleItems() {
  const query = normalizeSearch($("item-query").value);
  const categoryId = $("category-filter").value;
  return (menu.categories || [])
    .filter((category) => categoryId === "all" || category.id === categoryId)
    .flatMap((category) => (category.items || []).map((item) => ({ item, category })))
    .filter(({ item, category }) => {
      if (!query) return true;
      const text = `${item.name?.tr || item.name} ${category.name?.tr || category.name}`;
      return normalizeSearch(text).includes(query);
    });
}

function renderItems() {
  const rows = visibleItems();
  $("result-count").textContent = `${rows.length} sonuç`;
  const head = $("admin-table").firstElementChild;
  $("admin-table").innerHTML = "";
  $("admin-table").append(head);

  if (rows.length === 0) {
    $("admin-table").insertAdjacentHTML(
      "beforeend",
      `<div style="padding: 24px; text-align: center; color: var(--ink-soft);">Aramanıza uygun ürün bulunamadı.</div>`
    );
    return;
  }

  $("admin-table").insertAdjacentHTML(
    "beforeend",
    rows
      .map(
        ({ item, category }) => `
        <form data-item="${item.id}" class="${item.enabled ? "" : "disabled-row"}">
          <div class="admin-item-name">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" loading="lazy" width="48" height="48" />` : `<div style="width:48px;height:48px;border-radius:7px;background:var(--paper-2);display:grid;place-items:center;font-size:20px;">🍽️</div>`}
            <span><b>${escapeHtml(item.name?.tr || item.name)}</b><small>${escapeHtml(category.name?.tr || category.name)}</small></span>
          </div>
          <strong>${formatPrice(item.priceKurus)}</strong>
          <label class="price-input">
            <input name="price" aria-label="${escapeHtml(item.name?.tr || item.name)} yeni fiyat" inputmode="decimal" value="${(item.priceKurus || 0) / 100}" /><i>₺</i>
          </label>
          <div class="row-toggles">
            <label><input type="checkbox" name="enabled" ${item.enabled ? "checked" : ""} /> Aktif</label>
            <label><input type="checkbox" name="soldOut" ${item.soldOut ? "checked" : ""} /> Tükendi</label>
          </div>
          <button type="submit" aria-label="${escapeHtml(item.name?.tr || item.name)} kaydet" title="Kaydet">${icon("save", 17)}</button>
          <button type="button" class="icon-btn-danger btn-delete-item" data-id="${item.id}" title="Ürünü Sil">${icon("trash", 16)}</button>
        </form>`
      )
      .join("")
  );
}

$("admin-table").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const item = menu.categories.flatMap((category) => category.items || []).find((entry) => entry.id === form.dataset.item);
  if (!item) return;

  const priceKurus = parsePrice(form.price.value);
  if (priceKurus === null) return notify("error", "Geçerli bir fiyat girin.");

  const body = { priceKurus, enabled: form.enabled.checked, soldOut: form.soldOut.checked };
  Object.assign(item, body);
  await save(`/api/admin/item/${item.id}`, body, form.querySelector('button[type="submit"]'));
  renderItems();
});

$("admin-table").addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".btn-delete-item");
  if (!deleteBtn) return;
  const id = deleteBtn.dataset.id;

  let foundItem = null;
  for (const cat of menu.categories || []) {
    const idx = (cat.items || []).findIndex((i) => i.id === id);
    if (idx !== -1) {
      foundItem = cat.items[idx];
      if (!confirm(`"${foundItem.name?.tr || foundItem.name}" ürününü menüden silmek istediğinize emin misiniz?`)) return;
      cat.items.splice(idx, 1);
      break;
    }
  }

  if (foundItem) {
    persistMenu();
    renderItems();
    updateStats();
    notify("ok", "Ürün menüden silindi.");
  }
});

// --- 4. Modallar ve Yeni Ekleme İşlemleri ---

// Modal Kapatma
document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const dialog = $(btn.dataset.closeDialog);
    if (dialog) dialog.close();
  });
});

// Kampanya Ekleme Modalı Aç
$("btn-open-add-campaign")?.addEventListener("click", () => {
  $("form-add-campaign")?.reset();
  $("modal-add-campaign")?.showModal();
});

// Kampanya Formu Gönderimi
$("form-add-campaign")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const originalPriceKurus = parsePrice(form.originalPrice.value);
  const campaignPriceKurus = parsePrice(form.campaignPrice.value);

  if (originalPriceKurus === null || campaignPriceKurus === null) {
    return notify("error", "Lütfen geçerli fiyatlar girin.");
  }

  const titleTr = form.titleTr.value.trim();
  const titleEn = form.titleEn.value.trim() || titleTr;
  const subtitleTr = form.subtitleTr.value.trim();
  const subtitleEn = form.subtitleEn.value.trim() || subtitleTr;

  const newCampaign = {
    id: `kampanya-${Date.now()}`,
    order: (menu.campaigns || []).length + 1,
    title: { tr: titleTr, en: titleEn },
    subtitle: { tr: subtitleTr, en: subtitleEn },
    originalPriceKurus,
    campaignPriceKurus,
    modelGlbUrl: form.modelGlbUrl.value.trim() || "",
    modelUsdzUrl: form.modelUsdzUrl.value.trim() || "",
    enabled: form.enabled.checked,
  };

  menu.campaigns = menu.campaigns || [];
  menu.campaigns.push(newCampaign);
  persistMenu();
  renderCampaigns();
  updateStats();
  $("modal-add-campaign").close();
  notify("ok", `"${titleTr}" kampanyası başarıyla eklendi.`);
});

// Ürün Ekleme Modalı Aç
$("btn-open-add-item")?.addEventListener("click", () => {
  $("form-add-item")?.reset();
  const select = $("item-modal-category");
  if (select) {
    select.innerHTML = (menu.categories || [])
      .map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name?.tr || cat.name)}</option>`)
      .join("");
  }
  $("modal-add-item")?.showModal();
});

// Ürün Formu Gönderimi
$("form-add-item")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const priceKurus = parsePrice(form.price.value);
  if (priceKurus === null) return notify("error", "Lütfen geçerli bir ürün fiyatı girin.");

  const categoryId = form.categoryId.value;
  const category = (menu.categories || []).find((cat) => cat.id === categoryId);
  if (!category) return notify("error", "Geçerli bir kategori seçin.");

  const nameTr = form.nameTr.value.trim();
  const nameEn = form.nameEn.value.trim() || nameTr;
  const descTr = form.descTr.value.trim();
  const descEn = form.descEn.value.trim() || descTr;

  const newItem = {
    id: `item-${Date.now()}`,
    name: { tr: nameTr, en: nameEn },
    description: { tr: descTr, en: descEn },
    priceKurus,
    imageUrl: form.imageUrl.value.trim() || "",
    enabled: form.enabled.checked,
    soldOut: form.soldOut.checked,
  };

  category.items = category.items || [];
  category.items.unshift(newItem);
  persistMenu();
  renderItems();
  updateStats();
  $("modal-add-item").close();
  notify("ok", `"${nameTr}" ürünü menüye başarıyla eklendi.`);
});

// --- 5. Üst Menü Aksiyonları (JSON İndir, Sıfırla, Çıkış) ---

$("btn-download-json")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(menu, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "menu.json";
  a.click();
  URL.revokeObjectURL(url);
  notify("ok", "Güncel menu.json başarıyla indirildi.");
});

$("btn-reset-menu")?.addEventListener("click", () => {
  if (!confirm("Tüm yerel değişiklikler silinecek ve orijinal menüye dönülecektir. Onaylıyor musunuz?")) return;
  localStorage.removeItem("zz-menu-data");
  location.reload();
});

$("logout").innerHTML = icon("logOut", 18);
$("logout").addEventListener("click", async () => {
  sessionStorage.removeItem("zz-session");
  localStorage.removeItem("zz-admin-auth");
  document.cookie = "zz_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (err) {}
  location.href = "/login";
});

function updateStats() {
  const itemCount = (menu.categories || []).reduce((sum, category) => sum + (category.items || []).length, 0);
  $("admin-stats").innerHTML = `
    <span><b>${(menu.categories || []).length}</b>Kategori</span>
    <span><b>${itemCount}</b>Ürün</span>
    <span><b>${(menu.campaigns || []).length}</b>Kampanya</span>`;
}

// --- 6. Menü Verisini Yükleme ---

$("open-menu").insertAdjacentHTML("beforeend", icon("externalLink", 15));
$("filter-search").insertAdjacentHTML("afterbegin", icon("search"));
$("filter-category").insertAdjacentHTML("afterbegin", icon("slidersHorizontal"));
$("item-query").addEventListener("input", renderItems);
$("category-filter").addEventListener("change", renderItems);

// Önce localStorage'da admin tarafından düzenlenmiş veri var mı bakalım
const cached = localStorage.getItem("zz-menu-data");
if (cached) {
  try {
    menu = JSON.parse(cached);
  } catch (err) {}
}

if (!menu.categories || menu.categories.length === 0) {
  const urls = ["/api/admin/menu", "/api/menu.json", "api/menu.json", "../api/menu.json", "data/menu.json", "../data/menu.json"];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        menu = await res.json();
        break;
      }
    } catch (err) {}
  }
}

updateStats();

$("category-filter").innerHTML = `<option value="all">Tüm kategoriler</option>${(menu.categories || [])
  .map((category) => `<option value="${category.id}">${escapeHtml(category.name?.tr || category.name)}</option>`)
  .join("")}`;

renderCampaigns();
renderItems();
