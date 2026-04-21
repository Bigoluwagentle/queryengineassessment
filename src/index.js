require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const profilesRouter = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Insighta Labs Intelligence Query Engine',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'success', message: 'Server is running' });
});

app.use('/api/profiles', profilesRouter);

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`🚀 Insighta API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();