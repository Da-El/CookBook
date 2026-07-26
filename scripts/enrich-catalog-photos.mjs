/**
 * Attach real food photos from Wikimedia Commons to catalog.json.
 *
 * Uses free Commons images (real photos of foods/ingredients).
 * Not USDA lab photos — Foundation Foods has no official image set.
 * Attribution stored per food for credit.
 *
 * Usage: node scripts/enrich-catalog-photos.mjs
 *        node scripts/enrich-catalog-photos.mjs --force   # re-fetch even if picture set
 *        node scripts/enrich-catalog-photos.mjs --limit 20
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "apps", "web", "public", "data", "catalog.json");

const UA = "CookBook/1.0 (https://github.com/Da-El/grok-cookbook; ingredient catalog enrichment)";
const API = "https://commons.wikimedia.org/w/api.php";

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Turn "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw" into search terms */
function searchQueries(name) {
  let s = String(name || "")
    .replace(/\s+/g, " ")
    .trim();
  // Drop USDA preparation noise
  s = s
    .replace(/\b(raw|cooked|boiled|roasted|grilled|fried|commercial|frozen|canned|drained|with skin|skinless|boneless|meat only|meat and skin)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const firstComma = s.split(",")[0].trim();
  const queries = [];
  if (firstComma) queries.push(`${firstComma} food`);
  if (firstComma && firstComma.length > 3) queries.push(firstComma);
  // Second segment sometimes is the real food ("Apples, raw, with skin" → already first)
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[1].length > 3) {
    queries.push(`${parts[0]} ${parts[1]} food`);
  }
  return [...new Set(queries)];
}

async function commonsSearch(query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6", // File
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return [];
  return Object.values(pages)
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const mime = (info.mime || "").toLowerCase();
      if (!mime.startsWith("image/")) return null;
      if (mime.includes("svg")) return null; // prefer photos
      // Prefer photographs
      const ext = info.extmetadata || {};
      const artist = ext.Artist?.value || ext.Credit?.value || "";
      const license = ext.LicenseShortName?.value || ext.License?.value || "Wikimedia Commons";
      return {
        title: p.title,
        url: info.thumburl || info.url,
        full: info.url,
        mime,
        width: info.thumbwidth || info.width,
        artist: String(artist).replace(/<[^>]+>/g, "").slice(0, 200),
        license: String(license).replace(/<[^>]+>/g, "").slice(0, 80),
        page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      };
    })
    .filter(Boolean);
}

function scoreHit(hit, queryCore) {
  const t = (hit.title || "").toLowerCase();
  const q = queryCore.toLowerCase();
  let s = 0;
  if (t.includes(q)) s += 50;
  for (const w of q.split(/\s+/).filter((x) => x.length > 2)) {
    if (t.includes(w)) s += 10;
  }
  // Prefer larger thumbs
  if ((hit.width || 0) >= 400) s += 5;
  // Prefer jpeg photos
  if ((hit.mime || "").includes("jpeg") || (hit.mime || "").includes("jpg")) s += 3;
  // Penalize diagrams / logos
  if (/logo|icon|diagram|chart|map|flag|svg|symbol|text/i.test(t)) s -= 40;
  return s;
}

async function findPhoto(name) {
  const queries = searchQueries(name);
  const core = queries[0]?.replace(/\s+food$/i, "") || name;
  let best = null;
  let bestScore = -Infinity;
  const candidates = [];

  for (const q of queries.slice(0, 2)) {
    await sleep(120);
    let hits = [];
    try {
      hits = await commonsSearch(q);
    } catch (e) {
      console.warn("  search fail", q, e.message);
      continue;
    }
    for (const h of hits) {
      const sc = scoreHit(h, core);
      candidates.push(h);
      if (sc > bestScore) {
        bestScore = sc;
        best = h;
      }
    }
    if (bestScore >= 40) break;
  }

  if (!best || bestScore < 5) return null;
  return {
    picture: best.url,
    picture_candidates: [...new Set([best.url, best.full, ...candidates.slice(0, 4).map((c) => c.url)])].filter(Boolean),
    picture_attribution: {
      source: "Wikimedia Commons",
      title: best.title,
      license: best.license,
      artist: best.artist,
      page: best.page,
    },
  };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const foods = catalog.foods || [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let n = 0;

  for (const food of foods) {
    if (n >= limit) break;
    n++;
    if (!force && food.picture) {
      skipped++;
      continue;
    }
    process.stdout.write(`[${n}/${Math.min(foods.length, limit)}] ${food.name.slice(0, 50)}… `);
    try {
      const photo = await findPhoto(food.name);
      if (photo) {
        food.picture = photo.picture;
        food.picture_candidates = photo.picture_candidates;
        food.picture_attribution = photo.picture_attribution;
        updated++;
        console.log("ok");
      } else {
        failed++;
        console.log("no match");
      }
    } catch (e) {
      failed++;
      console.log("err", e.message);
    }
    // checkpoint every 25
    if (updated > 0 && updated % 25 === 0) {
      fs.writeFileSync(catalogPath, JSON.stringify(catalog));
      console.log("  checkpoint saved");
    }
  }

  catalog.generated_at = new Date().toISOString();
  catalog.photos = {
    source: "Wikimedia Commons",
    enriched_at: new Date().toISOString(),
    updated,
    skipped,
    failed,
  };
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`);
  console.log("Wrote", catalogPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
