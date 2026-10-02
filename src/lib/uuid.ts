// KAN-92: the one copy of the id shape check.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The shape of an id these tables will accept.
 *
 * `documents.id` is a uuid column, so an address carrying anything else reaches
 * Postgres as "invalid input syntax for type uuid", which is an error rather
 * than an answer: the endpoint would say 500 where docs/api.md says 404, and a
 * mistyped /documents/... would render the error page instead of the not found
 * page. A letter nobody owns is absent however the address was arrived at, so
 * the shape is checked before the query rather than discovered after it.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
