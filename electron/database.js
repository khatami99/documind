import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

let db;
let databasePath;

export async function initializeDatabase(userDataPath) {
  databasePath = path.join(userDataPath, 'documind.sqlite');
  const SQL = await initSqlJs();
  const existingDatabase = fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : null;
  db = existingDatabase ? new SQL.Database(existingDatabase) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT,
      category TEXT,
      tags TEXT,
      extracted_text TEXT,
      ai_summary TEXT,
      document_type TEXT,
      ai_metadata TEXT,
      indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_documents_file_name ON documents(file_name);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  persistDatabase();

  return databasePath;
}

export function upsertDocuments(documents) {
  const now = new Date().toISOString();
  db.run('BEGIN TRANSACTION');

  try {
    const statement = db.prepare(`
      INSERT INTO documents (
        file_name,
        file_path,
        file_type,
        file_size,
        created_at,
        updated_at,
        title,
        category,
        tags,
        extracted_text,
        ai_summary,
        document_type,
        ai_metadata,
        indexed_at
      ) VALUES (
        $file_name,
        $file_path,
        $file_type,
        $file_size,
        $created_at,
        $updated_at,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        $indexed_at
      )
      ON CONFLICT(file_path) DO UPDATE SET
        file_name = excluded.file_name,
        file_type = excluded.file_type,
        file_size = excluded.file_size,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        indexed_at = excluded.indexed_at
    `);

    for (const item of documents) {
      statement.run({
        $file_name: item.file_name,
        $file_path: item.file_path,
        $file_type: item.file_type,
        $file_size: item.file_size,
        $created_at: item.created_at,
        $updated_at: item.updated_at,
        $indexed_at: now
      });
    }

    statement.free();
    db.run('COMMIT');
    persistDatabase();
    return documents.length;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

export function listDocuments(search = '') {
  const trimmedSearch = search.trim().toLowerCase();
  if (!trimmedSearch) {
    return queryRows('SELECT * FROM documents ORDER BY updated_at DESC, file_name ASC');
  }

  return queryRows(
    `
      SELECT *
      FROM documents
      WHERE lower(file_name) LIKE $query
        OR lower(COALESCE(category, '')) LIKE $query
        OR lower(COALESCE(tags, '')) LIKE $query
        OR lower(COALESCE(extracted_text, '')) LIKE $query
      ORDER BY updated_at DESC, file_name ASC
    `,
    { $query: `%${trimmedSearch}%` }
  );
}

export function getDocument(id) {
  return queryRows('SELECT * FROM documents WHERE id = $id', { $id: id })[0] ?? null;
}

export function getDocumentStats() {
  const totals = queryRows(`
    SELECT
      COUNT(*) AS total_documents,
      COALESCE(SUM(file_size), 0) AS total_size
    FROM documents
  `)[0];

  const types = queryRows(`
    SELECT file_type, COUNT(*) AS total
    FROM documents
    GROUP BY file_type
    ORDER BY total DESC
  `);

  return { ...totals, types };
}

export function getSetting(key) {
  return queryRows('SELECT value FROM settings WHERE key = $key', { $key: key })[0]?.value ?? '';
}

export function setSetting(key, value) {
  db.run(
    `
      INSERT INTO settings (key, value)
      VALUES ($key, $value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    { $key: key, $value: value }
  );
  persistDatabase();
  return { key, value };
}

function queryRows(sql, params = {}) {
  const statement = db.prepare(sql);
  statement.bind(params);

  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();
  return rows;
}

function persistDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
}
