// netlify/functions/portfolio.js
// Not: Node 18'de global fetch var, extra paket gerekmez.

const SHEET_ID  = "15Pf9r6b8d1AfiP5L4R-nQj9dasVgSxb7lKdVG7pCdXI"; // senin sheet id
const SHEET_GID = "0"; // ilk sayfa

function firstHttp(s = "") {
  const m = String(s).match(/https?:\/\/[^\s"')\]]+/i);
  return m ? m[0] : "";
}
function isHttp(u) {
  try { const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:"; }
  catch { return false; }
}

async function fetchSheetRows() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;
  const txt = await fetch(url).then(r => r.text());
  const start = txt.indexOf("{");
  const end   = txt.lastIndexOf("}");
  const json  = JSON.parse(txt.slice(start, end + 1));

  const cols = json.table.cols.map(c => (c.label || "").toLowerCase().trim());
  const rows = json.table.rows.map(r => {
    const obj = {};
    (r.c || []).forEach((cell, i) => {
      obj[cols[i] || `col${i}`] = cell ? (cell.f ?? cell.v ?? "") : "";
    });
    return obj;
  });
  return rows;
}

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

function parsePrice(p) {
  const digits = String(p || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export async function handler() {
  try {
    const rows = await fetchSheetRows();

    const out = await Promise.all(
      rows.map(async (r) => {
        const link = r.link || "";
        let img = firstHttp(r.image_url || r.image || "");

        // image_url boş/bozuksa linkten og:image çek
        if (!isHttp(img) || !/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(img)) {
          if (isHttp(link)) {
            const og = await fetchOgImage(link);
            if (isHttp(og)) img = og;
          }
        }

        return {
          title: r.title || "",
          price: r.price || "",
          price_num: parsePrice(r.price),
          district: r.district || "",
          m2: r.m2 || r["m²"] || "",
          rooms: r.rooms || "",
          status: r.status || "",
          link,
          image_url: img || "",
        };
      })
    );

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
      body: JSON.stringify(out),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}
