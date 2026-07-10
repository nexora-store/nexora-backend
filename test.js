const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:1234@localhost:5432/nexora_store' });

async function main() {
  try {
    const columns = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'");
    console.log(JSON.stringify(columns.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
