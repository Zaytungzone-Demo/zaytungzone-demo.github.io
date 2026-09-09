// Eski kampanya adresi -> yeni kampanya adresi.
export const onRequestGet = ({ request, params }) =>
  Response.redirect(new URL(`/kampanya/${encodeURIComponent(params.slug)}`, request.url).toString(), 301);
