require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // 1. What's actually stored in order_items
    const items = await pool.query(`
      SELECT
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.product_name,
        oi.image_url,
        oi.quantity,
        oi.price,
        p.name AS live_product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      ORDER BY oi.product_name NULLS FIRST
      LIMIT 20
    `);
    console.log('\n=== ORDER ITEMS TABLE ===');
    console.table(items.rows);

    // 2. Count how many have empty/null product_name
    const empty = await pool.query(`
      SELECT COUNT(*) AS empty_snapshots
      FROM order_items
      WHERE product_name IS NULL OR product_name = '' OR product_name = 'Unknown Product'
    `);
    console.log('\n=== EMPTY SNAPSHOTS COUNT ===');
    console.table(empty.rows);

    // 3. Sample what the admin orders API query actually returns
    const adminSample = await pool.query(`
      SELECT
        o.id AS order_id,
        o.status,
        u.name AS customer_name,
        oi.product_id,
        oi.product_name AS snapshot_name,
        COALESCE(NULLIF(oi.product_name, ''), p.name, 'Unknown Product') AS final_name,
        p.name AS products_join_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    console.log('\n=== ADMIN API RESULT (what the API actually returns) ===');
    console.table(adminSample.rows);

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    pool.end();
  }
}
run();
