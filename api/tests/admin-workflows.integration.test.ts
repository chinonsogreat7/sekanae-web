import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { productCsvRowToProduct, productImportRowsFromCsv } from "../../src/admin/product-csv.js";

const databaseUrl = process.env.ADMIN_WORKFLOWS_TEST_DATABASE_URL;
test("admin workflows persist reviews/views, protect revisions and filter real database records", {skip:!databaseUrl}, async (t) => {
  assert.ok(["localhost","127.0.0.1"].includes(new URL(databaseUrl!).hostname));
  process.env.NODE_ENV="test"; process.env.DATABASE_URL=databaseUrl; process.env.ADMIN_API_KEY="admin-workflows-test-key"; process.env.ADMIN_LOGIN_EMAIL="workflow-test@sekanae.local";
  const {buildServer}=await import("../src/server.js");
  const {getPool,closePool}=await import("../src/db/pool.js");
  const {config}=await import("../src/config.js");
  const {upsertProductInDatabase}=await import("../src/repositories/admin-catalog-repository.js");
  const app=await buildServer();app.log.level="silent";
  const headers={authorization:"Bearer admin-workflows-test-key"};
  const marker=`workflow-${randomUUID()}`;
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  const productIds:string[]=[];const workIds:string[]=[];
  const owner=config.ADMIN_LOGIN_EMAIL;
  const pool=getPool();
  try {
    for (let index=0;index<ids.length;index++) {
      await pool.query(`insert into orders(id,customer_email,customer_name,currency,subtotal_cents,total_cents,status,payment_status,shipping_address,created_at) values($1,$2,$3,'EUR',1000,1000,$4,$5,$6,$7)`, [ids[index],`${marker}@example.com`,marker,index===2?'fulfilled':'paid',index===1?'unpaid':'paid',JSON.stringify({line1:'Test',city:'Test',country:'MT'}),['2026-09-05T00:00:00Z','2026-09-05T23:59:59.999Z','2026-09-06T00:00:00Z'][index]]);
    }
    await t.test("order-number/customer search, date boundaries, payment filters and pagination",async()=>{
      const list=async(query:string)=>{const r=await app.inject({url:`/api/admin/orders?${query}`,headers});assert.equal(r.statusCode,200,r.body);return r.json();};
      assert.equal((await list(`q=${ids[0].slice(0,8)}`)).data[0].id,ids[0]);
      assert.equal((await list(`q=${marker}&from=2026-09-05&to=2026-09-05`)).meta.total,2);
      assert.equal((await list(`q=${marker}&paymentStatus=paid&status=paid`)).meta.total,1);
      assert.equal((await list(`q=${marker}&limit=1&offset=1`)).meta.total,3);
      assert.equal((await list(`q=${marker}&limit=1&offset=1`)).data[0].id,ids[1]);
      assert.equal((await list(`q=${marker}%25`)).meta.total,0);
      assert.equal((await app.inject({url:'/api/admin/orders?from=2026-09-06&to=2026-09-05',headers})).statusCode,400);
      assert.equal((await app.inject({url:'/api/admin/orders?from=2026-02-30',headers})).statusCode,400);
      assert.equal((await app.inject({url:'/api/admin/orders?q=test'})).statusCode,401);
    });
    await t.test("dashboard count and list use the same published stock threshold including zero",async()=>{
      for(const [index,stock] of [0,5,6,0,0].entries()) {
        const product=productCsvRowToProduct(productImportRowsFromCsv(`name,category,price,stock,status\n${marker}-${index},Handbags,12,${stock},${index===3?'draft':'published'}`)[0]);
        await upsertProductInDatabase(product,{createOnly:true});productIds.push(product.id);
        if(index===4) await pool.query('update products set active=false where id=$1',[product.id]);
      }
      const response=await app.inject({url:'/api/admin/dashboard',headers});assert.equal(response.statusCode,200,response.body);
      const data=response.json().data;
      const expected=await pool.query("select count(*)::int as total from products p left join inventory i on i.product_id=p.id where p.active=true and p.status='published' and coalesce(i.quantity,0)<=5");
      assert.equal(data.metrics.lowStock,expected.rows[0].total);
      assert.ok(data.lowInventory.every((p:{stock:number})=>p.stock<=5));
      assert.ok(data.lowInventory.some((p:{id:string})=>p.id===productIds[0]));
      for(const id of productIds.slice(2)) assert.ok(!data.lowInventory.some((p:{id:string})=>p.id===id));
    });
    await t.test("saved CSV rows and order views survive a new server and enforce ownership/revisions",async()=>{
      assert.equal((await app.inject({url:'/api/admin/saved-work?kind=csv_review'})).statusCode,401);
      const rows=productImportRowsFromCsv('name,category,price,stock,status\nReview,Bags,-2,4,draft');
      const create=await app.inject({method:'POST',url:'/api/admin/saved-work',headers,payload:{kind:'csv_review',name:marker,payload:{filename:'review.csv',rows}}});
      assert.equal(create.statusCode,200,create.body);const work=create.json().data;workIds.push(work.id);
      const view=await app.inject({method:'POST',url:'/api/admin/saved-work',headers,payload:{kind:'order_view',name:marker,payload:{q:marker,paymentStatus:'paid'}}});assert.equal(view.statusCode,200,view.body);workIds.push(view.json().data.id);
      rows[0].values.price='25';
      const updateBody={kind:'csv_review',name:marker,payload:{filename:'review.csv',rows},revision:work.revision};
      const update=await app.inject({method:'PUT',url:`/api/admin/saved-work/${work.id}`,headers,payload:updateBody});assert.equal(update.statusCode,200,update.body);assert.equal(update.json().data.revision,2);
      assert.equal((await app.inject({method:'PUT',url:`/api/admin/saved-work/${work.id}`,headers,payload:updateBody})).statusCode,409);
      assert.equal((await app.inject({method:'DELETE',url:`/api/admin/saved-work/${work.id}`,headers,payload:{revision:1}})).statusCode,409);
      const second=await buildServer();second.log.level='silent';
      try {const r=await second.inject({url:`/api/admin/saved-work/${work.id}`,headers});assert.equal(r.json().data.payload.rows[0].values.price,'25');}finally{await second.close();}
      config.ADMIN_LOGIN_EMAIL='other-workflow-test@sekanae.local';
      assert.equal((await app.inject({url:`/api/admin/saved-work/${work.id}`,headers})).statusCode,404);
      const otherList=await app.inject({url:'/api/admin/saved-work?kind=csv_review',headers});assert.ok(!otherList.json().data.some((entry:{id:string})=>entry.id===work.id));
      assert.equal((await app.inject({method:'PUT',url:`/api/admin/saved-work/${work.id}`,headers,payload:{...updateBody,revision:2}})).statusCode,409);
      config.ADMIN_LOGIN_EMAIL=owner;
      const progress=await app.inject({method:'PATCH',url:`/api/admin/saved-work/${work.id}/csv-rows/2`,headers,payload:{revision:2,imported:true}});
      assert.equal(progress.statusCode,200,progress.body);assert.equal(progress.json().data.revision,3);
      const completed=await app.inject({url:`/api/admin/saved-work/${work.id}`,headers});
      assert.equal(completed.json().data.payload.rows[0].values.price,'25');
      assert.equal(completed.json().data.payload.rows[0].imported,true);
      assert.equal((await app.inject({method:'PATCH',url:`/api/admin/saved-work/${work.id}/csv-rows/2`,headers,payload:{revision:2,imported:false}})).statusCode,409);
      assert.equal((await app.inject({method:'DELETE',url:`/api/admin/saved-work/${work.id}`,headers,payload:{revision:3}})).statusCode,200);
    });
  } finally {
    config.ADMIN_LOGIN_EMAIL=owner;
    await pool.query('delete from admin_saved_work where id=any($1::uuid[])',[workIds]);
    await pool.query('delete from products where id=any($1)',[productIds]);
    await pool.query('delete from orders where id=any($1)',[ids]);
    await app.close();await closePool();
  }
});
