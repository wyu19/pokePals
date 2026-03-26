const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

let db;

function getDBPath() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return path.join(userDataPath, 'pokepals.db');
}

function initDB() {
  const dbPath = getDBPath();
  console.log('Initializing database at:', dbPath);
  
  db = new Database(dbPath);
  
  // Create pokemon table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY,
      hunger INTEGER DEFAULT 100,
      happiness INTEGER DEFAULT 100,
      x INTEGER,
      y INTEGER
    )
  `);
  
  // Initialize default pokemon row if not exists
  const exists = db.prepare('SELECT COUNT(*) as count FROM pokemon WHERE id = 1').get();
  if (exists.count === 0) {
    db.prepare('INSERT INTO pokemon (id, hunger, happiness) VALUES (1, 100, 100)').run();
    console.log('Created default pokemon entry');
  }
  
  console.log('Database initialized successfully');
  return db;
}

function savePosition(x, y) {
  if (!db) {
    console.error('Database not initialized');
    return;
  }
  
  try {
    db.prepare('UPDATE pokemon SET x = ?, y = ? WHERE id = 1').run(x, y);
    console.log('Position saved:', { x, y });
  } catch (error) {
    console.error('Error saving position:', error);
  }
}

function loadPosition() {
  if (!db) {
    console.error('Database not initialized');
    return null;
  }
  
  try {
    const row = db.prepare('SELECT x, y FROM pokemon WHERE id = 1').get();
    if (row && row.x !== null && row.y !== null) {
      console.log('Position loaded:', { x: row.x, y: row.y });
      return { x: row.x, y: row.y };
    }
    console.log('No saved position found');
    return null;
  } catch (error) {
    console.error('Error loading position:', error);
    return null;
  }
}

function closeDB() {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
}

function saveStats(hunger, happiness) {
  if (!db) {
    console.error('Database not initialized');
    return;
  }
  
  try {
    db.prepare('UPDATE pokemon SET hunger = ?, happiness = ? WHERE id = 1').run(hunger, happiness);
    console.log('Stats saved:', { hunger, happiness });
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

function loadStats() {
  if (!db) {
    console.error('Database not initialized');
    return { hunger: 100, happiness: 100 };
  }
  
  try {
    const row = db.prepare('SELECT hunger, happiness FROM pokemon WHERE id = 1').get();
    if (row) {
      console.log('Stats loaded:', { hunger: row.hunger, happiness: row.happiness });
      return { hunger: row.hunger, happiness: row.happiness };
    }
    console.log('No stats found, using defaults');
    return { hunger: 100, happiness: 100 };
  } catch (error) {
    console.error('Error loading stats:', error);
    return { hunger: 100, happiness: 100 };
  }
}

function getStats() {
  if (!db) {
    return { hunger: 100, happiness: 100 };
  }
  
  try {
    const row = db.prepare('SELECT hunger, happiness FROM pokemon WHERE id = 1').get();
    return row ? { hunger: row.hunger, happiness: row.happiness } : { hunger: 100, happiness: 100 };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { hunger: 100, happiness: 100 };
  }
}

module.exports = {
  initDB,
  savePosition,
  loadPosition,
  saveStats,
  loadStats,
  getStats,
  closeDB
};
