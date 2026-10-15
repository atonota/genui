export type AtlasQuoteProps = {
  quote: string;
  attribution: string;
  context?: string;
};

/** Quotation with a visible source; context discloses examples instead of implying endorsement. */
export default function AtlasQuote({ quote, attribution, context }: AtlasQuoteProps) {
  return (
    <figure className="atlas-quote">
      <blockquote className="atlas-quote-text">
        <p>{quote}</p>
      </blockquote>
      {/* A person is not a work title, so the attribution is plain caption text, not cite. */}
      <figcaption className="atlas-quote-caption">
        <span className="atlas-quote-attribution">{attribution}</span>
        {context && <span className="atlas-quote-context">{context}</span>}
      </figcaption>
    </figure>
  );
}
