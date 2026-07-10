const { Pool } = require('pg');
const connectionString = 'postgresql://postgres:1234@localhost:5432/nexora_store';
const pool = new Pool({ connectionString });

async function fix() {
  try {
    console.log("Dropping tables with incorrect ID types...");
    await pool.query('DROP TABLE IF EXISTS offer_banners, offers CASCADE');
    console.log("Tables dropped successfully.");
  } catch (err) {
    console.error("Error running fix:", err);
  } finally {
    await pool.end();
  }
}

fix();
