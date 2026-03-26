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
      expect(columnNames).toContain('hunger');
      expect(columnNames).toContain('happiness');
      expect(columnNames).toContain('x');
      expect(columnNames).toContain('y');
      
      db.close();
    });
    
    test('creates default pokemon entry', () => {
      const db = new Database(testDbPath);
      const pokemon = db.prepare("SELECT * FROM pokemon WHERE id = 1").get();
      
      expect(pokemon).toBeDefined();
      expect(pokemon.hunger).toBe(100);
      expect(pokemon.happiness).toBe(100);
      
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
});
