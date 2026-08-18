/*! gallery-count fix: rebuild when DOM card count != works.length */
(function(){
  if (typeof renderActiveAuthor !== "function") return;
  const original = renderActiveAuthor;
  renderActiveAuthor = function(opts){
    try {
      const list = (typeof activeAuthor !== "undefined" && activeAuthor && activeAuthor.works) ? activeAuthor.works : (typeof works !== "undefined" ? works : []);
      const expected = Array.isArray(list) ? list.length : 0;
      const actual = (typeof gallery !== "undefined" && gallery) ? gallery.querySelectorAll(".card").length : -1;
      if (expected > 0 && actual !== expected) {
        if (typeof authorDomCache !== "undefined" && authorDomCache && authorDomCache.delete && activeAuthor) {
          authorDomCache.delete(activeAuthor.id);
        }
        if (typeof mountedAuthorId !== "undefined") {
          mountedAuthorId = null;
        }
      }
    } catch (_) {}
    return original.call(this, opts);
  };
})();
