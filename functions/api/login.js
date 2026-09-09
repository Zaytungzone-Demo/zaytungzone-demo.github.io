import { createSession, json, safeEqual, sessionSecret } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "Sunucu yapılandırılmamış: ADMIN_PASSWORD tanımlı değil." }, { status: 500 });
  }

  const { username = "", password = "" } = await request.json().catch(() => ({}));
  const kullaniciDogru = safeEqual(
    String(username).trim().toLowerCase(),
    (env.ADMIN_USERNAME || "admin").toLowerCase()
  );
  const sifreDogru = safeEqual(String(password), env.ADMIN_PASSWORD);

  if (!kullaniciDogru || !sifreDogru) {
    return json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 });
  }

  const token = await createSession(sessionSecret(env));
  return json(
    { ok: true },
    {
      headers: {
        "set-cookie": `zz_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${12 * 60 * 60}`,
      },
    }
  );
}
