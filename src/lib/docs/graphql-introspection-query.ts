/**
 * The standard GraphQL introspection query + the minimal TypeScript shape of
 * its result that the docs pipeline needs.
 *
 * The repo doesn't depend on the `graphql` package (checked before adding —
 * see the Phase 2 implementation report), so this hand-rolls the well-known,
 * stable introspection query text (the same shape `graphql-js`'s
 * `getIntrospectionQuery()` produces) instead of pulling in a new dependency
 * for one query string.
 *
 * IMPORTANT: `scripts/refresh-graphql-schema-snapshot.mjs` duplicates this
 * query text (it's a plain Node script and can't import TypeScript). If you
 * change the query shape here, update that script too.
 */

export const GRAPHQL_INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export interface IntrospectionTypeRef {
  kind: string;
  name: string | null;
  ofType: IntrospectionTypeRef | null;
}

export interface IntrospectionInputValue {
  name: string;
  description: string | null;
  type: IntrospectionTypeRef;
  defaultValue: string | null;
}

export interface IntrospectionField {
  name: string;
  description: string | null;
  args: IntrospectionInputValue[];
  type: IntrospectionTypeRef;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface IntrospectionEnumValue {
  name: string;
  description: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface IntrospectionType {
  kind: string;
  name: string;
  description: string | null;
  fields: IntrospectionField[] | null;
  inputFields: IntrospectionInputValue[] | null;
  interfaces: IntrospectionTypeRef[] | null;
  enumValues: IntrospectionEnumValue[] | null;
  possibleTypes: IntrospectionTypeRef[] | null;
}

export interface IntrospectionSchema {
  queryType: { name: string } | null;
  mutationType: { name: string } | null;
  subscriptionType: { name: string } | null;
  types: IntrospectionType[];
}

/** The raw shape written to the committed snapshot and returned over the wire. */
export interface IntrospectionQueryResult {
  data: {
    __schema: IntrospectionSchema;
  };
}
