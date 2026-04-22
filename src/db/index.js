const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id            VARCHAR(36)   PRIMARY KEY,
        name          VARCHAR(255)  NOT NULL UNIQUE,
        gender        VARCHAR(10)   NOT NULL,
        gender_probability  FLOAT   NOT NULL,
        age           INT           NOT NULL,
        age_group     VARCHAR(20)   NOT NULL,
        country_id    VARCHAR(2)    NOT NULL,
        country_name  VARCHAR(255)  NOT NULL,
        country_probability  FLOAT  NOT NULL,
        created_at    TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender        ON profiles(gender);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group     ON profiles(age_group);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id    ON profiles(country_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age           ON profiles(age);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_created_at    ON profiles(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender_prob   ON profiles(gender_probability);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_prob  ON profiles(country_probability);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender_country ON profiles(gender, country_id);`);

    console.log('✅ Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };