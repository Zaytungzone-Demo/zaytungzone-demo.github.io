import { icon } from "./icons.js";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

let menu = { campaigns: [], categories: [] };

function normalizeSearch(value) {
  return value
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
  }).format(priceKurus / 100);

/** "129,90" ya da "129.9" gibi girdileri kuruşa çevirir; geçersizse null. */
function parsePrice(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

function notify(kind, text) {
  $("notice-slot").innerHTML = `<div class="admin-notice ${kind}" role="status">${escapeHtml(text)}<button>×</button></div>`;
  $("notice-slot").querySelector("button").addEventListener("click", () => ($("notice-slot").innerHTML = ""));
}

async function save(url, body, button) {
  button.disabled = true;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  button.disabled = false;

  if (response.status === 401) {
    location.href = "/login";
    return false;
  }
  if (!response.ok) {
    notify("error", (await response.json().catch(() => ({}))).error || "Kaydedilemedi.");
    return false;
  }
  notify("ok", "Değişiklik kaydedildi ve QR menüye yansıdı.");
  return true;
}

// --- Kampanyalar ---

function renderCampaigns() {
  $("campaign-admin-grid").innerHTML = menu.campaigns
    .map(
      (campaign) => `
      <form data-campaign="${campaign.id}">
        <div>
          <span>0${campaign.order}</span>
          <h3>${escapeHtml(campaign.title.tr)}</h3>
          <p>${escapeHtml(campaign.subtitle.tr)}</p>
        </div>
        <div class="campaign-price-fields">
          <label>Normal<input name="original" inputmode="decimal" value="${campaign.originalPriceKurus / 100}" /><i>₺</i></label>
          <label>Kampanya<input name="price" inputmode="decimal" value="${campaign.campaignPriceKurus / 100}" /><i>₺</i></label>
        </div>
        <footer>
          <label class="switch"><input type="checkbox" name="enabled" ${campaign.enabled ? "checked" : ""} /><span></span>Yayında</label>
          <button>${icon("save", 16)}Kaydet</button>
        </footer>
      </form>`
    )
    .join("");
}

$("campaign-admin-grid").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const campaign = menu.campaigns.find((entry) => entry.id === form.dataset.campaign);
  const originalPriceKurus = parsePrice(form.original.value);
  const campaignPriceKurus = parsePrice(form.price.value);

  if (originalPriceKurus === null || campaignPriceKurus === null) {
    return notify("error", "Geçerli kampanya fiyatları girin.");
  }
  const body = { originalPriceKurus, campaignPriceKurus, enabled: form.enabled.checked };
  if (await save(`/api/admin/campaign/${campaign.id}`, body, form.querySelector("button"))) {
    Object.assign(campaign, body);
  }
});

// --- Ürünler ---

function visibleItems() {
  const query = normalizeSearch($("item-query").value);
  const categoryId = $("category-filter").value;
  return menu.categories
    .filter((category) => categoryId === "all" || category.id === categoryId)
    .flatMap((category) => category.items.map((item) => ({ item, category })))
    .filter(({ item, category }) => !query || normalizeSearch(`${item.name.tr} ${category.name.tr}`).includes(query));
}

function renderItems() {
  const rows = visibleItems();
  $("result-count").textContent = `${rows.length} sonuç`;
  const head = $("admin-table").firstElementChild;
  $("admin-table").innerHTML = "";
  $("admin-table").append(head);
  $("admin-table").insertAdjacentHTML(
    "beforeend",
    rows
      .map(
        ({ item, category }) => `
        <form data-item="${item.id}" class="${item.enabled ? "" : "disabled-row"}">
          <div class="admin-item-name">
            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" loading="lazy" width="48" height="48" />` : ""}
            <span><b>${escapeHtml(item.name.tr)}</b><small>${escapeHtml(category.name.tr)}</small></span>
          </div>
          <strong>${formatPrice(item.priceKurus)}</strong>
          <label class="price-input">
            <input name="price" aria-label="${escapeHtml(item.name.tr)} yeni fiyat" inputmode="decimal" value="${item.priceKurus / 100}" /><i>₺</i>
          </label>
          <div class="row-toggles">
            <label><input type="checkbox" name="enabled" ${item.enabled ? "checked" : ""} /> Aktif</label>
            <label><input type="checkbox" name="soldOut" ${item.soldOut ? "checked" : ""} /> Tükendi</label>
          </div>
          <button aria-label="${escapeHtml(item.name.tr)} kaydet">${icon("save", 17)}</button>
        </form>`
      )
      .join("")
  );
}

$("admin-table").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const item = menu.categories.flatMap((category) => category.items).find((entry) => entry.id === form.dataset.item);
  const priceKurus = parsePrice(form.price.value);

  if (priceKurus === null) return notify("error", "Geçerli bir fiyat girin.");

  const body = { priceKurus, enabled: form.enabled.checked, soldOut: form.soldOut.checked };
  if (await save(`/api/admin/item/${item.id}`, body, form.querySelector("button"))) {
    Object.assign(item, body);
    renderItems();
  }
});

// --- Açılış ---

$("logout").innerHTML = icon("logOut", 18);
$("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login";
});
$("open-menu").insertAdjacentHTML("beforeend", icon("externalLink", 15));
$("filter-search").insertAdjacentHTML("afterbegin", icon("search"));
$("filter-category").insertAdjacentHTML("afterbegin", icon("slidersHorizontal"));
$("item-query").addEventListener("input", renderItems);
$("category-filter").addEventListener("change", renderItems);

/* Panel sayfası statik olarak herkese açık; asıl kapı burası. Oturum yoksa sunucu 401
   döner ve giriş sayfasına gideriz — hiçbir menü verisi sızmaz. */
const response = await fetch("/api/admin/menu");
if (response.status === 401) {
  location.replace("/login");
  await new Promise(() => {}); // yönlendirme olurken gerisini çalıştırma
}
menu = await response.json();

const itemCount = menu.categories.reduce((sum, category) => sum + category.items.length, 0);
$("admin-stats").innerHTML = `
  <span><b>${menu.categories.length}</b>Kategori</span>
  <span><b>${itemCount}</b>Ürün</span>
  <span><b>${menu.campaigns.length}</b>Kampanya</span>`;
$("category-filter").innerHTML = `<option value="all">Tüm kategoriler</option>${menu.categories
  .map((category) => `<option value="${category.id}">${escapeHtml(category.name.tr)}</option>`)
  .join("")}`;

renderCampaigns();
renderItems();
