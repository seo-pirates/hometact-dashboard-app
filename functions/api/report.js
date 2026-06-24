// Cloudflare Pages Function: GA4 / Search Console プロキシ（サービスアカウント認証）
// POST /api/report
//   body: { reports: [ <GA4 runReport request body> ... ], gsc: [ <GSC searchAnalytics body> ... ] }
//   resp: { reports: [ <runReport response> ... ], gsc: [ {rows:[...]} ... ] }
//
// 必要な環境変数（Cloudflare Pages の Settings > Environment variables / Secrets）:
//   GA_SA_KEY    … サービスアカウントJSONキーの中身そのまま（Secret推奨）
//   GA4_PROPERTY … 例: 533729605
//   GSC_SITE     … 例: https://hometact.biz/

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const token = await getAccessToken(env);
    const prop = env.GA4_PROPERTY || "533729605";
    const out = { reports: [], gsc: [] };

    for (const rep of (body.reports || [])) {
      const r = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`,
        { method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(rep) });
      out.reports.push(await r.json());
    }

    if (body.gsc && body.gsc.length) {
      const site = encodeURIComponent(env.GSC_SITE || "https://hometact.biz/");
      for (const q of body.gsc) {
        const r = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
          { method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(q) });
        out.gsc.push(await r.json());
      }
    }

    return json(out);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// ---- Google サービスアカウント認証（JWT署名→アクセストークン） ----
let _tok = null, _exp = 0;
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && now < _exp - 60) return _tok;
  if (!env.GA_SA_KEY) throw new Error("GA_SA_KEY (service account JSON) is not set");
  const sa = JSON.parse(env.GA_SA_KEY);
  const scope = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ].join(" ");
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await resp.json();
  if (!j.access_token) throw new Error("token error: " + JSON.stringify(j));
  _tok = j.access_token; _exp = now + (j.expires_in || 3600);
  return _tok;
}

function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function importPkcs8(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", raw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
