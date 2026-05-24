import { BarChart3, Boxes, ClipboardList, Edit3, Globe2, MailCheck, PackagePlus, Search, Send, Settings, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { adminMetrics, recentOrders } from "../data/editorial";
import { products } from "../data/catalog";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const adminTokenStorageKey = "sekanae_admin_token";

type NewsletterStats = {
  subscribed: number;
  unsubscribed: number;
  campaigns: number;
};

type NewsletterCampaign = {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
};

type AdminSessionResponse = {
  data: {
    authenticated: boolean;
    token: string;
    email: string;
    expiresAt: string;
  };
};

export function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [newsletterStats, setNewsletterStats] = useState<NewsletterStats | null>(null);
  const [campaignResult, setCampaignResult] = useState<NewsletterCampaign | null>(null);
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null);
  const [isSendingNewsletter, setIsSendingNewsletter] = useState(false);
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [html, setHtml] = useState("<p>A new SEKANAE edit is now available.</p>");
  const [text, setText] = useState("A new SEKANAE edit is now available.");

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem(adminTokenStorageKey);

    if (!savedToken) {
      return;
    }

    const token = savedToken;

    async function restoreSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/session`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          window.sessionStorage.removeItem(adminTokenStorageKey);
          return;
        }

        setAdminToken(token);
        setIsAuthenticated(true);
      } catch {
        window.sessionStorage.removeItem(adminTokenStorageKey);
      }
    }

    void restoreSession();
  }, []);

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const payload = await response.json() as Partial<AdminSessionResponse> & { error?: { message?: string } };

      if (!response.ok || !payload.data?.token) {
        throw new Error(payload.error?.message ?? "Invalid email or password.");
      }

      window.sessionStorage.setItem(adminTokenStorageKey, payload.data.token);
      setAdminToken(payload.data.token);
      setLoginPassword("");
      setIsAuthenticated(true);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(adminTokenStorageKey);
    setAdminToken("");
    setLoginPassword("");
    setIsAuthenticated(false);
    setNewsletterStats(null);
    setCampaignResult(null);
  }

  async function readNewsletterStats() {
    if (!adminToken) {
      setNewsletterMessage("Sign in again to continue.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/newsletter/stats`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load newsletter stats.");
      }

      const payload = await response.json() as { data: NewsletterStats };
      setNewsletterStats(payload.data);
      setNewsletterMessage(null);
    } catch {
      setNewsletterMessage("Newsletter stats are unavailable.");
    }
  }

  async function sendNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminToken) {
      setNewsletterMessage("Sign in again to continue.");
      return;
    }

    setIsSendingNewsletter(true);
    setNewsletterMessage(null);
    setCampaignResult(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/newsletter/campaigns/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          previewText: previewText || undefined,
          html,
          text: text || undefined,
        }),
      });

      const payload = await response.json() as { data?: NewsletterCampaign; error?: { message?: string } };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Newsletter send failed.");
      }

      setCampaignResult(payload.data);
      setNewsletterMessage("Newsletter campaign sent.");
      await readNewsletterStats();
    } catch (error) {
      setNewsletterMessage(error instanceof Error ? error.message : "Newsletter send failed.");
    } finally {
      setIsSendingNewsletter(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <section className="admin-login-panel">
          <p className="microcopy">Admin Studio</p>
          <h1>SEKANAE access</h1>
          <form onSubmit={submitAdminLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="admin@sekanae.co"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Checking access" : "Sign in"}
            </button>
          </form>
          {loginMessage && <p className="admin-status">{loginMessage}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="brand-mark">SEKANAE</div>
        <a href="#dashboard"><BarChart3 size={18} /> Dashboard</a>
        <a href="#products"><Boxes size={18} /> Products</a>
        <a href="#orders"><ClipboardList size={18} /> Orders</a>
        <a href="#newsletter"><MailCheck size={18} /> Newsletter</a>
        <a href="#content"><Edit3 size={18} /> Content</a>
        <a href="#markets"><Globe2 size={18} /> Markets</a>
        <a href="#settings"><Settings size={18} /> Settings</a>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="microcopy">Admin Studio</p>
            <h1>Manage SEKANAE</h1>
          </div>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Search products, orders, clients" />
          </div>
          <button className="admin-sign-out" type="button" onClick={signOut}>
            Sign out
          </button>
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
          <article className="admin-panel newsletter-admin-panel" id="newsletter">
            <div className="panel-heading">
              <h2>Newsletter</h2>
              <button type="button" onClick={readNewsletterStats}><MailCheck size={16} /> Refresh</button>
            </div>
            <div className="newsletter-admin-stats">
              <span><strong>{newsletterStats?.subscribed ?? "-"}</strong> subscribed</span>
              <span><strong>{newsletterStats?.unsubscribed ?? "-"}</strong> unsubscribed</span>
              <span><strong>{newsletterStats?.campaigns ?? "-"}</strong> campaigns</span>
            </div>
            <form className="newsletter-admin-form" onSubmit={sendNewsletter}>
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="New SEKANAE arrivals"
                  required
                />
              </label>
              <label>
                Preview text
                <input
                  value={previewText}
                  onChange={(event) => setPreviewText(event.target.value)}
                  placeholder="A short inbox preview"
                />
              </label>
              <label>
                Email HTML
                <textarea
                  value={html}
                  onChange={(event) => setHtml(event.target.value)}
                  required
                />
              </label>
              <label>
                Plain text fallback
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <button type="submit" disabled={isSendingNewsletter}>
                <Send size={16} /> {isSendingNewsletter ? "Sending" : "Send to subscribers"}
              </button>
            </form>
            {newsletterMessage && <p className="admin-status">{newsletterMessage}</p>}
            {campaignResult && (
              <p className="admin-status">
                Campaign {campaignResult.id.slice(0, 8)}: {campaignResult.sentCount}/{campaignResult.recipientCount} sent,
                {" "}{campaignResult.failedCount} failed.
              </p>
            )}
          </article>

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
