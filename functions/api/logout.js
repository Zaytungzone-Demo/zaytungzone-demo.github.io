import { json } from "../_lib.js";

export function onRequestPost() {
  return json(
    { ok: true },
    { headers: { "set-cookie": "zz_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" } }
  );
}
