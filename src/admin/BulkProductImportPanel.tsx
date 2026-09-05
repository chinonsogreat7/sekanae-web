import { csvReviewSchema, type AdminRequest, type SavedWork, type SavedWorkSummary } from "../../packages/admin/src/workflows";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ClipboardList, Upload } from "lucide-react";
import type { Product } from "../data/catalog";
import {
  productCsvColumns, productCsvLabels, productCsvRowErrors, productCsvRowToProduct,
  productCsvTemplate, productImportRowsFromCsv, requiredProductCsvColumns, splitImageFiles,
  type ProductCsvColumn, type ProductCsvRow,
} from "./product-csv";

type Props = {
  request: AdminRequest;
  products: Product[];
  uploadImages: (files: File[]) => Promise<string[]>;
  importProduct: (product: Product) => Promise<unknown>;
  onImported: () => Promise<void>;
};
const perPage = 10;
const maxImageBytes = 8 * 1024 * 1024;

export function BulkProductImportPanel({ products, request, uploadImages, importProduct, onImported }: Props) {
  const [rows, setRows] = useState<ProductCsvRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(1);
  const [savedReviews, setSavedReviews] = useState<SavedWorkSummary[]>([]);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const activeReview = useRef<SavedWork | null>(null);
  const requestRef = useRef(request);
  const snapshot = JSON.stringify({ filename, rows });
  const dirty = rows.length > 0 && snapshot !== savedSnapshot;
  const [history, setHistory] = useState<string[]>([]);
  const csvInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const importLock = useRef(false);
  const uploaded = useRef(new Map<File, string>());
  const errors = useMemo(() => new Map(rows.map((row) => [row.rowNumber,
    productCsvRowErrors(row, rows, products, files.map((file) => file.name)),
  ])), [rows, products, files]);
  const pending = rows.filter((row) => !row.imported);
  const invalid = pending.filter((row) => errors.get(row.rowNumber)?.length);
  const published = pending.filter((row) => row.values.status === "published").length;
  const busy = isReading || isImporting || isSavingReview;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const visibleRows = rows.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    requestRef.current<SavedWorkSummary[]>("/api/admin/saved-work?kind=csv_review", { signal: controller.signal })
      .then((response) => setSavedReviews(response.data))
      .catch(() => { if (!controller.signal.aborted) setSaveMessage("Saved reviews could not load. Refresh this page to retry."); });
    return () => controller.abort();
  }, []);

  async function persistReview(nextRows = rows, newCopy = false) {
    const previous = newCopy ? null : activeReview.current;
    const payload = { filename, rows: nextRows };
    setIsSavingReview(true);
    try {
      const response = await request<SavedWork>(previous ? `/api/admin/saved-work/${previous.id}` : "/api/admin/saved-work", {
        method: previous ? "PUT" : "POST",
        body: JSON.stringify({ kind: "csv_review", name: filename.slice(0, 100), payload, ...(previous ? { revision: previous.revision } : {}) }),
      });
      activeReview.current = response.data;
      setSavedSnapshot(JSON.stringify(payload));
      setSavedReviews((current) => [response.data, ...current.filter((item) => item.id !== response.data.id)]);
      setSaveMessage(`Saved at ${new Date(response.data.updatedAt).toLocaleTimeString()}. You can resume this review later.`);
      return response.data;
    } finally { setIsSavingReview(false); }
  }
  async function persistRowResult(row: ProductCsvRow, nextRows: ProductCsvRow[]) {
    const previous = activeReview.current;
    if (!previous) throw new Error("Save the review before recording import progress.");
    const response = await request<SavedWorkSummary>(`/api/admin/saved-work/${previous.id}/csv-rows/${row.rowNumber}`, {
      method: "PATCH", body: JSON.stringify({ revision: previous.revision, imported: Boolean(row.imported), importError: row.importError?.slice(0, 2000) }),
    });
    const payload = { filename, rows: nextRows };
    activeReview.current = { ...previous, ...response.data, kind: "csv_review", payload };
    setSavedSnapshot(JSON.stringify(payload));
    setSavedReviews((current) => [response.data, ...current.filter((item) => item.id !== response.data.id)]);
    setSaveMessage(`Import progress saved at ${new Date(response.data.updatedAt).toLocaleTimeString()}.`);
  }
  async function saveReview(newCopy = false) {
    try { await persistReview(rows, newCopy); }
    catch (error) { setSaveMessage(error instanceof Error ? error.message : "Review could not be saved. Your edits are still on this page."); }
  }
  async function resumeReview(item: SavedWorkSummary) {
    if (dirty && !window.confirm("Resume this saved review? Unsaved edits in the current review will be discarded.")) return;
    setIsSavingReview(true);
    try {
      const response = await request<SavedWork>(`/api/admin/saved-work/${item.id}`);
      if (response.data.kind !== "csv_review") throw new Error("This saved item is not a CSV review.");
      const payload = csvReviewSchema.parse(response.data.payload);
      activeReview.current = response.data;
      setRows(payload.rows); setFilename(payload.filename); setSavedSnapshot(JSON.stringify(payload));
      setFiles([]); uploaded.current.clear(); setPage(1); setConfirmed(false);
      setSaveMessage("Saved review resumed. Edits and import results restored. Reselect any referenced local image files before importing.");
      setMessage("");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Unable to resume review."); }
    finally { setIsSavingReview(false); }
  }
  async function removeReview(item: SavedWorkSummary) {
    if (!window.confirm(`Remove saved review “${item.name}”? Products already imported will not be changed.`)) return;
    setIsSavingReview(true);
    try {
      await request(`/api/admin/saved-work/${item.id}`, { method: "DELETE", body: JSON.stringify({ revision: item.revision }) });
      setSavedReviews((current) => current.filter((entry) => entry.id !== item.id));
      if (activeReview.current?.id === item.id) { activeReview.current = null; setSavedSnapshot(""); }
      setSaveMessage("Saved review removed.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Unable to remove saved review."); }
    finally { setIsSavingReview(false); }
  }

  useEffect(() => {
    if (!dirty && !isImporting) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guardNavigation = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || event.metaKey || event.ctrlKey) return;
      if (link.href === window.location.href) return;
      if (isImporting || !window.confirm("Leave this CSV review? Unsaved edits and import results will be discarded.")) {
        event.preventDefault();
        event.stopPropagation();
        if (isImporting) setMessage("Wait for the current import to finish before leaving this page.");
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [dirty, isImporting]);

  function edit(rowNumber: number, field: ProductCsvColumn, value: string) {
    setConfirmed(false);
    setRows((current) => current.map((row) => row.rowNumber === rowNumber
      ? { ...row, importError: undefined, values: { ...row.values, [field]: value } } : row));
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([productCsvTemplate()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sekanae-product-bulk-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function loadCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importLock.current) return;
    if (pending.length && !window.confirm("Replace the current CSV review? Unsaved edits will be discarded.")) return;
    if (file.size > 5 * 1024 * 1024) { setMessage("Choose a CSV smaller than 5 MB."); return; }
    setIsReading(true);
    try {
      const parsed = productImportRowsFromCsv(await file.text());
      activeReview.current = null; setSavedSnapshot(""); setSaveMessage("");
      setRows(parsed);
      setFilename(file.name);
      setFiles([]);
      uploaded.current.clear();
      setConfirmed(false);
      setPage(1);
      setMessage(`${parsed.length} rows loaded for review. Nothing has been uploaded or saved yet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read the CSV.");
    } finally { setIsReading(false); }
  }
  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (selected.some((file) => !file.type.startsWith("image/") || file.size > maxImageBytes)) {
      setMessage("Choose image files of 8 MB or less each.");
      return;
    }
    setFiles(selected);
    uploaded.current.clear();
    setConfirmed(false);
    setMessage(`${selected.length} images selected locally. They will upload only when you confirm the import.`);
  }
  async function finishImport() {
    if (importLock.current || busy || !confirmed || !pending.length || invalid.length) return;
    importLock.current = true;
    setIsImporting(true);
    const batch = [...pending];
    let nextRows = [...rows];
    let succeeded = 0;
    let failed = 0;
    let paused = "";
    try {
      // Save the exact reviewed values before any product or image upload.
      await persistReview(nextRows);
      for (const [index, row] of batch.entries()) {
        setMessage(`Importing ${index + 1} of ${batch.length}: ${row.values.name}`);
        try {
          const imageUrls: string[] = [];
          for (const name of splitImageFiles(row.values.imageFiles)) {
            const file = files.find((item) => item.name === name);
            if (!file) throw new Error(`Select ${name} before importing.`);
            let url = uploaded.current.get(file);
            if (!url) {
              [url] = await uploadImages([file]);
              if (!url) throw new Error(`The image upload returned no URL for ${name}.`);
              uploaded.current.set(file, url);
            }
            imageUrls.push(url);
          }
          await importProduct(productCsvRowToProduct(row, imageUrls));
          succeeded += 1;
          nextRows = nextRows.map((item) => item.rowNumber === row.rowNumber ? { ...item, imported: true, importError: undefined } : item);
        } catch (error) {
          failed += 1;
          nextRows = nextRows.map((item) => item.rowNumber === row.rowNumber
            ? { ...item, importError: error instanceof Error ? error.message : "Import failed. Retry this row." } : item);
        }
        setRows(nextRows);
        try { await persistRowResult(nextRows.find((item) => item.rowNumber === row.rowNumber)!, nextRows); }
        catch (error) {
          paused = error instanceof Error ? error.message : "Import progress could not be saved.";
          break;
        }
      }
      const summary = `${succeeded} imported; ${failed} failed. ${paused ? `Import paused: ${paused} Keep this page open and save a new copy to retain the latest results.` : failed ? "Successful rows are locked. Review the failed rows and retry." : "Import complete. Review and results saved."}`;
      setMessage(summary);
      setHistory((current) => [summary, ...current].slice(0, 5));
      try { await onImported(); } catch { setMessage(`${summary} Refresh Products to see the latest catalog.`); }
    } catch (error) {
      setMessage(`Nothing imported: ${error instanceof Error ? error.message : "Unable to save the review."}`);
    } finally {
      setConfirmed(false); setIsImporting(false); importLock.current = false;
    }
  }

  function field(row: ProductCsvRow, column: ProductCsvColumn) {
    const required = (requiredProductCsvColumns as readonly string[]).includes(column);
    const id = `csv-${row.rowNumber}-${column}`;
    const props = { id, value: row.values[column], disabled: busy || row.imported, required,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => edit(row.rowNumber, column, event.target.value) };
    return <label key={column} htmlFor={id}>
      {productCsvLabels[column]}{required ? " *" : ""}
      {column === "status" ? <select {...props}>
        <option value="">Choose status</option>
        {row.values.status && !["draft", "published"].includes(row.values.status) && <option value={row.values.status}>{row.values.status} (invalid)</option>}
        <option value="draft">Draft</option><option value="published">Published</option>
      </select> : ["description", "detailsMaterials", "detailsDimensions", "detailsCare", "detailsShipping"].includes(column)
        ? <textarea {...props} rows={2} placeholder={column === "description" ? row.values.name : column === "detailsMaterials" ? row.values.material : "Not specified"} />
        : <input {...props} type="text" inputMode={["price", "stock", "rating", "reviews"].includes(column) ? "decimal" : undefined}
          placeholder={column === "collection" ? row.values.category : ["rating", "reviews"].includes(column) ? "0" : ["isNew", "isBridalPreview"].includes(column) ? "false" : column === "imageFiles" ? "front.jpg|side.jpg" : undefined} />}
    </label>;
  }

  return <section className="admin-bulk-upload" aria-label="CSV product import">
    <div><strong>Bulk add products</strong>
      <p>1. Select CSV → 2. Review and edit → 3. Confirm import</p>
      <p>Required: A name, B category, D price (EUR), N stock, T status (draft or published). All other columns are optional. Keep the template headers; optional columns may be left blank or omitted.</p>
    </div>
    <div className="admin-bulk-actions">
      <button type="button" onClick={downloadTemplate}><ClipboardList size={15} /> Download template</button>
      <button type="button" onClick={() => csvInput.current?.click()} disabled={busy}><Upload size={15} /> {isReading ? "Reading CSV…" : "Select CSV"}</button>
      <input ref={csvInput} className="admin-upload-file-input" type="file" accept=".csv,text/csv" onChange={loadCsv} disabled={busy} aria-label="Product CSV file" />
      <button type="button" onClick={() => imageInput.current?.click()} disabled={busy}><Upload size={15} /> Select images (optional)</button>
      <input ref={imageInput} className="admin-upload-file-input" type="file" accept="image/*" multiple onChange={selectImages} disabled={busy} aria-label="Product image files" />
      {rows.length > 0 && <button type="button" disabled={busy} onClick={() => {
        if (pending.length && !window.confirm("Discard this CSV review and all unsaved edits?")) return;
        setRows([]); setFiles([]); setFilename(""); setConfirmed(false); uploaded.current.clear(); activeReview.current = null; setSavedSnapshot(""); setSaveMessage(""); setMessage("Current review cleared. Saved reviews remain available below.");
      }}>Clear review</button>}
    </div>
    {rows.length > 0 && <div className="admin-bulk-actions">
      <button type="button" disabled={busy || !dirty} onClick={() => void saveReview()}>{isSavingReview ? "Saving review…" : "Save review for later"}</button>
      {activeReview.current && <button type="button" disabled={busy} onClick={() => void saveReview(true)}>Save a new copy</button>}
      <span role="status">{dirty ? "Unsaved changes" : "Review saved"}</span>
    </div>}
    {saveMessage && <p role="status">{saveMessage}</p>}
    <details><summary>Saved CSV reviews ({savedReviews.length})</summary>
      <ul className="admin-saved-list">{savedReviews.map((item) => <li key={item.id}>
        <div><strong>{item.name}</strong><small>Saved {new Date(item.updatedAt).toLocaleString()}</small></div>
        <button type="button" disabled={busy} aria-label={`Resume ${item.name}`} onClick={() => void resumeReview(item)}>Resume</button>
        <button type="button" disabled={busy} aria-label={`Remove saved review ${item.name}`} onClick={() => void removeReview(item)}>Remove</button>
      </li>)}</ul>
      {!savedReviews.length && <p>No saved CSV reviews yet.</p>}
    </details>
    <p role="status" aria-live="polite">{message}</p>
    {rows.length > 0 && <>
      <div className="admin-bulk-summary"><span>{filename}</span><span>{pending.length} awaiting import</span><span>{invalid.length} need fixes</span><span>{rows.length - pending.length} imported</span><span>{files.length} images selected</span></div>
      <p>Defaults: collection uses the category, description uses the name, materials details use the material, ratings and reviews are 0, and flags are false. Other omitted fields stay empty. Open “Optional details” to override these values. List colors, occasions and tags with commas; separate image file names with |.</p>
      <p>Save this review to resume later without importing products. Edits and import results are stored securely in the admin; local image files must be reselected after reopening.</p>
      {invalid.length > 0 && <div className="admin-bulk-errors" role="alert">Fix or remove all {invalid.length} invalid rows before importing.
        <button type="button" onClick={() => setPage(Math.floor(rows.indexOf(invalid[0]) / perPage) + 1)}>Show first row needing fixes</button>
      </div>}
      <div className="admin-csv-review" aria-label="Review CSV rows">
        {visibleRows.map((row) => {
          const rowErrors = errors.get(row.rowNumber) ?? [];
          return <article className="admin-csv-row" key={row.rowNumber} aria-label={`CSV row ${row.rowNumber}`}>
            <div className="admin-csv-row-heading"><strong>Row {row.rowNumber} · {row.values.name || "Unnamed product"}</strong>
              <span>{row.imported ? "Imported" : rowErrors.length ? "Needs fixes" : row.importError ? "Import failed" : "Ready"}</span>
              {!row.imported && <button type="button" disabled={busy} aria-label={`Remove row ${row.rowNumber}`} onClick={() => {
                setRows((current) => current.filter((item) => item.rowNumber !== row.rowNumber)); setConfirmed(false);
                setPage(Math.min(page, Math.max(1, Math.ceil((rows.length - 1) / perPage))));
              }}>Remove row</button>}
            </div>
            <div className="admin-csv-fields">{requiredProductCsvColumns.map((column) => field(row, column))}</div>
            <details><summary>Optional details · images, descriptions and defaults</summary>
              <div className="admin-csv-fields admin-csv-optional">{productCsvColumns.filter((column) => !(requiredProductCsvColumns as readonly string[]).includes(column)).map((column) => field(row, column))}</div>
            </details>
            {!row.values.imageFiles.trim() && !row.imported && <p>No image supplied. This product will be imported without photos.</p>}
            {rowErrors.length > 0 && <ul className="admin-bulk-errors">{rowErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
            {row.importError && <p className="admin-bulk-errors" role="alert">{row.importError}</p>}
          </article>;
        })}
      </div>
      {pages > 1 && <div className="admin-bulk-actions"><button type="button" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>Previous rows</button><span>Page {page} of {pages}</span><button type="button" disabled={page === pages || busy} onClick={() => setPage(page + 1)}>Next rows</button></div>}
      {pending.length > 0 && <div className="admin-csv-confirm">
        <p>Final import: {pending.length} products — {published} published immediately, {pending.length - published} saved as drafts. Existing products cannot be overwritten by this import.</p>
        <label><input type="checkbox" checked={confirmed} disabled={busy || invalid.length > 0} onChange={(event) => setConfirmed(event.target.checked)} /> I have reviewed all rows, optional defaults and publishing statuses.</label>
        <button type="button" onClick={finishImport} disabled={busy || !confirmed || invalid.length > 0}>{isImporting ? "Importing…" : `Confirm import (${pending.length})`}</button>
      </div>}
    </>}
    {history.length > 0 && <div className="admin-bulk-history"><strong>Imports this session</strong>{history.map((item, index) => <span key={index}>{item}</span>)}</div>}
  </section>;
}
