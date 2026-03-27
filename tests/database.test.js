const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock electron app module with factory function
jest.mock('electron', () => {
  const path = require('path');
  const os = require('os');
  return {
    app: {
      getPath: jest.fn(() => path.join(os.tmpdir(), 'pokepals-test'))
    }
  };
});

const dbModule = require('../src/database');

describe('Database Module', () => {
  let testDbPath;
  
  beforeEach(() => {
    // Create test DB in temp directory
    testDbPath = path.join(os.tmpdir(), 'pokepals-test', 'pokepals.db');
    
    // Clean up any existing test DB
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Initialize fresh DB
    dbModule.initDB();
  });
  
  afterEach(() => {
    // Clean up
    dbModule.closeDB();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('initDB', () => {
    test('creates database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });
    
    test('creates pokemon table with correct schema', () => {
      const db = new Database(testDbPath);
      const tableInfo = db.prepare("PRAGMA table_info(pokemon)").all();
      
      const columnNames = tableInfo.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('species');
      expect(columnNames).toContain('hunger');
      expect(columnNames).toContain('happiness');
      expect(columnNames).toContain('x');
      expect(columnNames).toContain('y');
      expect(columnNames).toContain('active_pokemon');
      
      db.close();
    });
    
    test('creates default pokemon entry', () => {
      const db = new Database(testDbPath);
      const count = db.prepare("SELECT COUNT(*) as count FROM pokemon").get();
      
      expect(count.count).toBe(3);
      
      const bulbasaur = db.prepare("SELECT * FROM pokemon WHERE species = 'bulbasaur'").get();
      expect(bulbasaur).toBeDefined();
      expect(bulbasaur.hunger).toBe(100);
      expect(bulbasaur.happiness).toBe(100);
      expect(bulbasaur.active_pokemon).toBe(1);
      
      db.close();
    });
  });
  
  describe('savePosition and loadPosition', () => {
    test('saves position to database', () => {
      dbModule.savePosition(150, 200);
      
      const db = new Database(testDbPath);
      const pokemon = db.prepare("SELECT x, y FROM pokemon WHERE id = 1").get();
      
      expect(pokemon.x).toBe(150);
      expect(pokemon.y).toBe(200);
      
      db.close();
    });
    
    test('loads saved position', () => {
      dbModule.savePosition(300, 400);
      const position = dbModule.loadPosition();
      
      expect(position).toEqual({ x: 300, y: 400 });
    });
    
    test('returns null when no position saved', () => {
      const position = dbModule.loadPosition();
      expect(position).toBeNull();
    });
    
    test('updates existing position', () => {
      dbModule.savePosition(100, 100);
      dbModule.savePosition(200, 200);
      
      const position = dbModule.loadPosition();
      expect(position).toEqual({ x: 200, y: 200 });
    });
  });
  
  describe('saveStats and loadStats', () => {
    test('saves stats to database', () => {
      dbModule.saveStats(80, 90);
      
      const db = new Database(testDbPath);
      const pokemon = db.prepare("SELECT hunger, happiness FROM pokemon WHERE id = 1").get();
      
      expect(pokemon.hunger).toBe(80);
      expect(pokemon.happiness).toBe(90);
      
      db.close();
    });
    
    test('loads saved stats', () => {
      dbModule.saveStats(60, 70);
      const stats = dbModule.loadStats();
      
      expect(stats).toEqual({ hunger: 60, happiness: 70 });
    });
    
    test('returns default stats on first load', () => {
      const stats = dbModule.loadStats();
      expect(stats).toEqual({ hunger: 100, happiness: 100 });
    });
    
    test('updates existing stats', () => {
      dbModule.saveStats(50, 50);
      dbModule.saveStats(75, 85);
      
      const stats = dbModule.loadStats();
      expect(stats).toEqual({ hunger: 75, happiness: 85 });
    });
  });
  
  describe('getStats', () => {
    test('returns current stats without logging', () => {
      dbModule.saveStats(40, 60);
      const stats = dbModule.getStats();
      
      expect(stats).toEqual({ hunger: 40, happiness: 60 });
    });
    
    test('returns defaults when no stats saved', () => {
      const stats = dbModule.getStats();
      expect(stats).toEqual({ hunger: 100, happiness: 100 });
    });
  });
  
  describe('stat bounds', () => {
    test('allows hunger at boundaries', () => {
      dbModule.saveStats(0, 50);
      expect(dbModule.getStats().hunger).toBe(0);
      
      dbModule.saveStats(100, 50);
      expect(dbModule.getStats().hunger).toBe(100);
    });
    
    test('allows happiness at boundaries', () => {
      dbModule.saveStats(50, 0);
      expect(dbModule.getStats().happiness).toBe(0);
      
      dbModule.saveStats(50, 100);
      expect(dbModule.getStats().happiness).toBe(100);
    });
  });
  
  describe('multi-Pokemon support', () => {
    test('seeds database with 3 starters', () => {
      const all = dbModule.getAllPokemon();
      
      expect(all).toHaveLength(3);
      expect(all[0].species).toBe('bulbasaur');
      expect(all[1].species).toBe('charmander');
      expect(all[2].species).toBe('squirtle');
    });
    
    test('bulbasaur is active by default', () => {
      const active = dbModule.getActivePokemon();
      
      expect(active).toBeDefined();
      expect(active.species).toBe('bulbasaur');
      expect(active.active_pokemon).toBe(1);
    });
    
    test('setActivePokemon switches active Pokemon', () => {
      dbModule.setActivePokemon('charmander');
      const active = dbModule.getActivePokemon();
      
      expect(active.species).toBe('charmander');
      expect(active.active_pokemon).toBe(1);
    });
    
    test('only one Pokemon is active at a time', () => {
      dbModule.setActivePokemon('squirtle');
      const all = dbModule.getAllPokemon();
      
      const activeCount = all.filter(p => p.active_pokemon === 1).length;
      expect(activeCount).toBe(1);
      
      const activePokemon = all.find(p => p.active_pokemon === 1);
      expect(activePokemon.species).toBe('squirtle');
    });
    
    test('each Pokemon has independent stats', () => {
      // Set bulbasaur stats
      dbModule.setActivePokemon('bulbasaur');
      dbModule.saveStats(80, 90);
      
      // Set charmander stats
      dbModule.setActivePokemon('charmander');
      dbModule.saveStats(60, 70);
      
      // Verify independence
      const all = dbModule.getAllPokemon();
      const bulbasaur = all.find(p => p.species === 'bulbasaur');
      const charmander = all.find(p => p.species === 'charmander');
      
      expect(bulbasaur.hunger).toBe(80);
      expect(bulbasaur.happiness).toBe(90);
      expect(charmander.hunger).toBe(60);
      expect(charmander.happiness).toBe(70);
    });
    
    test('saveStats updates active Pokemon only', () => {
      dbModule.setActivePokemon('charmander');
      dbModule.saveStats(50, 50);
      
      const all = dbModule.getAllPokemon();
      const bulbasaur = all.find(p => p.species === 'bulbasaur');
      const charmander = all.find(p => p.species === 'charmander');
      
      // Bulbasaur should still have default stats
      expect(bulbasaur.hunger).toBe(100);
      expect(bulbasaur.happiness).toBe(100);
      
      // Charmander should have updated stats
      expect(charmander.hunger).toBe(50);
      expect(charmander.happiness).toBe(50);
    });
    
    test('each Pokemon has independent position', () => {
      // Set bulbasaur position
      dbModule.setActivePokemon('bulbasaur');
      dbModule.savePosition(100, 200);
      
      // Set squirtle position
      dbModule.setActivePokemon('squirtle');
      dbModule.savePosition(300, 400);
      
      // Verify independence
      const all = dbModule.getAllPokemon();
      const bulbasaur = all.find(p => p.species === 'bulbasaur');
      const squirtle = all.find(p => p.species === 'squirtle');
      
      expect(bulbasaur.x).toBe(100);
      expect(bulbasaur.y).toBe(200);
      expect(squirtle.x).toBe(300);
      expect(squirtle.y).toBe(400);
    });
    
    test('returns false when setting non-existent species', () => {
      const result = dbModule.setActivePokemon('pikachu');
      expect(result).toBe(false);
      
      // Active should remain unchanged
      const active = dbModule.getActivePokemon();
      expect(active.species).toBe('bulbasaur');
    });
  });
});
