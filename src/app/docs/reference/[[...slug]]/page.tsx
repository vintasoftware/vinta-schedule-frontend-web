import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocsContainer } from '@/components/docs/docs-container';
import { SchemaOperationsView } from '@/components/docs/schema-operations-view';
import { SchemaReferenceIndex } from '@/components/docs/schema-reference-index';
import { SchemaTypeDetail } from '@/components/docs/schema-type-detail';
import { SchemaTypesView } from '@/components/docs/schema-types-view';
import {
  buildOperationExample,
  type OperationType,
} from '@/lib/docs/build-operation-example';
import { getSchemaIntrospection } from '@/lib/docs/introspect-schema';
import {
  parseSchema,
  type GraphQLSchemaField,
  type GraphQLSchemaModel,
  type GraphQLSchemaType,
} from '@/lib/docs/parse-schema';
import { renderDocMarkdownToSafeHtml } from '@/lib/docs/render-doc-markdown';

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
 * Pre-render one highlighted GraphQL example per operation, keyed by field
 * name. Runs at build time (static export), so the per-field markdown render
 * never reaches a request. Highlighting reuses the docs markdown pipeline via a
 * fenced `graphql` block, so it shares the same sanitize + `hljs` output.
 */
async function buildExamples(
  fields: GraphQLSchemaField[],
  operationType: OperationType,
  typesByName: Map<string, GraphQLSchemaType>
): Promise<Map<string, string>> {
  const examples = new Map<string, string>();
  for (const field of fields) {
    const code = buildOperationExample(field, operationType, typesByName);
    const html = await renderDocMarkdownToSafeHtml(
      `\`\`\`graphql\n${code}\n\`\`\``
    );
    examples.set(field.name, html);
  }
  return examples;
}

/**
 * Statically generates the reference overview (`/docs/reference`), the three
 * section pages (`/queries`, `/mutations`, `/types`), and one page per
 * documented type (`/types/<name>`). Only `OBJECT`, `INPUT_OBJECT`, and `ENUM`
 * kinds get a detail page — see the filtering rationale in `parse-schema.ts`.
 */
export async function generateStaticParams() {
  const model = await loadModel();

  return [
    { slug: [] },
    { slug: ['queries'] },
    { slug: ['mutations'] },
    { slug: ['types'] },
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

  if (slug && slug[0] === 'queries') {
    return {
      title: 'Queries',
      description: 'Every query in the public GraphQL schema.',
    };
  }

  if (slug && slug[0] === 'mutations') {
    return {
      title: 'Mutations',
      description: 'Every mutation in the public GraphQL schema.',
    };
  }

  if (slug && slug[0] === 'types') {
    return {
      title: 'Types',
      description: 'Every type in the public GraphQL schema.',
    };
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
  const documentedTypeNames = new Set(model.types.map((t) => t.name));

  if (!slug || slug.length === 0) {
    return (
      <DocsContainer>
        <SchemaReferenceIndex model={model} />
      </DocsContainer>
    );
  }

  if (slug.length === 1 && slug[0] === 'queries') {
    const typesByName = new Map(model.types.map((t) => [t.name, t]));
    const examples = await buildExamples(model.queries, 'query', typesByName);
    return (
      <DocsContainer>
        <SchemaOperationsView
          title='Queries'
          intro={`Read operations on POST /graphql/ — ${model.queries.length} in all. Each shows its arguments, return type, and an example request.`}
          operationType='query'
          fields={model.queries}
          documentedTypeNames={documentedTypeNames}
          examples={examples}
          emptyLabel='This schema has no queries.'
        />
      </DocsContainer>
    );
  }

  if (slug.length === 1 && slug[0] === 'mutations') {
    const typesByName = new Map(model.types.map((t) => [t.name, t]));
    const examples = await buildExamples(
      model.mutations,
      'mutation',
      typesByName
    );
    return (
      <DocsContainer>
        <SchemaOperationsView
          title='Mutations'
          intro={`Write operations on POST /graphql/ — ${model.mutations.length} in all. Each shows its arguments, return type, and an example request.`}
          operationType='mutation'
          fields={model.mutations}
          documentedTypeNames={documentedTypeNames}
          examples={examples}
          emptyLabel='This schema has no mutations.'
        />
      </DocsContainer>
    );
  }

  if (slug.length === 1 && slug[0] === 'types') {
    return (
      <DocsContainer>
        <SchemaTypesView model={model} />
      </DocsContainer>
    );
  }

  if (slug.length === 2 && slug[0] === 'types') {
    const type = model.types.find((t) => t.slug === slug[1]);

    if (!type) {
      notFound();
    }

    return (
      <DocsContainer>
        <SchemaTypeDetail
          type={type}
          documentedTypeNames={documentedTypeNames}
        />
      </DocsContainer>
    );
  }

  notFound();
}
