require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Full orders table - see what columns actually exist and what data is there
    const orders = await pool.query(`
      SELECT o.id, o.user_id, o.status, o.total_amount, o.net_amount,
             o.shipping_address, o.created_at,
             u.name as customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 15
    `);
    console.log('\n=== ALL ORDERS ===');
    orders.rows.forEach(r => {
      console.log(`Order: ${r.id} | Customer: ${r.customer_name} | Status: ${r.status} | Amount: ${r.net_amount}`);
      console.log(`  shipping_address: ${r.shipping_address}`);
    });

    // Count order_items per order
    const counts = await pool.query(`
      SELECT o.id, u.name as customer, COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, u.name
      ORDER BY o.created_at DESC
      LIMIT 15
    `);
    console.log('\n=== ORDER ITEMS COUNT PER ORDER ===');
    console.table(counts.rows);

    // Show ALL columns in order_items table
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ORDER_ITEMS TABLE COLUMNS ===');
    console.table(cols.rows);

    // Show ALL columns in orders table
    const orderCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    console.log('\n=== ORDERS TABLE COLUMNS ===');
    console.table(orderCols.rows);

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    pool.end();
  }
}
run();
