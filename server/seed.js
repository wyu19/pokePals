const bcrypt = require('bcrypt');
const db = require('./database');

const SALT_ROUNDS = 10;

async function seed() {
  console.log('Starting database seed...');

  // Clear existing data
  console.log('Clearing existing friendships...');
  db.prepare('DELETE FROM friendships').run();
  
  console.log('Clearing existing users...');
  db.prepare('DELETE FROM users').run();

  // Create test users
  console.log('Creating test users...');
  const testUsers = [
    { username: 'ash_ketchum', password: 'pikachu123' },
    { username: 'misty_cascade', password: 'starmie456' },
    { username: 'brock_stone', password: 'onix789' },
    { username: 'gary_oak', password: 'rival999' },
    { username: 'professor_oak', password: 'research000' }
  ];

  const userIds = {};
  for (const user of testUsers) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(user.username, passwordHash);
    userIds[user.username] = result.lastInsertRowid;
    console.log(`  Created user: ${user.username} (id: ${userIds[user.username]})`);
  }

  // Create sample friendships
  console.log('Creating sample friendships...');
  
  // Accepted friendships
  db.prepare('INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)').run(
    userIds.ash_ketchum,
    userIds.misty_cascade,
    'accepted'
  );
  console.log('  ash_ketchum ↔ misty_cascade (accepted)');

  db.prepare('INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)').run(
    userIds.brock_stone,
    userIds.ash_ketchum,
    'accepted'
  );
  console.log('  brock_stone ↔ ash_ketchum (accepted)');

  // Pending friendships
  db.prepare('INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)').run(
    userIds.gary_oak,
    userIds.ash_ketchum,
    'pending'
  );
  console.log('  gary_oak → ash_ketchum (pending)');

  db.prepare('INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)').run(
    userIds.professor_oak,
    userIds.misty_cascade,
    'pending'
  );
  console.log('  professor_oak → misty_cascade (pending)');

  // Declined friendship
  db.prepare('INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)').run(
    userIds.gary_oak,
    userIds.brock_stone,
    'declined'
  );
  console.log('  gary_oak → brock_stone (declined)');

  console.log('\nSeed completed successfully!');
  console.log('\nTest credentials:');
  testUsers.forEach(user => {
    console.log(`  ${user.username} / ${user.password}`);
  });
}

seed()
  .then(() => {
    console.log('\nDatabase seeded successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
