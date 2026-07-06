import { DOMAIN_URL } from '@/data/constants';

export type BreadcrumbItem = { name: string; url: string };

export const BreadcrumbJsonLd = ({ items }: { items: BreadcrumbItem[] }) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${DOMAIN_URL}${item.url}`,
    })),
  };

  // Escape "<" so a title containing "</script>" can't break out of the tag.
  const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
};
