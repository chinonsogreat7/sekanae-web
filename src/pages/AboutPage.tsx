export function AboutPage() {
  return (
    <div className="page">
      <section className="about-hero">
        <div>
          <h1>A refined accessories maison for women in motion.</h1>
          <p>
            SEKANAE creates accessories with a global point of view: elegant, useful,
            giftable pieces designed for modern women whose lives move across cultures,
            calendars, cities, and ceremonies.
          </p>
        </div>
        <img
          src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=85"
          alt="SEKANAE editorial portrait"
        />
      </section>
      <section className="story-grid section-pad">
        <article>
          <h2>Craft</h2>
          <p>
            We begin with proportion, tactility, and restraint: leather that ages with
            grace, silk that brings light to tailoring, and jewelry that completes a
            look without overtaking it.
          </p>
        </article>
        <article>
          <h2>Culture</h2>
          <p>
            The brand is inspired by boutique hotels, galleries, old cities, modern
            terminals, and the intimate rituals women carry across borders.
          </p>
        </article>
        <article>
          <h2>Ceremony</h2>
          <p>
            Our Bridal Atelier is part of the future of SEKANAE: a quieter kind of
            wedding luxury for destination celebrations, vows, gifts, and keepsakes.
          </p>
        </article>
      </section>
    </div>
  );
}
