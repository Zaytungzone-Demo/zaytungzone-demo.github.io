import { icon } from "./icons.js";

/* iOS cihaz + Safari tespiti
   AR Quick Look yalnızca iOS Safari'de çalışır (<a rel="ar"> tricki).
   Chrome (CriOS), Firefox (FxiOS) gibi iOS tarayıcılar WebKit motorunu kullansa
   da Apple bu API'yi yalnızca Safari'ye açmıştır.
   Chrome iOS için: GLB dosyasını window.open ile açıyoruz — iOS bu dosyayı
   sistem seviyesinde AR Quick Look'a devredebiliyor. */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOSSafari = isIOS && /WebKit/.test(navigator.userAgent) &&
  !/CriOS|FxiOS|OPiOS|EdgiOS|GSA/.test(navigator.userAgent);

const SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdfTEeSjdCDmCmWsl8bkBvXCQ2aZigUwUK7K0hbpa0ZEhbtUg/viewform?usp=send_form";
const SOCIAL_URLS = {
  facebook: "https://www.facebook.com/zaytungzone",
  x: "https://x.com/zaytungzone",
  instagram: "https://www.instagram.com/zaytungzone/",
};

const copy = {
  tr: {
    campaigns: "Masanın gündemi",
    campaignEyebrow: "Altı ayrı bahane",
    menu: "Menü",
    search: "Menüde ara",
    searchHint: "Burger, kahve, pizza…",
    noResults: "Bu arama mutfağın gündemine düşmemiş.",
    view3d: "3D Görüntüle",
    soldOut: "Tükendi",
    surveyTitle: "İyi miydi? Kötüyse daha da merak ediyoruz.",
    surveyBody:
      "İki dakikalık ankette bizi değerlendirin. Mutfak ekibi okuyacak, muhasebe de duymuş gibi yapacak.",
    survey: "Bizi Değerlendir",
    footer: "Yemek ciddi iştir. Biz o kadar değiliz.",
    close: "Kapat",
    modelHint: "Sürükleyerek döndür, iki parmakla yakınlaş.",
    changeTheme: "Tema",
    language: "English",
    products: "ürün",
    previousCategories: "Önceki kategoriler",
    nextCategories: "Sonraki kategoriler",
    modelLoading: "3D model yükleniyor…",
    arReady: "Masamda gör",
    arUnavailable: "AR destekli cihazda masamda gör",
  },
  en: {
    campaigns: "Today at the table",
    campaignEyebrow: "Six separate excuses",
    menu: "Menu",
    search: "Search the menu",
    searchHint: "Burger, coffee, pizza…",
    noResults: "The kitchen has not been briefed about that search.",
    view3d: "View in 3D",
    soldOut: "Sold out",
    surveyTitle: "Good? If not, we are even more curious.",
    surveyBody:
      "Rate us in a two-minute survey. The kitchen will read it; accounting will pretend they did.",
    survey: "Rate us",
    footer: "Food is serious business. We are less so.",
    close: "Close",
    modelHint: "Drag to rotate, pinch to zoom.",
    changeTheme: "Theme",
    language: "Türkçe",
    products: "items",
    previousCategories: "Previous categories",
    nextCategories: "Next categories",
    modelLoading: "Loading the 3D model…",
    arReady: "See it on my table",
    arUnavailable: "Needs an AR capable device",
  },
};

const state = {
  locale: "tr",
  theme: "system",
  query: "",
  data: { campaigns: [], categories: [] },
  activeCategory: "",
};

const t = () => copy[state.locale];
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

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

function formatPrice(priceKurus) {
  return new Intl.NumberFormat(state.locale === "tr" ? "tr-TR" : "en-US", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: priceKurus % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(priceKurus / 100);
}

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollTo(id) {
  $(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

function focusSearch() {
  scrollTo("search");
  setTimeout(() => $("menu-search").focus(), 450);
}

// --- Tema & dil ---

function applyTheme() {
  localStorage.setItem("zz-theme", state.theme);
  const dark = state.theme === "dark" || (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = state.theme;
  const button = $("theme-button");
  button.innerHTML =
    state.theme === "light" ? icon("sun", 19) : state.theme === "dark" ? icon("moon", 19) : '<span class="system-theme">A</span>';
  button.setAttribute("aria-label", `${t().changeTheme}: ${state.theme}`);
  button.title = `${t().changeTheme}: ${state.theme}`;
}

function cycleTheme() {
  state.theme = state.theme === "system" ? "light" : state.theme === "light" ? "dark" : "system";
  applyTheme();
}

function toggleLocale() {
  state.locale = state.locale === "tr" ? "en" : "tr";
  localStorage.setItem("zz-locale", state.locale);
  document.documentElement.lang = state.locale;
  renderAll();
}

// --- Bölümler ---

function renderStaticCopy() {
  for (const node of document.querySelectorAll("[data-t]")) node.textContent = t()[node.dataset.t];

  const language = $("language-button");
  language.innerHTML = `${icon("languages", 18)}<span>${state.locale.toUpperCase()}</span>`;
  language.setAttribute("aria-label", `Dil: ${t().language}`);

  const search = $("search-button");
  search.innerHTML = icon("search", 19);
  search.setAttribute("aria-label", t().search);

  $("search-label").innerHTML = `${icon("search", 20)}<span class="sr-only">${escapeHtml(t().search)}</span>`;
  $("menu-search").placeholder = t().searchHint;
  const clear = $("search-clear");
  clear.innerHTML = icon("x", 18);
  clear.setAttribute("aria-label", t().close);

  $("survey-mark").innerHTML = icon("clipboardCheck", 34);
  const survey = $("survey-button");
  survey.href = SURVEY_URL;
  survey.innerHTML = `${escapeHtml(t().survey)}${icon("chevronRight")}`;

  $("social-links").innerHTML = `
    <a href="${SOCIAL_URLS.facebook}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${icon("facebook")}</a>
    <a href="${SOCIAL_URLS.x}" target="_blank" rel="noopener noreferrer" aria-label="X"><b>𝕏</b></a>
    <a href="${SOCIAL_URLS.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${icon("instagram")}</a>`;

  $("bottom-nav").innerHTML = `
    <button data-scroll="campaigns">${icon("badgePercent")}<span>${escapeHtml(t().campaigns.split(" ")[0])}</span></button>
    <button data-scroll="menu">${icon("menu")}<span>${escapeHtml(t().menu)}</span></button>
    <button data-focus-search>${icon("search")}<span>${escapeHtml(t().search.split(" ")[0])}</span></button>
    <a href="${SURVEY_URL}" target="_blank" rel="noopener noreferrer">${icon("clipboardCheck")}<span>${escapeHtml(t().survey)}</span></a>`;
}

function renderCampaigns() {
  $("campaign-count").textContent = String(state.data.campaigns.length).padStart(2, "0");
  $("campaign-grid").innerHTML = state.data.campaigns
    .map(
      (campaign) => `
      <article class="campaign-card">
        <div class="campaign-image ${campaign.imagePosition}">
          <img src="${campaign.imageUrl}" alt="${escapeHtml(campaign.title[state.locale])}" ${campaign.order === 1 ? "" : 'loading="lazy"'} />
          <span class="campaign-number">0${campaign.order}</span>
        </div>
        <div class="campaign-body">
          <div>
            <h2>${escapeHtml(campaign.title[state.locale])}</h2>
            <p>${escapeHtml(campaign.subtitle[state.locale])}</p>
          </div>
          <div class="campaign-prices">
            <del>${formatPrice(campaign.originalPriceKurus)}</del>
            <strong>${formatPrice(campaign.campaignPriceKurus)}</strong>
          </div>
          <button class="primary-button" data-campaign="${campaign.slug}">
            ${icon("box", 18)}${escapeHtml(t().view3d)}${icon("chevronRight", 17)}
          </button>
        </div>
      </article>`
    )
    .join("");
}

function renderCategoryNav() {
  $("category-scroll").innerHTML = state.data.categories
    .map(
      (category) =>
        `<button data-category="${category.slug}" class="${state.activeCategory === category.slug ? "active" : ""}">${escapeHtml(category.name[state.locale])}</button>`
    )
    .join("");
  $("category-prev").innerHTML = icon("chevronLeft", 20);
  $("category-prev").setAttribute("aria-label", t().previousCategories);
  $("category-next").innerHTML = icon("chevronRight", 20);
  $("category-next").setAttribute("aria-label", t().nextCategories);
  updateCategoryArrows();
}

function filteredCategories() {
  const query = normalizeSearch(state.query);
  if (!query) return state.data.categories;
  return state.data.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        normalizeSearch(
          `${item.name.tr} ${item.name.en} ${item.description.tr} ${item.description.en} ${category.name.tr} ${category.name.en}`
        ).includes(query)
      ),
    }))
    .filter((category) => category.items.length > 0);
}

function renderMenu() {
  const categories = filteredCategories();
  $("result-count").textContent = `${categories.reduce((sum, category) => sum + category.items.length, 0)} ${t().products}`;
  $("search-clear").hidden = !state.query;

  $("menu-list").innerHTML = categories.length
    ? categories
        .map(
          (category) => `
        <section class="menu-category" id="category-${category.slug}" data-category-section="${category.slug}">
          <header>
            <div><span>${String(category.order + 1).padStart(2, "0")}</span><h3>${escapeHtml(category.name[state.locale])}</h3></div>
            ${category.tagline[state.locale] ? `<p>“${escapeHtml(category.tagline[state.locale])}”</p>` : ""}
          </header>
          <div class="product-grid">${category.items.map(renderProduct).join("")}</div>
        </section>`
        )
        .join("")
    : `<div class="empty-state">${icon("search", 30)}<p>${escapeHtml(t().noResults)}</p></div>`;

  observeCategories();
}

function renderProduct(item) {
  const name = escapeHtml(item.name[state.locale]);
  const description = item.description[state.locale];
  return `
    <article class="product-card ${item.soldOut ? "sold-out" : ""}">
      ${
        item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${name}" loading="lazy" width="180" height="140" />`
          : `<div class="product-placeholder">${icon("utensils", 24)}</div>`
      }
      <div class="product-copy">
        <div class="product-title"><h4>${name}</h4><strong>${formatPrice(item.priceKurus)}</strong></div>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        ${item.soldOut ? `<span class="sold-out-badge">${escapeHtml(t().soldOut)}</span>` : ""}
      </div>
    </article>`;
}

// 38 kategori şeride sığmıyor. Sayfa kaydıkça sıradaki kategoriyi şeridin ortasına getiriyoruz;
// böylece kullanıcı çubuğu elle sürüklemeden de hepsini görüyor. Yalnız şeridin kendi
// scrollLeft'ini oynatıyoruz, sayfanın dikey konumuna dokunmuyoruz.
function centerActiveCategory() {
  const bar = $("category-scroll");
  const active = bar.querySelector("button.active");
  if (!active) return;
  bar.scrollTo({
    left: active.offsetLeft - bar.clientWidth / 2 + active.offsetWidth / 2,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

// Şerit uçtayken o yöndeki ok sönükleşir. Gizlemiyoruz: düğme imlecin altından kaybolmasın.
function updateCategoryArrows() {
  const bar = $("category-scroll");
  const max = bar.scrollWidth - bar.clientWidth;
  $("category-prev").disabled = bar.scrollLeft <= 2;
  $("category-next").disabled = bar.scrollLeft >= max - 2;
}

// Kaydırdıkça üstteki kategori sekmesi kendini işaretlesin.
let categoryObserver;
function observeCategories() {
  categoryObserver?.disconnect();
  categoryObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const slug = visible.target.dataset.categorySection;
      if (slug === state.activeCategory) return;
      state.activeCategory = slug;
      for (const button of $("category-scroll").children) {
        button.classList.toggle("active", button.dataset.category === state.activeCategory);
      }
      centerActiveCategory();
    },
    { rootMargin: "-28% 0px -58%", threshold: [0, 0.1, 0.5] }
  );
  for (const section of document.querySelectorAll("[data-category-section]")) categoryObserver.observe(section);
}

function renderAll() {
  renderStaticCopy();
  applyTheme();
  renderCampaigns();
  renderCategoryNav();
  renderMenu();
}

// --- 3D / AR kutusu ---

let modelViewerScript;
function loadModelViewer() {
  modelViewerScript ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/model-viewer.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return modelViewerScript;
}

function openCampaign(slug) {
  const campaign = state.data.campaigns.find((entry) => entry.slug === slug);
  if (!campaign) return;

  history.replaceState(null, "", `/kampanya/${campaign.slug}`);
  document.body.classList.add("modal-open");
  $("modal-root").innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <section class="model-modal" role="dialog" aria-modal="true" aria-labelledby="model-title">
        <header>
          <div>
            <span>CAMPAIGN 0${campaign.order}</span>
            <h2 id="model-title">${escapeHtml(campaign.title[state.locale])}</h2>
            <p>${escapeHtml(campaign.subtitle[state.locale])}</p>
          </div>
          <button data-close aria-label="${escapeHtml(t().close)}">${icon("x")}</button>
        </header>
        <div class="model-stage">
          <div class="model-viewer-shell">
            <model-viewer src="${campaign.modelGlbUrl}" alt="${escapeHtml(campaign.title[state.locale])} 3D modeli"
              ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" xr-environment
              camera-controls touch-action="pan-y" shadow-intensity="1" environment-image="neutral"></model-viewer>
            <div class="model-progress">${escapeHtml(t().modelLoading)}</div>
            <button class="ar-button" disabled>${escapeHtml(t().arUnavailable)}</button>
          </div>
        </div>
        <footer>
          <span>${escapeHtml(t().modelHint)}</span>
          <div>
            <del>${formatPrice(campaign.originalPriceKurus)}</del>
            <strong>${formatPrice(campaign.campaignPriceKurus)}</strong>
          </div>
        </footer>
      </section>
    </div>`;

  $("modal-root").querySelector("[data-close]").focus();

  const viewer = $("modal-root").querySelector("model-viewer");
  const progress = $("modal-root").querySelector(".model-progress");
  const arButton = $("modal-root").querySelector(".ar-button");
  arButton.addEventListener("click", () => {
    if (isIOS && !isIOSSafari) {
      /* Chrome / Firefox iOS: GLB'yi yeni sekmede aç,
         iOS bu dosyayı sistem seviyesinde AR Quick Look'a devreder. */
      window.open(campaign.modelGlbUrl, '_blank');
    } else {
      viewer.activateAR?.();
    }
  });

  loadModelViewer().then(() => {
    const ready = () => {
      progress.remove();
      /* canActivateAR Safari'de true döner; iOS Chrome'da false döner ama
         biz yine de butonu enable ediyoruz — click handler farkı yönetiyor. */
      if (viewer.canActivateAR || isIOS) {
        arButton.disabled = false;
        arButton.textContent = t().arReady;
      }
    };
    if (viewer.loaded) ready();
    else viewer.addEventListener("load", ready, { once: true });
  });
}

function closeCampaign() {
  if (!$("modal-root").firstElementChild) return;
  $("modal-root").innerHTML = "";
  document.body.classList.remove("modal-open");
  history.replaceState(null, "", "/");
}

// --- Olaylar ---

document.addEventListener("click", (event) => {
  const campaignButton = event.target.closest("[data-campaign]");
  if (campaignButton) return openCampaign(campaignButton.dataset.campaign);

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) return scrollTo(`category-${categoryButton.dataset.category}`);

  const scrollButton = event.target.closest("[data-scroll]");
  if (scrollButton) return scrollTo(scrollButton.dataset.scroll);

  if (event.target.closest("[data-focus-search]")) return focusSearch();
  if (event.target.closest("[data-close]")) return closeCampaign();
});

// Arka plana tıklayınca kapansın, kutunun içine tıklayınca kapanmasın.
$("modal-root").addEventListener("mousedown", (event) => {
  if (event.target.classList.contains("modal-backdrop")) closeCampaign();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCampaign();
});

for (const [id, yon] of [["category-prev", -1], ["category-next", 1]]) {
  $(id).addEventListener("click", () => {
    const bar = $("category-scroll");
    bar.scrollBy({ left: yon * bar.clientWidth * 0.8, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });
}
$("category-scroll").addEventListener("scroll", updateCategoryArrows, { passive: true });
addEventListener("resize", updateCategoryArrows);

$("language-button").addEventListener("click", toggleLocale);
$("theme-button").addEventListener("click", cycleTheme);
$("search-button").addEventListener("click", focusSearch);
$("search-clear").addEventListener("click", () => {
  state.query = "";
  $("menu-search").value = "";
  renderMenu();
});
$("menu-search").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderMenu();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

// --- Açılış ---

const savedLocale = localStorage.getItem("zz-locale");
if (savedLocale === "tr" || savedLocale === "en") state.locale = savedLocale;
const savedTheme = localStorage.getItem("zz-theme");
if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") state.theme = savedTheme;
document.documentElement.lang = state.locale;

const response = await fetch("/api/menu");
state.data = await response.json();
state.activeCategory = state.data.categories[0]?.slug ?? "";
renderAll();

// QR kodu doğrudan bir kampanyaya bakıyorsa 3D kutusunu açarak başla.
const deepLink = location.pathname.match(/^\/kampanya\/([\w-]+)$/);
if (deepLink) openCampaign(deepLink[1]);
