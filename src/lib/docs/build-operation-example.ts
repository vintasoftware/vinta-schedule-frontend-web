/**
 * Generates a copy-pasteable example GraphQL operation for a schema field, plus
 * the humanized-description helpers the reference cards use.
 *
 * The example is built purely from the introspected schema: required arguments
 * are filled with placeholder values keyed to their type, input objects are
 * expanded one level deep, and object return types get a shallow selection set
 * of their leaf fields. It is meant to show the *shape* of a valid request, not
 * to be a runnable call — the placeholder ids (`"<organizationId>"`) must be
 * swapped for real values.
 */

import type {
  GraphQLSchemaArg,
  GraphQLSchemaField,
  GraphQLSchemaType,
} from './parse-schema';

export type OperationType = 'query' | 'mutation';

const INDENT = '  ';

/** Insert spaces at camelCase / ACRONYM boundaries so a field name reads as prose. */
export function humanizeFieldName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The description shown on every operation card: the schema's own description
 * when it has one, otherwise a humanized sentence derived from the field name
 * so no card is ever left blank.
 */
export function describeOperation(
  field: GraphQLSchemaField,
  operationType: OperationType
): string {
  const own = field.description?.trim();
  if (own) return own;

  const humanized = humanizeFieldName(field.name);
  if (operationType === 'query') {
    const lower = humanized.charAt(0).toLowerCase() + humanized.slice(1);
    return `Returns ${lower}.`;
  }
  return `${humanized}.`;
}

/** camelCase → PascalCase, for the named operation in the example. */
function toOperationName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** A field whose type is a scalar or enum — a selection-set leaf, not an object to drill into. */
function isLeaf(
  typeName: string | null,
  typesByName: Map<string, GraphQLSchemaType>
): boolean {
  if (!typeName) return true;
  const type = typesByName.get(typeName);
  return !type || type.kind !== 'OBJECT';
}

/** A placeholder value for an argument or input field, chosen from its named type. */
function renderValue(
  name: string,
  typeSignature: string,
  typeName: string | null,
  typesByName: Map<string, GraphQLSchemaType>,
  depth: number,
  visited: Set<string>
): string {
  const isList = typeSignature.includes('[');
  const base = renderBaseValue(name, typeName, typesByName, depth, visited);
  return isList ? `[${base}]` : base;
}

function renderBaseValue(
  name: string,
  typeName: string | null,
  typesByName: Map<string, GraphQLSchemaType>,
  depth: number,
  visited: Set<string>
): string {
  switch (typeName) {
    case 'ID':
    case 'String':
      return `"<${name}>"`;
    case 'Int':
      return '10';
    case 'Float':
      return '1.0';
    case 'Boolean':
      return 'true';
    case 'DateTime':
      return '"2025-01-01T00:00:00Z"';
    case 'JSON':
      return '{}';
    case null:
      return 'null';
  }

  const type = typesByName.get(typeName);
  if (!type) return `"<${name}>"`;

  if (type.kind === 'ENUM') {
    return type.enumValues[0]?.name ?? 'null';
  }

  if (type.kind === 'INPUT_OBJECT') {
    if (depth <= 0 || visited.has(type.name)) return '{}';
    const nextVisited = new Set(visited).add(type.name);
    const required = type.inputFields.filter((f) => f.type.endsWith('!'));
    const chosen = required.length ? required : type.inputFields.slice(0, 3);
    if (chosen.length === 0) return '{}';
    const parts = chosen.map(
      (f) =>
        `${f.name}: ${renderValue(f.name, f.type, f.typeName, typesByName, depth - 1, nextVisited)}`
    );
    return `{ ${parts.join(', ')} }`;
  }

  return `"<${name}>"`;
}

/**
 * A shallow selection set for an object return type: up to 6 leaf fields, then
 * up to a couple of nested objects (one level deeper), guarding against cycles.
 * Returns '' when the type is a leaf itself, so the caller knows to omit a
 * selection set entirely.
 */
function buildSelection(
  typeName: string | null,
  typesByName: Map<string, GraphQLSchemaType>,
  depth: number,
  indentLevel: number,
  visited: Set<string>
): string {
  if (!typeName) return '';
  const type = typesByName.get(typeName);
  if (!type || type.kind !== 'OBJECT') return '';
  if (visited.has(typeName)) return '';

  const nextVisited = new Set(visited).add(typeName);
  const inner = INDENT.repeat(indentLevel + 1);
  const closing = INDENT.repeat(indentLevel);
  const lines: string[] = [];

  for (const field of type.fields) {
    if (isLeaf(field.typeName, typesByName)) {
      lines.push(inner + field.name);
      if (lines.length >= 6) break;
    }
  }

  if (depth > 1) {
    for (const field of type.fields) {
      if (lines.length >= 8) break;
      if (isLeaf(field.typeName, typesByName)) continue;
      const sub = buildSelection(
        field.typeName,
        typesByName,
        depth - 1,
        indentLevel + 1,
        nextVisited
      );
      if (sub) lines.push(`${inner}${field.name} ${sub}`);
    }
  }

  if (lines.length === 0) lines.push(inner + '__typename');

  return `{\n${lines.join('\n')}\n${closing}}`;
}

function renderArgs(
  args: GraphQLSchemaArg[],
  typesByName: Map<string, GraphQLSchemaType>
): string {
  // Only required (non-null) args go in the example — the minimal valid call.
  const required = args.filter((a) => a.type.endsWith('!'));
  const parts = required.map(
    (a) =>
      `${a.name}: ${renderValue(a.name, a.type, a.typeName, typesByName, 2, new Set())}`
  );

  if (parts.length === 0) return '';
  if (parts.length === 1) return `(${parts[0]})`;

  // Break multiple args onto their own lines so the call stays readable.
  const argIndent = INDENT.repeat(2);
  return `(\n${parts.map((p) => argIndent + p).join('\n')}\n${INDENT})`;
}

/**
 * Build a named example operation for a query or mutation field, e.g.
 *
 *   query CalendarGroupBookableSlots {
 *     calendarGroupBookableSlots(organizationId: "<organizationId>", …) {
 *       id
 *       start
 *     }
 *   }
 */
export function buildOperationExample(
  field: GraphQLSchemaField,
  operationType: OperationType,
  typesByName: Map<string, GraphQLSchemaType>
): string {
  const args = renderArgs(field.args, typesByName);
  const selection = buildSelection(
    field.typeName,
    typesByName,
    2,
    1,
    new Set()
  );
  const selectionPart = selection ? ` ${selection}` : '';

  const line = `${INDENT}${field.name}${args}${selectionPart}`;
  return `${operationType} ${toOperationName(field.name)} {\n${line}\n}`;
}
