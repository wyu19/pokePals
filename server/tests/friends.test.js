const request = require('supertest');
const express = require('express');
const db = require('../database');
const authRouter = require('../routes/auth');
const friendsRouter = require('../routes/friends');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api', friendsRouter);

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

// Clean up database before each test
beforeEach(() => {
  db.exec('DELETE FROM friendships');
  db.exec('DELETE FROM users');
});

describe('GET /api/users/search', () => {
  let user1, user2, user3;
  
  beforeEach(async () => {
    user1 = await createAndLoginUser('testuser1');
    user2 = await createAndLoginUser('testuser2');
    user3 = await createAndLoginUser('anotheruser');
  });
  
  test('should return matching users with partial match', async () => {
    const res = await request(app)
      .get('/api/users/search?q=test')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1); // only testuser2 matches 'test' (testuser1 is excluded as current user)
    expect(res.body.some(u => u.username === 'testuser1')).toBe(false); // excludes self
    expect(res.body.some(u => u.username === 'testuser2')).toBe(true);
  });
  
  test('should be case-insensitive', async () => {
    const res = await request(app)
      .get('/api/users/search?q=TEST')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some(u => u.username === 'testuser2')).toBe(true);
  });
  
  test('should exclude current user from results', async () => {
    const res = await request(app)
      .get('/api/users/search?q=testuser1')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.some(u => u.username === 'testuser1')).toBe(false);
  });
  
  test('should return empty array if no matches', async () => {
    const res = await request(app)
      .get('/api/users/search?q=nonexistentuser')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should require search query', async () => {
    const res = await request(app)
      .get('/api/users/search?q=')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Search query required');
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .get('/api/users/search?q=test');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('POST /api/friends/request', () => {
  let user1, user2;
  
  beforeEach(async () => {
    user1 = await createAndLoginUser('requester');
    user2 = await createAndLoginUser('target');
  });
  
  test('should create pending friendship', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('friendshipId');
    expect(res.body.status).toBe('pending');
    
    // Verify in database
    const friendship = db.prepare('SELECT * FROM friendships WHERE id = ?').get(res.body.friendshipId);
    expect(friendship.requester_id).toBe(user1.userId);
    expect(friendship.addressee_id).toBe(user2.userId);
    expect(friendship.status).toBe('pending');
  });
  
  test('should prevent duplicate requests', async () => {
    // First request
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    // Duplicate request
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('Friendship already exists');
  });
  
  test('should prevent duplicate requests in reverse direction', async () => {
    // First request: user1 → user2
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    // Reverse request: user2 → user1
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ target_user_id: user1.userId });
    
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('Friendship already exists');
  });
  
  test('should prevent self-friending', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user1.userId });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Cannot send friend request to yourself');
  });
  
  test('should return 404 for non-existent target user', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: 99999 });
    
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('User not found');
  });
  
  test('should require valid target_user_id', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: 'invalid' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid target_user_id required');
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/friends/request')
      .send({ target_user_id: user2.userId });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('POST /api/friends/accept', () => {
  let requester, addressee, friendshipId;
  
  beforeEach(async () => {
    requester = await createAndLoginUser('requester');
    addressee = await createAndLoginUser('addressee');
    
    // Create pending friendship
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ target_user_id: addressee.userId });
    
    friendshipId = res.body.friendshipId;
  });
  
  test('should accept pending request', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('accepted');
    
    // Verify in database
    const friendship = db.prepare('SELECT status FROM friendships WHERE id = ?').get(friendshipId);
    expect(friendship.status).toBe('accepted');
  });
  
  test('should return 403 if current user is not addressee', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Only the recipient can accept');
  });
  
  test('should return 400 if status is not pending (already accepted)', async () => {
    // Accept once
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    // Try to accept again
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Cannot accept');
  });
  
  test('should return 404 for non-existent friendship', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: 99999 });
    
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Friendship not found');
  });
  
  test('should require valid friendship_id', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: 'invalid' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid friendship_id required');
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/friends/accept')
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('POST /api/friends/decline', () => {
  let requester, addressee, friendshipId;
  
  beforeEach(async () => {
    requester = await createAndLoginUser('requester');
    addressee = await createAndLoginUser('addressee');
    
    // Create pending friendship
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ target_user_id: addressee.userId });
    
    friendshipId = res.body.friendshipId;
  });
  
  test('should decline pending request', async () => {
    const res = await request(app)
      .post('/api/friends/decline')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('declined');
    
    // Verify in database
    const friendship = db.prepare('SELECT status FROM friendships WHERE id = ?').get(friendshipId);
    expect(friendship.status).toBe('declined');
  });
  
  test('should return 403 if current user is not addressee', async () => {
    const res = await request(app)
      .post('/api/friends/decline')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Only the recipient can decline');
  });
  
  test('should return 400 if status is not pending', async () => {
    // Accept first
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    // Try to decline
    const res = await request(app)
      .post('/api/friends/decline')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Cannot decline');
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .post('/api/friends/decline')
      .send({ friendship_id: friendshipId });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('GET /api/friends', () => {
  let user1, user2, user3, user4;
  
  beforeEach(async () => {
    user1 = await createAndLoginUser('user1');
    user2 = await createAndLoginUser('user2');
    user3 = await createAndLoginUser('user3');
    user4 = await createAndLoginUser('user4');
  });
  
  test('should return accepted friends in both directions', async () => {
    // Create accepted friendships
    // user1 → user2 (user1 is requester)
    const res1 = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ friendship_id: res1.body.friendshipId });
    
    // user3 → user1 (user1 is addressee)
    const res2 = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user3.token}`)
      .send({ target_user_id: user1.userId });
    
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ friendship_id: res2.body.friendshipId });
    
    // Get user1's friends
    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.some(f => f.username === 'user2')).toBe(true);
    expect(res.body.some(f => f.username === 'user3')).toBe(true);
  });
  
  test('should not return duplicate friends', async () => {
    // Create and accept friendship
    const res1 = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ friendship_id: res1.body.friendshipId });
    
    // Get friends from both users
    const resUser1 = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user1.token}`);
    
    const resUser2 = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user2.token}`);
    
    // Each should see the other exactly once
    expect(resUser1.body).toHaveLength(1);
    expect(resUser2.body).toHaveLength(1);
    expect(resUser1.body[0].username).toBe('user2');
    expect(resUser2.body[0].username).toBe('user1');
  });
  
  test('should return empty array if no accepted friends', async () => {
    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should exclude pending friendships', async () => {
    // Create pending friendship
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should exclude declined friendships', async () => {
    // Create and decline friendship
    const res1 = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ target_user_id: user2.userId });
    
    await request(app)
      .post('/api/friends/decline')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ friendship_id: res1.body.friendshipId });
    
    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${user1.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .get('/api/friends');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});

describe('GET /api/friends/requests', () => {
  let requester, addressee, otherUser;
  
  beforeEach(async () => {
    requester = await createAndLoginUser('requester');
    addressee = await createAndLoginUser('addressee');
    otherUser = await createAndLoginUser('other');
  });
  
  test('should return pending requests where current user is addressee', async () => {
    // Create pending request
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ target_user_id: addressee.userId });
    
    const res = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${addressee.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].requesterUsername).toBe('requester');
    expect(res.body[0]).toHaveProperty('friendshipId');
    expect(res.body[0]).toHaveProperty('createdAt');
  });
  
  test('should include requester username', async () => {
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ target_user_id: addressee.userId });
    
    const res = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${addressee.token}`);
    
    expect(res.body[0]).toHaveProperty('requesterUsername');
    expect(res.body[0].requesterUsername).toBe('requester');
  });
  
  test('should return empty array if no pending requests', async () => {
    const res = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${addressee.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should not return accepted requests', async () => {
    // Create and accept request
    const res1 = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ target_user_id: addressee.userId });
    
    await request(app)
      .post('/api/friends/accept')
      .set('Authorization', `Bearer ${addressee.token}`)
      .send({ friendship_id: res1.body.friendshipId });
    
    const res = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${addressee.token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
  
  test('should require authentication', async () => {
    const res = await request(app)
      .get('/api/friends/requests');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
});
