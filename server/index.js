require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const db = require('./database');
const authRouter = require('./routes/auth');
const friendsRouter = require('./routes/friends');
const visitsRouter = require('./routes/visits');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'PokePals Server' });
});

app.use('/api/auth', authRouter);
app.use('/api', friendsRouter);
app.use('/api', visitsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
