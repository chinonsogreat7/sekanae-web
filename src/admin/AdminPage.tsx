import { BarChart3, Boxes, ClipboardList, Edit3, Globe2, PackagePlus, Search, Settings, Sparkles } from "lucide-react";
import { adminMetrics, recentOrders } from "../data/editorial";
import { products } from "../data/catalog";

export function AdminPage() {
  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="brand-mark">SEKANAE</div>
        <a href="#dashboard"><BarChart3 size={18} /> Dashboard</a>
        <a href="#products"><Boxes size={18} /> Products</a>
        <a href="#orders"><ClipboardList size={18} /> Orders</a>
        <a href="#content"><Edit3 size={18} /> Content</a>
        <a href="#markets"><Globe2 size={18} /> Markets</a>
        <a href="#settings"><Settings size={18} /> Settings</a>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="microcopy">Admin Studio</p>
            <h1>Manage the SEKANAE maison</h1>
          </div>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Search products, orders, clients" />
          </div>
        </header>

        <section className="admin-metrics" id="dashboard">
          {adminMetrics.map((metric) => (
            <article key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="admin-grid">
          <article className="admin-panel" id="products">
            <div className="panel-heading">
              <h2>Product Catalog</h2>
              <button type="button"><PackagePlus size={16} /> Add product</button>
            </div>
            <div className="admin-table">
              <div className="admin-table-head">
                <span>Product</span><span>Category</span><span>Stock</span><span>Status</span>
              </div>
              {products.slice(0, 6).map((product) => (
                <div className="admin-row" key={product.id}>
                  <span><img src={product.images[0]} alt="" /> {product.name}</span>
                  <span>{product.category}</span>
                  <span>{product.stock}</span>
                  <span>{product.isBridalPreview ? "Bridal preview" : product.isNew ? "New" : "Active"}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-panel" id="orders">
            <div className="panel-heading">
              <h2>Recent Orders</h2>
              <button type="button">Export</button>
            </div>
            <div className="order-list">
              {recentOrders.map((order) => (
                <div key={order.id}>
                  <strong>{order.id}</strong>
                  <span>{order.customer}</span>
                  <span>{order.market}</span>
                  <span>{order.total}</span>
                  <em>{order.status}</em>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel" id="content">
            <h2>Content Calendar</h2>
            <div className="content-tasks">
              <label><input type="checkbox" defaultChecked /> Publish Travel Edit journal story</label>
              <label><input type="checkbox" /> Prepare Bridal Atelier waitlist email</label>
              <label><input type="checkbox" /> Update gift packaging photography</label>
            </div>
          </article>
          <article className="admin-panel" id="markets">
            <h2>Markets and Readiness</h2>
            <div className="market-list">
              {["US", "UK", "EU", "Nigeria", "UAE", "Singapore"].map((market) => (
                <span key={market}><Sparkles size={14} /> {market}</span>
              ))}
            </div>
            <p>
              Next backend phase: connect inventory, tax, shipping zones, payment providers,
              and customer profiles through Shopify or a custom commerce API.
            </p>
          </article>
        </section>
      </section>
    </div>
  );
}
