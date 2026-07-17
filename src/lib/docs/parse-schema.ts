/**
 * Normalizes raw GraphQL introspection JSON into `GraphQLSchemaModel` — the
 * shape the schema reference pages render.
 *
 * Deliberate filtering (151 live types is too many to render 1:1):
 * - `__`-prefixed introspection meta-types (`__Schema`, `__Type`, …) are
 *   always dropped — they document the introspection system itself, never
 *   the public API.
 * - The `Query` / `Mutation` root OBJECT types are not included in `types`;
 *   their fields are surfaced as `queries` / `mutations` instead, which is
 *   how every GraphQL reference doc (and the reference index page) presents
 *   them.
 * - Only `OBJECT`, `INPUT_OBJECT`, and `ENUM` kinds get a `types` entry (and
 *   therefore a `/docs/reference/types/<name>` detail page via
 *   `generateStaticParams`) — those are the kinds with fields/values worth a
 *   dedicated page. `INTERFACE` and `UNION` are not currently used by this
 *   schema (0 occurrences in the live introspection) so they're intentionally
 *   left unhandled rather than speculatively supported.
 * - `SCALAR` types never get a detail page (nothing to enumerate beyond a
 *   description) — the five GraphQL built-ins (`ID`/`String`/`Int`/`Float`/
 *   `Boolean`) are dropped entirely, and the schema's two custom scalars
 *   (`DateTime`, `JSON`) are surfaced as `scalars` for a short inline
 *   mention on the index page.
 */

import type {
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionSchema,
  IntrospectionTypeRef,
} from './graphql-introspection-query';

const BUILTIN_SCALARS = new Set(['ID', 'String', 'Int', 'Float', 'Boolean']);

const DOCUMENTED_TYPE_KINDS = new Set(['OBJECT', 'INPUT_OBJECT', 'ENUM']);

export type GraphQLSchemaTypeKind = 'OBJECT' | 'INPUT_OBJECT' | 'ENUM';

export interface GraphQLSchemaArg {
  name: string;
  description: string | null;
  /** Rendered type signature, e.g. `[BookableSlot!]!`. */
  type: string;
  /** The innermost named type, for cross-linking to its detail page. */
  typeName: string | null;
  defaultValue: string | null;
}

export interface GraphQLSchemaField {
  name: string;
  description: string | null;
  args: GraphQLSchemaArg[];
  /** Rendered type signature, e.g. `[BookableSlot!]!`. */
  type: string;
  /** The innermost named type, for cross-linking to its detail page. */
  typeName: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface GraphQLSchemaEnumValue {
  name: string;
  description: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface GraphQLSchemaScalar {
  name: string;
  description: string | null;
}

export interface GraphQLSchemaType {
  kind: GraphQLSchemaTypeKind;
  name: string;
  /** URL-safe identifier for `/docs/reference/types/<slug>`. GraphQL type names are already identifier-safe, so this equals `name`. */
  slug: string;
  description: string | null;
  /** Populated for OBJECT. */
  fields: GraphQLSchemaField[];
  /** Populated for INPUT_OBJECT. */
  inputFields: GraphQLSchemaField[];
  /** Populated for ENUM. */
  enumValues: GraphQLSchemaEnumValue[];
}

export interface GraphQLSchemaModel {
  queries: GraphQLSchemaField[];
  mutations: GraphQLSchemaField[];
  types: GraphQLSchemaType[];
  scalars: GraphQLSchemaScalar[];
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name);

const isIntrospectionTypeName = (name: string) => name.startsWith('__');

/**
 * Renders a `__Type` reference chain (NON_NULL/LIST wrappers around a named
 * type) into GraphQL SDL-style notation, e.g. `NON_NULL(LIST(NON_NULL(OBJECT
 * BookableSlot)))` → `{ display: '[BookableSlot!]!', namedType: 'BookableSlot' }`.
 */
function formatTypeRef(ref: IntrospectionTypeRef): {
  display: string;
  namedType: string | null;
} {
  if (ref.kind === 'NON_NULL') {
    const inner = formatTypeRef(
      ref.ofType ?? { kind: 'SCALAR', name: null, ofType: null }
    );
    return { display: `${inner.display}!`, namedType: inner.namedType };
  }

  if (ref.kind === 'LIST') {
    const inner = formatTypeRef(
      ref.ofType ?? { kind: 'SCALAR', name: null, ofType: null }
    );
    return { display: `[${inner.display}]`, namedType: inner.namedType };
  }

  return { display: ref.name ?? 'Unknown', namedType: ref.name };
}

function parseArg(arg: IntrospectionInputValue): GraphQLSchemaArg {
  const { display, namedType } = formatTypeRef(arg.type);
  return {
    name: arg.name,
    description: arg.description,
    type: display,
    typeName: namedType,
    defaultValue: arg.defaultValue,
  };
}

function parseField(field: IntrospectionField): GraphQLSchemaField {
  const { display, namedType } = formatTypeRef(field.type);
  return {
    name: field.name,
    description: field.description,
    args: (field.args ?? []).map(parseArg).sort(byName),
    type: display,
    typeName: namedType,
    isDeprecated: field.isDeprecated,
    deprecationReason: field.deprecationReason,
  };
}

/** Input object fields (`__InputValue`) reuse the field shape, sans `args`/deprecation (introspection doesn't report either for input fields). */
function parseInputField(field: IntrospectionInputValue): GraphQLSchemaField {
  const { display, namedType } = formatTypeRef(field.type);
  return {
    name: field.name,
    description: field.description,
    args: [],
    type: display,
    typeName: namedType,
    isDeprecated: false,
    deprecationReason: null,
  };
}

/** Normalizes raw introspection JSON into the `GraphQLSchemaModel` reference pages render. */
export function parseSchema(schema: IntrospectionSchema): GraphQLSchemaModel {
  const queryTypeName = schema.queryType?.name ?? null;
  const mutationTypeName = schema.mutationType?.name ?? null;

  const queryType = schema.types.find((t) => t.name === queryTypeName);
  const mutationType = schema.types.find((t) => t.name === mutationTypeName);

  const queries = (queryType?.fields ?? []).map(parseField).sort(byName);
  const mutations = (mutationType?.fields ?? []).map(parseField).sort(byName);

  const scalars = schema.types
    .filter(
      (t) =>
        t.kind === 'SCALAR' &&
        !isIntrospectionTypeName(t.name) &&
        !BUILTIN_SCALARS.has(t.name)
    )
    .map((t) => ({ name: t.name, description: t.description }))
    .sort(byName);

  const types = schema.types
    .filter(
      (t) =>
        DOCUMENTED_TYPE_KINDS.has(t.kind) &&
        !isIntrospectionTypeName(t.name) &&
        t.name !== queryTypeName &&
        t.name !== mutationTypeName
    )
    .map((t): GraphQLSchemaType => {
      const kind = t.kind as GraphQLSchemaTypeKind;
      return {
        kind,
        name: t.name,
        slug: t.name,
        description: t.description,
        fields: (t.fields ?? []).map(parseField).sort(byName),
        inputFields: (t.inputFields ?? []).map(parseInputField).sort(byName),
        enumValues: (t.enumValues ?? [])
          .map((v) => ({
            name: v.name,
            description: v.description,
            isDeprecated: v.isDeprecated,
            deprecationReason: v.deprecationReason,
          }))
          .sort(byName),
      };
    })
    .sort(byName);

  return { queries, mutations, types, scalars };
}
