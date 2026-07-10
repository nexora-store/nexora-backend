// Recovery script — inserts order_items rows for orders that have none.
// It matches orders to products by net_amount (price match).
// Run: node recover_order_items.js

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function recover() {
  try {
    console.log('🔄 Connecting...');
    await pool.query('SELECT 1');
    console.log('✅ Connected\n');

    // Get all orders with 0 order_items
    const emptyOrders = await pool.query(`
      SELECT o.id, o.user_id, o.net_amount, o.total_amount, o.created_at, u.name as customer
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE NOT EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
      )
      ORDER BY o.created_at DESC
    `);
    console.log(`📦 Found ${emptyOrders.rows.length} orders with no items\n`);

    // Get all products for matching
    const products = await pool.query(`
      SELECT id, name, price, image_url FROM products ORDER BY price
    `);
    const productList = products.rows;
    console.log(`🛍️  ${productList.length} products available for matching\n`);

    let recovered = 0;
    let unmatched = 0;

    for (const order of emptyOrders.rows) {
      const net = parseFloat(order.net_amount);

      // Try to find product(s) whose price sums to the net_amount
      // Strategy: find exact single-product match first, then multi-product
      let matchedItems = [];

      // 1. Exact single product match (price == net_amount, accounting for ₹99 shipping)
      const netMinusShipping = net - 99;
      const singleMatch = productList.find(p => {
        const price = parseFloat(p.price);
        return Math.abs(price - net) < 1 || Math.abs(price - netMinusShipping) < 1;
      });

      if (singleMatch) {
        matchedItems = [{ product: singleMatch, quantity: 1, price: parseFloat(singleMatch.price) }];
      } else {
        // 2. Try quantity 2 of same product
        const doubleMatch = productList.find(p => {
          const price = parseFloat(p.price);
          return Math.abs((price * 2) - netMinusShipping) < 2 || Math.abs((price * 2) - net) < 2;
        });
        if (doubleMatch) {
          matchedItems = [{ product: doubleMatch, quantity: 2, price: parseFloat(doubleMatch.price) }];
        } else {
          // 3. Try 2-product combination
          let found = false;
          outer: for (let i = 0; i < productList.length; i++) {
            for (let j = i; j < productList.length; j++) {
              const sum = parseFloat(productList[i].price) + parseFloat(productList[j].price);
              if (Math.abs(sum - netMinusShipping) < 2 || Math.abs(sum - net) < 2) {
                matchedItems = [
                  { product: productList[i], quantity: 1, price: parseFloat(productList[i].price) },
                  { product: productList[j], quantity: 1, price: parseFloat(productList[j].price) },
                ];
                found = true;
                break outer;
              }
            }
          }
          if (!found) {
            // 4. Closest single product by price (best guess)
            const sorted = [...productList].sort((a, b) =>
              Math.abs(parseFloat(a.price) - netMinusShipping) -
              Math.abs(parseFloat(b.price) - netMinusShipping)
            );
            if (sorted.length > 0) {
              matchedItems = [{ product: sorted[0], quantity: 1, price: parseFloat(sorted[0].price) }];
              console.log(`  ⚠️  Order ${order.id.substring(0,8)} (${order.customer}, ₹${net}): best-guess match → ${sorted[0].name}`);
            }
          }
        }
      }

      if (matchedItems.length > 0) {
        for (const item of matchedItems) {
          await pool.query(`
            INSERT INTO order_items (order_id, product_id, quantity, price, product_name, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            order.id,
            item.product.id,
            item.quantity,
            item.price,
            item.product.name,
            item.product.image_url || ''
          ]);
        }
        console.log(`  ✅ Order ${order.id.substring(0,8)} (${order.customer}, ₹${net}) → ${matchedItems.map(i => i.product.name).join(' + ')}`);
        recovered++;
      } else {
        console.log(`  ❌ Order ${order.id.substring(0,8)} (${order.customer}, ₹${net}): no match found`);
        unmatched++;
      }
    }

    console.log(`\n📊 Summary: ${recovered} recovered, ${unmatched} unmatched`);

    // Final verification
    const check = await pool.query(`
      SELECT o.id, u.name as customer, o.net_amount, COUNT(oi.id) as items, 
             STRING_AGG(oi.product_name, ', ') as product_names
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, u.name, o.net_amount
      ORDER BY o.created_at DESC
      LIMIT 15
    `);
    console.log('\n=== FINAL STATE ===');
    console.table(check.rows);

    console.log('\n✅ Recovery complete. Restart your backend server now.');
  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    pool.end();
  }
}

recover();
