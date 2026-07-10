// One-time migration script to add product_name and image_url snapshots to order_items
// Run this with: node migrate_order_items.js

require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('🔄 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');

    // Step 1: Add columns if they don't exist
    console.log('📝 Adding product_name and image_url columns to order_items...');
    await pool.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''
    `);
    console.log('✅ Columns added (or already exist)\n');

    // Step 2: Count how many rows need backfilling
    const countResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM order_items 
      WHERE product_name IS NULL OR product_name = ''
    `);
    const needsBackfill = parseInt(countResult.rows[0].count);
    console.log(`📊 Found ${needsBackfill} order items without product names\n`);

    if (needsBackfill === 0) {
      console.log('✅ All order items already have product names. Nothing to backfill.');
      await pool.end();
      return;
    }

    // Step 3: Backfill from products table
    console.log('🔄 Backfilling product names and images from products table...');
    const updateResult = await pool.query(`
      UPDATE order_items oi
      SET product_name = COALESCE(p.name, 'Unknown Product'),
          image_url    = COALESCE(p.image_url, '')
      FROM products p
      WHERE oi.product_id = p.id
        AND (oi.product_name IS NULL OR oi.product_name = '')
    `);
    console.log(`✅ Updated ${updateResult.rowCount} order items with product names\n`);

    // Step 4: Show sample of updated data
    console.log('📋 Sample of updated order items:');
    const sampleResult = await pool.query(`
      SELECT oi.product_name, oi.quantity, oi.price, o.id as order_id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_name IS NOT NULL AND oi.product_name != ''
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    console.table(sampleResult.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 All existing orders now have product names saved.');
    console.log('\n💡 You can now restart your backend server or refresh the Admin Orders page.');

    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
