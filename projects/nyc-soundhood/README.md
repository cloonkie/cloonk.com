# NYC Soundhood

Connect Spotify and get your **top 3 NYC neighborhoods**, matched by ear. Your
real top artists and the micro-genres behind them become a taste fingerprint,
scored against the sonic profile of fourteen neighborhoods. Styled in the
cloonk design system.

**No server, no client secret, nothing stored.** Auth runs on Spotify's PKCE
flow; the access token lives only in the open tab and analysis happens entirely
in the browser.

Live: <https://cloonk.com/projects/nyc-soundhood/>

## How it works

Pure front-end. No build step.

1. **Read the genres** — `GET /v1/me/top/artists` returns up to 50 artists, each
   carrying Spotify's granular genre tags ("brooklyn drill," "bedroom pop,"
   "deep house"). A keyword classifier folds them into ten sonic families:
   hip-hop, R&B & soul, indie, rock & punk, electronic & dance, pop, jazz &
   classical, folk & country, Latin & global, experimental.
2. **Build the fingerprint** — genres are weighted by listening rank (top artists
   count more) into a taste vector; average artist popularity sets a
   mainstream-to-underground axis.
3. **Match the map** — weighted cosine similarity between your vector and each
   neighborhood's, blended with axis proximity, returns the closest three with
   the driving genres named.

Neighborhood profiles (`NEIGHBORHOODS` in `nyc-soundhood.js`) are hand-authored
from each area's musical history and present-day scene — opinionated, not a
survey. The match score paints each neighborhood's **real boundary** on the map
(`data/neighborhoods.geojson`) plus a heatmap weighted by match.

Boundaries are the pediacities NYC neighborhoods dataset, carved to the 14
neighborhoods used here and rounded to 5 decimal places (~1 m) to keep the file
small (~20 KB).

## Enabling the Spotify connection

The matching engine works out of the box via the **Preview** button. To
turn on the real connection:

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add this page's exact URL as a Redirect URI — for production:
   `https://cloonk.com/projects/nyc-soundhood/` (the redirect must match
   character-for-character, trailing slash included). For local testing Spotify
   allows loopback addresses like `http://127.0.0.1:5500/projects/nyc-soundhood/`.
3. Copy the **Client ID** into `CONFIG.SPOTIFY_CLIENT_ID` in `nyc-soundhood.js`.
   No client secret is used — PKCE doesn't need one.

While the app is in **development mode**, Spotify only authorizes accounts you
add to its user allowlist; the API returns `403` for anyone else until you
request an extension. The tool surfaces that case as a readable notice.

> Note: Spotify deprecated the `audio-features` endpoint for new apps, so the
> fingerprint is built from genres and popularity rather than per-track energy /
> valence. No extra scopes beyond `user-top-read` are requested.

```
projects/nyc-soundhood/
├── index.html         # shell: connect / loading / map views
├── nyc-soundhood.css  # cloonk theme ramp + components
├── nyc-soundhood.js   # PKCE auth, genre classifier, matching engine, Mapbox render
└── data/
    └── neighborhoods.geojson  # the 14 neighborhood boundaries
```

## Privacy

There is no backend. The PKCE verifier and OAuth `state` are held in
`sessionStorage` only for the round-trip to Spotify; the access token stays in
tab memory and is never written to storage. No listening data is uploaded,
logged, or shared.
