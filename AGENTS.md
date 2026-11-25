# AGENTS.md

Guidance for AI coding agents (Claude Code, Gemini CLI, Codex, etc.) working in
this repo. `CLAUDE.md` and `GEMINI.md` just import this file, so edit this one.

## Project

Shape Match, a game for ages 3 to 6: drag each shape into the outline that
matches. It says the colors and shapes out loud. It is served at
`https://mike.pullen.dev/shape-match/` by the `mtp13/mike.pullen.dev` hub, which
proxies `/shape-match/…` to this repo's Vercel project.

Canvas game in `game.js`. Each level adds a shape (up to 8); from level 3 the
outlines lose their colors. Names are spoken with the browser's speech
synthesis. Always starts at level 1, since siblings share devices.

- **Dev dependencies for tooling are allowed, runtime dependencies are not, and
  there must never be a build step.** The browser loads `game.js` directly as a
  classic `<script>`.
- Every asset path is **relative** (`style.css`, `fonts/…`, `favicon.png`) so
  the game works both on its own Vercel domain and under `/shape-match/` on the
  hub. Never use root-absolute paths like `/style.css`.
- The page loads nothing from third parties. The tests fail on any `http(s)://`
  URL in a `<link>` or `<script>`.

## Commands

```sh
npm test               # node --test tests/*.test.js
npm run format         # prettier --write .
npm run lint           # npm run format:check && npm run lint:html
node --check game.js   # syntax check (CI runs this too)
python3 -m http.server 4321
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, the syntax check
and `npm test` on Node 22 for pull requests and pushes to `master`. Dependabot
opens monthly grouped PRs for the npm dev dependencies and GitHub Actions.

## Layout

| File                                                 | Purpose                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `index.html`                                         | Markup                                                                         |
| `style.css`                                          | Styles, including the `@font-face` rules                                       |
| `game.js`                                            | All game logic                                                                 |
| `fonts/`                                             | Self-hosted Roboto Mono (woff2) and its `OFL.txt` license                      |
| `favicon.svg`, `favicon.png`, `apple-touch-icon.png` | The game's own icon: SVG, a 48×48 PNG fallback, and an opaque 180×180 iOS icon |
| `vercel.json`, `.vercelignore`                       | CSP and cache headers, deploy rule, and deploy exclusion list                  |
| `tests/vercel.test.js`                               | Guards the branch-deployment rule (only `master` deploys)                      |
| `manifest.webmanifest`                               | Home-screen manifest: opens full screen (`display: standalone`)                |
| `tests/site.test.js`                                 | Checks assets, relative paths, the CSP, no inline code, and the phone guards   |

## Phones and tablets

Young kids play this on iPhones, so `game.js` and `style.css` guard against what
little hands do by accident. Keep these when you change the game:

- **Zoom:** `html { touch-action: manipulation }` stops double-tap zoom, a
  `touchend` handler blocks a second tap within 350 ms (except on links and
  buttons), and `gesturestart` is cancelled to stop Safari's pinch zoom.
  `overscroll-behavior: none` stops pull-to-refresh.
- **Back swipes:** a `touchstart` within 24 px of the left or right edge is
  cancelled (except on links and buttons), since that is how Safari's
  back/forward swipe starts. Once a game starts, `guardHistory()` pushes a
  history entry and re-pushes it on `popstate`, so a back swipe that gets
  through lands back on the game. The ← link still leaves.
- **Sound:** iOS only lets audio start from a finished tap (`touchend`/`click`),
  not `pointerdown`, so `wakeAudio()` resumes the `AudioContext` on every
  finished tap and key press.
- **Speech:** `wakeAudio()` also speaks one silent utterance on the first
  finished tap, which iOS requires before any speech. Turning talking on speaks
  "Talking is on!" from that tap (and unmutes if needed), so it works mid-game.
  `say()` only cancels a busy queue, calls `speechSynthesis.resume()` (iOS can
  leave it paused after an interruption) and keeps a reference to the utterance
  so Safari doesn't drop it.
- **Home screen:** `manifest.webmanifest` (`display: standalone`) and the
  `apple-mobile-web-app-capable` meta let the game be added to the Home Screen,
  where it opens full screen with no browser back swipe at all.

## Headers (`vercel.json`)

`/(.*)` gets a strict CSP (`'self'` only, no `'unsafe-inline'`, and
`connect-src 'none'` because the game makes no network requests), `nosniff`,
`Referrer-Policy` and `Permissions-Policy`. Because of the CSP, never add an
inline `<script>`, `<style>` or `style=""` attribute (setting `element.style`
from `game.js` is fine). `/`, `index.html`, `game.js` and `style.css` are sent
with `Cache-Control: public, max-age=0, must-revalidate` so updates show up
straight away.

Only `master` deploys (`git.deploymentEnabled`: keep `"**": false` and
`"master": true`), because the Vercel Hobby plan caps deployments at 100/day.
Test on localhost instead.

## Git & GitHub

- `master` is the default branch. Work on a feature branch (`feat/…`, `fix/…`,
  `chore/…`), run `npm run format`, `npm run lint` and `npm test`, then open a
  pull request against `master`. Never push to `master` directly.
- Push once per unit of work: every push to `master` is a Vercel deployment.
