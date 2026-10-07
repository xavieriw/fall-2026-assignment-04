---
name: erd-generator
description: Designs a database Entity-Relationship Diagram (ERD) in Mermaid `erDiagram` syntax from an unstructured domain description, validates it and compiles it to an SVG with a local script, and self-corrects syntax errors. Use when the user asks to design, draft, model, or diagram an ERD, data model, database schema, entity relationships, or an architecture/data diagram for a domain or system.
---

# ERD Generator

Turn a natural-language domain description into a **validated** Mermaid ERD saved at
`docs/architecture/schema.mmd` and compiled to `docs/architecture/erd.svg`.

Never claim the diagram is done until the renderer script prints `SUCCESS`.

## Paths (relative to the repository root)

| Purpose | Path |
| --- | --- |
| Mermaid source (you write this) | `docs/architecture/schema.mmd` |
| Rendered asset (the script writes this) | `docs/architecture/erd.svg` |
| Validator / renderer | `.agent/skills/erd-generator/scripts/render_erd.js` |
| Existing migrations (read for context) | `src/db/migrations/` |

## Execution Workflow

### 1. Parse the domain requirements

Before writing any Mermaid, extract:

- **Entities**: nouns that hold data. Name them in plural `UPPER_SNAKE_CASE` (e.g. `USERS`, `BOOK_AUTHORS`).
- **Attributes**: `type name` pairs per entity. Use simple types the migration skill can map:
  `int`, `serial`, `uuid`, `varchar`, `text`, `boolean`, `date`, `timestamp`, `decimal`.
- **Primary keys**: every entity gets exactly one `PK` (default `int id PK`), except junction
  tables, which may use two `PK, FK` columns as a composite key.
- **Foreign keys**: mark each with `FK`, name them `<singular_entity>_id`, and make the FK type
  match the referenced PK type.
- **Cardinalities**: decide for every relationship:
  - `||--o{` one-to-many (parent on the left, the child holding the FK on the right)
  - `||--o|` one-to-one / zero-or-one (mark the child FK `FK, UK`)
  - `||--|{` one-to-one-or-many (mandatory child)
  - many-to-many: introduce an explicit junction entity with two FKs and two `||--o{` relationships.
- **Existing tables**: check `src/db/migrations/` for tables that already exist (e.g. `USERS` in
  `001_initial_schema.ts`). Include them in the diagram with the **same columns they already
  have** so relationships are complete, and add a comment such as
  `%% USERS already exists (001_initial_schema) - do not recreate`.

If the request is ambiguous, apply sensible defaults and record each business decision as a
`%%` comment at the top of the file.

### 2. Write the Mermaid file

Write the diagram directly to `docs/architecture/schema.mmd` (create `docs/architecture/` if needed).
The file must contain **only** Mermaid (no Markdown fences). Shape:

```
erDiagram
    %% business decisions as comments
    PARENTS ||--o{ CHILDREN : "has"

    PARENTS {
        int id PK
        varchar name
        timestamp created_at
    }
    CHILDREN {
        int id PK
        int parent_id FK
        varchar label "optional comment"
    }
```

Syntax rules that commonly cause failures; follow them up front:
- The first non-comment line is exactly `erDiagram`.
- Attribute lines are `type name [PK|FK|UK[, ...]] ["comment"]`. Types and names use only letters,
  digits, `_` and `-`: avoid parentheses (write `varchar`, not `varchar(255)`; older Mermaid versions reject them), no spaces.
- Multiple key markers are comma-separated: `int user_id FK, UK`.
- Every relationship needs `: label`; labels containing spaces must be double-quoted.
- No SQL clauses such as `NOT NULL` or `DEFAULT` in attributes; put them in a quoted comment instead.

### 3. Validate and render

Run from the repository root:

```bash
node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
```

(This is `node scripts/render_erd.js docs/architecture/schema.mmd` relative to this skill's directory.
Paths are resolved against the current working directory, so always run it from the repo root.)

- Prints `SUCCESS` (exit code `0`): go to step 5.
- Prints `SYNTAX_ERROR: ...` (exit code `1`): go to step 4.

### 4. Self-correction loop (max 3 retries)

When the script reports `SYNTAX_ERROR`:
1. Read the stderr trace. Mermaid parse errors give a line number, a caret (`^`) under the
   offending token and `Expecting ..., got ...`. Locate that line in `schema.mmd`.
2. Identify the root cause (parenthesised types, unquoted multi-word labels, invalid cardinality
   token, bad key marker, stray punctuation, missing `erDiagram` header, ...).
3. Edit `docs/architecture/schema.mmd` to fix **only** the faulty syntax. Do not delete entities,
   attributes or relationships just to make the error go away.
4. Re-run the script.

Retry at most **3 times**. If it still fails after the third retry, stop, show the user the last
error trace and the current Mermaid source, explain what was attempted, and do not report success.

### 5. Final output

After `SUCCESS`, reply to the user with:
1. A short summary of the entities, keys and relationships, plus any business decisions assumed.
2. The **raw Mermaid** contents of `docs/architecture/schema.mmd` in a ```` ```mermaid ```` code block.
3. The paths of the source (`docs/architecture/schema.mmd`) and the rendered image asset
   (**`docs/architecture/erd.svg`**).
4. How many self-correction retries were needed (0 if none).

Suggest the `kysely-migration-generator` skill as the next step to turn the ERD into a migration.
