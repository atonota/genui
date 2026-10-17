export type GenUXQuoteProps = {
  quote: string;
  attribution: string;
  context?: string;
};

/** Quotation with a visible source; context discloses examples instead of implying endorsement. */
export default function GenUXQuote({ quote, attribution, context }: GenUXQuoteProps) {
  return (
    <figure className="genux-quote">
      <blockquote className="genux-quote-text">
        <p>{quote}</p>
      </blockquote>
      {/* A person is not a work title, so the attribution is plain caption text, not cite. */}
      <figcaption className="genux-quote-caption">
        <span className="genux-quote-attribution">{attribution}</span>
        {context && <span className="genux-quote-context">{context}</span>}
      </figcaption>
    </figure>
  );
}
