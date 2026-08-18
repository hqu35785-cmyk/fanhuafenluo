/*! No-lock mode: show all card faces without unlock. */
(function () {
  function clearSensitiveFlags() {
    try {
      if (typeof authors === "undefined" || !Array.isArray(authors)) return;
      authors.forEach(function (author) {
        if (!author || !Array.isArray(author.works)) return;
        author.works.forEach(function (w) {
          if (!w) return;
          w.sensitive = false;
          w.sensitiveSetting = false;
        });
      });
      if (typeof works !== "undefined" && Array.isArray(works)) {
        works.forEach(function (w) {
          if (!w) return;
          w.sensitive = false;
          w.sensitiveSetting = false;
        });
      }
    } catch (_) {}
  }

  function forcePaintFaces() {
    try {
      if (typeof works === "undefined" || !Array.isArray(works)) return;
      if (typeof gallery === "undefined" || !gallery) return;
      var cards = gallery.querySelectorAll(".card[data-index]");
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var index = Number(card.dataset.index);
        var work = works[index];
        if (!work) continue;
        var src = work.preview || work.image;
        if (!src) continue;
        var img = card.querySelector(".front img");
        if (!img) continue;
        img.hidden = false;
        img.removeAttribute("aria-hidden");
        img.alt = work.name || "";
        if (img.getAttribute("src") !== src) {
          img.setAttribute("src", src);
        }
        card.classList.remove("is-sensitive");
        var front = card.querySelector(".front");
        if (front) {
          front.classList.remove("is-locked", "is-loading", "is-load-error");
          front.removeAttribute("aria-busy");
        }
        var veil = card.querySelector(".privacy-veil");
        if (veil) veil.hidden = true;
        var unlock = card.querySelector(".privacy-unlock");
        if (unlock) {
          unlock.dataset.mode = "save";
          unlock.textContent = "保存角色卡 PNG";
          unlock.disabled = false;
        }
      }
    } catch (_) {}
  }

  function install() {
    clearSensitiveFlags();
    try {
      if (typeof isWorkLocked === "function") {
        isWorkLocked = function () { return false; };
      }
      if (typeof isSettingLocked === "function") {
        isSettingLocked = function () { return false; };
      }
    } catch (_) {}
    try {
      if (typeof unlockedWorks !== "undefined" && unlockedWorks && typeof unlockedWorks.add === "function") {
        if (typeof works !== "undefined" && Array.isArray(works)) {
          for (var i = 0; i < works.length; i++) unlockedWorks.add(i);
        }
      }
    } catch (_) {}
    try {
      if (typeof syncUnlockAll === "function") syncUnlockAll();
    } catch (_) {}
    try {
      var btn = document.getElementById("unlockAll");
      if (btn) btn.hidden = true;
    } catch (_) {}
    forcePaintFaces();
  }

  install();
  setTimeout(install, 0);
  setTimeout(install, 400);
  setTimeout(install, 1200);
  setTimeout(install, 2500);
  setTimeout(install, 5000);
  document.addEventListener("catalog-ready", function () {
    install();
    setTimeout(forcePaintFaces, 100);
    setTimeout(forcePaintFaces, 600);
  });
  document.addEventListener("fanhua-catalog-ready", function () {
    install();
    setTimeout(forcePaintFaces, 100);
    setTimeout(forcePaintFaces, 600);
  });

  if (typeof renderActiveAuthor === "function") {
    var orig = renderActiveAuthor;
    renderActiveAuthor = function (opts) {
      clearSensitiveFlags();
      var result = orig.call(this, opts);
      try {
        if (typeof isWorkLocked === "function") isWorkLocked = function () { return false; };
        if (typeof isSettingLocked === "function") isSettingLocked = function () { return false; };
      } catch (_) {}
      setTimeout(forcePaintFaces, 0);
      setTimeout(forcePaintFaces, 200);
      setTimeout(forcePaintFaces, 800);
      return result;
    };
  }
})();
