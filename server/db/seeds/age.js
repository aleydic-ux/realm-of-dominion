require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT COUNT(*) FROM ages WHERE is_active = true');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Active age already exists, skipping.');
      return;
    }

    const ageLengthDays = parseInt(process.env.AGE_LENGTH_DAYS || '90');
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + ageLengthDays * 24 * 60 * 60 * 1000);

    const { rows } = await client.query(
      `INSERT INTO ages (name, starts_at, ends_at, is_active)
       VALUES ($1, $2, $3, true) RETURNING id`,
      ['Age of Iron', startsAt, endsAt]
    );
    console.log(`Created Age of Iron (id=${rows[0].id}), ends ${endsAt.toISOString()}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
