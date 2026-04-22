require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function generateUUIDv7() {
  const now = BigInt(Date.now());
  const timestampHex = now.toString(16).padStart(12, '0');
  const randA = Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0');
  const variantNibble = (8 + Math.floor(Math.random() * 4)).toString(16);
  const randB1 = Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0');
  const randB2 = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0');
  return (
    timestampHex.slice(0, 8) + '-' +
    timestampHex.slice(8, 12) + '-' +
    '7' + randA + '-' +
    variantNibble + randB1 + '-' +
    randB2
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 60) return 'adult';
  return 'senior';
}

async function initDb(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id                  VARCHAR(36)   PRIMARY KEY,
      name                VARCHAR(255)  NOT NULL UNIQUE,
      gender              VARCHAR(10)   NOT NULL,
      gender_probability  FLOAT         NOT NULL,
      age                 INT           NOT NULL,
      age_group           VARCHAR(20)   NOT NULL,
      country_id          VARCHAR(2)    NOT NULL,
      country_name        VARCHAR(255)  NOT NULL,
      country_probability FLOAT         NOT NULL,
      created_at          TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender       ON profiles(gender);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group    ON profiles(age_group);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id   ON profiles(country_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age          ON profiles(age);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_created_at   ON profiles(created_at);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender_prob  ON profiles(gender_probability);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_prob ON profiles(country_probability);`);
  console.log('✅ Database initialized successfully');
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return 0;
  const values = [];
  const placeholders = batch.map((p, i) => {
    const b = i * 10;
    values.push(p.id, p.name, p.gender, p.gender_probability, p.age, p.age_group, p.country_id, p.country_name, p.country_probability, p.created_at);
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`;
  });
  const sql = `
    INSERT INTO profiles (id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (name) DO NOTHING
  `;
  const result = await client.query(sql, values);
  return result.rowCount;
}

function downloadJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (data.trim().startsWith('<')) return reject(new Error('Got HTML, not JSON. Use --file flag.'));
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function seed() {
  console.log('🌱 Starting database seed...\n');

  const args = process.argv.slice(2);
  const fileFlag = args.indexOf('--file');
  let profiles;

  if (fileFlag !== -1 && args[fileFlag + 1]) {
    const filePath = path.resolve(args[fileFlag + 1]);
    console.log(`📂 Loading profiles from local file: ${filePath}`);
    profiles = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } else {
    const url = `https://drive.usercontent.google.com/download?id=1Up06dcS9OfUEnDj_u6OV_xTRntupFhPH&export=download&authuser=0&confirm=t`;
    console.log(`📥 Downloading profiles.json from Google Drive...`);
    console.log(`   URL: ${url}\n`);
    try {
      profiles = await downloadJSON(url);
    } catch (err) {
      console.error('❌ Download failed:', err.message);
      console.log('💡 Use: node scripts/seed.js --file ./profiles.json');
      process.exit(1);
    }
  }

  if (!Array.isArray(profiles)) {
    if (profiles.profiles) profiles = profiles.profiles;
    else if (profiles.data) profiles = profiles.data;
    else { console.error('❌ Unexpected JSON shape'); process.exit(1); }
  }

  console.log(`✅ Loaded ${profiles.length} profiles\n`);

  const client = await pool.connect();
  try {
    await initDb(client);

    let totalInserted = 0;
    let totalSkipped = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const rawBatch = profiles.slice(i, i + BATCH_SIZE);

      const batch = rawBatch.map((p) => {
        const age = typeof p.age === 'number' ? p.age : parseInt(p.age, 10);
        return {
          id: p.id || generateUUIDv7(),
          name: p.name || p.fullName || '',
          gender: (p.gender || '').toLowerCase(),
          gender_probability: typeof p.gender_probability === 'number' ? p.gender_probability : parseFloat(p.gender_probability || p.genderProbability || 0),
          age,
          age_group: p.age_group || p.ageGroup || getAgeGroup(age),
          country_id: (p.country_id || p.countryId || p.country?.id || '').toUpperCase(),
          country_name: p.country_name || p.countryName || p.country?.name || '',
          country_probability: typeof p.country_probability === 'number' ? p.country_probability : parseFloat(p.country_probability || p.countryProbability || 0),
          created_at: p.created_at || p.createdAt || new Date().toISOString(),
        };
      });

      const valid = batch.filter((p) => p.name && p.gender && p.country_id);
      totalSkipped += batch.length - valid.length;

      const inserted = await insertBatch(client, valid);
      totalInserted += inserted;
      totalSkipped += valid.length - inserted;

      const progress = Math.min(i + BATCH_SIZE, profiles.length);
      process.stdout.write(`\r📊 Progress: ${progress}/${profiles.length} processed...`);
    }

    console.log('\n');
    console.log(`✅ Seed complete!`);
    console.log(`   Inserted : ${totalInserted}`);
    console.log(`   Skipped  : ${totalSkipped} (duplicates/invalid)`);
    console.log(`   Total    : ${profiles.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});