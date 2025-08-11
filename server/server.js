
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'gymbuddy';
if (!uri) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

let client, db;
async function getDb() {
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    db = client.db(dbName);
    await db.collection('workouts').createIndex({ userId: 1, date: -1 });
    await db.collection('lasts').createIndex({ userId: 1, name: 1 }, { unique: true });
  }
  return db;
}

function getUserId(req) {
  const device = req.header('x-device-id');
  return device || null;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/workouts', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'missing x-device-id' });
  const db = await getDb();
  const items = await db.collection('workouts').find({ userId }).sort({ date: -1 }).limit(500).toArray();
  res.json(items);
});

app.post('/api/workouts', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'missing x-device-id' });

  const w = req.body || {};
  if (!w.date || !w.exercises) return res.status(400).json({ error: 'invalid workout' });

  const now = new Date();
  w.userId = userId;
  w.createdAt = now;
  w.updatedAt = now;

  const db = await getDb();
  const r = await db.collection('workouts').insertOne(w);

  // Update lasts
  const weights = {};
  (w.exercises || []).forEach(ex => {
    const used = ex.weight || (ex.sets || []).map(s => s.weight).find(Boolean);
    if (used) weights[ex.name] = used;
  });
  const bulk = db.collection('lasts').initializeUnorderedBulkOp();
  Object.entries(weights).forEach(([name, weight]) => {
    bulk.find({ userId, name }).upsert().updateOne({ $set: { userId, name, weight, updatedAt: now } });
  });
  if (Object.keys(weights).length) await bulk.execute();

  res.status(201).json({ id: r.insertedId });
});

app.use(express.static('.'));
const port = process.env.PORT || 8787;
app.listen(port, () => console.log('API running on http://localhost:' + port));
