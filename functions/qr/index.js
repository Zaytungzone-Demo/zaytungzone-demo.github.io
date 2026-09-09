// Eski sitenin adresi: basılmış QR kodlar hâlâ /qr'a bakıyor olabilir.
export const onRequestGet = ({ request }) =>
  Response.redirect(new URL("/", request.url).toString(), 301);
