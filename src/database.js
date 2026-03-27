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
  
  // Create pokemon table with multi-starter support
  db.exec(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY,
      species TEXT NOT NULL,
      hunger INTEGER DEFAULT 100,
      happiness INTEGER DEFAULT 100,
      x INTEGER,
      y INTEGER,
      active_pokemon INTEGER DEFAULT 0
    )
  `);
  
  // Initialize default 3 starters if not exists
  const exists = db.prepare('SELECT COUNT(*) as count FROM pokemon').get();
  if (exists.count === 0) {
    db.prepare('INSERT INTO pokemon (id, species, hunger, happiness, active_pokemon) VALUES (1, ?, 100, 100, 1)').run('bulbasaur');
    db.prepare('INSERT INTO pokemon (id, species, hunger, happiness, active_pokemon) VALUES (2, ?, 100, 100, 0)').run('charmander');
    db.prepare('INSERT INTO pokemon (id, species, hunger, happiness, active_pokemon) VALUES (3, ?, 100, 100, 0)').run('squirtle');
    console.log('Created default pokemon entries: bulbasaur (active), charmander, squirtle');
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
    // Save position for active Pokemon
    db.prepare('UPDATE pokemon SET x = ?, y = ? WHERE active_pokemon = 1').run(x, y);
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
    const row = db.prepare('SELECT x, y FROM pokemon WHERE active_pokemon = 1').get();
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
    db.prepare('UPDATE pokemon SET hunger = ?, happiness = ? WHERE active_pokemon = 1').run(hunger, happiness);
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
    const row = db.prepare('SELECT hunger, happiness FROM pokemon WHERE active_pokemon = 1').get();
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
    const row = db.prepare('SELECT hunger, happiness FROM pokemon WHERE active_pokemon = 1').get();
    return row ? { hunger: row.hunger, happiness: row.happiness } : { hunger: 100, happiness: 100 };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { hunger: 100, happiness: 100 };
  }
}

function getActivePokemon() {
  if (!db) {
    console.error('Database not initialized');
    return null;
  }
  
  try {
    const row = db.prepare('SELECT * FROM pokemon WHERE active_pokemon = 1').get();
    if (row) {
      console.log('Active Pokemon:', row.species);
      return row;
    }
    console.log('No active Pokemon found');
    return null;
  } catch (error) {
    console.error('Error getting active Pokemon:', error);
    return null;
  }
}

function setActivePokemon(species) {
  if (!db) {
    console.error('Database not initialized');
    return false;
  }
  
  try {
    // Check if species exists first
    const exists = db.prepare('SELECT COUNT(*) as count FROM pokemon WHERE species = ?').get(species);
    if (exists.count === 0) {
      console.error(`Pokemon species not found: ${species}`);
      return false;
    }
    
    // Set all Pokemon to inactive
    db.prepare('UPDATE pokemon SET active_pokemon = 0').run();
    
    // Set specified species to active
    db.prepare('UPDATE pokemon SET active_pokemon = 1 WHERE species = ?').run(species);
    
    console.log(`Set ${species} as active Pokemon`);
    return true;
  } catch (error) {
    console.error('Error setting active Pokemon:', error);
    return false;
  }
}

function getAllPokemon() {
  if (!db) {
    return [];
  }
  
  try {
    const rows = db.prepare('SELECT * FROM pokemon ORDER BY id').all();
    return rows;
  } catch (error) {
    console.error('Error getting all Pokemon:', error);
    return [];
  }
}

module.exports = {
  initDB,
  savePosition,
  loadPosition,
  saveStats,
  loadStats,
  getStats,
  getActivePokemon,
  setActivePokemon,
  getAllPokemon,
  closeDB
};
