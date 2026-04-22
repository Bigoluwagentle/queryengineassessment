require('dotenv').config();
const { pool, initDb } = require('../src/db');
const { generateUUIDv7 } = require('../src/utils/uuid');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const GDRIVE_FILE_ID = '1Up06dcS9OfUEnDj_u6OV_xTRntupFhPH';
const GDRIVE_DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${GDRIVE_FILE_ID}`;
const GDRIVE_CONFIRM_URL = `https://drive.usercontent.google.com/download?id=${GDRIVE_FILE_ID}&export=download&authuser=0&confirm=t`;

const BATCH_SIZE = 100; 

function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 60) return 'adult';
  return 'senior';
}

function downloadJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadJSON(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          // Handle Google Drive's "virus scan warning" HTML page
          if (data.trim().startsWith('<')) {
            reject(new Error('Received HTML instead of JSON — Google Drive may require confirmation. Use --file flag with a local copy.'));
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return 0;

  const values = [];
  const placeholders = batch.map((profile, i) => {
    const base = i * 10;
    values.push(
      profile.id,
      profile.name,
      profile.gender,
      profile.gender_probability,
      profile.age,
      profile.age_group,
      profile.country_id,
      profile.country_name,
      profile.country_probability,
      profile.created_at
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  });

  const sql = `
    INSERT INTO profiles
      (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (name) DO NOTHING
  `;

  const result = await client.query(sql, values);
  return result.rowCount;
}

async function seed() {
  console.log('🌱 Starting database seed...\n');

  const args = process.argv.slice(2);
  const fileFlag = args.indexOf('--file');
  let profiles;

  if (fileFlag !== -1 && args[fileFlag + 1]) {
    const filePath = path.resolve(args[fileFlag + 1]);
    console.log(`📂 Loading profiles from local file: ${filePath}`);
    const raw = fs.readFileSync(filePath, 'utf8');
    profiles = JSON.parse(raw);
  } else {
    console.log(`📥 Downloading profiles.json from Google Drive...`);
    console.log(`   URL: ${GDRIVE_CONFIRM_URL}\n`);
    try {
      profiles = await downloadJSON(GDRIVE_CONFIRM_URL);
    } catch (err) {
      console.error('❌ Download failed:', err.message);
      console.log('\n💡 Tip: Download profiles.json manually and run:');
      console.log('   node scripts/seed.js --file ./profiles.json\n');
      process.exit(1);
    }
  }

  if (!Array.isArray(profiles)) {
    if (profiles.profiles && Array.isArray(profiles.profiles)) {
      profiles = profiles.profiles;
    } else if (profiles.data && Array.isArray(profiles.data)) {
      profiles = profiles.data;
    } else {
      console.error('❌ Unexpected JSON shape. Expected an array of profiles.');
      process.exit(1);
    }
  }

  console.log(`✅ Loaded ${profiles.length} profiles\n`);

  await initDb();

  const client = await pool.connect();
  let totalInserted = 0;
  let totalSkipped = 0;

  try {
    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const rawBatch = profiles.slice(i, i + BATCH_SIZE);

      const batch = rawBatch.map((p) => {
        const age = typeof p.age === 'number' ? p.age : parseInt(p.age, 10);
        return {
          id: p.id || generateUUIDv7(),
          name: p.name || p.fullName || '',
          gender: (p.gender || '').toLowerCase(),
          gender_probability:
            typeof p.gender_probability === 'number'
              ? p.gender_probability
              : parseFloat(p.gender_probability || p.genderProbability || 0),
          age,
          age_group: p.age_group || p.ageGroup || getAgeGroup(age),
          country_id: (p.country_id || p.countryId || p.country?.id || '').toUpperCase(),
          country_name: p.country_name || p.countryName || p.country?.name || '',
          country_probability:
            typeof p.country_probability === 'number'
              ? p.country_probability
              : parseFloat(p.country_probability || p.countryProbability || 0),
          created_at: p.created_at || p.createdAt || new Date().toISOString(),
        };
      });

      const valid = batch.filter((p) => p.name && p.gender && p.country_id);
      const skipped = batch.length - valid.length;
      totalSkipped += skipped;

      const inserted = await insertBatch(client, valid);
      totalInserted += inserted;
      totalSkipped += valid.length - inserted; 

      const progress = Math.min(i + BATCH_SIZE, profiles.length);
      process.stdout.write(`\r📊 Progress: ${progress}/${profiles.length} processed...`);
    }

    console.log('\n');
    console.log(`✅ Seed complete!`);
    console.log(`   Inserted: ${totalInserted}`);
    console.log(`   Skipped (duplicates/invalid): ${totalSkipped}`);
    console.log(`   Total processed: ${profiles.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});