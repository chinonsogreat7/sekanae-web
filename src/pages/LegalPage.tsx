import { Link } from "react-router-dom";
import { PageMeta } from "../components/PageMeta";

type LegalSection = {
  title: string;
  body: string;
};

type LegalPageProps = {
  title: string;
  description: string;
  path: string;
  updated: string;
  sections: LegalSection[];
};

function LegalPage({ title, description, path, updated, sections }: LegalPageProps) {
  return (
    <div className="page legal-page">
      <PageMeta title={title} description={description} path={path} />
      <section className="legal-hero">
        <div>
          <p className="microcopy">Client information</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <span>Last updated {updated}</span>
        </div>
      </section>
      <section className="legal-layout section-pad">
        <aside className="legal-aside">
          <Link to="/shipping">Shipping</Link>
          <Link to="/returns">Returns</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/client-care">Client Care</Link>
        </aside>
        <div className="legal-content">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ShippingPage() {
  return (
    <LegalPage
      title="Shipping"
      path="/shipping"
      updated="May 24, 2026"
      description="Tracked delivery guidance for SEKANAE accessories, gifts, and Bridal Atelier preview pieces."
      sections={[
        {
          title: "Delivery regions",
          body: "SEKANAE is prepared for international delivery across selected markets including the United States, United Kingdom, European Union, Nigeria, United Arab Emirates, and Singapore. Available shipping options are shown at checkout when live rates are enabled.",
        },
        {
          title: "Processing time",
          body: "In-stock accessories are prepared with care before dispatch. Bridal preview pieces, gift packaging, and special handling requests may require additional preparation time.",
        },
        {
          title: "Tracking",
          body: "Orders ship with tracked delivery whenever a carrier service is available. Tracking details are sent to the email used at checkout after fulfillment begins.",
        },
        {
          title: "Duties and taxes",
          body: "Import duties, local taxes, and customs fees may apply depending on destination. Where duties-paid options are not available, the recipient may be responsible for local charges before delivery.",
        },
      ]}
    />
  );
}

export function ReturnsPage() {
  return (
    <LegalPage
      title="Returns"
      path="/returns"
      updated="May 24, 2026"
      description="Return guidance for eligible unused SEKANAE pieces and client-care support."
      sections={[
        {
          title: "Eligibility",
          body: "Eligible unused pieces may be returned within 14 days of delivery when they are unworn, undamaged, and returned with original packaging, tags, and care materials.",
        },
        {
          title: "How to start a return",
          body: "Contact Client Care with your order email, order number, item name, and reason for return. We will confirm eligibility and provide the next steps.",
        },
        {
          title: "Final sale items",
          body: "Personalized items, opened intimate gift sets, and select Bridal Atelier preview pieces may be final sale unless required otherwise by applicable law.",
        },
        {
          title: "Refund timing",
          body: "Approved refunds are issued to the original payment method after returned items are received and inspected. Bank or payment-provider processing times may vary.",
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      path="/privacy"
      updated="May 24, 2026"
      description="How SEKANAE handles client information across shopping, checkout, newsletter, and concierge experiences."
      sections={[
        {
          title: "Information we collect",
          body: "We collect information you provide when shopping, subscribing, checking out, or contacting Client Care, such as name, email, delivery details, order details, preferences, and message content.",
        },
        {
          title: "How we use information",
          body: "We use client information to operate the storefront, process orders, provide support, send requested updates, protect the service, and improve the SEKANAE experience.",
        },
        {
          title: "Service providers",
          body: "We may use trusted providers for hosting, payments, email, analytics, and fulfillment. These providers process information only as needed to support the services they provide to us.",
        },
        {
          title: "Your choices",
          body: "You may unsubscribe from marketing emails using the unsubscribe link or contact Client Care to request help with access, correction, or deletion of personal information where applicable.",
        },
      ]}
    />
  );
}
