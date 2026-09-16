(() => {
  const root = document.getElementById("article-root");
  const nav = document.getElementById("daily-nav");
  const crumbs = document.getElementById("crumbs");
  const readTime = document.getElementById("read-time");
  const sidebar = document.getElementById("sidebar");
  const menuButton = document.getElementById("menu-button");
  const sidebarClose = document.getElementById("sidebar-close");
  const scrim = document.getElementById("sidebar-scrim");
  const modeButton = document.getElementById("mode-button");
  const embeddedContent = window.__NEW_TECH_CONTENT__;
  const mobileNavQuery = window.matchMedia("(max-width: 760px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let manifest;
  let pages = [];
  let hasRenderedPage = false;
  let drawerFrame = 0;
  let drawerDrag = null;
  let suppressNextSidebarClick = false;

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
    document.querySelector("meta[name='theme-color']").content = theme === "dark" ? "#141414" : "#ffffff";
    storeTheme(theme);
    modeButton.textContent = theme === "dark" ? "☼" : "◐";
    modeButton.setAttribute("aria-label", theme === "dark" ? "밝은 모드로 전환" : "어두운 모드로 전환");
  }

  const savedTheme = readStoredTheme();
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme || preferredTheme);
  modeButton.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  function sidebarWidth() {
    return sidebar.getBoundingClientRect().width || 286;
  }

  function drawerPosition() {
    const transform = getComputedStyle(sidebar).transform;
    if (!transform || transform === "none") return document.body.classList.contains("nav-open") ? 0 : -sidebarWidth();
    try {
      return new DOMMatrixReadOnly(transform).m41;
    } catch {
      const match = transform.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+)/);
      return match ? Number(match[1]) : -sidebarWidth();
    }
  }

  function drawDrawer(x) {
    const width = sidebarWidth();
    const clamped = Math.max(-width, Math.min(0, x));
    const progress = 1 + clamped / width;
    sidebar.style.transform = `translate3d(${clamped}px, 0, 0)`;
    scrim.style.opacity = String(Math.max(0, Math.min(1, progress)));
  }

  function stopDrawerAnimation() {
    if (drawerFrame) cancelAnimationFrame(drawerFrame);
    drawerFrame = 0;
  }

  function settleDrawer(open) {
    stopDrawerAnimation();
    drawDrawer(open ? 0 : -sidebarWidth());
    document.body.classList.toggle("nav-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    scrim.hidden = !open;
    if (mobileNavQuery.matches) {
      sidebar.inert = !open;
      sidebar.setAttribute("aria-hidden", String(!open));
    }
  }

  function animateDrawer(open, releaseVelocity = 0) {
    if (!mobileNavQuery.matches || reducedMotionQuery.matches) {
      settleDrawer(open);
      return;
    }

    const width = sidebarWidth();
    const target = open ? 0 : -width;
    let position = drawerPosition();
    let velocity = releaseVelocity;

    if (Math.abs(position - target) < .5 && Math.abs(velocity) < 4) {
      settleDrawer(open);
      return;
    }

    stopDrawerAnimation();
    if (open) {
      sidebar.inert = false;
      sidebar.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("nav-open");
    menuButton.setAttribute("aria-expanded", String(open));
    scrim.hidden = false;

    const stiffness = 460;
    const damping = 2 * Math.sqrt(stiffness);
    let previousTime = performance.now();

    const step = now => {
      const dt = Math.min((now - previousTime) / 1000, .032);
      previousTime = now;
      const acceleration = -stiffness * (position - target) - damping * velocity;
      velocity += acceleration * dt;
      position += velocity * dt;
      drawDrawer(position);

      if (Math.abs(position - target) < 1.25 && Math.abs(velocity) < 20) {
        settleDrawer(open);
      } else {
        drawerFrame = requestAnimationFrame(step);
      }
    };
    drawerFrame = requestAnimationFrame(step);
  }

  function toggleNav(open) {
    if (!mobileNavQuery.matches) {
      stopDrawerAnimation();
      sidebar.style.transform = "";
      scrim.style.opacity = "";
      document.body.classList.toggle("nav-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      scrim.hidden = !open;
      return;
    }
    animateDrawer(open);
  }
  menuButton.addEventListener("click", () => toggleNav(true));
  sidebarClose.addEventListener("click", () => toggleNav(false));
  scrim.addEventListener("click", () => toggleNav(false));

  sidebar.addEventListener("pointerdown", event => {
    if (!mobileNavQuery.matches || scrim.hidden || event.button !== 0) return;
    stopDrawerAnimation();
    const position = drawerPosition();
    drawerDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: position,
      dragging: false,
      samples: [{ time: event.timeStamp, position }]
    };
  });

  sidebar.addEventListener("pointermove", event => {
    if (!drawerDrag || drawerDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drawerDrag.startX;
    const dy = event.clientY - drawerDrag.startY;

    if (!drawerDrag.dragging) {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        drawerDrag = null;
        return;
      }
      drawerDrag.dragging = true;
      sidebar.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const position = drawerDrag.startPosition + dx;
    drawDrawer(position);
    drawerDrag.samples.push({ time: event.timeStamp, position: drawerPosition() });
    drawerDrag.samples = drawerDrag.samples.filter(sample => event.timeStamp - sample.time <= 120);
  });

  function finishDrawerDrag(event) {
    if (!drawerDrag || drawerDrag.pointerId !== event.pointerId) return;
    const drag = drawerDrag;
    drawerDrag = null;
    if (!drag.dragging) return;

    const position = drawerPosition();
    const first = drag.samples[0];
    const last = drag.samples.at(-1);
    const elapsed = Math.max(1, last.time - first.time);
    const velocity = (last.position - first.position) / elapsed * 1000;
    const projectedPosition = position + velocity * .22;
    const shouldOpen = projectedPosition > -sidebarWidth() * .5;
    suppressNextSidebarClick = true;
    animateDrawer(shouldOpen, velocity);
  }

  sidebar.addEventListener("pointerup", finishDrawerDrag);
  sidebar.addEventListener("pointercancel", finishDrawerDrag);
  sidebar.addEventListener("click", event => {
    if (!suppressNextSidebarClick) return;
    suppressNextSidebarClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  function syncDrawerToViewport() {
    stopDrawerAnimation();
    const open = document.body.classList.contains("nav-open");
    if (mobileNavQuery.matches) {
      settleDrawer(open);
    } else {
      sidebar.style.transform = "";
      scrim.style.opacity = "";
      document.body.classList.remove("nav-open");
      sidebar.inert = false;
      sidebar.removeAttribute("aria-hidden");
      menuButton.setAttribute("aria-expanded", "false");
      scrim.hidden = true;
    }
  }

  mobileNavQuery.addEventListener?.("change", syncDrawerToViewport);
  window.addEventListener("resize", syncDrawerToViewport, { passive: true });
  window.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !document.body.classList.contains("nav-open")) return;
    toggleNav(false);
    menuButton.focus();
  });
  syncDrawerToViewport();

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

  function updateSsdOffloadCalculator(scope) {
    const calculator = scope.querySelector("[data-ssd-calculator]");
    if (!calculator) return;
    const bytesInput = calculator.querySelector("[data-ssd-bytes]");
    const hitInput = calculator.querySelector("[data-ssd-hit]");
    const rateInput = calculator.querySelector("[data-ssd-rate]");
    const bytesValue = calculator.querySelector("[data-ssd-bytes-value]");
    const hitValue = calculator.querySelector("[data-ssd-hit-value]");
    const rateValue = calculator.querySelector("[data-ssd-rate-value]");
    const bandwidthValue = calculator.querySelector("[data-ssd-bandwidth-value]");
    const bandwidthBar = calculator.querySelector("[data-ssd-bandwidth-bar]");
    const result = calculator.querySelector("[data-ssd-result]");

    const draw = () => {
      const bytesPerToken = Number(bytesInput.value);
      const hitRate = Number(hitInput.value) / 100;
      const tokensPerSecond = Number(rateInput.value);
      const requiredBandwidth = bytesPerToken * (1 - hitRate) * tokensPerSecond;

      bytesValue.textContent = `${bytesPerToken.toFixed(2)} GiB/token`;
      hitValue.textContent = `${Math.round(hitRate * 100)}%`;
      rateValue.textContent = `${tokensPerSecond.toFixed(1)} tok/s`;
      bandwidthValue.textContent = `${requiredBandwidth.toFixed(2)} GiB/s`;
      bandwidthBar.style.width = `${Math.min(100, requiredBandwidth / 8 * 100)}%`;
      bandwidthBar.parentElement.setAttribute("aria-valuenow", Math.min(8, requiredBandwidth).toFixed(2));
      bandwidthBar.parentElement.setAttribute("aria-valuetext", `필요한 지속 읽기 ${requiredBandwidth.toFixed(2)} GiB/s`);

      result.className = requiredBandwidth > 4 ? "sim-result warn" : "sim-result";
      result.textContent = `miss expert만 계산해도 SSD가 지속적으로 ${requiredBandwidth.toFixed(2)} GiB/s를 공급해야 합니다. page fault, 작은 read, dequant, 복사는 이 값에 추가됩니다.`;
    };

    [bytesInput, hitInput, rateInput].forEach(input => input.addEventListener("input", draw));
    draw();
  }

  function initArticle(page) {
    updateMemorySimulator(root);
    updateCacheCalculator(root);
    updateSsdOffloadCalculator(root);
    root.querySelectorAll("a[href^='#']").forEach(link => {
      link.addEventListener("click", () => toggleNav(false));
    });
    document.querySelectorAll(".page-link").forEach(link => link.classList.toggle("active", link.dataset.pageId === page.id));
    const words = root.textContent.replace(/\s+/g, " ").trim().length;
    readTime.textContent = `${Math.max(4, Math.round(words / 430))} MIN READ`;
  }

  function fitArticleHeadings() {
    root.querySelectorAll("h1, h2, h3").forEach(heading => {
      heading.querySelectorAll("br").forEach(br => br.replaceWith(" "));
      heading.style.removeProperty("font-size");
      const available = heading.clientWidth;
      if (!available) return;
      const range = document.createRange();
      range.selectNodeContents(heading);
      const width = range.getBoundingClientRect().width;
      if (width > available) {
        const size = parseFloat(getComputedStyle(heading).fontSize);
        heading.style.fontSize = `${Math.floor(size * (available - 1) / width * 100) / 100}px`;
      }
    });
  }

  let headingWidth = 0;
  new ResizeObserver(([entry]) => {
    if (entry.contentRect.width === headingWidth) return;
    headingWidth = entry.contentRect.width;
    fitArticleHeadings();
  }).observe(root);
  document.fonts.ready.then(fitArticleHeadings);

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

      const renderPage = () => {
        root.innerHTML = `${html}${articleNavigation(page)}`;
        crumbs.textContent = `${page.date.replaceAll("-", ".")} / ${page.index} ${page.title}`;
        document.title = `${page.title} · NEW_TECH`;
        initArticle(page);
        fitArticleHeadings();
      };

      if (hasRenderedPage && document.startViewTransition && !reducedMotionQuery.matches) {
        try {
          const transition = document.startViewTransition(renderPage);
          await transition.updateCallbackDone;
        } catch {
          renderPage();
        }
      } else {
        renderPage();
      }
      hasRenderedPage = true;
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
