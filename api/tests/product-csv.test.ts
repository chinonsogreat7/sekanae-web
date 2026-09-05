import assert from "node:assert/strict";
import { test } from "node:test";
import { productCsvColumns, productCsvRowErrors, productCsvRowToProduct, productCsvTemplate, productImportRowsFromCsv } from "../../src/admin/product-csv.js";
import { productImportBodySchema } from "../src/routes/admin-catalog-schemas.js";

const minimalCsv = "name,category,price,stock,status\nTest bag,Handbags,12.50,3,draft";
test("only A, B, D, N and T are required, with safe defaults accepted by the import API", () => {
  assert.deepEqual([0, 1, 3, 13, 19].map((index) => productCsvColumns[index]), ["name", "category", "price", "stock", "status"]);
  const rows = productImportRowsFromCsv(minimalCsv);
  assert.deepEqual(productCsvRowErrors(rows[0], rows, [], []), []);
  const product = productImportBodySchema.parse(productCsvRowToProduct(rows[0]));
  assert.equal(product.collection, "Handbags");
  assert.equal(product.description, "Test bag");
  assert.equal(product.price, 12.5);
  assert.equal(product.material, "");
  assert.deepEqual(product.images, []);
  assert.equal(product.details.shipping, "");
  assert.equal(product.reviews, 0);
  assert.equal(product.isNew, false);
  assert.equal(productImportRowsFromCsv(productCsvTemplate()).length, 1);
});
test("each required header is enforced; missing optional headers do not crash", () => {
  for (const field of ["name", "category", "price", "stock", "status"]) {
    assert.throws(() => productImportRowsFromCsv(minimalCsv.replace(field, "unused")), /Missing required/);
  }
  assert.throws(() => productImportRowsFromCsv("name,category,price,stock,status\n"), /no product rows/);
});
test("quoted commas, escaped quotes, BOM, multiline text, CRLF, reordered headers and true line numbers", () => {
  const rows = productImportRowsFromCsv('\uFEFFSTATUS,stock,price,category,name,description\r\nDRAFT,2,30,Bags,"Bag, ""mini""","Line one\r\nLine two"\r\n\r\npublished,1,20,Bags,Second,Plain');
  assert.equal(rows[0].values.name, 'Bag, "mini"');
  assert.equal(rows[0].values.status, 'draft');
  assert.equal(rows[0].values.description, 'Line one\r\nLine two');
  assert.equal(rows[1].rowNumber, 5);
});
test("malformed CSV is rejected instead of silently shifting fields", () => {
  assert.throws(() => productImportRowsFromCsv(minimalCsv + ',extra'), /cells/);
  assert.throws(() => productImportRowsFromCsv(minimalCsv.replace('Test bag', '"Test bag')), /Unclosed/);
  assert.throws(() => productImportRowsFromCsv(minimalCsv.replace('Test bag', '"Test"bag')), /quoting/);
  assert.throws(() => productImportRowsFromCsv(minimalCsv.replace('category', 'name')), /Missing required/);
  assert.throws(() => productImportRowsFromCsv(minimalCsv.replace('status\n', 'status,name\n')), /unique/);
});
test("numeric ranges, required cells and invalid statuses/flags are actionable and editable", () => {
  for (const [field, value] of [["name", ""], ["category", ""], ["price", ""], ["stock", ""], ["status", ""], ["price", "-2"], ["price", "Infinity"], ["price", "1.234"], ["stock", "1.5"], ["stock", "2147483648"], ["rating", "6"], ["reviews", "-1"], ["status", "live"], ["isNew", "maybe"]] as const) {
    const rows = productImportRowsFromCsv(minimalCsv);
    rows[0].values[field] = value;
    assert.ok(productCsvRowErrors(rows[0], rows, [], []).length, `${field}=${value}`);
  }
  const rows = productImportRowsFromCsv(minimalCsv);
  rows[0].values.price = "-1";
  assert.ok(productCsvRowErrors(rows[0], rows, [], []).length);
  rows[0].values.price = "0";
  rows[0].values.stock = "0";
  assert.deepEqual(productCsvRowErrors(rows[0], rows, [], []), []);
});
test("duplicate names and existing products cannot be silently overwritten", () => {
  const rows = productImportRowsFromCsv(minimalCsv + "\nTest-bag,Handbags,20,4,draft");
  assert.match(productCsvRowErrors(rows[0], rows, [], []).join(), /same product/);
  rows.pop();
  assert.match(productCsvRowErrors(rows[0], rows, [productCsvRowToProduct(rows[0])], []).join(), /already exists/);
});
test("images are optional, but supplied references must be unique and matched", () => {
  const rows = productImportRowsFromCsv(minimalCsv);
  rows[0].values.imageFiles = "front.jpg|side.jpg";
  assert.equal(productCsvRowErrors(rows[0], rows, [], []).length, 2);
  assert.equal(productCsvRowErrors(rows[0], rows, [], ["front.jpg", "side.jpg"]).length, 0);
  assert.match(productCsvRowErrors(rows[0], rows, [], ["front.jpg", "front.jpg", "side.jpg"]).join(), /Multiple/);
});
test("API also rejects missing status/stock, invalid price and incomplete required fields", () => {
  const product = productCsvRowToProduct(productImportRowsFromCsv(minimalCsv)[0]);
  for (const patch of [{ stock: undefined }, { status: undefined }, { price: -1 }, { price: 1.234 }, { name: "" }, { category: "" }]) {
    assert.equal(productImportBodySchema.safeParse({ ...product, ...patch }).success, false);
  }
});
