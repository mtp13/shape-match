const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("style.css");

const refs = [
  ...html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)="([^"]+)"/g),
].map((m) => m[1]);

describe("index.html", () => {
  it("loads only local files, by relative path, that exist", () => {
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      assert.doesNotMatch(ref, /^(https?:)?\/\//, `${ref} is not local`);
      assert.ok(!ref.startsWith("/"), `${ref} must be relative`);
      assert.ok(fs.existsSync(path.join(root, ref)), `Missing ${ref}`);
    }
  });

  it("has no inline scripts or styles, which the CSP blocks", () => {
    assert.doesNotMatch(html, /<script>|<style|\sstyle="|\son\w+="/);
  });
});

function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  assert.equal(buf.toString("ascii", 12, 16), "IHDR", `${file} is not a PNG`);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

describe("icons", () => {
  it("declares PNG icon sizes that match the files", () => {
    const icons = [
      ...html.matchAll(
        /<link\b[^>]*\bsizes="(\d+x\d+)"[^>]*\bhref="([^"]+\.png)"/g,
      ),
    ];
    assert.ok(icons.length >= 2);
    for (const [, sizes, href] of icons)
      assert.equal(pngSize(href), sizes, href);
  });

  it("has an SVG favicon", () => {
    assert.match(
      html,
      /<link rel="icon" type="image\/svg\+xml" href="favicon.svg"/,
    );
    assert.match(read("favicon.svg"), /^<svg\b[^>]*viewBox="0 0 64 64"/);
  });
});

describe("style.css", () => {
  it("loads its fonts from local woff2 files that exist", () => {
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    assert.ok(urls.length > 0);
    for (const url of urls) {
      assert.ok(!url.startsWith("/"), `${url} must be relative`);
      const buf = fs.readFileSync(path.join(root, url));
      assert.equal(buf.toString("ascii", 0, 4), "wOF2", `${url} is not woff2`);
    }
  });

  it("ships the font's OFL license next to the font files", () => {
    assert.match(read("fonts/OFL.txt"), /SIL Open Font License/);
  });
});

describe("vercel.json headers", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const all = vercel.headers.find((r) => r.source === "/(.*)");

  it("sends a strict CSP on every file", () => {
    const csp = all.headers.find(
      (h) => h.key === "Content-Security-Policy",
    ).value;
    assert.doesNotMatch(csp, /unsafe-|https?:|\*/);
    for (const directive of [
      "default-src 'self'",
      "font-src 'self'",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ]) {
      assert.ok(csp.includes(directive), `CSP is missing ${directive}`);
    }
  });

  it("sends nosniff on every file", () => {
    const value = all.headers.find(
      (h) => h.key === "X-Content-Type-Options",
    ).value;
    assert.equal(value, "nosniff");
  });
});

describe(".vercelignore", () => {
  it("keeps tooling and docs off the deployed site", () => {
    const ignored = read(".vercelignore").split("\n");
    for (const entry of ["package.json", "AGENTS.md", "tests/"]) {
      assert.ok(ignored.includes(entry), `${entry} is not ignored`);
    }
  });
});
