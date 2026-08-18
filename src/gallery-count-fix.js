/*! Permanent fix for app.js renderActiveAuthor DOM-cache bug.
 *  Same-author path used to skip rebuild when catalog grew (3 -> 70).
 *  This wraps renderActiveAuthor with the correct count check.
 */
(function () {
  if (typeof renderActiveAuthor !== "function") return;

  const original = renderActiveAuthor;

  function forceStaleAuthorDom(authorId) {
    try {
      if (typeof authorDomCache !== "undefined" && authorDomCache && typeof authorDomCache.delete === "function") {
        authorDomCache.delete(authorId);
      }
    } catch (_) {}
    try {
      if (typeof mountedAuthorId !== "undefined") {
        mountedAuthorId = null;
      }
    } catch (_) {}
  }

  renderActiveAuthor = function (opts) {
    try {
      const list =
        typeof activeAuthor !== "undefined" && activeAuthor && Array.isArray(activeAuthor.works)
          ? activeAuthor.works
          : typeof works !== "undefined" && Array.isArray(works)
            ? works
            : [];
      const expected = list.length;
      const actual =
        typeof gallery !== "undefined" && gallery
          ? gallery.querySelectorAll(".card").length
          : -1;
      const authorId =
        typeof activeAuthor !== "undefined" && activeAuthor ? activeAuthor.id : null;

      // Data says N cards but DOM has a different count -> must rebuild.
      if (expected > 0 && actual >= 0 && actual !== expected) {
        forceStaleAuthorDom(authorId);
      }
    } catch (_) {}

    return original.call(this, opts);
  };
})();
