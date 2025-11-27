import type Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

// Lazy initialization function
function getDb(): Database.Database {
  // Use singleton pattern to ensure single database connection
  const globalForDb = globalThis as unknown as {
    db?: Database.Database;
  };

  if (!globalForDb.db) {
    // Dynamic import to avoid build-time evaluation
    const Database = require("better-sqlite3");

    // Ensure data directory exists
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = join(dataDir, "sessions.db");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL"); // Better concurrency

    // Create table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_mappings (
        custom_session_id TEXT PRIMARY KEY,
        heygen_session_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_expires_at ON session_mappings(expires_at);
      
      CREATE TABLE IF NOT EXISTS session_config_updates (
        custom_session_id TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        consumed_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_config_created_at ON session_config_updates(created_at);
      CREATE INDEX IF NOT EXISTS idx_config_consumed_at ON session_config_updates(consumed_at);
    `);

    console.log("Database initialized at:", dbPath);
    globalForDb.db = db;
  }

  // At this point, db is guaranteed to be defined
  return globalForDb.db!;
}

export { getDb };

