#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const outputDirectory = resolve(process.argv[2] || "output/bookmark-site");
const [documentHtml, manifestSource, favicon] = await Promise.all([
  readFile("new_tech.html", "utf8"),
  readFile("content/manifest.json", "utf8"),
  readFile("assets/favicon.svg", "utf8"),
]);
const manifest = JSON.parse(manifestSource);
async function embedPageImages(path) {
  let html = await readFile(path, "utf8");
  const sources = new Set(
    Array.from(
      html.matchAll(
        /<img\b[^>]*\bsrc="(assets\/[^"]+\.(?:png|jpg|jpeg|webp))"/gu,
      ),
      (match) => match[1],
    ),
  );
  for (const source of sources) {
    const extension = source.split(".").at(-1);
    const bytes = await readFile(source);
    html = html.replaceAll(
      `src="${source}"`,
      `src="data:image/${extension === "jpg" ? "jpeg" : extension};base64,${bytes.toString("base64")}"`,
    );
  }
  return html;
}
const pageEntries = await Promise.all(
  manifest.days
    .flatMap((day) => day.pages)
    .map(async (page) => [page.file, await embedPageImages(page.file)]),
);
const embeddedContent = JSON.stringify({
  pages: Object.fromEntries(pageEntries),
}).replaceAll("<", "\\u003c");
const result = await build({
  mode: "bookmark",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    write: false,
    minify: true,
    cssCodeSplit: false,
    lib: { entry: resolve("src/main.jsx"), name: "NewTech", formats: ["iife"] },
    rollupOptions: { input: resolve("src/main.jsx") },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap(
  (item) => item.output,
);
const application = output
  .find((item) => item.type === "chunk")
  .code.replaceAll("</script", "<\\/script");
const styles = output
  .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
  .map((item) => item.source)
  .join("\n");
if (!application || !styles)
  throw new Error("Application JavaScript or CSS is missing from the build");
const bundledHtml = documentHtml
  .replace(
    /<link rel="icon"[^>]*>/u,
    () =>
      `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}" type="image/svg+xml">`,
  )
  .replace("</head>", () => `<style>${styles}</style>\n</head>`)
  .replace(
    /<script type="module" src="\/src\/main.jsx"><\/script>/u,
    () =>
      `<script>window.__NEW_TECH_CONTENT__=${embeddedContent};</script>\n<script>${application}</script>`,
  );
if (
  bundledHtml.includes('src="/src/') ||
  /<script\b[^>]*\bsrc=/u.test(bundledHtml)
)
  throw new Error("Bookmark bundle still contains external application assets");
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "new_tech.html"), bundledHtml);
console.log(
  `Built ${resolve(outputDirectory, "new_tech.html")} (${Buffer.byteLength(bundledHtml)} bytes)`,
);
