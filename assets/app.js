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

  function initQuantStudy(container) {
    const study = container.querySelector('[data-quant-study]');
    if (!study) return;
    const find = selector => study.querySelector(selector);
    const all = selector => [...study.querySelectorAll(selector)];
    const blue = '#71c9ff', yellow = '#ffe18b', purple = '#c3a5ff';
    const line = (x1, y1, x2, y2, color = '#465973', extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
    const circle = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
    const label = (x, y, value, color) => `<text x="${x}" y="${y}"${color ? ` style="fill:${color}"` : ''}>${value}</text>`;
    const values = [-.83, -.61, -.38, -.21, -.07, .08, .19, .36, .59, .88];
    const px = value => 40 + (value + 1) * 300;
    let snapped = false;
    find('[data-q-original]').innerHTML = values.map((w, i) => circle(px(w), 70 + (i % 3) * 24, 5, 'none', `stroke="${blue}" stroke-width="2"`)).join('');
    find('[data-q-points]').innerHTML = values.map((w, i) => circle(px(w), 70 + (i % 3) * 24, 5, blue, 'class="q-point"')).join('');
    function drawRound() {
      const bits = Number(find('#q-bits').value), count = 2 ** bits;
      const quantized = values.map(w => -1 + Math.round((w + 1) / 2 * (count - 1)) * 2 / (count - 1));
      find('#q-bits-value').value = bits;
      find('[data-q-grid]').innerHTML = line(40, 160, 640, 160) + Array.from({ length: count }, (_, i) => line(40 + i * 600 / (count - 1), 40, 40 + i * 600 / (count - 1), 169, yellow, 'opacity=".35"')).join('');
      find('[data-q-errors]').innerHTML = snapped ? values.map((w, i) => line(px(w), 70 + (i % 3) * 24, px(quantized[i]), 70 + (i % 3) * 24, yellow, 'stroke-width="2"')).join('') : '';
      all('[data-q-points] circle').forEach((point, i) => {
        point.setAttribute('cx', px(snapped ? quantized[i] : values[i]));
        point.setAttribute('fill', snapped ? yellow : blue);
      });
      const mse = quantized.reduce((sum, w, i) => sum + (w - values[i]) ** 2, 0) / values.length;
      find('[data-q-round-result]').textContent = `${bits}비트 → ${count}개 눈금. ${snapped ? `이 예제의 평균 제곱 오차는 ${mse.toFixed(5)}.` : '버튼을 누르면 파란 점이 가장 가까운 눈금으로 이동한다.'}`;
      find('[data-q-snap]').setAttribute('aria-pressed', String(snapped));
      find('[data-q-snap]').textContent = snapped ? '원래 값으로 되돌리기' : '격자에 맞추기';
    }
    find('#q-bits').addEventListener('input', drawRound);
    find('[data-q-snap]').addEventListener('click', () => { snapped = !snapped; drawRound(); });
    drawRound();

    find('[data-q-blocks]').innerHTML = Array.from({ length: 8 }, (_, i) => `<button type="button" class="q-block" data-q-block="${i}" aria-pressed="false" aria-label="블록 ${i + 1}, 가중치 32개">블록 ${i + 1}<span class="q-dots" aria-hidden="true">${'<i></i>'.repeat(32)}</span></button>`).join('');
    function chooseBlock(index) {
      all('[data-q-block]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      find('[data-q-block-result]').textContent = `블록 ${index + 1}: 가중치 ${index * 32 + 1}–${(index + 1) * 32}번. 4비트 번호 32개 + 6비트 배율 + 6비트 최솟값 정보. 상위 FP16 배율 두 개는 전체 8개 블록이 공유한다.`;
    }
    all('[data-q-block]').forEach((button, i) => button.addEventListener('click', () => chooseBlock(i)));
    chooseBlock(0);

    const iqLevels = [-127, -104, -83, -65, -49, -35, -22, -10, 1, 13, 25, 38, 53, 69, 89, 113];
    const levelX = value => 40 + (value + 127) * 2.5;
    const distribution = Array.from({ length: 101 }, (_, i) => {
      const w = -127 + i * 2.4;
      return `${i ? 'L' : 'M'}${levelX(w)},${175 - 120 * Math.exp(-w * w / (2 * 32 ** 2))}`;
    }).join(' ');
    find('[data-q-distribution]').innerHTML = `<path d="${distribution} L640,175 L40,175 Z" fill="${blue}" opacity=".1"/>` + line(40, 175, 640, 175);
    find('[data-q-level-ticks]').innerHTML = iqLevels.map(() => line(40, 40, 40, 185, yellow, 'class="q-tick" stroke-width="2"')).join('');
    function drawLevels(mode) {
      const levels = mode === 'iq' ? iqLevels : Array.from({ length: 16 }, (_, i) => -127 + i * 16);
      all('[data-q-level-ticks] line').forEach((tick, i) => { tick.setAttribute('x1', levelX(levels[i])); tick.setAttribute('x2', levelX(levels[i])); });
      all('[data-q-levels]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.qLevels === mode)));
      find('[data-q-level-result]').textContent = mode === 'iq' ? 'IQ4_NL: 가운데 눈금 간격은 좁고, 바깥쪽은 넓다. 번호의 개수는 여전히 16개다.' : '균일 격자: 어디서나 간격이 16이다. 값이 드문 양 끝에도 같은 간격으로 눈금을 둔다.';
    }
    all('[data-q-levels]').forEach(button => button.addEventListener('click', () => drawLevels(button.dataset.qLevels)));
    drawLevels('uniform');

    const book = [[.15, .2], [.2, .8], [.75, .25], [.8, .85]];
    const vectors = [[.2, .7], [.8, .8], [.7, .2]];
    const vx = x => 40 + x * 250, vy = y => 240 - y * 210;
    function drawBook() {
      const vector = vectors[Number(find('#q-vector').value)];
      const distances = book.map(v => v.reduce((s, x, j) => s + (x - vector[j]) ** 2, 0));
      const index = distances.indexOf(Math.min(...distances));
      const address = index.toString(2).padStart(2, '0');
      find('[data-q-codebook]').innerHTML = line(40, 240, 305, 240) + line(40, 240, 40, 15) + label(265, 270, 'w₁') + label(10, 25, 'w₂') + line(vx(vector[0]), vy(vector[1]), vx(book[index][0]), vy(book[index][1]), yellow, 'stroke-dasharray="4 4"') + book.map((v, i) => circle(vx(v[0]), vy(v[1]), 8, i === index ? yellow : '#60748f') + label(vx(v[0]) + 12, vy(v[1]) - 10, i.toString(2).padStart(2, '0'), i === index ? yellow : null)).join('') + circle(vx(vector[0]), vy(vector[1]), 5, blue);
      find('[data-q-code-index]').textContent = address;
      find('[data-q-code-result]').textContent = `주소 ${address} → (${book[index].join(', ')})로 복원. 제곱 거리 ${distances[index].toFixed(4)}.`;
    }
    find('#q-vector').addEventListener('change', drawBook);
    drawBook();

    function drawMetric() {
      const alpha = Number(find('#q-importance').value);
      const a = alpha * .15 ** 2 + .05 ** 2, b = alpha * .05 ** 2 + .25 ** 2;
      const winner = a <= b ? 'A' : 'B', cost = Math.min(a, b);
      const x = v => 70 + v * 210, y = v => 280 - v * 210;
      find('#q-importance-value').value = alpha;
      find('[data-q-metric]').innerHTML = line(45, 280, 310, 280) + line(70, 290, 70, 15) + label(278, 299, 'w₁') + label(35, 24, 'w₂') + `<ellipse cx="${x(.35)}" cy="${y(.85)}" rx="${Math.sqrt(cost / alpha) * 210}" ry="${Math.sqrt(cost) * 210}" fill="${purple}" fill-opacity=".1" stroke="${purple}" stroke-width="2"/>` + line(x(.35), y(.85), x(winner === 'A' ? .2 : .4), y(winner === 'A' ? .9 : .6), yellow, 'stroke-dasharray="4 4"') + circle(x(.2), y(.9), 7, winner === 'A' ? yellow : '#60748f') + label(x(.2) - 22, y(.9) - 12, 'A', yellow) + circle(x(.4), y(.6), 7, winner === 'B' ? yellow : '#60748f') + label(x(.4) + 12, y(.6) + 15, 'B', yellow) + circle(x(.35), y(.85), 5, blue) + label(x(.35) + 14, y(.85) - 7, '원본', blue);
      find('[data-q-winner]').textContent = a === b || Math.abs(a - b) < 1e-10 ? 'A = B' : winner;
      find('[data-q-costs]').innerHTML = `A: ${alpha} × 0.15² + 0.05² = <strong>${a.toFixed(4)}</strong><br>B: ${alpha} × 0.05² + 0.25² = <strong>${b.toFixed(4)}</strong>`;
      find('[data-q-metric-result]').textContent = alpha === 3 ? '중요도 3배에서 두 후보의 가중 오차가 같다.' : `${alpha}배 중요도에서는 ${winner}의 가중 오차가 더 작다. ${alpha > 3 ? '가로 방향 오차를 줄이기 위해 세로 방향 오차를 더 허용했다.' : '중요도를 높여 가장 가까운 후보가 바뀌는 순간을 찾아보자.'}`;
    }
    find('#q-importance').addEventListener('input', drawMetric);
    drawMetric();

    find('[data-q-mix-cells]').innerHTML = '<span></span>'.repeat(20);
    function drawMix() {
      const percent = Number(find('#q-mix-ratio').value), p = percent / 100;
      find('#q-mix-value').value = `${percent}%`;
      all('[data-q-mix-cells] span').forEach((cell, i) => cell.classList.toggle('is-high', i < percent / 5));
      find('[data-q-mix-result]').textContent = `${(1 - p).toFixed(2)} × 4.5 + ${p.toFixed(2)} × 6.5625 = ${(4.5 * (1 - p) + 6.5625 * p).toFixed(4)} bpw`;
    }
    find('#q-mix-ratio').addEventListener('input', drawMix);
    drawMix();
  }

  function initArticle(page) {
    initQuantStudy(root);
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
