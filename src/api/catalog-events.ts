export const catalogChangedEvent = "sekanae:catalog-changed";
export const catalogChangedStorageKey = "sekanae_catalog_changed";

export function invalidateCatalog(archivedProductId: string) {
  window.dispatchEvent(new CustomEvent(catalogChangedEvent, { detail: archivedProductId }));
  try {
    // Notify other storefront tabs on the same origin as well.
    window.localStorage.setItem(catalogChangedStorageKey, JSON.stringify({ archivedProductId, at: Date.now() }));
  } catch {
    // Same-tab invalidation still works when storage is unavailable.
  }
}
