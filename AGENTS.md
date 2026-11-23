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
| `tests/site.test.js`                                 | Checks assets, relative paths, the CSP, and no inline code                     |

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
