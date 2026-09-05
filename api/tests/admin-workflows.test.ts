import assert from "node:assert/strict";
import { test } from "node:test";
import { orderFiltersSchema, savedWorkSchema, csvReviewSchema } from "../../packages/admin/src/workflows.js";
import { productImportRowsFromCsv } from "../../src/admin/product-csv.js";

test("order filter dates are valid inclusive calendar dates and ranges are ordered", () => {
  assert.equal(orderFiltersSchema.safeParse({ from: "2024-02-29", to: "2024-02-29" }).success, true);
  for (const value of [{from:"2026-02-29"}, {from:"2026-09-06",to:"2026-09-05"}, {from:"not-a-date"}, {paymentStatus:"other"}, {email:"broken"}]) {
    assert.equal(orderFiltersSchema.safeParse(value).success, false);
  }
  assert.equal(orderFiltersSchema.parse({ q: "  123  " }).q, "123");
});
test("saved reviews preserve invalid editable rows and completion results without requiring images", () => {
  const rows = productImportRowsFromCsv("name,category,price,stock,status\nTest,Bags,-5,1,draft\nFinished,Bags,20,1,draft");
  rows[0].importError = "Retry this row";
  rows[1].imported = true;
  const result = csvReviewSchema.parse({filename:"test.csv",rows});
  assert.equal(result.rows[0].values.price, "-5");
  assert.equal(result.rows[0].importError, "Retry this row");
  assert.equal(result.rows[1].imported, true);
  assert.equal(csvReviewSchema.safeParse({filename:"x",rows:[rows[0],rows[0]]}).success,false);
  assert.equal(savedWorkSchema.safeParse({kind:"csv_review",name:"",payload:result}).success,false);
});
