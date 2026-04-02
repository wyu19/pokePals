const Database = require('better-sqlite3');
const path = require('path');

// Use in-memory database for tests to avoid conflicts
const dbPath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.join(__dirname, 'server.db');

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log(`Database connected: ${dbPath}`);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    addressee_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(requester_id, addressee_id)
  );

  CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
  CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
  CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visiting_user_id INTEGER NOT NULL,
    host_user_id INTEGER NOT NULL,
    pokemon_species TEXT CHECK(pokemon_species IN ('bulbasaur', 'charmander', 'squirtle')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ended_at DATETIME,
    FOREIGN KEY (visiting_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_visits_host_expires ON visits(host_user_id, expires_at);
  CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visiting_user_id);
`);

console.log('Database schema initialized');

module.exports = db;
