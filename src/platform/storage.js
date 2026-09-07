/* Small injectable browser storage boundary; keeps all existing save keys. */
const EmberStorage = (() => {
  function create(getStorage, onUnavailable = () => {}) {
    let warned = false;
    return Object.freeze({
      read(key, fallback = null) {
        try {
          const raw = getStorage().getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      },
      write(key, value) {
        try {
          getStorage().setItem(key, JSON.stringify(value));
          return true;
        } catch {
          if (!warned) {
            warned = true;
            onUnavailable();
          }
          return false;
        }
      },
    });
  }
  return Object.freeze({ create });
})();
if (typeof module !== "undefined") module.exports = EmberStorage;
