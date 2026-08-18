/*! Force card-name to true bottom-left after every gallery render. */
(function () {
  function pin() {
    try {
      var names = document.querySelectorAll(".card-name");
      for (var i = 0; i < names.length; i++) {
        var el = names[i];
        el.style.setProperty("position", "absolute", "important");
        el.style.setProperty("left", "8px", "important");
        el.style.setProperty("right", "auto", "important");
        el.style.setProperty("bottom", "8px", "important");
        el.style.setProperty("top", "auto", "important");
        el.style.setProperty("max-width", "calc(100% - 96px)", "important");
        el.style.setProperty("margin", "0", "important");
        el.style.setProperty("padding", "0", "important");
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("transform", "none", "important");

        var meta = el.querySelector(".card-meta");
        if (!meta) {
          meta = document.createElement("span");
          meta.className = "card-meta";
          meta.innerHTML = "<span></span><span>点按翻转</span>";
          el.appendChild(meta);
        }
        meta.style.setProperty("display", "flex", "important");
        meta.style.setProperty("visibility", "visible", "important");
        meta.style.setProperty("opacity", "1", "important");
        meta.style.setProperty("margin-top", "4px", "important");
        meta.style.setProperty("padding-top", "4px", "important");
        meta.style.setProperty("border-top", "1px solid rgba(255,255,255,.12)", "important");

        var spans = meta.querySelectorAll("span");
        if (spans.length >= 1) spans[0].style.setProperty("display", "none", "important");
        if (spans.length >= 2) {
          spans[1].textContent = spans[1].textContent || "点按翻转";
          spans[1].style.setProperty("display", "inline", "important");
          spans[1].style.setProperty("color", "rgba(243,190,210,.9)", "important");
          spans[1].style.setProperty("font-size", "8px", "important");
        } else {
          var tip = document.createElement("span");
          tip.textContent = "点按翻转";
          tip.style.cssText = "display:inline!important;color:rgba(243,190,210,.9)!important;font-size:8px!important;";
          meta.appendChild(tip);
        }
      }

      var opens = document.querySelectorAll(".card-open");
      for (var j = 0; j < opens.length; j++) {
        opens[j].style.setProperty("top", "8px", "important");
        opens[j].style.setProperty("right", "8px", "important");
      }

      var saves = document.querySelectorAll(".privacy-unlock");
      for (var k = 0; k < saves.length; k++) {
        saves[k].style.setProperty("right", "8px", "important");
        saves[k].style.setProperty("bottom", "8px", "important");
      }
    } catch (_) {}
  }

  function schedule() {
    pin();
    setTimeout(pin, 50);
    setTimeout(pin, 300);
    setTimeout(pin, 800);
    setTimeout(pin, 1600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
  document.addEventListener("catalog-ready", schedule);
  document.addEventListener("fanhua-catalog-ready", schedule);

  var mo = new MutationObserver(function () {
    pin();
  });
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });
  }

  if (typeof renderActiveAuthor === "function") {
    var orig = renderActiveAuthor;
    renderActiveAuthor = function (opts) {
      var r = orig.call(this, opts);
      schedule();
      return r;
    };
  }
})();
