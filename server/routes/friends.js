const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Search users by username
router.get('/users/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  const currentUserId = req.user.userId;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  try {
    const query = `%${q.trim()}%`;
    const users = db.prepare(`
      SELECT id, username 
      FROM users 
      WHERE username LIKE ? COLLATE NOCASE 
        AND id != ?
      ORDER BY username
      LIMIT 20
    `).all(query, currentUserId);
    
    console.log(`User search: q="${q}", found ${users.length} results`);
    res.json(users);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Send friend request
router.post('/friends/request', authenticateToken, (req, res) => {
  const { target_user_id } = req.body;
  const requesterId = req.user.userId;
  
  // Validate target_user_id exists
  if (!target_user_id || typeof target_user_id !== 'number') {
    return res.status(400).json({ error: 'Valid target_user_id required' });
  }
  
  // Prevent self-friending
  if (requesterId === target_user_id) {
    return res.status(400).json({ error: 'Cannot send friend request to yourself' });
  }
  
  try {
    // Check if target user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(target_user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check for existing friendship (bidirectional)
    const existingFriendship = db.prepare(`
      SELECT id, status 
      FROM friendships 
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
    `).get(requesterId, target_user_id, target_user_id, requesterId);
    
    if (existingFriendship) {
      return res.status(409).json({ 
        error: 'Friendship already exists',
        status: existingFriendship.status
      });
    }
    
    // Insert friendship record
    const result = db.prepare(`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES (?, ?, 'pending')
    `).run(requesterId, target_user_id);
    
    console.log(`Friend request sent: ${requesterId} → ${target_user_id} (id: ${result.lastInsertRowid})`);
    
    res.status(201).json({
      friendshipId: result.lastInsertRowid,
      status: 'pending'
    });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Friend request failed' });
  }
});

// Get pending friend requests
router.get('/friends/requests', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;
  
  try {
    const requests = db.prepare(`
      SELECT 
        f.id as friendshipId,
        f.requester_id as requesterId,
        u.username as requesterUsername,
        f.created_at as createdAt
      FROM friendships f
      JOIN users u ON f.requester_id = u.id
      WHERE f.addressee_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).all(currentUserId);
    
    console.log(`Fetched ${requests.length} pending requests for user ${currentUserId}`);
    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Accept friend request
router.post('/friends/accept', authenticateToken, (req, res) => {
  const { friendship_id } = req.body;
  const currentUserId = req.user.userId;
  
  if (!friendship_id || typeof friendship_id !== 'number') {
    return res.status(400).json({ error: 'Valid friendship_id required' });
  }
  
  try {
    // Get friendship and verify it exists
    const friendship = db.prepare('SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?').get(friendship_id);
    
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    
    // Verify current user is the addressee
    if (friendship.addressee_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the recipient can accept this request' });
    }
    
    // Verify status is pending
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: `Cannot accept ${friendship.status} request` });
    }
    
    // Update status to accepted
    db.prepare('UPDATE friendships SET status = ? WHERE id = ?').run('accepted', friendship_id);
    
    console.log(`Friend request accepted: friendship ${friendship_id} (${friendship.requester_id} ↔ ${currentUserId})`);
    
    res.json({
      friendshipId: friendship_id,
      status: 'accepted'
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Decline friend request
router.post('/friends/decline', authenticateToken, (req, res) => {
  const { friendship_id } = req.body;
  const currentUserId = req.user.userId;
  
  if (!friendship_id || typeof friendship_id !== 'number') {
    return res.status(400).json({ error: 'Valid friendship_id required' });
  }
  
  try {
    // Get friendship and verify it exists
    const friendship = db.prepare('SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?').get(friendship_id);
    
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    
    // Verify current user is the addressee
    if (friendship.addressee_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the recipient can decline this request' });
    }
    
    // Verify status is pending
    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: `Cannot decline ${friendship.status} request` });
    }
    
    // Update status to declined
    db.prepare('UPDATE friendships SET status = ? WHERE id = ?').run('declined', friendship_id);
    
    console.log(`Friend request declined: friendship ${friendship_id} (${friendship.requester_id} ↔ ${currentUserId})`);
    
    res.json({
      friendshipId: friendship_id,
      status: 'declined'
    });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

// Get friend list (bidirectional)
router.get('/friends', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;
  
  try {
    // Bidirectional query: returns each friendship exactly once
    // regardless of who initiated (requester or addressee)
    const friends = db.prepare(`
      SELECT u.id, u.username
      FROM users u
      JOIN friendships f ON (
        (f.requester_id = ? AND f.addressee_id = u.id) OR
        (f.addressee_id = ? AND f.requester_id = u.id)
      )
      WHERE f.status = 'accepted'
      ORDER BY u.username
    `).all(currentUserId, currentUserId);
    
    console.log(`Fetched ${friends.length} friends for user ${currentUserId}`);
    res.json(friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;
