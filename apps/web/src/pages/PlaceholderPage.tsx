import { Link } from "react-router-dom";

export function PlaceholderPage({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>{title}</h1>
            <p className="lede">{blurb}</p>
          </div>
        </div>
        <section className="card card-pad empty-state">
          <p className="muted">This screen is a stub for a later feature PR.</p>
          <Link to="/ingredients" className="btn btn-primary mt-16">
            Go to fridge
          </Link>
        </section>
      </div>
    </div>
  );
}
