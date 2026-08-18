/*! No-lock mode: all cards usable without unlock. Restore from backups/ if needed. */
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
  }

  install();
  setTimeout(install, 0);
  setTimeout(install, 500);
  setTimeout(install, 1500);
  setTimeout(install, 3000);
  document.addEventListener("catalog-ready", install);
  document.addEventListener("fanhua-catalog-ready", install);

  if (typeof renderActiveAuthor === "function") {
    var orig = renderActiveAuthor;
    renderActiveAuthor = function (opts) {
      clearSensitiveFlags();
      var result = orig.call(this, opts);
      try {
        if (typeof isWorkLocked === "function") isWorkLocked = function () { return false; };
        if (typeof isSettingLocked === "function") isSettingLocked = function () { return false; };
      } catch (_) {}
      return result;
    };
  }
})();
