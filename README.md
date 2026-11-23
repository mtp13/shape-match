# Shape Match

Drag each shape into the outline that matches. It says the colors and shapes out
loud. Made for ages 3 to 6.

**[Play it → mike.pullen.dev/shape-match/](https://mike.pullen.dev/shape-match/)**

## How to play

Drag a shape from the tray into its outline. A wrong outline gives a gentle
boing and the shape slides back.

## Development

There's no build step. Serve the folder over HTTP:

```sh
python3 -m http.server 4321
```

Then open <http://localhost:4321/>.

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `npm ci`         | Install the dev tooling (once)                 |
| `npm test`       | Run the tests with Node's built-in test runner |
| `npm run lint`   | Check formatting (Prettier) and HTML validity  |
| `npm run format` | Format the code with Prettier                  |

## Tech

Plain HTML, CSS and JavaScript with no framework, no runtime dependencies and no
build step. Deployed to [Vercel](https://vercel.com) with a strict
Content-Security-Policy in `vercel.json`, and served on
[mike.pullen.dev](https://mike.pullen.dev) through that site's proxy rewrites.
Roboto Mono is self-hosted in `fonts/` (SIL OFL 1.1, see `fonts/OFL.txt`).
