const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
  
  if (!token) {
    console.log('Auth failed: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.log('Auth failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user; // { userId, username, iat, exp }
    next();
  });
}

module.exports = { authenticateToken };
