// Fetches recall data from public government APIs and writes normalized JSON + RSS feeds.
// Run with: node scripts/fetch-recalls.js
// No dependencies — uses built-in fetch (Node 18+).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SITE_URL = 'https://getalysis.github.io/RecallRadar';
const DAYS_BACK = 120; // rolling window fetched each run

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// ---- CPSC (consumer products) ----
async function fetchCPSC() {
  const start = isoDaysAgo(DAYS_BACK);
  const url = `https://www.saferproducts.gov/RestWebServices/Recall?RecallDateStart=${start}&format=json`;
  const raw = await fetchJSON(url);
  return raw.map(r => ({
    id: `cpsc-${r.RecallID}`,
    category: 'consumer-products',
    categoryLabel: 'Consumer Products',
    title: r.Title || (r.Products && r.Products[0] && r.Products[0].Name) || 'Recall',
    date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
    description: r.Description || '',
    url: r.URL || (r.RecallID ? `https://www.cpsc.gov/Recalls/${new Date(r.RecallDate).getFullYear()}` : ''),
    brand: (r.Manufacturers && r.Manufacturers[0] && r.Manufacturers[0].Name) || (r.Products && r.Products[0] && r.Products[0].Name) || '',
    hazard: (r.Hazards && r.Hazards[0] && r.Hazards[0].Name) || '',
    source: 'CPSC'
  })).filter(r => r.date);
}

// ---- NHTSA (vehicles) — pull recent recalls via a curated set of top manufacturers,
// since NHTSA's public API requires make/model/year rather than offering a firehose endpoint. ----
const TOP_MAKES = ['toyota','honda','ford','chevrolet','nissan','jeep','hyundai','kia','subaru','tesla','bmw','mercedes-benz','volkswagen','ram','gmc'];
const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1];

async function fetchModelsForMakeYear(make, year) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  try {
    const raw = await fetchJSON(url);
    return (raw.Results || []).map(m => m.Model_Name);
  } catch (e) {
    return [];
  }
}

async function fetchNHTSAForModel(make, model, year) {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  try {
    const raw = await fetchJSON(url);
    return (raw.results || []).map(r => ({
      id: `nhtsa-${r.NHTSACampaignNumber}-${make}-${model}-${year}`,
      category: 'vehicles',
      categoryLabel: 'Vehicles',
      title: `${year} ${make.charAt(0).toUpperCase()+make.slice(1)} ${model} — ${r.Component || 'Recall'}`,
      date: r.ReportReceivedDate ? normalizeUSDate(r.ReportReceivedDate) : null,
      description: r.Summary || '',
      url: `https://www.nhtsa.gov/recalls?nhtsaId=${r.NHTSACampaignNumber}`,
      brand: r.Manufacturer || make,
      hazard: r.Component || '',
      source: 'NHTSA'
    }));
  } catch (e) {
    return [];
  }
}

function normalizeUSDate(dmy) {
  // NHTSA's recallsByVehicle endpoint returns DD/MM/YYYY, not the US-conventional MM/DD/YYYY.
  const [d, m, y] = dmy.split('/');
  if (!y) return null;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function fetchNHTSA() {
  const makeYearPairs = [];
  for (const make of TOP_MAKES) for (const year of YEARS) makeYearPairs.push({ make, year });

  const modelLists = await mapWithConcurrency(makeYearPairs, 8, async ({ make, year }) => {
    const models = await fetchModelsForMakeYear(make, year);
    return { make, year, models };
  });

  const modelJobs = [];
  for (const { make, year, models } of modelLists) {
    for (const model of models) modelJobs.push({ make, model, year });
  }

  const nested = await mapWithConcurrency(modelJobs, 15, ({ make, model, year }) => fetchNHTSAForModel(make, model, year));
  const all = nested.flat();
  const cutoff = isoDaysAgo(DAYS_BACK);
  return all.filter(r => r.date && r.date >= cutoff);
}

// ---- openFDA (food + drugs + medical devices) ----
async function fetchOpenFDA(endpoint, categorySlug, categoryLabel) {
  const start = isoDaysAgo(DAYS_BACK).replace(/-/g, '');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const url = `https://api.fda.gov/${endpoint}.json?search=report_date:[${start}+TO+${today}]&limit=100&sort=report_date:desc`;
  try {
    const raw = await fetchJSON(url);
    return (raw.results || []).map(r => ({
      id: `fda-${categorySlug}-${r.recall_number || r.event_id || Math.random().toString(36).slice(2)}`,
      category: categorySlug,
      categoryLabel,
      title: r.product_description ? r.product_description.slice(0, 140) : (r.reason_for_recall || 'Recall').slice(0,140),
      date: r.report_date ? `${r.report_date.slice(0,4)}-${r.report_date.slice(4,6)}-${r.report_date.slice(6,8)}` : null,
      description: r.reason_for_recall || '',
      url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
      brand: r.recalling_firm || '',
      hazard: r.classification || '',
      source: 'FDA'
    })).filter(r => r.date);
  } catch (e) {
    return [];
  }
}

function escapeXML(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}

function buildRSS(items, categoryLabel, filename) {
  const entries = items.slice(0, 60).map(r => `
  <item>
    <title>${escapeXML(r.title)}</title>
    <link>${escapeXML(r.url)}</link>
    <guid isPermaLink="false">${escapeXML(r.id)}</guid>
    <pubDate>${new Date(r.date).toUTCString()}</pubDate>
    <description>${escapeXML(r.description).slice(0, 500)}</description>
  </item>`).join('');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>RecallRadar — ${escapeXML(categoryLabel)} Recalls</title>
  <link>${SITE_URL}</link>
  <description>Latest ${escapeXML(categoryLabel)} recalls from official US government sources.</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${entries}
</channel></rss>`;
  fs.writeFileSync(path.join(DATA_DIR, filename), rss);
}

async function main() {
  console.log('Fetching CPSC...');
  const cpsc = await fetchCPSC().catch(e => { console.error('CPSC failed:', e.message); return []; });
  console.log(`  ${cpsc.length} consumer product recalls`);

  console.log('Fetching NHTSA (this takes a bit — many make/year combos)...');
  const nhtsa = await fetchNHTSA().catch(e => { console.error('NHTSA failed:', e.message); return []; });
  console.log(`  ${nhtsa.length} vehicle recalls`);

  console.log('Fetching openFDA food recalls...');
  const food = await fetchOpenFDA('food/enforcement', 'food', 'Food');
  console.log(`  ${food.length} food recalls`);

  console.log('Fetching openFDA drug recalls...');
  const drugs = await fetchOpenFDA('drug/enforcement', 'drugs', 'Drugs & Medical');
  console.log(`  ${drugs.length} drug recalls`);

  console.log('Fetching openFDA device recalls...');
  const devices = await fetchOpenFDA('device/enforcement', 'drugs', 'Drugs & Medical');
  console.log(`  ${devices.length} device recalls`);

  const all = [...cpsc, ...nhtsa, ...food, ...drugs, ...devices]
    .filter(r => r.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  // de-dupe by id
  const seen = new Set();
  const deduped = all.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'recalls.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: deduped.length,
    recalls: deduped
  }, null, 0));

  buildRSS(deduped, 'All', 'rss-all.xml');
  buildRSS(deduped.filter(r => r.category === 'consumer-products'), 'Consumer Products', 'rss-consumer-products.xml');
  buildRSS(deduped.filter(r => r.category === 'vehicles'), 'Vehicles', 'rss-vehicles.xml');
  buildRSS(deduped.filter(r => r.category === 'food'), 'Food', 'rss-food.xml');
  buildRSS(deduped.filter(r => r.category === 'drugs'), 'Drugs & Medical', 'rss-drugs.xml');

  console.log(`\nTotal: ${deduped.length} recalls written to data/recalls.json + 5 RSS feeds.`);
}

main().catch(e => { console.error(e); process.exit(1); });
