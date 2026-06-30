/* ════════════════════════════════════════════════════════════════════
   Swiss Property Search
   - Static, client-side tool. Data comes from getProperties() below,
     which is the single seam to later swap in a real API / proxy.
   ════════════════════════════════════════════════════════════════════ */

/* ── Swiss cantons (code → name) ── */
const CANTONS = {
  AG: 'Aargau', AI: 'Appenzell Innerrhoden', AR: 'Appenzell Ausserrhoden',
  BE: 'Bern', BL: 'Basel-Landschaft', BS: 'Basel-Stadt', FR: 'Fribourg',
  GE: 'Geneva', GL: 'Glarus', GR: 'Graubünden', JU: 'Jura', LU: 'Lucerne',
  NE: 'Neuchâtel', NW: 'Nidwalden', OW: 'Obwalden', SG: 'St. Gallen',
  SH: 'Schaffhausen', SO: 'Solothurn', SZ: 'Schwyz', TG: 'Thurgau',
  TI: 'Ticino', UR: 'Uri', VD: 'Vaud', VS: 'Valais', ZG: 'Zug', ZH: 'Zürich',
};

/* ── Sample dataset of Swiss properties for sale ──
   Realistic but illustrative. Prices in CHF. */
const PROPERTIES = [
  { id: 'zh-001', title: 'Modern 3.5-room apartment near the lake', type: 'Apartment', canton: 'ZH', city: 'Zürich', price: 1290000, rooms: 3.5, livingSpace: 92, yearBuilt: 2018, description: 'Bright corner flat with balcony, 5 min from Zürichsee.' },
  { id: 'zh-002', title: 'Family house with garden in Küsnacht', type: 'House', canton: 'ZH', city: 'Küsnacht', price: 3450000, rooms: 6.5, livingSpace: 210, yearBuilt: 2005, description: 'Detached house, large garden, lake view, double garage.' },
  { id: 'zh-003', title: 'Compact studio in Zürich Kreis 4', type: 'Apartment', canton: 'ZH', city: 'Zürich', price: 620000, rooms: 1.5, livingSpace: 38, yearBuilt: 1999, description: 'Centrally located, ideal first home or pied-à-terre.' },
  { id: 'zh-004', title: 'Penthouse with rooftop terrace', type: 'Penthouse', canton: 'ZH', city: 'Winterthur', price: 1850000, rooms: 4.5, livingSpace: 138, yearBuilt: 2021, description: 'Top-floor unit with 40 m² terrace and panoramic views.' },
  { id: 'be-001', title: '4.5-room apartment in Bern Länggasse', type: 'Apartment', canton: 'BE', city: 'Bern', price: 980000, rooms: 4.5, livingSpace: 115, yearBuilt: 2010, description: 'Quiet residential area, close to university and old town.' },
  { id: 'be-002', title: 'Chalet near Gstaad', type: 'House', canton: 'BE', city: 'Saanen', price: 2980000, rooms: 5.5, livingSpace: 180, yearBuilt: 1998, description: 'Traditional alpine chalet, ski-in access, fireplace.' },
  { id: 'be-003', title: 'Renovated farmhouse in the Emmental', type: 'House', canton: 'BE', city: 'Langnau', price: 845000, rooms: 6.5, livingSpace: 240, yearBuilt: 1962, description: 'Spacious country home with barn, fully renovated 2019.' },
  { id: 'ge-001', title: 'Elegant apartment in Geneva Eaux-Vives', type: 'Apartment', canton: 'GE', city: 'Geneva', price: 1650000, rooms: 4, livingSpace: 105, yearBuilt: 2012, description: 'High ceilings, near lake and city centre.' },
  { id: 'ge-002', title: 'Lakeside villa in Cologny', type: 'House', canton: 'GE', city: 'Cologny', price: 6900000, rooms: 8, livingSpace: 360, yearBuilt: 2008, description: 'Prestigious villa with pool and direct lake frontage.' },
  { id: 'ge-003', title: 'Studio near international organisations', type: 'Apartment', canton: 'GE', city: 'Geneva', price: 540000, rooms: 1, livingSpace: 32, yearBuilt: 1985, description: 'Compact, well-connected, ideal investment.' },
  { id: 'vd-001', title: '3.5-room flat with Léman view', type: 'Apartment', canton: 'VD', city: 'Lausanne', price: 1120000, rooms: 3.5, livingSpace: 88, yearBuilt: 2016, description: 'Modern building, balcony facing the lake and Alps.' },
  { id: 'vd-002', title: 'Vineyard house in Lavaux', type: 'House', canton: 'VD', city: 'Cully', price: 2350000, rooms: 5.5, livingSpace: 195, yearBuilt: 1978, description: 'Character home amid UNESCO vineyards, terraced garden.' },
  { id: 'vd-003', title: 'New-build apartment in Montreux', type: 'Apartment', canton: 'VD', city: 'Montreux', price: 1390000, rooms: 4.5, livingSpace: 124, yearBuilt: 2023, description: 'Brand new, minergie standard, parking included.' },
  { id: 'vs-001', title: 'Ski apartment in Verbier', type: 'Apartment', canton: 'VS', city: 'Verbier', price: 1750000, rooms: 3.5, livingSpace: 78, yearBuilt: 2014, description: 'Cosy chalet-style flat, walking distance to lifts.' },
  { id: 'vs-002', title: 'Detached house in Sion', type: 'House', canton: 'VS', city: 'Sion', price: 720000, rooms: 5.5, livingSpace: 165, yearBuilt: 1989, description: 'Sunny plot, mountain views, garage and cellar.' },
  { id: 'vs-003', title: 'Building plot near Crans-Montana', type: 'Plot', canton: 'VS', city: 'Lens', price: 480000, rooms: 0, livingSpace: 0, yearBuilt: 0, description: 'Serviced building land of 820 m², south-facing.' },
  { id: 'ti-001', title: 'Apartment with lake view in Lugano', type: 'Apartment', canton: 'TI', city: 'Lugano', price: 1280000, rooms: 4.5, livingSpace: 130, yearBuilt: 2017, description: 'Spacious terrace, communal pool, view over Lake Lugano.' },
  { id: 'ti-002', title: 'Rustico in the Verzasca valley', type: 'House', canton: 'TI', city: 'Sonogno', price: 395000, rooms: 3, livingSpace: 85, yearBuilt: 1920, description: 'Stone-built rustico, renovated, idyllic mountain setting.' },
  { id: 'ti-003', title: 'Penthouse in Locarno', type: 'Penthouse', canton: 'TI', city: 'Locarno', price: 1950000, rooms: 5.5, livingSpace: 175, yearBuilt: 2020, description: 'Two-level penthouse, large terrace, lake panorama.' },
  { id: 'zg-001', title: 'Luxury apartment in Zug', type: 'Apartment', canton: 'ZG', city: 'Zug', price: 2150000, rooms: 4.5, livingSpace: 142, yearBuilt: 2019, description: 'High-end finishes, lake and mountain views, low taxes.' },
  { id: 'zg-002', title: 'Townhouse in Baar', type: 'House', canton: 'ZG', city: 'Baar', price: 1980000, rooms: 5.5, livingSpace: 188, yearBuilt: 2011, description: 'Modern terraced house, garden, near train station.' },
  { id: 'lu-001', title: '3.5-room apartment in Lucerne', type: 'Apartment', canton: 'LU', city: 'Lucerne', price: 890000, rooms: 3.5, livingSpace: 86, yearBuilt: 2008, description: 'Walk to old town and lake, balcony, garage space.' },
  { id: 'lu-002', title: 'House with Pilatus view', type: 'House', canton: 'LU', city: 'Kriens', price: 1450000, rooms: 6.5, livingSpace: 205, yearBuilt: 2002, description: 'Family home, large garden, views to Mt. Pilatus.' },
  { id: 'bs-001', title: 'City apartment in Basel', type: 'Apartment', canton: 'BS', city: 'Basel', price: 760000, rooms: 3.5, livingSpace: 84, yearBuilt: 1996, description: 'Near Rhine and city centre, well maintained building.' },
  { id: 'bs-002', title: 'Attic flat in Kleinbasel', type: 'Penthouse', canton: 'BS', city: 'Basel', price: 1050000, rooms: 4, livingSpace: 110, yearBuilt: 2015, description: 'Bright attic conversion with skylights and terrace.' },
  { id: 'bl-001', title: 'Family house in Binningen', type: 'House', canton: 'BL', city: 'Binningen', price: 1320000, rooms: 5.5, livingSpace: 170, yearBuilt: 1985, description: 'Quiet street, mature garden, tram to Basel nearby.' },
  { id: 'sg-001', title: '4.5-room apartment in St. Gallen', type: 'Apartment', canton: 'SG', city: 'St. Gallen', price: 680000, rooms: 4.5, livingSpace: 108, yearBuilt: 2007, description: 'Spacious flat near the city, parking included.' },
  { id: 'gr-001', title: 'Holiday apartment in Davos', type: 'Apartment', canton: 'GR', city: 'Davos', price: 980000, rooms: 3.5, livingSpace: 72, yearBuilt: 2013, description: 'Ski and hike from the door, south-facing balcony.' },
  { id: 'gr-002', title: 'Engadine house in Pontresina', type: 'House', canton: 'GR', city: 'Pontresina', price: 2750000, rooms: 6.5, livingSpace: 220, yearBuilt: 2000, description: 'Classic Engadine architecture, wellness area, garage.' },
  { id: 'ag-001', title: 'Modern house in Aarau', type: 'House', canton: 'AG', city: 'Aarau', price: 1180000, rooms: 5.5, livingSpace: 178, yearBuilt: 2016, description: 'Energy-efficient new build, garden, two parking spots.' },
  { id: 'ag-002', title: '3.5-room apartment in Baden', type: 'Apartment', canton: 'AG', city: 'Baden', price: 740000, rooms: 3.5, livingSpace: 90, yearBuilt: 2009, description: 'Central location, balcony, close to thermal baths.' },
  { id: 'fr-001', title: 'House in Fribourg old town', type: 'House', canton: 'FR', city: 'Fribourg', price: 990000, rooms: 5.5, livingSpace: 185, yearBuilt: 1955, description: 'Characterful townhouse, renovated, courtyard garden.' },
  { id: 'sz-001', title: 'Lake-view apartment in Schwyz', type: 'Apartment', canton: 'SZ', city: 'Brunnen', price: 1240000, rooms: 4.5, livingSpace: 128, yearBuilt: 2018, description: 'Overlooking Lake Lucerne, large terrace, low taxes.' },
  { id: 'tg-001', title: 'Family house in Frauenfeld', type: 'House', canton: 'TG', city: 'Frauenfeld', price: 870000, rooms: 5.5, livingSpace: 162, yearBuilt: 1992, description: 'Quiet neighbourhood, garden, near schools.' },
  { id: 'ne-001', title: 'Apartment with lake view in Neuchâtel', type: 'Apartment', canton: 'NE', city: 'Neuchâtel', price: 690000, rooms: 4.5, livingSpace: 118, yearBuilt: 2004, description: 'Views over Lake Neuchâtel, balcony, cellar and parking.' },
  { id: 'so-001', title: 'Multi-family investment in Olten', type: 'Multi-family', canton: 'SO', city: 'Olten', price: 2480000, rooms: 0, livingSpace: 520, yearBuilt: 1975, description: '6-unit apartment building, fully let, good yield.' },
];

/* ── Data seam: the only place that produces the dataset ──
   Returns a Promise so a real async source can replace it later. */
function getProperties() {
  return Promise.resolve(PROPERTIES);
}

/* ── Formatting helpers ── */
const chf = new Intl.NumberFormat('de-CH', {
  style: 'currency', currency: 'CHF', maximumFractionDigits: 0,
});

function cantonName(code) {
  return CANTONS[code] || code;
}

/* ── State: results of the last search ── */
let lastResults = [];

/* ── Read the current filter values from the form ── */
function readFilters() {
  const num = (id) => {
    const v = document.getElementById(id).value.trim();
    return v === '' ? null : Number(v);
  };
  const str = (id) => {
    const v = document.getElementById(id).value.trim();
    return v === '' ? null : v;
  };
  return {
    canton: str('f-canton'),
    type: str('f-type'),
    priceMin: num('f-price-min'),
    priceMax: num('f-price-max'),
    roomsMin: num('f-rooms-min'),
    spaceMin: num('f-space-min'),
    yearMin: num('f-year-min'),
  };
}

/* ── Pure filter function over a property list ── */
function search(properties, f) {
  return properties.filter((p) => {
    if (f.canton && p.canton !== f.canton) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.priceMin != null && p.price < f.priceMin) return false;
    if (f.priceMax != null && p.price > f.priceMax) return false;
    if (f.roomsMin != null && p.rooms < f.roomsMin) return false;
    if (f.spaceMin != null && p.livingSpace < f.spaceMin) return false;
    if (f.yearMin != null && p.yearBuilt < f.yearMin) return false;
    return true;
  });
}

/* ── Build the card markup for one property ── */
function cardHtml(p) {
  const specs = [];
  if (p.rooms) specs.push(`${p.rooms} rooms`);
  if (p.livingSpace) specs.push(`${p.livingSpace} m²`);
  if (p.yearBuilt) specs.push(`built ${p.yearBuilt}`);

  return `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card property-card shadow-sm">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge badge-type">${p.type}</span>
            <span class="price">${chf.format(p.price)}</span>
          </div>
          <h3 class="h6 card-title">${p.title}</h3>
          <p class="location mb-1">${p.city}, ${cantonName(p.canton)} (${p.canton})</p>
          <p class="specs mb-2">${specs.join(' · ') || '—'}</p>
          <p class="card-text small text-body-secondary mb-0">${p.description}</p>
        </div>
      </div>
    </div>`;
}

/* ── Render a result list into the page ── */
function render(results) {
  const container = document.getElementById('results');
  const noResults = document.getElementById('no-results');
  const count = document.getElementById('result-count');
  const saveBtn = document.getElementById('save-json');

  container.innerHTML = results.map(cardHtml).join('');

  if (results.length === 0) {
    noResults.classList.remove('d-none');
    count.textContent = 'No properties found';
  } else {
    noResults.classList.add('d-none');
    count.textContent = `${results.length} ${results.length === 1 ? 'property' : 'properties'} found`;
  }

  saveBtn.disabled = results.length === 0;
}

/* ── Export the current results as a downloadable JSON file ── */
function saveAsJson(results, filters) {
  const payload = {
    source: 'Swiss Property Search (fe19.github.io)',
    exportedAt: new Date().toISOString(),
    filters,
    count: results.length,
    properties: results,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swiss-properties-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Populate the canton dropdown ── */
function populateCantons() {
  const select = document.getElementById('f-canton');
  Object.keys(CANTONS).sort((a, b) => cantonName(a).localeCompare(cantonName(b)))
    .forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${cantonName(code)} (${code})`;
      select.appendChild(opt);
    });
}

/* ── Wire up the page ── */
function init() {
  populateCantons();

  const form = document.getElementById('search-form');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const filters = readFilters();
    getProperties().then((all) => {
      lastResults = search(all, filters);
      render(lastResults);
    });
  });

  form.addEventListener('reset', () => {
    lastResults = [];
    document.getElementById('results').innerHTML = '';
    document.getElementById('no-results').classList.add('d-none');
    document.getElementById('result-count').textContent = 'Use the filters above and press Search';
    document.getElementById('save-json').disabled = true;
  });

  document.getElementById('save-json').addEventListener('click', () => {
    if (lastResults.length) saveAsJson(lastResults, readFilters());
  });
}

document.addEventListener('DOMContentLoaded', init);
