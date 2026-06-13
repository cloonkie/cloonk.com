/* ============================================================
   NYC Soundhood — connect Spotify, get your top 3 neighborhoods.

   Pure client-side. Spotify Authorization Code + PKCE flow:
   no server, no client secret. The access token lives only in
   this tab and is never persisted. Listening data never leaves
   the browser. Results render onto a Mapbox map: top 3 reveal
   one tap at a time (#3 → #1), then a music-match heatmap, then
   a stats drawer slides in from the left.
   ============================================================ */

const CONFIG = {
  SPOTIFY_CLIENT_ID: '10b45912eaaf459cbe4a675ef262bf8e',
  MAPBOX_TOKEN: 'pk.eyJ1IjoiY2xvb25rIiwiYSI6ImNtbjQxdDF1NzA0YXgycXByNXVuMnllYW4ifQ.3NHqjWQmGopsx5Xy1uHkQg',
  SCOPES: 'user-top-read',
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token',
  API: 'https://api.spotify.com/v1',
};

/* redirect_uri must match a Redirect URI registered on the Spotify app
   exactly — including the trailing slash. */
const REDIRECT_URI = location.origin + location.pathname;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ── Sonic families (the 10 buckets every vector is built on) ── */
const BUCKETS = ['hiphop', 'rnbsoul', 'indie', 'rock', 'electronic', 'pop', 'jazzclassical', 'folkcountry', 'latinglobal', 'experimental'];
const FAMILY_LABEL = {
  hiphop: 'hip-hop', rnbsoul: 'R&B & soul', indie: 'indie', rock: 'rock & punk',
  electronic: 'electronic & dance', pop: 'pop', jazzclassical: 'jazz & classical',
  folkcountry: 'folk & country', latinglobal: 'Latin & global', experimental: 'experimental',
};

const GENRE_RULES = [
  ['hiphop',        ['hip hop', 'hip-hop', 'rap', 'drill', 'trap', 'grime', 'crunk', 'phonk']],
  ['rnbsoul',       ['r&b', 'rnb', 'soul', 'funk', 'motown', 'neo soul', 'neo-soul', 'gospel', 'quiet storm', 'new jack', 'doo-wop', 'contemporary r&b', 'alternative r&b', 'bedroom soul', 'go-go', 'p funk', 'p-funk']],
  ['indie',         ['indie', 'bedroom', 'dream pop', 'shoegaze', 'lo-fi', 'lofi', 'art pop', 'indietronica', 'slacker', 'jangle', 'twee', 'chillwave', 'noise pop', 'freak folk', 'etherpop', 'escape room', 'pov:', 'alt z', 'bubblegrunge', 'pixie']],
  ['rock',          ['rock', 'punk', 'metal', 'grunge', ' emo', 'emo ', 'hardcore', 'garage rock', 'garage punk', 'post-punk', 'psych', 'alternative', 'screamo', 'thrash', 'permanent wave', 'new wave', 'no wave', 'britpop', 'math rock', 'noise rock', 'art rock', 'glam', 'shoegaze', 'grindcore', 'metalcore', 'djent', 'stoner', 'sludge']],
  ['electronic',    ['house', 'techno', 'edm', 'electro', 'dance', 'dnb', 'drum and bass', 'dubstep', 'trance', 'electronic', 'electronica', 'rave', 'breakbeat', 'disco', 'synthwave', 'synthpop', 'synth pop', 'big room', 'future bass', 'uk garage', 'garage house', '2-step', 'jersey club', 'jungle', 'downtempo', 'trip hop', 'nu disco', 'hardstyle', 'gabber', 'footwork', 'bass music', 'glitch hop', 'bassline', 'eurodance', 'hyperpop', 'vaporwave']],
  ['pop',           ['pop', 'k-pop', 'j-pop', 'c-pop', 'boy band', 'girl group', 'europop', 'teen pop', 'dance pop', 'electropop', 'viral pop', 'bubblegum', 'metropopolis', 'post-teen', 'candy pop', 'pop rock']],
  ['jazzclassical', ['jazz', 'classical', 'blues', 'swing', 'orchestra', 'bossa', 'baroque', 'opera', 'piano', 'big band', 'bebop', 'ragtime', 'fusion', 'chamber', 'symphony', 'string quartet', 'compositional', 'modern classical', 'cool jazz', 'hard bop', 'vocal jazz', 'smooth jazz', 'free jazz']],
  ['folkcountry',   ['folk', 'country', 'americana', 'singer-songwriter', 'bluegrass', 'roots', 'honky', 'western', 'cowboy', 'alt-country', 'outlaw country', 'nashville', 'red dirt', 'stomp and holler', 'neo-traditional', 'mellow gold']],
  ['latinglobal',   ['latin', 'reggaeton', 'afrobeat', 'afrobeats', 'afro ', 'afropop', 'afroswing', 'caribbean', 'reggae', 'dancehall', 'salsa', 'cumbia', 'bachata', 'soca', 'world', 'bhangra', 'amapiano', 'highlife', 'brazilian', 'mpb', 'arab', 'desi', 'bolly', 'merengue', 'corrido', 'regional mexican', 'sierreno', 'banda', 'flamenco', 'samba', 'baile funk', 'funk carioca', 'gqom', 'kwaito', 'dembow', 'perreo', 'azonto', 'soukous']],
  ['experimental',  ['experimental', 'avant', 'noise', 'ambient', 'idm', 'intelligent dance', 'drone', 'industrial', 'glitch', 'minimalism', 'musique', 'sound art', 'field recording', 'plunderphonics', 'deconstructed']],
];
/* "pop" qualifiers that read as indie texture, not mainstream pop */
const INDIE_POP = ['dream pop', 'bedroom pop', 'art pop', 'indie pop', 'chamber pop', 'jangle pop', 'noise pop', 'psych pop', 'baroque pop', 'sophisti', 'bubblegrunge', 'pixie'];

/* returns family -> accumulated weight for one genre string */
function classifyGenre(g) {
  const s = ' ' + g.toLowerCase() + ' ';
  const hits = {};
  for (const [bucket, keys] of GENRE_RULES) {
    for (const k of keys) {
      if (!s.includes(k)) continue;
      if (bucket === 'pop' && k === 'pop' && INDIE_POP.some(p => s.includes(p))) { hits.indie = (hits.indie || 0) + 1; break; }
      hits[bucket] = (hits[bucket] || 0) + 1;
      break; // one match per family avoids double-counting synonyms
    }
  }
  return hits;
}

/* ── The map. vec is in BUCKETS order; under = how far toward the
   underground end of the dial (0 mainstream → 1 underground).
   lngLat is the neighborhood centroid for Mapbox. ── */
const NEIGHBORHOODS = [
  { name: 'Bushwick', boro: 'Brooklyn', under: 0.85, lngLat: [-73.9214, 40.6944],
    vec: [0.25, 0.2, 0.7, 0.5, 0.9, 0.15, 0.2, 0.1, 0.35, 0.8],
    blurb: 'Warehouse parties behind unmarked doors, a techno set that ends after sunrise, and a gallery in a former auto-body shop.',
    scene: 'House of Yes, Elsewhere, Mood Ring, the loft-rave circuit',
    sound: 'Four-on-the-floor techno, leftfield electronic, art-damaged indie',
    track: 'Something with no chorus and a very long build.' },
  { name: 'Ridgewood', boro: 'Queens', under: 0.9, lngLat: [-73.9057, 40.7005],
    vec: [0.3, 0.25, 0.6, 0.45, 0.9, 0.15, 0.25, 0.15, 0.35, 0.85],
    blurb: "Bushwick's quieter, weirder sibling across the county line — minimal techno in a basement, no line, no photos.",
    scene: 'Nowadays, TV Eye, after-hours lofts',
    sound: 'Hypnotic minimal techno, ambient, experimental electronics',
    track: 'A 12-minute deep cut you found on a niche label.' },
  { name: 'Williamsburg', boro: 'Brooklyn', under: 0.45, lngLat: [-73.9573, 40.7142],
    vec: [0.3, 0.3, 0.9, 0.55, 0.45, 0.6, 0.25, 0.4, 0.25, 0.4],
    blurb: 'The original indie capital, now a little glossier — rooftop shows, record stores, and a band you liked before they blew up.',
    scene: 'Music Hall of Williamsburg, Brooklyn Bowl, Rough Trade alumni',
    sound: 'Indie rock, dream pop, the tasteful end of the charts',
    track: 'A 2010s indie anthem that still slaps.' },
  { name: 'Lower East Side', boro: 'Manhattan', under: 0.55, lngLat: [-73.9843, 40.7153],
    vec: [0.45, 0.4, 0.7, 0.6, 0.7, 0.5, 0.3, 0.25, 0.3, 0.45],
    blurb: 'Tiny venues stacked over cocktail bars, a DJ until 4am, and the constant churn of whatever is next.',
    scene: 'Mercury Lounge, Pianos, Bowery Ballroom, basement DJ sets',
    sound: 'Indie-electronic crossover, nightlife pop, garage',
    track: 'The remix, not the original.' },
  { name: 'East Village', boro: 'Manhattan', under: 0.65, lngLat: [-73.9836, 40.7265],
    vec: [0.3, 0.3, 0.75, 0.95, 0.35, 0.35, 0.4, 0.45, 0.2, 0.55],
    blurb: 'Punk built this neighborhood and never fully left — leather, dive bars, and the ghost of CBGB on every other block.',
    scene: 'The old CBGB corner, Niagara, dive-bar jukeboxes',
    sound: 'Punk, garage rock, post-punk, anything loud and a little mean',
    track: 'Three chords and the truth.' },
  { name: 'Greenwich Village', boro: 'Manhattan', under: 0.45, lngLat: [-73.9990, 40.7335],
    vec: [0.15, 0.4, 0.55, 0.45, 0.15, 0.35, 0.8, 0.95, 0.25, 0.3],
    blurb: 'Folk revival holy ground and a jazz cellar on the corner — the city for people who came here with a guitar and a notebook.',
    scene: 'Village Vanguard, Cafe Wha?, the old Gaslight haunts',
    sound: 'Folk, singer-songwriter, traditional jazz',
    track: 'A confessional ballad, just voice and strings.' },
  { name: 'Harlem', boro: 'Manhattan', under: 0.4, lngLat: [-73.9465, 40.8116],
    vec: [0.7, 0.9, 0.2, 0.2, 0.2, 0.35, 0.95, 0.25, 0.45, 0.25],
    blurb: 'The room where American music keeps getting reinvented — from the Renaissance big bands to Sunday gospel to uptown rap.',
    scene: 'Apollo Theater, Minton’s Playhouse, Showmans',
    sound: 'Jazz, soul, gospel, classic and modern hip-hop',
    track: 'Something with horns and history.' },
  { name: 'Bed-Stuy', boro: 'Brooklyn', under: 0.55, lngLat: [-73.9416, 40.6872],
    vec: [0.95, 0.8, 0.3, 0.2, 0.25, 0.3, 0.4, 0.15, 0.35, 0.2],
    blurb: 'Biggie’s blocks — brownstone stoops, a barbershop playlist, and a hip-hop lineage you can hear from the windows.',
    scene: 'Brooklyn corners that raised a genre, soul-food spots, block parties',
    sound: 'Hip-hop first, soul and R&B close behind',
    track: 'A boom-bap classic that needs no introduction.' },
  { name: 'Crown Heights', boro: 'Brooklyn', under: 0.55, lngLat: [-73.9442, 40.6694],
    vec: [0.6, 0.8, 0.35, 0.2, 0.4, 0.35, 0.45, 0.2, 0.9, 0.3],
    blurb: 'West Indian Day parade energy year-round — soundsystems, roti shops, and a diaspora dancefloor.',
    scene: 'Friends and Lovers, the Eastern Parkway carnival route',
    sound: 'Afrobeats, dancehall, Caribbean, soul',
    track: 'A riddim that fills the street.' },
  { name: 'Washington Heights', boro: 'Manhattan', under: 0.4, lngLat: [-73.9365, 40.8417],
    vec: [0.75, 0.6, 0.25, 0.25, 0.35, 0.45, 0.35, 0.2, 0.95, 0.2],
    blurb: 'Uptown and unapologetically loud — bachata from a passing car, a bodega merengue, the block from "In the Heights."',
    scene: 'Bachata bars, Coogan’s legacy, summer block sound',
    sound: 'Latin — reggaeton, bachata, salsa — with hip-hop on top',
    track: 'A reggaeton hit that turns the corner into a party.' },
  { name: 'Chelsea', boro: 'Manhattan', under: 0.3, lngLat: [-74.0014, 40.7465],
    vec: [0.45, 0.5, 0.4, 0.3, 0.9, 0.8, 0.3, 0.15, 0.4, 0.35],
    blurb: 'Big rooms, big drops, and a club legacy from the Roxy onward — the part of town that still believes in the dancefloor.',
    scene: 'Nightclub mainstays, gallery openings, rooftop DJs',
    sound: 'House, dance-pop, the bright end of electronic',
    track: 'A peak-time anthem with hands in the air.' },
  { name: 'SoHo', boro: 'Manhattan', under: 0.15, lngLat: [-74.0003, 40.7233],
    vec: [0.45, 0.55, 0.45, 0.35, 0.55, 0.9, 0.45, 0.25, 0.3, 0.2],
    blurb: 'Cast-iron storefronts and chart-topping playlists — polished, current, and dressed for the photo.',
    scene: 'Flagship stores, hotel lobbies, the Apple-store-soundtrack of the city',
    sound: 'Mainstream pop, glossy R&B, tasteful crossover',
    track: 'Whatever’s #1 this week, and looking good about it.' },
  { name: 'Park Slope', boro: 'Brooklyn', under: 0.4, lngLat: [-73.9799, 40.6710],
    vec: [0.3, 0.45, 0.75, 0.4, 0.25, 0.4, 0.65, 0.75, 0.3, 0.35],
    blurb: 'Stroller-era indie and a tote bag of vinyl — chamber-folk on the turntable, a kids’ concert in the park, a quiet good taste.',
    scene: 'Barbès, Prospect Park bandshell, the food-co-op aux cord',
    sound: 'Indie folk, chamber pop, mellow jazz',
    track: 'A warm, literate album you play start to finish.' },
  { name: 'Astoria', boro: 'Queens', under: 0.45, lngLat: [-73.9236, 40.7644],
    vec: [0.45, 0.5, 0.55, 0.45, 0.45, 0.5, 0.5, 0.45, 0.75, 0.4],
    blurb: 'The most-everything neighborhood in the most-diverse borough — a beer garden, a Greek taverna, and a different language every block.',
    scene: 'Bohemian Hall beer garden, global supper clubs, the 7-train mix',
    sound: 'Genuinely eclectic — a little of everything, global at the core',
    track: 'A playlist that can’t pick a lane, in the best way.' },
];

/* ── State ── */
let timeRange = 'medium_term';
let accessToken = null;   // kept in memory only (never persisted), for re-fetch
let isDemo = false;

/* ============================================================
   PKCE helpers
   ============================================================ */
function randomString(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map(b => chars[b % chars.length]).join('');
}
async function sha256(str) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); }
function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function beginAuth() {
  if (!CONFIG.SPOTIFY_CLIENT_ID) {
    showNotice(
      `<strong>Spotify connect isn’t configured on this build.</strong> ` +
      `Register an app at <code>developer.spotify.com</code>, add ` +
      `<code>${REDIRECT_URI}</code> as a Redirect URI, paste the Client ID into ` +
      `<code>nyc-soundhood.js</code>, and the button goes live. In the meantime, ` +
      `try <strong>Preview</strong> to see the engine run.`, false);
    return;
  }
  const verifier = randomString(64);
  const challenge = base64url(await sha256(verifier));
  const state = randomString(16);
  sessionStorage.setItem('nsm_verifier', verifier);
  sessionStorage.setItem('nsm_state', state);
  sessionStorage.setItem('nsm_range', timeRange);

  const params = new URLSearchParams({
    client_id: CONFIG.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: CONFIG.SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  location.href = `${CONFIG.AUTH_URL}?${params}`;
}

async function exchangeToken(code) {
  const verifier = sessionStorage.getItem('nsm_verifier');
  const body = new URLSearchParams({
    client_id: CONFIG.SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code, redirect_uri: REDIRECT_URI, code_verifier: verifier,
  });
  const res = await fetch(CONFIG.TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!res.ok) throw new Error('Token exchange failed (' + res.status + '). Check the Client ID and Redirect URI.');
  return (await res.json()).access_token;
}

async function apiGet(token, path) {
  const res = await fetch(CONFIG.API + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 403) throw new Error('Spotify denied access (403). If the app is in development mode, your account must be added to its allowlist.');
  if (!res.ok) throw new Error('Spotify API error (' + res.status + ').');
  return res.json();
}

/* ============================================================
   Handle the redirect back from Spotify
   ============================================================ */
async function handleRedirect() {
  const url = new URLSearchParams(location.search);
  if (url.get('error')) {
    showView('connect'); showNotice('Authorization was cancelled. ' + url.get('error') + '.', true); cleanUrl(); return;
  }
  const code = url.get('code');
  if (!code) return false;
  if (url.get('state') !== sessionStorage.getItem('nsm_state')) {
    showView('connect'); showNotice('Authorization state mismatch — please try connecting again.', true); cleanUrl(); return true;
  }
  timeRange = sessionStorage.getItem('nsm_range') || 'medium_term';
  cleanUrl();
  showView('loading');
  try {
    setLoading('Trading the code for a token…');
    accessToken = await exchangeToken(code);
    isDemo = false;
    setLoading('Pulling your top artists…');
    const artists = await fetchArtists(timeRange);
    setLoading('Mapping your sound onto the city…');
    enterMap(analyze(artists));
  } catch (e) {
    console.error(e); showView('connect'); showNotice(e.message || 'Something went wrong.', true);
  }
  return true;
}
function cleanUrl() { history.replaceState({}, document.title, REDIRECT_URI); }

async function fetchArtists(range) {
  const data = await apiGet(accessToken, `/me/top/artists?limit=50&time_range=${range}`);
  const artists = (data.items || []).map(a => ({
    id: a.id, name: a.name, genres: a.genres || [],
    popularity: typeof a.popularity === 'number' ? a.popularity : 50,
  }));
  if (!artists.length) throw new Error('Spotify returned no top artists for this window. Try a different listening window, or listen a little more first.');

  // Spotify often returns sparse/empty genres per artist, so the genre signal
  // can come up thin. Widen it: pull the artists behind your top tracks and
  // batch-fetch their genres, merging any not already in the top-artist set.
  try {
    const seen = new Set(artists.map(a => a.id));
    const tracks = await apiGet(accessToken, `/me/top/tracks?limit=50&time_range=${range}`);
    const extra = [];
    (tracks.items || []).forEach(t => (t.artists || []).forEach(ar => {
      if (ar.id && !seen.has(ar.id)) { seen.add(ar.id); extra.push(ar.id); }
    }));
    for (let i = 0; i < extra.length && i < 100; i += 50) {
      const r = await apiGet(accessToken, `/artists?ids=${extra.slice(i, i + 50).join(',')}`);
      (r.artists || []).forEach(ar => artists.push({
        id: ar.id, name: ar.name, genres: ar.genres || [],
        popularity: typeof ar.popularity === 'number' ? ar.popularity : 50,
        secondary: true,   // from tracks — counts for genre signal, not the top-artist list
      }));
    }
  } catch (e) { /* top tracks are a bonus; ignore failures */ }
  return artists;
}

/* re-run with a new time frame from inside the drawer, jumping straight to
   the breakdown + heatmap state (no re-reveal). */
async function regenerate(range) {
  timeRange = range;
  syncRangeUI();
  const note = $('#d-range-note');
  try {
    if (note) note.textContent = 'Regenerating…';
    const artists = (isDemo || !accessToken) ? SAMPLE_ARTISTS : await fetchArtists(range);
    enterMap(analyze(artists), true);
    openDrawer();
    if (note) note.textContent = (isDemo || !accessToken) ? 'Sample data ignores the time frame.' : '';
  } catch (e) {
    if (note) note.textContent = e.message || 'Could not regenerate.';
  }
}
function syncRangeUI() {
  $$('#d-range-seg button').forEach(b => b.classList.toggle('active', b.dataset.range === timeRange));
}

/* ============================================================
   The engine
   ============================================================ */
function analyze(artists) {
  const primary = artists.filter(a => !a.secondary);
  const nPrimary = primary.length || 1;
  const vec = Object.fromEntries(BUCKETS.map(b => [b, 0]));
  const genreTally = {};
  let popSum = 0, popN = 0, classifiedW = 0;

  artists.forEach((a, i) => {
    // rank decay over the primary (top) list; track-derived artists count half.
    const rank = a.secondary ? nPrimary : i;
    const w = (1 - Math.min(rank, nPrimary) / (nPrimary + 4) * 0.6) * (a.secondary ? 0.5 : 1);
    if (!a.secondary) { popSum += a.popularity * w; popN += w; }
    a.genres.forEach(g => {
      genreTally[g] = (genreTally[g] || 0) + 1;
      const hits = classifyGenre(g);
      for (const b in hits) { vec[b] += w * hits[b]; classifiedW += w * hits[b]; }
    });
  });

  const avgPop = popN ? popSum / popN : 50;
  // spread the mainstream→underground dial: ~80 popularity reads mainstream (0),
  // ~38 reads underground (1), instead of everyone clustering near the middle.
  const under = clamp((80 - avgPop) / (80 - 38), 0, 1);

  const uVecArr = BUCKETS.map(b => vec[b]);
  const total = uVecArr.reduce((s, x) => s + x, 0) || 1;
  const pct = Object.fromEntries(BUCKETS.map((b, i) => [b, uVecArr[i] / total]));

  const raw = NEIGHBORHOODS.map(h => {
    const cos = cosine(uVecArr, h.vec);             // genre-direction overlap
    const axisFit = 1 - Math.abs(under - h.under);  // mainstream/underground proximity
    return { h, blend: 0.82 * cos + 0.18 * axisFit, contrib: contribution(uVecArr, h.vec) };
  });

  // Rescale the blended scores across all 14 to a meaningful "% out of 100":
  // the best fit lands high (~96), the weakest low (~38), with real spread between.
  const blends = raw.map(r => r.blend);
  const lo = Math.min(...blends), hi = Math.max(...blends);
  const span = (hi - lo) || 1;
  const matches = raw.map(r => {
    const norm = (r.blend - lo) / span;             // 0..1 across the set
    const score = Math.round(38 + norm * 58);       // 38..96 display percentage
    return { h: r.h, score, norm, blend: r.blend, contrib: r.contrib };
  }).sort((a, b) => b.score - a.score);

  const topGenres = Object.entries(genreTally).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([g, c]) => ({ g, c }));
  return { artists: primary, vec, pct, under, avgPop, matches, topGenres, primaryCount: primary.length };
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
function contribution(u, v) {
  return BUCKETS.map((b, i) => ({ b, c: u[i] * v[i] })).sort((x, y) => y.c - x.c).filter(x => x.c > 0);
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function matchReason(m, under) {
  const tops = m.contrib.slice(0, 2).map(x => FAMILY_LABEL[x.b]);
  const axis = under > 0.6 ? 'underground-leaning taste' : under < 0.35 ? 'chart-forward taste' : 'middle-of-the-dial taste';
  if (!tops.length) return `Your ${axis} lands closest to ${m.h.name}.`;
  const fam = tops.length > 1 ? `${tops[0]} and ${tops[1]}` : tops[0];
  return `Your ${fam} listening, plus a ${axis}, maps onto ${m.h.name}.`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================================================
   Map experience
   ============================================================ */
let map = null;
let profile = null;            // current analyzed profile
let revealStep = 0;            // 0..3 reveal taps, then 4 = heatmap shown
let markers = [];              // mapbox markers for revealed top-3
const SOURCES_READY = { ok: false };

/* real neighborhood boundaries (pediacities, carved to our 14) */
let GEO = null;
const geoReady = fetch('data/neighborhoods.geojson')
  .then(r => r.ok ? r.json() : null)
  .then(g => { GEO = g; })
  .catch(() => { GEO = null; });

/* darker classic basemap (dark-v11), light-v11 in light mode */
function mapStyle() {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11';
}
function accentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#39ff14';
}
function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function heatRamp(accent) {
  return ['interpolate', ['linear'], ['heatmap-density'],
    0, 'rgba(0,0,0,0)', 0.2, hexToRgba(accent, 0.28), 0.5, hexToRgba(accent, 0.6), 1, accent];
}
function fillRamp(accent) {
  return ['interpolate', ['linear'], ['get', 'norm'], 0, hexToRgba(accent, 0.18), 0.5, hexToRgba(accent, 0.55), 1, accent];
}

/* merge match scores onto the real boundary polygons, by name */
function buildFeatures() {
  const recByName = {};
  profile.matches.forEach((m) => { recByName[m.h.name] = { m, rank: 0 }; });
  profile.matches.slice(0, 3).forEach((m, i) => { recByName[m.h.name].rank = i + 1; });

  const polys = { type: 'FeatureCollection', features: [] };
  const points = { type: 'FeatureCollection', features: [] };
  GEO.features.forEach(f => {
    const rec = recByName[f.properties.name];
    if (!rec) return;
    const m = rec.m;
    const props = {
      name: m.h.name, boro: m.h.boro,
      score: m.score, norm: m.norm,   // score = 0..100 display %, norm = 0..1 for heatmap
      pct: m.score, rank: rec.rank,
    };
    polys.features.push({ type: 'Feature', properties: props, geometry: f.geometry });
    points.features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: m.h.lngLat } });
  });
  return { polys, points };
}

function addMapData() {
  if (!map || !profile) return;
  if (!GEO) { geoReady.then(() => { if (profile && map) addMapData(); }); return; }  // wait for boundaries
  const { polys, points } = buildFeatures();
  const accent = accentColor();

  if (map.getSource('hoods')) map.getSource('hoods').setData(polys);
  else map.addSource('hoods', { type: 'geojson', data: polys });
  if (map.getSource('hoodpts')) map.getSource('hoodpts').setData(points);
  else map.addSource('hoodpts', { type: 'geojson', data: points });

  const add = (id, def) => { if (!map.getLayer(id)) map.addLayer(def); };

  // faint zone outline for all 14 — the "slices"
  add('hoods-zone', {
    id: 'hoods-zone', type: 'line', source: 'hoods',
    paint: { 'line-color': accent, 'line-width': 1, 'line-opacity': 0.18 },
  });
  // choropleth fill by match score — hidden until heatmap stage
  add('hoods-fill', {
    id: 'hoods-fill', type: 'fill', source: 'hoods',
    paint: { 'fill-color': fillRamp(accent), 'fill-opacity': 0 },
  });
  // revealed top-3 highlight (fill + bold outline), filtered by name
  add('hoods-active-fill', {
    id: 'hoods-active-fill', type: 'fill', source: 'hoods',
    filter: ['in', ['get', 'name'], ['literal', []]],
    paint: { 'fill-color': accent, 'fill-opacity': 0.32 },
  });
  add('hoods-active-line', {
    id: 'hoods-active-line', type: 'line', source: 'hoods',
    filter: ['in', ['get', 'name'], ['literal', []]],
    paint: { 'line-color': accent, 'line-width': 2.5, 'line-opacity': 0.95 },
  });
  // music-match heatmap — hidden until stage 4
  add('heat', {
    id: 'heat', type: 'heatmap', source: 'hoodpts',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'norm'], 0, 0.15, 1, 1],
      'heatmap-intensity': 1.1,
      'heatmap-radius': 70,
      'heatmap-opacity': 0.85,
      'heatmap-color': heatRamp(accent),
    },
  });

  SOURCES_READY.ok = true;
  applyRevealState();
}

/* re-apply current reveal state to layers (after style swaps / re-add) */
function applyRevealState() {
  if (!SOURCES_READY.ok) return;
  // reveal order is #3 → #2 → #1, so after s steps the revealed names are
  // the lowest-ranked s of the top three (matches indices 3-s .. 2).
  const s = Math.min(revealStep, 3);
  const names = profile.matches.slice(3 - s, 3).map(m => m.h.name);
  map.setFilter('hoods-active-fill', ['in', ['get', 'name'], ['literal', names]]);
  map.setFilter('hoods-active-line', ['in', ['get', 'name'], ['literal', names]]);
  if (revealStep >= 4) {
    map.setLayoutProperty('heat', 'visibility', 'visible');
    map.setPaintProperty('hoods-fill', 'fill-opacity', 0.5);
  } else {
    if (map.getLayer('heat')) map.setLayoutProperty('heat', 'visibility', 'none');
    map.setPaintProperty('hoods-fill', 'fill-opacity', 0);
  }
}

function walkCoords(c, fn) {
  if (typeof c[0] === 'number') fn(c);
  else c.forEach(x => walkCoords(x, fn));
}
function allBounds() {
  const b = new mapboxgl.LngLatBounds();
  if (GEO) GEO.features.forEach(f => walkCoords(f.geometry.coordinates, c => b.extend(c)));
  else profile.matches.forEach(m => b.extend(m.h.lngLat));
  return b;
}

function enterMap(p, instant) {
  profile = p;
  revealStep = instant ? 4 : 0;
  markers.forEach(m => m.remove()); markers = [];
  renderDrawer(p);
  showView('map');

  const afterData = () => {
    resetCamera();
    if (instant) revealAllInstant();
  };

  if (!map) {
    mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: 'map',
      style: mapStyle(),
      bounds: allBounds(),
      fitBoundsOptions: { padding: 80 },
      attributionControl: false,
      logoPosition: 'bottom-right',
    });
    map.on('load', () => { addMapData(); afterData(); });
    // theme toggle calls setStyle, which wipes layers — re-add them (DOM
    // markers survive); colors pick up the new theme accent on re-add.
    map.on('style.load', () => { if (profile) addMapData(); });
    map.on('click', () => { if (revealStep < 4) advanceReveal(); });
  } else {
    SOURCES_READY.ok = false;
    if (map.isStyleLoaded()) { addMapData(); afterData(); }
    else map.once('idle', () => { addMapData(); afterData(); });
    map.resize();
  }
  setRevealUI();
  if (!instant) closeDrawer();
}

/* jump straight to the all-revealed + heatmap state (used when regenerating
   from the drawer with a new time frame) */
function revealAllInstant() {
  if (!SOURCES_READY.ok) { geoReady.then(() => setTimeout(revealAllInstant, 50)); return; }
  markers.forEach(m => m.remove()); markers = [];
  profile.matches.slice(0, 3).forEach((m, i) => addMarker(m, i + 1));
  revealStep = 4;
  applyRevealState();
  $('#heat-legend').classList.add('show');
  setRevealUI();
}

function resetCamera() { if (map) map.fitBounds(allBounds(), { padding: 80, duration: 900 }); }

/* frame a single neighborhood's real shape, leaving room for its marker */
function flyToHood(m) {
  const f = GEO && GEO.features.find(x => x.properties.name === m.h.name);
  if (!f) { map.flyTo({ center: m.h.lngLat, zoom: 13.2, duration: 1400, essential: true }); return; }
  const b = new mapboxgl.LngLatBounds();
  walkCoords(f.geometry.coordinates, c => b.extend(c));
  map.fitBounds(b, { padding: { top: 130, bottom: 90, left: 90, right: 90 }, maxZoom: 14.5, duration: 1400, essential: true });
}

function advanceReveal() {
  if (!SOURCES_READY.ok) return;
  if (revealStep >= 4) { openDrawer(); return; }

  if (revealStep < 3) {
    revealStep++;
    const rank = 3 - (revealStep - 1);          // step1→#3, step2→#2, step3→#1
    const m = profile.matches[rank - 1];
    applyRevealState();
    addMarker(m, rank);
    flyToHood(m);
  } else {
    // final tap → heatmap + auto-open drawer
    revealStep = 4;
    applyRevealState();
    resetCamera();
    $('#heat-legend').classList.add('show');
    setTimeout(openDrawer, 1100);
  }
  setRevealUI();
}

function addMarker(m, rank) {
  const el = document.createElement('div');
  el.className = 'hood-marker' + (rank === 1 ? ' is-top' : '');
  el.innerHTML =
    `<span class="hm-rank">${rank}</span>` +
    `<span class="hm-body"><b>${esc(m.h.name)}</b><i>${m.score}% match</i></span>`;
  const mk = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(m.h.lngLat).addTo(map);
  markers.push(mk);
}

function setRevealUI() {
  const btn = $('#reveal-btn');
  if (revealStep === 0)      btn.textContent = 'Tap to reveal my #3';
  else if (revealStep === 1) btn.textContent = 'Tap to reveal my #2';
  else if (revealStep === 2) btn.textContent = 'Tap to reveal my #1';
  else if (revealStep === 3) btn.textContent = 'Show match heatmap';
  else                       btn.textContent = 'See the breakdown';
  $('#reveal-dock').classList.toggle('done', revealStep >= 4);
}

/* ============================================================
   Stats drawer (slides in from the left)
   ============================================================ */
function renderDrawer(p) {
  const top3 = p.matches.slice(0, 3);
  $('#d-matches').innerHTML = top3.map((m, i) => `
    <div class="d-match">
      <span class="d-rank">${i + 1}</span>
      <div class="d-match-body">
        <div class="d-match-top"><b>${esc(m.h.name)}</b><span>${m.score}%</span></div>
        <div class="d-meter"><i style="width:${m.score}%"></i></div>
        <p>${esc(matchReason(m, p.under))} ${esc(m.h.blurb)}</p>
        <dl><dt>Scene</dt><dd>${esc(m.h.scene)}</dd><dt>Sound</dt><dd>${esc(m.h.sound)}</dd></dl>
      </div>
    </div>`).join('');

  const fam = BUCKETS.map(b => ({ b, v: p.pct[b] })).sort((a, b) => b.v - a.v).filter(x => x.v > 0.01);
  $('#d-bars').innerHTML = fam.map(f => `
    <div class="bar-row">
      <span class="lbl">${FAMILY_LABEL[f.b]}</span>
      <div class="bar-track"><i style="width:${Math.round(f.v * 100 / fam[0].v)}%"></i></div>
      <span class="pct">${Math.round(f.v * 100)}%</span>
    </div>`).join('');

  $('#d-axis').style.left = `${Math.round(p.under * 100)}%`;
  $('#d-genres').innerHTML = p.topGenres.length
    ? p.topGenres.map((t, i) => `<span class="chip${i === 0 ? ' chip-top' : ''}"><b>${esc(t.g)}</b><i>${t.c}</i></span>`).join('')
    : '<span class="chip">Spotify tagged no sub-genres for these artists — try the “All time” window.</span>';
  $('#d-artists').innerHTML = p.artists.slice(0, 10).map((a, i) => `
    <div class="row"><span class="i">${String(i + 1).padStart(2, '0')}</span>
      <span class="nm">${esc(a.name)}</span><span class="gn">${esc(a.genres[0] || '')}</span></div>`).join('');
  $('#d-sub').textContent = `Built from your top ${p.artists.length} artists · avg. popularity ${Math.round(p.avgPop)}/100.`;
  syncRangeUI();

  renderDrawer._summary =
    `My NYC Soundhood (cloonk.com):\n` +
    top3.map((m, i) => `${i + 1}. ${m.h.name}, ${m.h.boro} — ${m.score}% match`).join('\n') +
    `\nTaste: ${fam.slice(0, 3).map(f => FAMILY_LABEL[f.b]).join(', ')}.`;
}

function openDrawer() { $('#stats-drawer').classList.add('open'); document.body.classList.add('drawer-open'); }
function closeDrawer() { $('#stats-drawer').classList.remove('open'); document.body.classList.remove('drawer-open'); }
function toggleDrawer() { $('#stats-drawer').classList.contains('open') ? closeDrawer() : openDrawer(); }

/* ============================================================
   Views, notices, loading
   ============================================================ */
function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  if (name === 'map' && map) setTimeout(() => map.resize(), 60);
}
function setLoading(msg) { $('#loading-msg').textContent = msg; }
function showNotice(html, isError) { $('#connect-notice').innerHTML = `<div class="notice ${isError ? 'error' : ''}">${html}</div>`; }

/* ============================================================
   Sample data (preview / no-credentials demo)
   ============================================================ */
const SAMPLE_ARTISTS = [
  { name: 'Four Tet', genres: ['electronica', 'intelligent dance music', 'ambient'], popularity: 62 },
  { name: 'Caribou', genres: ['indietronica', 'chillwave', 'electronica'], popularity: 60 },
  { name: 'Floating Points', genres: ['intelligent dance music', 'electronica', 'minimal techno'], popularity: 55 },
  { name: 'King Krule', genres: ['indie', 'art pop', 'jazz rap'], popularity: 58 },
  { name: 'Yves Tumor', genres: ['experimental', 'art pop', 'alternative rock'], popularity: 54 },
  { name: 'Jamie xx', genres: ['indietronica', 'house', 'uk garage'], popularity: 66 },
  { name: 'Aphex Twin', genres: ['intelligent dance music', 'ambient', 'experimental'], popularity: 61 },
  { name: 'MF DOOM', genres: ['hip hop', 'underground hip hop', 'rap'], popularity: 64 },
  { name: 'Tame Impala', genres: ['psychedelic rock', 'indie', 'neo-psychedelic'], popularity: 80 },
  { name: 'Sampha', genres: ['alternative r&b', 'art pop', 'soul'], popularity: 59 },
  { name: 'Burial', genres: ['dubstep', 'ambient', 'uk garage'], popularity: 52 },
  { name: 'Bonobo', genres: ['electronica', 'downtempo', 'chillwave'], popularity: 63 },
];
function runDemo() {
  isDemo = true; accessToken = null;
  showView('loading'); setLoading('Reading the sample listener…');
  setTimeout(() => enterMap(analyze(SAMPLE_ARTISTS)), 600);
}

/* ============================================================
   Wiring
   ============================================================ */
$('#nav-theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  const apply = () => { root.setAttribute('data-theme', next); if (map) map.setStyle(mapStyle()); };
  if (document.startViewTransition) {
    root.classList.add('theme-switching');
    document.startViewTransition(apply).finished.finally(() => root.classList.remove('theme-switching'));
  } else { apply(); }
  try { localStorage.setItem('cloonk-theme', next); } catch (e) {}
});

$('#range-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (!btn) return;
  $$('#range-seg button').forEach(b => b.classList.toggle('active', b === btn));
  timeRange = btn.dataset.range;
});

$('#connect-btn').addEventListener('click', beginAuth);
$('#demo-btn').addEventListener('click', runDemo);
$('#reveal-btn').addEventListener('click', advanceReveal);
$('#seemore-btn').addEventListener('click', toggleDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
$('#d-range-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-range]');
  if (btn && btn.dataset.range !== timeRange) regenerate(btn.dataset.range);
});
$('#restart-btn').addEventListener('click', () => { closeDrawer(); showView('connect'); $('#connect-notice').innerHTML = ''; });

$$('.how-tip-toggle').forEach(t => t.addEventListener('click', (e) => {
  e.stopPropagation();
  const tip = t.parentElement.querySelector('.how-tip-pop');
  $$('.how-tip-pop.show').forEach(p => { if (p !== tip) p.classList.remove('show'); });
  tip.classList.toggle('show');
}));
document.addEventListener('click', () => $$('.how-tip-pop.show').forEach(p => p.classList.remove('show')));

$('#copy-btn').addEventListener('click', async () => {
  const btn = $('#copy-btn');
  try { await navigator.clipboard.writeText(renderDrawer._summary || '');
    const t = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => (btn.textContent = t), 1600);
  } catch (e) { /* clipboard blocked */ }
});

/* on load: finish an auth redirect if we’re mid-flow */
handleRedirect();
