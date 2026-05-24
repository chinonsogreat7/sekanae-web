import { PageMeta } from "../components/PageMeta";
import { SectionHeading } from "../components/SectionHeading";
import { lookbookStories } from "../data/editorial";

export function LookbookPage() {
  return (
    <div className="page">
      <PageMeta
        title="The Lookbook"
        path="/lookbook"
        description="Styling notes from SEKANAE for work, travel, evening events, ceremony, and everyday luxury."
      />
      <section className="page-hero lookbook-hero">
        <div>
          <h1>The Lookbook</h1>
          <p>
            Styling notes for work, travel, evening events, and everyday luxury.
          </p>
        </div>
      </section>
      <section className="section-pad">
        <SectionHeading title="How SEKANAE moves" copy="Accessories for lives with appointments, passports, dinners, and ceremonies." />
        <div className="lookbook-grid">
          {lookbookStories.map((story) => (
            <article key={story.title}>
              <img src={story.image} alt={`${story.title} styling`} />
              <div>
                <h2>{story.title}</h2>
                <p>{story.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
