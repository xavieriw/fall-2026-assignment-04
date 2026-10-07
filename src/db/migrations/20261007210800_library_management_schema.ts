import { Kysely, sql } from 'kysely';

// Generated from docs/architecture/schema.mmd.
// `users` already exists (001_initial_schema) and is only referenced here.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('borrowers')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull().unique()
    )
    .addColumn('card_number', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('phone', 'varchar(255)')
    .addColumn('address', 'text')
    .addColumn('membership_expires_on', 'date', (col) => col.notNull())
    .addColumn('max_active_loans', 'integer', (col) =>
      col.notNull().defaultTo(5)
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  await db.schema
    .createTable('genres')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .execute();

  await db.schema
    .createTable('authors')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('first_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('last_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('birth_date', 'date')
    .addColumn('biography', 'text')
    .execute();

  await db.schema
    .createTable('books')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('genre_id', 'integer', (col) =>
      col.references('genres.id').onDelete('cascade').notNull()
    )
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('isbn', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('published_year', 'integer')
    .addColumn('total_copies', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('available_copies', 'integer', (col) =>
      col.notNull().defaultTo(1)
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('books_genre_id_idx')
    .on('books')
    .column('genre_id')
    .execute();

  await db.schema
    .createTable('book_authors')
    .addColumn('book_id', 'integer', (col) =>
      col.references('books.id').onDelete('cascade').notNull()
    )
    .addColumn('author_id', 'integer', (col) =>
      col.references('authors.id').onDelete('cascade').notNull()
    )
    .addColumn('author_order', 'integer', (col) => col.notNull().defaultTo(1))
    .addPrimaryKeyConstraint('book_authors_pkey', ['book_id', 'author_id'])
    .execute();

  await db.schema
    .createIndex('book_authors_author_id_idx')
    .on('book_authors')
    .column('author_id')
    .execute();

  await db.schema
    .createTable('loans')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('borrower_id', 'integer', (col) =>
      col.references('borrowers.id').onDelete('cascade').notNull()
    )
    .addColumn('book_id', 'integer', (col) =>
      col.references('books.id').onDelete('cascade').notNull()
    )
    .addColumn('loaned_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addColumn('due_on', 'date', (col) => col.notNull())
    .addColumn('returned_at', 'timestamp')
    .addColumn('late_fee', 'numeric(10, 2)', (col) =>
      col.notNull().defaultTo(0)
    )
    .execute();

  await db.schema
    .createIndex('loans_borrower_id_idx')
    .on('loans')
    .column('borrower_id')
    .execute();

  await db.schema
    .createIndex('loans_book_id_idx')
    .on('loans')
    .column('book_id')
    .execute();
}

// Reverse dependency order of `up`; `users` belongs to 001_initial_schema.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('loans').ifExists().execute();
  await db.schema.dropTable('book_authors').ifExists().execute();
  await db.schema.dropTable('books').ifExists().execute();
  await db.schema.dropTable('authors').ifExists().execute();
  await db.schema.dropTable('genres').ifExists().execute();
  await db.schema.dropTable('borrowers').ifExists().execute();
}
