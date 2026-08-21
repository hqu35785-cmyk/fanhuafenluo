(() => {
  "use strict";

  const body = document.body;
  const gallery = document.querySelector("#gallery");
  const siteHeader = document.querySelector(".site-header");
  const detailPanel = document.querySelector("#detailPanel");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!gallery) return;

  body.classList.add("motion-rich");

  const visibleCards = new Set();
  const cardMeta = new WeakMap();
  const observedCards = new Set();
  let columns = 6;
  let metricsRaf = 0;
  let physicsRaf = 0;
  let lastPaintAt = 0;
  let lastScrollY = window.scrollY;
  let lastScrollAt = performance.now();
  let lastScrollEventAt = 0;
  let forceTarget = 0;
  let forcePosition = 0;
  let forceVelocity = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function galleryColumns() {
    if (window.innerWidth <= 620) return 2;
    if (window.innerWidth <= 980) return 4;
    return 6;
  }

  function resetCard(card) {
    const face = cardMeta.get(card)?.face || card.querySelector(".card-face");
    if (!face) return;
    face.style.removeProperty("transform");
    face.style.setProperty("--scroll-art-shift", "0px");
    face.style.setProperty("--scroll-glow", "0");
  }

  function refreshMetrics() {
    metricsRaf = 0;
    columns = galleryColumns();
    for (const card of [...visibleCards]) {
      if (!card.isConnected) {
        visibleCards.delete(card);
        continue;
      }
      const meta = cardMeta.get(card);
      if (!meta) continue;
      const rect = card.getBoundingClientRect();
      meta.centerY = window.scrollY + rect.top + rect.height * 0.5;
    }
  }

  function queueMetricsRefresh() {
    if (metricsRaf) return;
    metricsRaf = requestAnimationFrame(refreshMetrics);
  }

  const visibilityObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          card.classList.toggle("is-motion-visible", entry.isIntersecting);
          if (entry.isIntersecting) {
            visibleCards.add(card);
            const meta = cardMeta.get(card);
            if (meta) {
              const rect = entry.boundingClientRect;
              meta.centerY = window.scrollY + rect.top + rect.height * 0.5;
            }
          } else {
            visibleCards.delete(card);
            resetCard(card);
          }
        });
      }, { rootMargin: "90px 0px 110px", threshold: 0 })
    : null;

  function bindCards() {
    const cards = [...gallery.querySelectorAll(".archive-card")];
    const current = new Set(cards);

    observedCards.forEach((card) => {
      if (current.has(card)) return;
      visibilityObserver?.unobserve(card);
      visibleCards.delete(card);
      observedCards.delete(card);
    });

    cards.forEach((card, index) => {
      const face = card.querySelector(".card-face");
      const existing = cardMeta.get(card);
      if (existing) {
        existing.index = index;
        existing.face = face;
      } else {
        cardMeta.set(card, { index, face, centerY: 0 });
      }
      if (!observedCards.has(card)) {
        observedCards.add(card);
        if (visibilityObserver) visibilityObserver.observe(card);
        else {
          card.classList.add("is-motion-visible");
          visibleCards.add(card);
        }
      }
    });
    queueMetricsRefresh();
  }

  function paint(force) {
    const cols = columns;
    const absForce = Math.abs(force);
    const viewportCenterY = window.scrollY + window.innerHeight * 0.5;
    const halfViewport = Math.max(window.innerHeight * 0.5, 1);
    const center = (cols - 1) / 2 || 1;

    for (const card of visibleCards) {
      if (!card.isConnected || gallery.classList.contains("is-author-switching")) continue;
      const meta = cardMeta.get(card);
      if (!meta?.face) continue;

      const i = meta.index;
      const col = i % cols;
      const side = (col - center) / Math.max(center, 1);
      const verticalBias = clamp((meta.centerY - viewportCenterY) / halfViewport, -1, 1);
      const individuality = 0.90 + (i % 4) * 0.045;
      const depth = 1 + Math.abs(verticalBias) * 0.14;
      const shift = clamp(force * individuality * depth, -34, 34);
      const tilt = clamp(-force * 0.135, -4.6, 4.6);
      const roll = clamp(force * 0.046 * side + force * 0.008 * verticalBias, -1.55, 1.55);
      const squash = Math.min(absForce * 0.00105, 0.027);
      const scaleX = 1 + squash * 0.42;
      const scaleY = 1 - squash;
      const artShift = clamp(-force * 0.31, -9.5, 9.5);
      const glow = clamp(absForce / 30, 0, 0.56);

      meta.face.style.setProperty(
        "transform",
        `perspective(760px) translate3d(0,${shift.toFixed(2)}px,0) translateY(var(--hover-lift,0px)) rotateX(${tilt.toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) scale(${scaleX.toFixed(4)},${scaleY.toFixed(4)})`,
        "important"
      );
      meta.face.style.setProperty("--scroll-art-shift", `${artShift.toFixed(2)}px`);
      meta.face.style.setProperty("--scroll-glow", glow.toFixed(3));
    }
  }

  function runPhysics(now) {
    physicsRaf = 0;
    if (prefersReducedMotion.matches || document.hidden) {
      forceTarget = forcePosition = forceVelocity = 0;
      body.classList.remove("is-scroll-forcing", "scroll-force-down", "scroll-force-up");
      for (const card of visibleCards) resetCard(card);
      return;
    }

    if (now - lastPaintAt < 14) {
      physicsRaf = requestAnimationFrame(runPhysics);
      return;
    }
    lastPaintAt = now;

    const spring = 0.18;
    const damping = 0.70;
    forceVelocity += (forceTarget - forcePosition) * spring;
    forceVelocity *= damping;
    forcePosition += forceVelocity;
    forceTarget *= 0.64;

    if (performance.now() - lastScrollEventAt < 48 && Math.abs(forcePosition) < 3.2 && Math.abs(forceTarget) > 0.2) {
      forcePosition = Math.sign(forceTarget || 1) * 3.2;
    }

    paint(forcePosition);

    const settled = Math.abs(forceTarget) < 0.06 && Math.abs(forcePosition) < 0.08 && Math.abs(forceVelocity) < 0.05;
    if (settled) {
      forceTarget = forcePosition = forceVelocity = 0;
      paint(0);
      body.classList.remove("is-scroll-forcing", "scroll-force-down", "scroll-force-up");
      return;
    }
    physicsRaf = requestAnimationFrame(runPhysics);
  }

  window.addEventListener("scroll", () => {
    if (prefersReducedMotion.matches || !visibleCards.size || document.hidden) return;
    const now = performance.now();
    const y = window.scrollY;
    const delta = y - lastScrollY;
    const dt = clamp(now - lastScrollAt, 8, 48);
    lastScrollY = y;
    lastScrollAt = now;
    if (!delta) return;

    const velocity = delta / dt;
    let impulse = velocity * 22 + delta * 0.32;
    if (Math.abs(impulse) < 5.5) impulse = Math.sign(delta) * 5.5;
    impulse = clamp(impulse, -38, 38);
    forceTarget = clamp(forceTarget * 0.28 + impulse, -42, 42);
    lastScrollEventAt = now;
    body.classList.add("is-scroll-forcing");
    body.classList.toggle("scroll-force-down", delta > 0);
    body.classList.toggle("scroll-force-up", delta < 0);
    if (!physicsRaf) physicsRaf = requestAnimationFrame(runPhysics);
  }, { passive: true });

  window.addEventListener("resize", queueMetricsRefresh, { passive: true });

  /* Keep physics binding in sync with the app's real-card re-render on author switches. */
  new MutationObserver(() => bindCards()).observe(gallery, { childList: true });
  bindCards();

  /* Header entrance animation whenever the active author metadata changes. */
  const authorName = document.querySelector("#authorName");
  if (authorName && siteHeader) {
    let headerTimer = 0;
    new MutationObserver(() => {
      if (prefersReducedMotion.matches) return;
      siteHeader.classList.remove("author-switch-in");
      void siteHeader.offsetWidth;
      siteHeader.classList.add("author-switch-in");
      clearTimeout(headerTimer);
      headerTimer = window.setTimeout(() => siteHeader.classList.remove("author-switch-in"), 650);
    }).observe(authorName, { childList: true, characterData: true, subtree: true });
  }

  /* Direction-aware detail-tab motion layered over app.js's real detail content. */
  let detailIndex = 0;
  document.addEventListener("pointerdown", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-detail-tab]") : null;
    if (!button || !detailPanel) return;
    const buttons = [...document.querySelectorAll("[data-detail-tab]")];
    const nextIndex = Math.max(0, buttons.indexOf(button));
    detailPanel.dataset.motionDirection = nextIndex >= detailIndex ? "forward" : "backward";
    detailIndex = nextIndex;
    button.classList.remove("is-tab-hit");
    void button.offsetWidth;
    button.classList.add("is-tab-hit");
    window.setTimeout(() => button.classList.remove("is-tab-hit"), 460);
  }, { capture: true, passive: true });

  /* Tactile acknowledgement for actions, without adding a new visual style. */
  document.addEventListener("pointerdown", (event) => {
    const action = event.target instanceof Element
      ? event.target.closest(".detail-action,.download-action,.detail-save-btn,.save-sheet-choice")
      : null;
    if (!action || prefersReducedMotion.matches) return;
    action.classList.remove("is-activating");
    void action.offsetWidth;
    action.classList.add("is-activating");
    window.setTimeout(() => action.classList.remove("is-activating"), 450);
  }, { capture: true, passive: true });

  document.addEventListener("visibilitychange", () => {
    body.classList.toggle("is-page-hidden", document.hidden);
    if (!document.hidden) {
      lastScrollY = window.scrollY;
      lastScrollAt = performance.now();
      queueMetricsRefresh();
    }
  });
})();
