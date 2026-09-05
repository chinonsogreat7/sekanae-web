type CatalogFeedbackProps = {
  loading: boolean;
  error: string | null;
  total: number;
  matches: number;
  retry: () => void;
  clearFilters?: () => void;
};

export function CatalogFeedback({ loading, error, total, matches, retry, clearFilters }: CatalogFeedbackProps) {
  // Refreshing an already visible collection should not replace it with skeletons.
  if (loading && total === 0) {
    return <div className="catalog-feedback" role="status" aria-live="polite">
      <p className="microcopy">From the studio</p>
      <h2>Finding your next favourite…</h2>
      <p>Our collection is loading.</p>
    </div>;
  }
  if (error && !loading) {
    return <div className="catalog-feedback" role="status" aria-live="polite">
      <p className="microcopy">A moment, please</p>
      <h2>The collection couldn’t load</h2>
      <p>Please try again to see the latest pieces.</p>
      <button type="button" className="secondary-button" onClick={retry}>Try again</button>
    </div>;
  }
  if (loading || matches > 0) return null;
  return <div className="catalog-feedback" role="status" aria-live="polite">
    <p className="microcopy">The SEKANAE collection</p>
    <h2>{total === 0 ? "A new edit is on its way" : "No pieces match your selection"}</h2>
    <p>{total === 0 ? "Please check back soon for our latest pieces." : "Try another search or clear your filters to explore the collection."}</p>
    {total > 0 && clearFilters && <button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button>}
  </div>;
}
