#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] || "output/bookmark-site");
const [documentHtml, styles, application, manifestSource, favicon] = await Promise.all([
  readFile("new_tech.html", "utf8"),
  readFile("assets/styles.css", "utf8"),
  readFile("assets/app.js", "utf8"),
  readFile("content/manifest.json", "utf8"),
  readFile("assets/favicon.svg", "utf8"),
]);

const manifest = JSON.parse(manifestSource);
const pagePaths = manifest.days.flatMap(day => day.pages.map(page => page.file));
const pageEntries = await Promise.all(
  pagePaths.map(async path => [path, await readFile(path, "utf8")]),
);
const embeddedContent = JSON.stringify({
  manifest,
  pages: Object.fromEntries(pageEntries),
}).replaceAll("<", "\\u003c");
const embeddedFavicon = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

const bundledHtml = documentHtml
  .replace(/<link rel="icon"[^>]*>/u, `<link rel="icon" href="${embeddedFavicon}" type="image/svg+xml">`)
  .replace(/\s*<link rel="preconnect"[^>]*>\s*/gu, "\n")
  .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/u, "\n")
  .replace(
    /<link rel="stylesheet" href="assets\/styles\.css">/u,
    `  <style>\n${styles}\n  </style>`,
  )
  .replace(
    /<script src="assets\/app\.js" defer><\/script>/u,
    `  <script>window.__NEW_TECH_CONTENT__ = ${embeddedContent};</script>`,
  )
  .replace("</body>", `  <script>\n${application}\n  </script>\n</body>`);

if (bundledHtml.includes('href="assets/styles.css"') || bundledHtml.includes('src="assets/app.js"')) {
  throw new Error("bookmark bundle still contains external application assets");
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "new_tech.html"), bundledHtml);
console.log(`Built ${resolve(outputDirectory, "new_tech.html")} (${Buffer.byteLength(bundledHtml)} bytes)`);
