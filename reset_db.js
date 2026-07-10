const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const connectionString = 'postgresql://postgres:1234@localhost:5432/nexora_store';
const pool = new Pool({ connectionString });

async function resetDb() {
  console.log("Starting DB reset...");
  try {
    // 1. Drop existing tables to clear mismatched schema
    const dropQuery = `
      DROP TABLE IF EXISTS wishlist, cart, order_items, payments, nxl_transactions, nxl_wallet, orders, products, categories, vendors, users, coupons, notifications, promotions, reward_rules, user_addresses CASCADE;
    `;
    await pool.query(dropQuery);
    console.log("Dropped existing tables.");

    // 2. Read and run schema.sql
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log("Executed schema.sql successfully.");

    // 3. Seed users (vendor and customer)
    const hashedPassword = await bcrypt.hash('password123', 10);
    const adminHashedPassword = await bcrypt.hash('admin123', 10);

    const vendorUserRes = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Nexora Athletics', 'vendor@nexora.com', hashedPassword, 'vendor']
    );
    const vendorId = vendorUserRes.rows[0].id;
    console.log(`Seeded vendor user with ID: ${vendorId}`);

    const customerUserRes = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Rohan Sharma', 'customer@nexora.com', hashedPassword, 'customer']
    );
    const customerId = customerUserRes.rows[0].id;
    console.log(`Seeded customer user with ID: ${customerId}`);

    const adminUserRes = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Nexora Admin', 'admin@nexora.com', adminHashedPassword, 'admin']
    );
    const adminId = adminUserRes.rows[0].id;
    console.log(`Seeded admin user with ID: ${adminId}`);

    // Create wallets
    await pool.query(`INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 50.00)`, [vendorId]);
    await pool.query(`INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 50.00)`, [customerId]);
    await pool.query(`INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 50.00)`, [adminId]);
    console.log("Created wallets for users.");

    // 4. Seed categories
    const categories = ['Shoes', 'Electronics', 'Fashion', 'Grocery', 'General'];
    const categoryIds = {};
    for (const catName of categories) {
      const catRes = await pool.query(
        `INSERT INTO categories (name, icon) VALUES ($1, $2) RETURNING id`,
        [catName, catName.toLowerCase()]
      );
      categoryIds[catName] = catRes.rows[0].id;
    }
    console.log("Seeded categories:", Object.keys(categoryIds));

    // 5. Seed products
    const products = [
      {
        name: "Nexora Ultra Pro Sneakers",
        description: "Next-gen sports shoes with responsive cushioning, carbon plate propulsion, and high-traction soles. Engineered for comfort and peak athletic performance.",
        price: 12999.00,
        stock: 45,
        category: "Shoes",
        image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80"
      },
      {
        name: "SoundNova ANC Headphones",
        description: "Premium over-ear wireless headphones with active noise cancellation, high-fidelity audio, and up to 40 hours of battery life.",
        price: 18499.00,
        stock: 20,
        category: "Electronics",
        image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
      },
      {
        name: "VoltFit Smartwatch Series X",
        description: "Waterproof fitness smartwatch tracking real-time heart rate, blood oxygen levels, and multi-sport activities with an elegant OLED display.",
        price: 8999.00,
        stock: 80,
        category: "Electronics",
        image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"
      },
      {
        name: "EcoOrganic Matcha Green Tea",
        description: "100% organic Japanese matcha green tea powder. Stone-ground, culinary grade, and packed with powerful antioxidants.",
        price: 1499.00,
        stock: 120,
        category: "Grocery",
        image_url: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&auto=format&fit=crop&q=80"
      },
      {
        name: "AeroBreath Running Shirt",
        description: "Ultra-lightweight, breathable, and sweat-wicking athletic shirt designed to keep you cool during intense runs.",
        price: 2499.00,
        stock: 60,
        category: "Fashion",
        image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80"
      }
    ];

    for (const p of products) {
      await pool.query(
        `INSERT INTO products (vendor_id, name, description, price, stock, category_id, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [vendorId, p.name, p.description, p.price, p.stock, categoryIds[p.category], p.image_url]
      );
    }
    console.log("Seeded products successfully.");
    console.log("DB reset and seeding complete!");
  } catch (err) {
    console.error("Error resetting database:", err);
  } finally {
    await pool.end();
  }
}

resetDb();
