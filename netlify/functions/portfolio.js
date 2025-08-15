// netlify/functions/portfolio.js
// Node 18: global fetch var
const SHEET_ID  = "15Pf9r6b8d1AfiP5L4R-nQj9dasVgSxb7lKdVG7pCdXI";
const SHEET_GID = "0"; // ilk sayfa

const IMG_EXT = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;

function firstHttp(s = "") {
  const m = String(s).match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : "";
}
function isHttp(u) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; }
  catch { return false; }
}
function looksLikeDirectImage(u){ return isHttp(u) && IMG_EXT.test(u); }

async function fetchOgImage(pageUrl) {
  try {
    const resp = await fetch(pageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36",
      },
      redirect: "follow",
    });
    const html = await resp.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

async function resolveImage(primary, fallbackPage){
  // 1) CSV'deki image_url alanı
  let u = firstHttp(primary);
  if (looksLikeDirectImage(u)) return u;

  // imgbb / hizliresim gibi SAYFA linkleri → og:image çek
  if (isHttp(u)) {
    const og = await fetchOgImage(u);
    if (looksLikeDirectImage(og)) return og;
  }

  // 2) İlan linkinden og:image dene
  if (isHttp(fallbackPage)) {
    const og2 = await fetchOgImage(fallbackPage);
    if (looksLikeDirectImage(og2)) return og2;
  }

  // 3) Olmadıysa boş bırak → frontende fallback
  return "";
}

function parsePrice(p){ const d=String(p||"").replace(/[^\d]/g,""); return d?Number(d):null; }

async function fetchSheetRows() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;
  const txt = await fetch(url).then(r=>r.text());
  const start = txt.indexOf("{"), end = txt.lastIndexOf("}");
  const json  = JSON.parse(txt.slice(start, end + 1));
  const cols = json.table.cols.map(c => (c.label || "").toLowerCase().trim());
  const rows = json.table.rows.map(r => {
    const obj = {};
    (r.c || []).forEach((cell, i) => obj[cols[i] || `col${i}`] = cell ? (cell.f ?? cell.v ?? "") : "");
    return obj;
  });
  return rows;
}

export async function handler(){
  try{
    const rows = await fetchSheetRows();

    const out = await Promise.all(rows.map(async r => {
      const link = r.link || "";
      const img  = await resolveImage(r.image_url || r.image || "", link);
      return {
        title:   r.title || "",
        price:   r.price || "",
        price_num: parsePrice(r.price),
        district: r.district || "",
        m2:      r.m2 || r["m²"] || "",
        rooms:   r.rooms || "",
        status:  r.status || "",
        link,
        image_url: img // boş gelebilir → frontend fallback
      };
    }));

    return {
      statusCode: 200,
      headers: { "content-type":"application/json; charset=utf-8", "cache-control":"public, max-age=300" },
      body: JSON.stringify(out)
    };
  }catch(e){
    return { statusCode: 500, body: JSON.stringify({error:String(e)}) };
  }
}
