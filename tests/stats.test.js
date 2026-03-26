describe('Stat Logic', () => {
  describe('Feed interaction', () => {
    test('increases hunger by 20', () => {
      const currentHunger = 50;
      const newHunger = Math.min(100, currentHunger + 20);
      
      expect(newHunger).toBe(70);
    });
    
    test('caps hunger at 100', () => {
      const currentHunger = 90;
      const newHunger = Math.min(100, currentHunger + 20);
      
      expect(newHunger).toBe(100);
    });
    
    test('works when hunger is 0', () => {
      const currentHunger = 0;
      const newHunger = Math.min(100, currentHunger + 20);
      
      expect(newHunger).toBe(20);
    });
    
    test('works when hunger is already 100', () => {
      const currentHunger = 100;
      const newHunger = Math.min(100, currentHunger + 20);
      
      expect(newHunger).toBe(100);
    });
  });
  
  describe('Play interaction', () => {
    test('increases happiness by 15', () => {
      const currentHappiness = 50;
      const newHappiness = Math.min(100, currentHappiness + 15);
      
      expect(newHappiness).toBe(65);
    });
    
    test('caps happiness at 100', () => {
      const currentHappiness = 92;
      const newHappiness = Math.min(100, currentHappiness + 15);
      
      expect(newHappiness).toBe(100);
    });
    
    test('works when happiness is 0', () => {
      const currentHappiness = 0;
      const newHappiness = Math.min(100, currentHappiness + 15);
      
      expect(newHappiness).toBe(15);
    });
  });
  
  describe('Hunger decay', () => {
    test('decreases hunger by 1', () => {
      const currentHunger = 50;
      const newHunger = Math.max(0, currentHunger - 1);
      
      expect(newHunger).toBe(49);
    });
    
    test('stops at 0', () => {
      const currentHunger = 0;
      const newHunger = Math.max(0, currentHunger - 1);
      
      expect(newHunger).toBe(0);
    });
    
    test('works from full hunger', () => {
      const currentHunger = 100;
      const newHunger = Math.max(0, currentHunger - 1);
      
      expect(newHunger).toBe(99);
    });
  });
  
  describe('Starvation penalty', () => {
    test('decreases happiness when hunger is 0', () => {
      const hunger = 0;
      const happiness = 50;
      
      let newHappiness = happiness;
      if (hunger === 0 && happiness > 0) {
        newHappiness = Math.max(0, happiness - 1);
      }
      
      expect(newHappiness).toBe(49);
    });
    
    test('does not decrease happiness when hunger > 0', () => {
      const hunger = 1;
      const happiness = 50;
      
      let newHappiness = happiness;
      if (hunger === 0 && happiness > 0) {
        newHappiness = Math.max(0, happiness - 1);
      }
      
      expect(newHappiness).toBe(50);
    });
    
    test('stops happiness at 0', () => {
      const hunger = 0;
      const happiness = 0;
      
      let newHappiness = happiness;
      if (hunger === 0 && happiness > 0) {
        newHappiness = Math.max(0, happiness - 1);
      }
      
      expect(newHappiness).toBe(0);
    });
  });
  
  describe('Combined scenarios', () => {
    test('full decay cycle: 100 to 0 takes 100 ticks', () => {
      let hunger = 100;
      let ticks = 0;
      
      while (hunger > 0) {
        hunger = Math.max(0, hunger - 1);
        ticks++;
      }
      
      expect(ticks).toBe(100);
      expect(hunger).toBe(0);
    });
    
    test('feed 5 times restores from 0 to 100', () => {
      let hunger = 0;
      
      for (let i = 0; i < 5; i++) {
        hunger = Math.min(100, hunger + 20);
      }
      
      expect(hunger).toBe(100);
    });
    
    test('play 7 times restores happiness from 0 to 100+', () => {
      let happiness = 0;
      
      for (let i = 0; i < 7; i++) {
        happiness = Math.min(100, happiness + 15);
      }
      
      expect(happiness).toBe(100);
    });
    
    test('neglect scenario: hunger decays, then happiness decays', () => {
      let hunger = 10;
      let happiness = 100;
      
      // Decay hunger to 0
      for (let i = 0; i < 20; i++) {
        hunger = Math.max(0, hunger - 1);
      }
      expect(hunger).toBe(0);
      expect(happiness).toBe(100);
      
      // Now happiness starts decaying
      for (let i = 0; i < 10; i++) {
        if (hunger === 0 && happiness > 0) {
          happiness = Math.max(0, happiness - 1);
        }
      }
      expect(happiness).toBe(90);
    });
  });
});
