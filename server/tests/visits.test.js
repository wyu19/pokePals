const request = require('supertest');
const express = require('express');
const db = require('../database');
const authRouter = require('../routes/auth');
const friendsRouter = require('../routes/friends');
const visitsRouter = require('../routes/visits');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api', friendsRouter);
app.use('/api', visitsRouter);

// Helper function to register and login a user
async function createAndLoginUser(username, password = 'password123') {
  await request(app)
    .post('/api/auth/register')
    .send({ username, password });
  
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  
  return { token: res.body.token, userId: res.body.userId };
}

// Helper function to create accepted friendship
async function createFriendship(requester, addressee) {
  const res = await request(app)
    .post('/api/friends/request')
    .set('Authorization', `Bearer ${requester.token}`)
    .send({ target_user_id: addressee.userId });
  
  await request(app)
    .post('/api/friends/accept')
    .set('Authorization', `Bearer ${addressee.token}`)
    .send({ friendship_id: res.body.friendshipId });
}

// Clean up database before each test
beforeEach(() => {
  db.exec('DELETE FROM visits');
  db.exec('DELETE FROM friendships');
  db.exec('DELETE FROM users');
});

describe('POST /api/visits', () => {
  let visitor, host, otherUser;
  
  beforeEach(async () => {
    visitor = await createAndLoginUser('visitor');
    host = await createAndLoginUser('host');
    otherUser = await createAndLoginUser('otheruser');
  });
  
  test('should create visit between accepted friends', async () => {
    // Create friendship
    await createFriendship(visitor, host);
    
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('visitId');
    expect(res.body).toHaveProperty('expiresAt');
    
    // Verify in database
    const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(res.body.visitId);
    expect(visit.visiting_user_id).toBe(visitor.userId);
    expect(visit.host_user_id).toBe(host.userId);
    expect(visit.pokemon_species).toBe('bulbasaur');
    expect(visit.ended_at).toBeNull();
  });
  
  test('should work in both friendship directions (visitor requests host)', async () => {
    // Visitor initiates friendship
    await createFriendship(visitor, host);
    
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('visitId');
  });
  
  test('should work in both friendship directions (host requests visitor)', async () => {
    // Host initiates friendship
    await createFriendship(host, visitor);
    
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'squirtle' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('visitId');
  });
  
  test('should return 404 if host user not found', async () => {
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: 99999, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Host user not found');
  });
  
  test('should return 403 if not friends (no friendship)', async () => {
    // No friendship created
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Friendship required');
  });
  
  test('should return 403 if friendship is pending (not accepted)', async () => {
    // Create pending friendship but don't accept
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ target_user_id: host.userId });
    
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Friendship required');
  });
  
  test('should return 400 for invalid pokemon_species', async () => {
    await createFriendship(visitor, host);
    
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'pikachu' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid pokemon_species required');
  });
  
  test('should return 400 for self-visit attempt', async () => {
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: visitor.userId, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Cannot visit yourself');
  });
  
  test('should allow multiple visitors to same host', async () => {
    await createFriendship(visitor, host);
    await createFriendship(otherUser, host);
    
    // First visit succeeds
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res1.statusCode).toBe(201);
    expect(res1.body).toHaveProperty('visitId');
    
    // Second concurrent visit to same host also succeeds
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res2.statusCode).toBe(201);
    expect(res2.body).toHaveProperty('visitId');
    expect(res2.body.visitId).not.toBe(res1.body.visitId);
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/visits')
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('GET /api/visits/active', () => {
  let visitor, host, otherUser;
  
  beforeEach(async () => {
    visitor = await createAndLoginUser('visitor');
    host = await createAndLoginUser('host');
    otherUser = await createAndLoginUser('otheruser');
  });
  
  test('should return active visits with visitor username', async () => {
    await createFriendship(visitor, host);
    
    // Create visit
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    // Fetch as host
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('visitingUserId', visitor.userId);
    expect(res.body[0]).toHaveProperty('pokemonSpecies', 'bulbasaur');
    expect(res.body[0]).toHaveProperty('visitorUsername', 'visitor');
    expect(res.body[0]).toHaveProperty('createdAt');
    expect(res.body[0]).toHaveProperty('expiresAt');
  });
  
  test('should return empty array if no active visits', async () => {
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should exclude expired visits', async () => {
    // Insert expired visit manually
    db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, created_at, expires_at)
      VALUES (?, ?, 'bulbasaur', datetime('now', '-48 hours'), datetime('now', '-24 hours'))
    `).run(visitor.userId, host.userId);
    
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should exclude ended visits', async () => {
    await createFriendship(visitor, host);
    
    // Create visit
    const createRes = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    // End visit
    await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: createRes.body.visitId });
    
    // Fetch active visits
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should only show visits where current user is host', async () => {
    await createFriendship(visitor, host);
    
    // Create visit
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'squirtle' });
    
    // Fetch as visitor (should be empty - only host sees visit)
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${visitor.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .get('/api/visits/active');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('POST /api/visits/end', () => {
  let visitor, host, otherUser, visitId;
  
  beforeEach(async () => {
    visitor = await createAndLoginUser('visitor');
    host = await createAndLoginUser('host');
    otherUser = await createAndLoginUser('otheruser');
    
    // Create friendship and visit
    await createFriendship(visitor, host);
    const res = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    visitId = res.body.visitId;
  });
  
  test('should allow host to end visit', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('visitId', visitId);
    expect(res.body).toHaveProperty('endedAt');
    
    // Verify in database
    const visit = db.prepare('SELECT ended_at FROM visits WHERE id = ?').get(visitId);
    expect(visit.ended_at).not.toBeNull();
  });
  
  test('should allow visitor to end visit', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ visit_id: visitId });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('visitId', visitId);
    expect(res.body).toHaveProperty('endedAt');
  });
  
  test('should return 404 if visit not found', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: 99999 });
    
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Visit not found');
  });
  
  test('should return 403 if user is neither visitor nor host', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ visit_id: visitId });
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Only the visitor or host can end');
  });
  
  test('should return 400 if visit already ended', async () => {
    // End once
    await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId });
    
    // Try to end again
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Visit already ended');
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .send({ visit_id: visitId });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
  
  test('should require valid visit_id', async () => {
    const res = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: 'invalid' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid visit_id required');
  });
});

describe('Concurrent visits', () => {
  let visitor1, visitor2, visitor3, host;
  
  beforeEach(async () => {
    visitor1 = await createAndLoginUser('visitor1');
    visitor2 = await createAndLoginUser('visitor2');
    visitor3 = await createAndLoginUser('visitor3');
    host = await createAndLoginUser('host');
    
    // All visitors are friends with host
    await createFriendship(visitor1, host);
    await createFriendship(visitor2, host);
    await createFriendship(visitor3, host);
  });
  
  test('should allow 2+ visitors to same host simultaneously', async () => {
    // First visit
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor1.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res1.statusCode).toBe(201);
    
    // Second visit
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor2.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res2.statusCode).toBe(201);
    
    // Third visit
    const res3 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor3.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'squirtle' });
    
    expect(res3.statusCode).toBe(201);
    
    // All 3 visitIds should be unique
    const visitIds = [res1.body.visitId, res2.body.visitId, res3.body.visitId];
    const uniqueIds = new Set(visitIds);
    expect(uniqueIds.size).toBe(3);
  });
  
  test('GET /api/visits/active should return all concurrent visits', async () => {
    // Create 2 concurrent visits
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor1.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor2.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    // Fetch active visits
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    
    // Verify both visitors present
    const visitorUsernames = res.body.map(v => v.visitorUsername).sort();
    expect(visitorUsernames).toEqual(['visitor1', 'visitor2']);
    
    // Verify species
    const species = res.body.map(v => v.pokemonSpecies).sort();
    expect(species).toEqual(['bulbasaur', 'charmander']);
  });
  
  test('POST /api/visits/end should dismiss only targeted visit, others remain', async () => {
    // Create 3 concurrent visits
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor1.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor2.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    const res3 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor3.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'squirtle' });
    
    const visitId2 = res2.body.visitId;
    
    // End middle visit
    const endRes = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId2 });
    
    expect(endRes.statusCode).toBe(200);
    
    // Fetch active visits - should have 2 remaining
    const fetchRes = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes.statusCode).toBe(200);
    expect(fetchRes.body).toHaveLength(2);
    
    // Verify visitor2 (charmander) is gone
    const activeUsernames = fetchRes.body.map(v => v.visitorUsername).sort();
    expect(activeUsernames).toEqual(['visitor1', 'visitor3']);
    
    // Verify correct species remain
    const activeSpecies = fetchRes.body.map(v => v.pokemonSpecies).sort();
    expect(activeSpecies).toEqual(['bulbasaur', 'squirtle']);
  });
  
  test('expired visits excluded from active query regardless of count', async () => {
    // Create 2 active visits
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor1.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor2.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    // Insert 2 expired visits manually
    db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, created_at, expires_at)
      VALUES (?, ?, 'squirtle', datetime('now', '-48 hours'), datetime('now', '-24 hours'))
    `).run(visitor3.userId, host.userId);
    
    db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, created_at, expires_at)
      VALUES (?, ?, 'bulbasaur', datetime('now', '-72 hours'), datetime('now', '-48 hours'))
    `).run(visitor1.userId, host.userId);
    
    // Fetch active - should only return 2 active, not 4 total
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    
    // Verify only active visits returned
    const species = res.body.map(v => v.pokemonSpecies).sort();
    expect(species).toEqual(['bulbasaur', 'charmander']);
  });
});

describe('Load test: 10 simultaneous visits', () => {
  let host, visitors;
  
  beforeEach(async () => {
    host = await createAndLoginUser('host');
    
    // Create 10 visitor users with accepted friendships
    visitors = [];
    for (let i = 1; i <= 10; i++) {
      const visitor = await createAndLoginUser(`visitor${i}`);
      await createFriendship(visitor, host);
      visitors.push(visitor);
    }
  });
  
  test('should handle 10 concurrent POST /api/visits and return all in GET /api/visits/active in <5s', async () => {
    // Fire 10 concurrent POST requests
    const createPromises = visitors.map((visitor, index) => {
      const species = ['bulbasaur', 'charmander', 'squirtle'][index % 3];
      return request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${visitor.token}`)
        .send({ host_user_id: host.userId, pokemon_species: species });
    });
    
    const createStartTime = Date.now();
    const createResults = await Promise.all(createPromises);
    const createDuration = Date.now() - createStartTime;
    
    // Verify all 10 POSTs succeeded
    expect(createResults.every(res => res.statusCode === 201)).toBe(true);
    
    // Verify all visitIds are unique
    const visitIds = createResults.map(res => res.body.visitId);
    const uniqueIds = new Set(visitIds);
    expect(uniqueIds.size).toBe(10);
    
    console.log(`[Load Test] Created 10 concurrent visits in ${createDuration}ms`);
    
    // Measure GET /api/visits/active response time
    const getStartTime = Date.now();
    const getRes = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    const getDuration = Date.now() - getStartTime;
    
    // Verify all 10 visits returned
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toHaveLength(10);
    
    // Verify response time <5s (5000ms)
    expect(getDuration).toBeLessThan(5000);
    
    console.log(`[Load Test] GET /api/visits/active returned 10 visits in ${getDuration}ms`);
    
    // Verify all visitor usernames present
    const visitorUsernames = getRes.body.map(v => v.visitorUsername).sort();
    const expectedUsernames = visitors.map((_, i) => `visitor${i + 1}`).sort();
    expect(visitorUsernames).toEqual(expectedUsernames);
  });
  
  test('should maintain isolation: 10 visitors to host A should not appear in host B active list', async () => {
    const hostB = await createAndLoginUser('hostB');
    
    // Create 10 visits to host A
    const createPromises = visitors.map((visitor, index) => {
      const species = ['bulbasaur', 'charmander', 'squirtle'][index % 3];
      return request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${visitor.token}`)
        .send({ host_user_id: host.userId, pokemon_species: species });
    });
    
    await Promise.all(createPromises);
    
    // Host B should see empty list (not host A's 10 visits)
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${hostB.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('Integration tests', () => {
  let visitor, host, otherUser;
  
  beforeEach(async () => {
    visitor = await createAndLoginUser('visitor');
    host = await createAndLoginUser('host');
    otherUser = await createAndLoginUser('otheruser');
  });
  
  test('full lifecycle: create → fetch active → end → verify empty', async () => {
    await createFriendship(visitor, host);
    
    // Create visit
    const createRes = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(createRes.statusCode).toBe(201);
    const visitId = createRes.body.visitId;
    
    // Fetch active visits (should include visit)
    const fetchRes1 = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes1.statusCode).toBe(200);
    expect(fetchRes1.body).toHaveLength(1);
    expect(fetchRes1.body[0].id).toBe(visitId);
    
    // End visit
    const endRes = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId });
    
    expect(endRes.statusCode).toBe(200);
    
    // Fetch active visits (should be empty)
    const fetchRes2 = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes2.statusCode).toBe(200);
    expect(fetchRes2.body).toHaveLength(0);
  });
  
  test('expiration filtering with manually set old timestamps', async () => {
    // Insert expired visit manually
    db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, created_at, expires_at)
      VALUES (?, ?, 'squirtle', datetime('now', '-48 hours'), datetime('now', '-24 hours'))
    `).run(visitor.userId, host.userId);
    
    // Insert active visit manually
    db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, created_at, expires_at)
      VALUES (?, ?, 'bulbasaur', datetime('now'), datetime('now', '+24 hours'))
    `).run(otherUser.userId, host.userId);
    
    // Fetch active visits
    const res = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].pokemonSpecies).toBe('bulbasaur');
  });
  
  test('multiple concurrent visits: create → verify all active → end one → verify others remain', async () => {
    await createFriendship(visitor, host);
    await createFriendship(otherUser, host);
    
    // Create first visit
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res1.statusCode).toBe(201);
    const visitId1 = res1.body.visitId;
    
    // Create second concurrent visit
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res2.statusCode).toBe(201);
    const visitId2 = res2.body.visitId;
    
    // Verify both are active
    const fetchRes1 = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes1.statusCode).toBe(200);
    expect(fetchRes1.body).toHaveLength(2);
    
    // End first visit
    const endRes = await request(app)
      .post('/api/visits/end')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ visit_id: visitId1 });
    
    expect(endRes.statusCode).toBe(200);
    
    // Verify only second visit remains
    const fetchRes2 = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes2.statusCode).toBe(200);
    expect(fetchRes2.body).toHaveLength(1);
    expect(fetchRes2.body[0].id).toBe(visitId2);
    expect(fetchRes2.body[0].pokemonSpecies).toBe('charmander');
  });
});
