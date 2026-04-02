const request = require('supertest');
const express = require('express');
const db = require('../database');
const authRouter = require('../routes/auth');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Clean up database before each test
beforeEach(() => {
  db.exec('DELETE FROM users');
});

describe('POST /api/auth/register', () => {
  test('should register user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.username).toBe('testuser');
  });
  
  test('should reject duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
    
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password456' });
    
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Username already taken');
  });
  
  test('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'short' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('at least 8 characters');
  });
  
  test('should reject invalid username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: 'password123' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('3-20 alphanumeric');
  });
  
  test('should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('required');
  });
  
  test('should hash password in database', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
    
    const user = db.prepare('SELECT password_hash FROM users WHERE username = ?').get('testuser');
    
    expect(user.password_hash).not.toBe('password123');
    expect(user.password_hash).toMatch(/^\$2b\$/);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
  });
  
  test('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(res.body.username).toBe('testuser');
  });
  
  test('should reject invalid username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'password123' });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid username or password');
  });
  
  test('should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid username or password');
  });
  
  test('should return valid JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(res.body.token);
    
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('username');
    expect(decoded.username).toBe('testuser');
  });
});

describe('GET /api/auth/me (JWT middleware)', () => {
  let token;
  
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
    
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    token = res.body.token;
  });
  
  test('should return user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe('testuser');
  });
  
  test('should reject request without token', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('token required');
  });
  
  test('should reject request with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_token');
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Invalid or expired');
  });
});
