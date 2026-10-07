---
name: kysely-migration-generator
description: Translates a Mermaid ERD (docs/architecture/schema.mmd, or the compiled docs/architecture/erd.svg) into a type-safe Kysely PostgreSQL migration in src/db/migrations/. Use when the user asks to generate, create or write a database migration, Kysely schema, DDL or tables from an ERD, Mermaid diagram, schema.mmd or data model.
---

# Kysely Migration Generator

Convert the Mermaid `erDiagram` in `docs/architecture/` into a Kysely migration that type-checks
(`npm run build`) and executes (`npm run migrate:up`).

## Inputs

1. **Source of truth:** `docs/architecture/schema.mmd`. If only `docs/architecture/erd.svg` exists,
   read the entity names, attribute rows (type, name, keys) and relationship labels from the SVG's
   text nodes and reconstruct the model from them.
2. **Reference baseline:** read every file in `src/db/migrations/` first.
   - Follow the structure and style of `001_initial_schema.ts` (imports, `Kysely<any>`, `` sql`NOW()` ``).
   - Build the list of **tables that already exist**. Never re-create them; only add FKs pointing
     to them. (`users` is created by `001_initial_schema.ts` with an `id serial` PK.)
   - Entities marked in `%%` comments as "already exists" are treated the same way.

## Translation Rules

### Entities to Tables
- Table name = entity name converted to **snake_case, lower case**: `USERS` -> `users`,
  `BookAuthors` / `BOOK_AUTHORS` -> `book_authors`. Column names are snake_case as well.
- One `db.schema.createTable('<name>')` chain per new entity, ending in `.execute()`.

### Data types (Mermaid -> Kysely / PostgreSQL)

| Mermaid type | Kysely column type |
| --- | --- |
| `int`, `integer` (non-PK) | `'integer'` |
| `bigint` | `'bigint'` |
| `serial` | `'serial'` |
| `uuid` | `'uuid'` |
| `string`, `varchar` | `'varchar(255)'` |
| `text` | `'text'` |
| `boolean`, `bool` | `'boolean'` |
| `date` | `'date'` |
| `datetime`, `timestamp` | `'timestamp'` |
| `decimal`, `numeric`, `money` | `'numeric(10, 2)'` |
| `float`, `double` | `'double precision'` |
| `json`, `jsonb` | `'jsonb'` |

### Keys & Columns
- **`PK` -> auto-generating IDs**
  - integer PK (`int`, `serial`, `bigint`): `.addColumn('id', 'serial', (col) => col.primaryKey())`
  - `uuid` PK: ``.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))``
  - Junction table whose keys are two `PK, FK` columns: no surrogate id; add
    `.addPrimaryKeyConstraint('<table>_pkey', ['<a>_id', '<b>_id'])`.
- **`FK` -> references with cascade**
  `.addColumn('author_id', 'integer', (col) => col.references('authors.id').onDelete('cascade').notNull())`
  - FK column type must match the referenced PK: `serial` PK -> `'integer'` FK, `uuid` PK -> `'uuid'` FK.
  - Resolve the referenced table from the relationship line; fall back to the `<singular>_id` naming convention.
  - FKs are `.notNull()` unless the attribute comment says `nullable`/`optional` or the parent side
    of the relationship is optional (`|o--o{`).
- **`UK`** -> `.unique()`.
- Attribute comments: `not null` / `required` -> `.notNull()`; `unique` -> `.unique()`;
  `default <value>` -> `.defaultTo(<value>)` (use `` sql`...` `` for SQL expressions);
  `check <expr>` -> ``.check(sql`<expr>`)``.
- `created_at` / `updated_at` timestamps -> ``.defaultTo(sql`NOW()`).notNull()``.

### Cardinalities

| Mermaid | Meaning | Kysely output |
| --- | --- | --- |
| `A \|\|--o{ B` | one-to-many | FK column on **B** referencing `a.id` (not unique) |
| `A \|\|--\|{ B` | one-to-one-or-many | same as above, FK `.notNull()` |
| `A \|\|--o\| B` | one-to-one (zero-or-one) | FK column on **B** referencing `a.id` **with `.unique()`** |
| `A \|\|--\|\| B` | exactly one-to-one | FK on **B** with `.unique().notNull()` |
| `A }o--o{ B` | many-to-many | junction table `a_b` with two cascade FKs and a composite PK |

The entity on the "many" / optional side of a relationship holds the foreign key.

## Ordering

- **`up`**: create tables in **dependency (topological) order**; a table is created only after
  every table it references. Pre-existing tables count as already created.
- **`down`**: drop the new tables in the **exact reverse** of the `up` order (children before
  parents) with `db.schema.dropTable('<name>').ifExists().execute()`. Never drop tables this
  migration did not create (e.g. never drop `users`).
- Index FK columns that are not already unique or the leading column of a PK:
  `db.schema.createIndex('<table>_<col>_idx').on('<table>').column('<col>').execute()`
  (dropping the table drops its indexes).

## File Output

- Path: `src/db/migrations/<timestamp>_<migration_name>.ts`
  - `<timestamp>` = current UTC time as `YYYYMMDDHHmmss` (e.g. `20261007153000`). It sorts after
    `001_...`, so Kysely runs it after the existing migrations.
  - `<migration_name>` = short snake_case description, e.g. `library_management_schema`.
- Required structure (TypeScript ES module):

```ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // createTable chains in dependency order
}

export async function down(db: Kysely<any>): Promise<void> {
  // dropTable calls in reverse dependency order
}
```

- Both `up(db: Kysely<any>)` and `down(db: Kysely<any>)` **must** be exported. Import `sql` only if used.
- Do not modify existing migration files.

## Verification (required before reporting success)

From the repo root, fix the migration until all of these pass:
1. `npm run build`: no TypeScript errors.
2. `npm run migrate:up`: prints `migration "<file>" was executed successfully`
   (requires the PostgreSQL container from `docker compose up -d`).
3. Optional reversibility check: `npm run migrate:down`, then `npm run migrate:up` again.

Report to the user: the migration path, a table-by-table summary (columns, PK, FKs, unique
constraints), the `up` creation order and `down` drop order, and the verification results.
