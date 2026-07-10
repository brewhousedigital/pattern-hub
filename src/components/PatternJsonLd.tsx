import { DOMAIN_URL } from '@/data/constants';
import { generatePbImageOpenGraph } from '@/functions/utilities/generate-pb-image';
import type { TypePatternResponse } from '@/functions/database/patterns';

export const PatternJsonLd = ({ pattern }: { pattern: TypePatternResponse }) => {
  const authors = [...(pattern.expand?.authors?.map((a) => a.name) ?? []), ...(pattern.author_manual ?? [])].filter(
    Boolean,
  );

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: pattern.name,
    description: pattern.description || `Stained glass pattern: ${pattern.name}`,
    url: `${DOMAIN_URL}/pattern/${pattern.id}`,
    image: generatePbImageOpenGraph(pattern),
  };

  if (pattern.tags?.length) jsonLd.keywords = pattern.tags.join(', ');
  if (pattern.design_date) jsonLd.dateCreated = new Date(pattern.design_date as unknown as string).toISOString();
  if (pattern.created) jsonLd.datePublished = new Date(pattern.created).toISOString();
  if (pattern.updated) jsonLd.dateModified = new Date(pattern.updated).toISOString();
  if (authors.length) jsonLd.author = authors.map((name) => ({ '@type': 'Person', name }));

  if (pattern.total_ratings && pattern.total_ratings > 0 && pattern.avg_rating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: pattern.avg_rating,
      reviewCount: pattern.total_ratings,
    };
  }

  const additionalProperty: Record<string, unknown>[] = [];
  if (pattern.difficulty) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'difficulty', value: pattern.difficulty });
  }
  if (pattern.pieces) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'pieces', value: pattern.pieces });
  }
  if (additionalProperty.length) jsonLd.additionalProperty = additionalProperty;

  // Escape "<" so a pattern name/description containing "</script>" can't break out of the tag.
  const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
};
