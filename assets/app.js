(() => {
  const root = document.getElementById("article-root");
  const nav = document.getElementById("daily-nav");
  const crumbs = document.getElementById("crumbs");
  const readTime = document.getElementById("read-time");
  const menuButton = document.getElementById("menu-button");
  const sidebarClose = document.getElementById("sidebar-close");
  const scrim = document.getElementById("sidebar-scrim");
  const modeButton = document.getElementById("mode-button");
  const embeddedContent = window.__NEW_TECH_CONTENT__;
  let manifest;
  let pages = [];

  function readStoredTheme() {
    try {
      return localStorage.getItem("new-tech-theme");
    } catch {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem("new-tech-theme", theme);
    } catch {
      // Sandboxed bookmark previews intentionally disable storage access.
    }
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    storeTheme(theme);
    modeButton.textContent = theme === "dark" ? "☼" : "◐";
    modeButton.setAttribute("aria-label", theme === "dark" ? "밝은 모드로 전환" : "어두운 모드로 전환");
  }

  const savedTheme = readStoredTheme();
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || preferredTheme);
  modeButton.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  function toggleNav(open) {
    document.body.classList.toggle("nav-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    scrim.hidden = !open;
  }
  menuButton.addEventListener("click", () => toggleNav(true));
  sidebarClose.addEventListener("click", () => toggleNav(false));
  scrim.addEventListener("click", () => toggleNav(false));

  function flattenPages(data) {
    return data.days.flatMap(day => day.pages.map(page => ({ ...page, date: day.date, dateLabel: day.label, dayTitle: day.title })));
  }

  function renderNav(data) {
    nav.innerHTML = data.days.map(day => `
      <section class="day-block" aria-labelledby="day-${day.date}">
        <h2 class="day-heading" id="day-${day.date}">
          <span class="day-date">${day.label}</span>
          <span class="day-topic">${day.title}</span>
        </h2>
        ${day.pages.map(page => `
          <a class="page-link" href="#${page.id}" data-page-id="${page.id}">
            <span class="page-index">${page.index}</span>
            <span>
              <span class="page-name">${page.title}</span>
              <span class="page-subtitle">${page.subtitle}</span>
            </span>
          </a>
        `).join("")}
      </section>
    `).join("");
  }

  function currentId() {
    return location.hash.replace(/^#/, "") || pages[0]?.id;
  }

  function articleNavigation(page) {
    const index = pages.findIndex(item => item.id === page.id);
    const previous = pages[index - 1];
    const next = pages[index + 1];
    if (!previous && !next) return "";
    return `
      <nav class="article-nav" aria-label="이전 및 다음 페이지">
        ${previous ? `<a href="#${previous.id}"><span>← PREVIOUS</span><strong>${previous.title}</strong></a>` : `<span></span>`}
        ${next ? `<a href="#${next.id}"><span>NEXT →</span><strong>${next.title}</strong></a>` : `<span></span>`}
      </nav>
    `;
  }

  function updateMemorySimulator(scope) {
    const simulator = scope.querySelector("[data-memory-simulator]");
    if (!simulator) return;
    const input = simulator.querySelector("input[type='range']");
    const values = simulator.querySelectorAll("[data-ram-value]");
    const ramSegment = simulator.querySelector("[data-ram-segment]");
    const freeSegment = simulator.querySelector("[data-free-segment]");
    const result = simulator.querySelector("[data-memory-result]");
    const checkpoint = 60.8;
    const gpuResident = 28;

    const draw = () => {
      const ram = Number(input.value);
      const offloaded = Math.max(0, checkpoint - gpuResident);
      const headroom = ram - offloaded;
      const usedPct = Math.min(100, offloaded / ram * 100);
      values.forEach(value => { value.textContent = `${ram} GiB`; });
      ramSegment.style.width = `${usedPct}%`;
      freeSegment.style.width = `${Math.max(0, 100 - usedPct)}%`;
      ramSegment.textContent = `${offloaded.toFixed(1)}G weights`;
      freeSegment.textContent = headroom > 12 ? `${headroom.toFixed(1)}G left` : "";

      if (headroom < 8) {
        result.className = "sim-result warn";
        result.textContent = `용량 경고 — 시스템 RAM 여유가 약 ${headroom.toFixed(1)} GiB뿐입니다. OS, page cache, CPU workspace를 넣으면 매우 빡빡합니다.`;
      } else {
        result.className = "sim-result";
        result.textContent = `용량상 여유 약 ${headroom.toFixed(1)} GiB. 구동 가능성은 생기지만 속도는 PCIe·DRAM·expert-cache hit rate가 결정합니다.`;
      }
    };
    input.addEventListener("input", draw);
    draw();
  }

  function updateCacheCalculator(scope) {
    const calculator = scope.querySelector("[data-cache-calculator]");
    if (!calculator) return;
    const samples = calculator.querySelector("[data-cache-samples]");
    const value = calculator.querySelector("[data-cache-value]");
    const bar = calculator.querySelector("[data-cache-bar]");
    const draw = () => {
      const count = Number(samples.value);
      const gib = count * 1024 * 4096 * 3 * 2 / (1024 ** 3);
      const practical = gib * (1.6 / 1.2);
      value.textContent = `${Math.round(practical)} GiB`;
      bar.style.width = `${Math.min(100, practical / 1600 * 100)}%`;
      bar.setAttribute("aria-valuenow", String(Math.round(practical)));
    };
    samples.addEventListener("input", draw);
    draw();
  }

  function initArticle(page) {
    updateMemorySimulator(root);
    updateCacheCalculator(root);
    root.querySelectorAll("a[href^='#']").forEach(link => {
      link.addEventListener("click", () => toggleNav(false));
    });
    document.querySelectorAll(".page-link").forEach(link => link.classList.toggle("active", link.dataset.pageId === page.id));
    const words = root.textContent.replace(/\s+/g, " ").trim().length;
    readTime.textContent = `${Math.max(4, Math.round(words / 430))} MIN READ`;
  }

  async function loadPage({ preserveScroll = false } = {}) {
    const id = currentId();
    const page = pages.find(item => item.id === id) || pages[0];
    if (!page) return;
    if (id !== page.id) history.replaceState(null, "", `#${page.id}`);

    root.setAttribute("aria-busy", "true");
    try {
      let html = embeddedContent?.pages?.[page.file];
      if (typeof html !== "string") {
        const response = await fetch(page.file, { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        html = await response.text();
      }
      root.innerHTML = `${html}${articleNavigation(page)}`;
      crumbs.textContent = `${page.date.replaceAll("-", ".")} / ${page.index} ${page.title}`;
      document.title = `${page.title} · NEW_TECH`;
      initArticle(page);
      if (!preserveScroll) window.scrollTo({ top: 0, behavior: "instant" });
      root.focus({ preventScroll: true });
      toggleNav(false);
    } catch (error) {
      root.innerHTML = `
        <section class="error-state">
          <p class="eyebrow">LOAD ERROR</p>
          <h1>페이지를 불러오지 못했습니다.</h1>
          <p>정적 파일을 직접 열었다면 HTTP 서버에서 <code>new_tech.html</code>을 열어 주세요. (${error.message})</p>
        </section>
      `;
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }

  async function init() {
    try {
      manifest = embeddedContent?.manifest;
      if (!manifest) {
        const response = await fetch("content/manifest.json", { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        manifest = await response.json();
      }
      pages = flattenPages(manifest);
      renderNav(manifest);
      await loadPage();
    } catch (error) {
      root.innerHTML = `
        <section class="error-state">
          <p class="eyebrow">MANIFEST ERROR</p>
          <h1>목차를 불러오지 못했습니다.</h1>
          <p><code>python3 -m http.server 8000 --bind 0.0.0.0</code>로 실행한 뒤 다시 접속해 주세요. (${error.message})</p>
        </section>
      `;
    }
  }

  window.addEventListener("hashchange", () => loadPage());
  init();
})();
