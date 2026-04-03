const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create a visit
router.post('/visits', authenticateToken, (req, res) => {
  const { host_user_id, pokemon_species } = req.body;
  const visiting_user_id = req.user.userId;
  
  // Validate host_user_id is number
  if (!host_user_id || typeof host_user_id !== 'number') {
    return res.status(400).json({ error: 'Valid host_user_id required' });
  }
  
  // Validate pokemon_species
  const validSpecies = ['bulbasaur', 'charmander', 'squirtle'];
  if (!pokemon_species || !validSpecies.includes(pokemon_species)) {
    return res.status(400).json({ error: 'Valid pokemon_species required (bulbasaur, charmander, or squirtle)' });
  }
  
  // Prevent self-visit
  if (visiting_user_id === host_user_id) {
    return res.status(400).json({ error: 'Cannot visit yourself' });
  }
  
  try {
    // Check if host user exists
    const hostUser = db.prepare('SELECT id FROM users WHERE id = ?').get(host_user_id);
    if (!hostUser) {
      return res.status(404).json({ error: 'Host user not found' });
    }
    
    // Check friendship exists (bidirectional)
    const friendship = db.prepare(`
      SELECT id, status 
      FROM friendships 
      WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
        AND status = 'accepted'
    `).get(visiting_user_id, host_user_id, host_user_id, visiting_user_id);
    
    if (!friendship) {
      return res.status(403).json({ error: 'Friendship required to visit' });
    }
    
    // Insert visit with 24-hour expiration
    const result = db.prepare(`
      INSERT INTO visits (visiting_user_id, host_user_id, pokemon_species, expires_at)
      VALUES (?, ?, ?, datetime('now', '+24 hours'))
    `).run(visiting_user_id, host_user_id, pokemon_species);
    
    // Get the created visit to return expires_at
    const createdVisit = db.prepare('SELECT expires_at FROM visits WHERE id = ?').get(result.lastInsertRowid);
    
    console.log(`Visit created: ${visiting_user_id} → ${host_user_id} (${pokemon_species}, expires: ${createdVisit.expires_at})`);
    
    res.status(201).json({
      visitId: result.lastInsertRowid,
      expiresAt: createdVisit.expires_at
    });
  } catch (error) {
    console.error('Create visit error:', error);
    res.status(500).json({ error: 'Visit creation failed' });
  }
});

// Get active visits where current user is host
router.get('/visits/active', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;
  
  try {
    const visits = db.prepare(`
      SELECT 
        v.id,
        v.visiting_user_id as visitingUserId,
        v.pokemon_species as pokemonSpecies,
        v.created_at as createdAt,
        v.expires_at as expiresAt,
        u.username as visitorUsername
      FROM visits v
      JOIN users u ON v.visiting_user_id = u.id
      WHERE v.host_user_id = ? 
        AND v.ended_at IS NULL 
        AND v.expires_at > datetime('now')
      ORDER BY v.created_at DESC
    `).all(currentUserId);
    
    console.log(`Fetched ${visits.length} active visits for host ${currentUserId}`);
    res.json(visits);
  } catch (error) {
    console.error('Get active visits error:', error);
    res.status(500).json({ error: 'Failed to fetch active visits' });
  }
});

// End a visit manually
router.post('/visits/end', authenticateToken, (req, res) => {
  const { visit_id } = req.body;
  const currentUserId = req.user.userId;
  
  // Validate visit_id is number
  if (!visit_id || typeof visit_id !== 'number') {
    return res.status(400).json({ error: 'Valid visit_id required' });
  }
  
  try {
    // Get visit and verify it exists
    const visit = db.prepare('SELECT id, visiting_user_id, host_user_id, ended_at FROM visits WHERE id = ?').get(visit_id);
    
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    
    // Authorize: current user must be visitor OR host
    if (visit.visiting_user_id !== currentUserId && visit.host_user_id !== currentUserId) {
      return res.status(403).json({ error: 'Only the visitor or host can end this visit' });
    }
    
    // Validate not already ended
    if (visit.ended_at !== null) {
      return res.status(400).json({ error: 'Visit already ended' });
    }
    
    // Update ended_at
    db.prepare(`UPDATE visits SET ended_at = datetime('now') WHERE id = ?`).run(visit_id);
    
    // Get the updated ended_at value
    const updatedVisit = db.prepare('SELECT ended_at FROM visits WHERE id = ?').get(visit_id);
    
    console.log(`Visit ended: ${visit_id} by user ${currentUserId}`);
    
    res.json({
      visitId: visit_id,
      endedAt: updatedVisit.ended_at
    });
  } catch (error) {
    console.error('End visit error:', error);
    res.status(500).json({ error: 'Failed to end visit' });
  }
});

module.exports = router;
