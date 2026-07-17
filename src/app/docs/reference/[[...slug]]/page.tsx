import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SchemaReferenceIndex } from '@/components/docs/schema-reference-index';
import { SchemaTypeDetail } from '@/components/docs/schema-type-detail';
import { getSchemaIntrospection } from '@/lib/docs/introspect-schema';
import { parseSchema, type GraphQLSchemaModel } from '@/lib/docs/parse-schema';

/**
 * Loads and normalizes the schema once per render — cheap even if called
 * from both `generateStaticParams` and every page, because
 * `getSchemaIntrospection` memoizes the underlying fetch/snapshot-read for
 * the lifetime of the build process.
 */
async function loadModel(): Promise<GraphQLSchemaModel> {
  const { schema } = await getSchemaIntrospection();
  return parseSchema(schema);
}

/**
 * Statically generates the index (`/docs/reference`) plus one page per
 * documented type (`/docs/reference/types/<name>`). Only `OBJECT`,
 * `INPUT_OBJECT`, and `ENUM` kinds get a detail page — see the filtering
 * rationale in `parse-schema.ts`.
 */
export async function generateStaticParams() {
  const model = await loadModel();

  return [
    { slug: [] },
    ...model.types.map((type) => ({ slug: ['types', type.slug] })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (slug && slug[0] === 'types' && slug[1]) {
    return { title: slug[1] };
  }

  return {
    title: 'Schema Reference',
    description:
      'Every query, mutation, and type in the public GraphQL schema.',
  };
}

export default async function SchemaReferencePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const model = await loadModel();

  if (!slug || slug.length === 0) {
    return <SchemaReferenceIndex model={model} />;
  }

  if (slug.length === 2 && slug[0] === 'types') {
    const type = model.types.find((t) => t.slug === slug[1]);

    if (!type) {
      notFound();
    }

    const documentedTypeNames = new Set(model.types.map((t) => t.name));
    return (
      <SchemaTypeDetail type={type} documentedTypeNames={documentedTypeNames} />
    );
  }

  notFound();
}
