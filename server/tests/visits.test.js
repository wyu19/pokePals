// Set environment variables before loading any modules
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

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
  
  test('should return 409 if host already has active visitor', async () => {
    await createFriendship(visitor, host);
    await createFriendship(otherUser, host);
    
    // First visit succeeds
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res1.statusCode).toBe(201);
    
    // Second visit to same host fails
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res2.statusCode).toBe(409);
    expect(res2.body.error).toContain('Host already has an active visitor');
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
  
  test('conflict prevention: host already has active visitor', async () => {
    await createFriendship(visitor, host);
    await createFriendship(otherUser, host);
    
    // First visit succeeds
    const res1 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${visitor.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'bulbasaur' });
    
    expect(res1.statusCode).toBe(201);
    
    // Second concurrent visit fails
    const res2 = await request(app)
      .post('/api/visits')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ host_user_id: host.userId, pokemon_species: 'charmander' });
    
    expect(res2.statusCode).toBe(409);
    expect(res2.body.error).toContain('Host already has an active visitor');
    
    // Verify only one active visit exists
    const fetchRes = await request(app)
      .get('/api/visits/active')
      .set('Authorization', `Bearer ${host.token}`);
    
    expect(fetchRes.body).toHaveLength(1);
  });
});
