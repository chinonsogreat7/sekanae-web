import { Mail, MessageCircle, PackageCheck, RotateCcw } from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBaseUrl } from "../api/config";
import { CustomSelect } from "../components/CustomSelect";
import { PageMeta } from "../components/PageMeta";

const apiBaseUrl = getApiBaseUrl();

export function ClientCarePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("Product guidance");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitConciergeRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/concierge/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, topic, message }),
      });

      if (!response.ok) {
        throw new Error("Concierge request failed.");
      }

      setName("");
      setEmail("");
      setTopic("Product guidance");
      setMessage("");
      setStatus("Your request has been received. Client Care will reply by email.");
    } catch {
      const mailto = `mailto:care@sekanae.co?subject=${encodeURIComponent(`SEKANAE concierge request: ${topic}`)}&body=${encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`
      )}`;
      setStatus("We could not send this automatically. Please email care@sekanae.co or use the prepared email link below.");
      window.setTimeout(() => {
        window.location.href = mailto;
      }, 250);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageMeta
        title="Client Care"
        path="/client-care"
        description="Contact SEKANAE Client Care for product guidance, shipping, returns, gift packaging, and Bridal Atelier preview requests."
      />
      <section className="page-hero care-hero">
        <div>
          <h1>Client Care</h1>
          <p>
            Concierge-style support for international shipping, gifts, materials,
            returns, and Bridal Atelier private preview requests.
          </p>
        </div>
      </section>
      <section className="care-layout section-pad">
        <div className="faq-grid">
          <article><PackageCheck size={22} /><h2>Shipping</h2><p>Tracked international delivery with express options for selected markets.</p></article>
          <article><RotateCcw size={22} /><h2>Returns</h2><p>Eligible unused pieces may be returned within 14 days in original packaging.</p></article>
          <article><Mail size={22} /><h2>Materials</h2><p>Care guidance is included with every piece, from silk and leather to pearls and vermeil.</p></article>
          <article><MessageCircle size={22} /><h2>Concierge</h2><p>Request styling, gifting, or Bridal Atelier guidance from the SEKANAE client care team.</p></article>
        </div>
        <form className="concierge-form" onSubmit={submitConciergeRequest}>
          <h2>Contact the Concierge</h2>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <CustomSelect
            label="Topic"
            name="topic"
            value={topic}
            onChange={setTopic}
            options={[
              "Product guidance",
              "Shipping and returns",
              "Gift packaging",
              "Bridal Atelier preview",
            ]}
          />
          <label>
            Message
            <textarea
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending" : "Send request"}
          </button>
          {status && <p className="form-status">{status}</p>}
        </form>
      </section>
    </div>
  );
}
