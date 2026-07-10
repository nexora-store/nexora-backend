const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexora_super_secret_key_123!';

// Razorpay instance
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log('Razorpay initialized successfully.');
} else {
  console.warn('WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not found in .env. Payment APIs will return errors.');
}

// Setup PostgreSQL pool with safety checks
let pool = null;
let dbConnected = false; // tracks whether a real DB connection was confirmed

async function initPool() {
  if (!process.env.DATABASE_URL) {
    console.warn("No DATABASE_URL set. Running in in-memory mode.");
    return;
  }
  try {
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10000,
      max: 5,
    });
    // Test the connection before committing to it
    await testPool.query('SELECT 1');
    pool = testPool;
    dbConnected = true;
    console.log("✅ PostgreSQL connected successfully.");
  } catch (e) {
    pool = null;
    dbConnected = false;
    console.warn(`⚠️  PostgreSQL unavailable (${e.message}). Running in in-memory mode.`);
  }
}

// We call initPool() at the bottom just before app.listen, but we need pool
// defined now for the rest of the file. Routes use executeQuery() which checks pool.

// In-Memory Database Fallback
const dbFallback = {
  users: [],
  products: [
    {
      id: "prod-6",
      vendor_id: "vendor-1",
      name: "Classic Leather Loafers",
      description: "Handcrafted genuine leather loafers with cushioned insoles and slip-resistant rubber soles. Perfect for office and casual wear.",
      price: 3499.00,
      stock: 35,
      category: "Shoes",
      image_url: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-7",
      vendor_id: "vendor-1",
      name: "ProGrip Basketball Shoes",
      description: "High-top basketball shoes with ankle support, superior grip, and responsive foam midsole for explosive court performance.",
      price: 4999.00,
      stock: 28,
      category: "Shoes",
      image_url: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-8",
      vendor_id: "vendor-1",
      name: "FlexStep Trail Running Shoes",
      description: "All-terrain trail shoes with rock guard protection, breathable mesh upper, and aggressive outsole lugs.",
      price: 2999.00,
      stock: 42,
      category: "Shoes",
      image_url: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-9",
      vendor_id: "vendor-1",
      name: "NexTab Pro 11 Tablet",
      description: "11-inch 2K display tablet with octa-core processor, 8GB RAM, 128GB storage, and a 8000mAh long-lasting battery.",
      price: 24999.00,
      stock: 15,
      category: "Electronics",
      image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-10",
      vendor_id: "vendor-1",
      name: "PowerBoost 20000mAh Power Bank",
      description: "Slim dual-port power bank with 65W PD fast charging, digital display, and universal compatibility.",
      price: 1999.00,
      stock: 90,
      category: "Electronics",
      image_url: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-11",
      vendor_id: "vendor-1",
      name: "ClearVision Wireless Earbuds",
      description: "True wireless earbuds with 6-mic ENC, 30-hour total playtime, IPX5 water resistance, and multipoint Bluetooth 5.3.",
      price: 3999.00,
      stock: 55,
      category: "Electronics",
      image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-12",
      vendor_id: "vendor-1",
      name: "MechKeys RGB Gaming Keyboard",
      description: "Tenkeyless mechanical keyboard with Cherry MX switches, per-key RGB backlighting, and aluminium top plate.",
      price: 4499.00,
      stock: 22,
      category: "Electronics",
      image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-13",
      vendor_id: "vendor-1",
      name: "LuxeWear Silk Kurta Set",
      description: "Premium pure silk kurta-pajama set with intricate embroidery. Ideal for festivals and formal occasions.",
      price: 3299.00,
      stock: 30,
      category: "Fashion",
      image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-14",
      vendor_id: "vendor-1",
      name: "UrbanEdge Denim Jacket",
      description: "Classic washed denim jacket with front chest pockets, adjustable cuffs, and a relaxed modern fit.",
      price: 1999.00,
      stock: 50,
      category: "Fashion",
      image_url: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-15",
      vendor_id: "vendor-1",
      name: "Boho Floral Maxi Dress",
      description: "Flowy rayon maxi dress with all-over floral print, adjustable straps, and a smocked waist for a perfect fit.",
      price: 1499.00,
      stock: 65,
      category: "Fashion",
      image_url: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-16",
      vendor_id: "vendor-1",
      name: "Premium Leather Handbag",
      description: "Structured vegan leather handbag with gold-tone hardware, zip closure, and a removable shoulder strap.",
      price: 2799.00,
      stock: 40,
      category: "Fashion",
      image_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-17",
      vendor_id: "vendor-1",
      name: "Cold-Pressed Extra Virgin Olive Oil",
      description: "Premium Italian extra-virgin olive oil, first cold pressed from hand-picked olives. Rich flavour and high polyphenol content.",
      price: 899.00,
      stock: 100,
      category: "Grocery",
      image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-18",
      vendor_id: "vendor-1",
      name: "Himalayan Pink Salt 1kg",
      description: "Unprocessed natural Himalayan pink rock salt with 84 trace minerals. Ideal for cooking, seasoning, and wellness.",
      price: 499.00,
      stock: 200,
      category: "Grocery",
      image_url: "https://images.unsplash.com/photo-1506368083636-6defb67639a7?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "prod-20",
      vendor_id: "vendor-1",
      name: "Brew Master Coffee Beans 500g",
      description: "Single-origin Arabica whole beans from Coorg estates. Medium roast with notes of dark chocolate and caramel.",
      price: 799.00,
      stock: 110,
      category: "Grocery",
      image_url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&auto=format&fit=crop&q=80"
    },
  ],
  cart: {}, // userId: [ { productId, quantity } ]
  wallets: {}, // userId: { balance: 0, transactions: [] }
  orders: [],
  wishlist: {}, // userId: [ productIds ]
};

// Seed initial vendor
dbFallback.users.push({
  id: "vendor-1",
  name: "Nexora Athletics",
  email: "vendor@nexora.com",
  password: bcrypt.hashSync("password123", 10),
  role: "vendor",
  is_blocked: false,
});

// Seed admin user (offline fallback only)
dbFallback.users.push({
  id: "admin-1",
  name: "Nexora Admin",
  email: "admin@nexora.com",
  password: bcrypt.hashSync("admin123", 10),
  role: "admin",
  is_blocked: false,
});

// Helper to query DB or fallback
// Guards against passing non-UUID strings into UUID columns, which would
// crash PostgreSQL with "invalid input syntax for type uuid".
async function executeQuery(text, params) {
  if (pool) {
    try {
      const res = await pool.query(text, params);
      return res.rows;
    } catch (e) {
      // Only log non-UUID type errors as warnings (UUID errors are developer noise
      // when the app is running with the in-memory fallback user IDs like "user-123").
      if (!e.message.includes('invalid input syntax for type uuid')) {
        console.warn("DB Query failed, using fallback database. Error:", e.message);
      }
    }
  }
  return null;
}

// Returns true if the value is a valid UUID (v4 or any standard UUID format)
function isValidUUID(value) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// MIDDLEWARE - AUTHENTICATION
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user;
    // Flag whether this user's ID is a real PostgreSQL UUID.
    // Routes can use req.user.hasRealUUID to decide whether to bother querying the DB.
    req.user.hasRealUUID = isValidUUID(user.id);
    next();
  });
};

// ROUTES

// 1. Splash check / Info
app.get('/api/info', (req, res) => {
  res.json({ app: "Nexora Store API", version: "1.0.0", status: "Running" });
});

// 2. Authentication
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // ── Check for existing email in DB first to avoid the unique-constraint crash ──
  if (pool) {
    const existing = await executeQuery('SELECT id FROM users WHERE email = $1', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }
  }

  // DB logic — use ON CONFLICT as a final safety net
  let dbResult = await executeQuery(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role`,
    [name, email, hashedPassword, role]
  );

  // ON CONFLICT DO NOTHING returns empty array if email already existed
  if (dbResult && dbResult.length === 0) {
    return res.status(400).json({ message: "Email already registered" });
  }

  if (dbResult && dbResult[0]) {
    const user = dbResult[0];
    if (role === 'vendor') {
      await executeQuery('INSERT INTO vendors (user_id, store_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, name + ' Store']);
    }
    // Setup NXL wallet — ON CONFLICT guards against duplicate wallet
    const walletRes = await executeQuery(
      'INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING RETURNING id',
      [user.id]
    );
    if (walletRes && walletRes[0]) {
      await executeQuery(
        "INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, 50, 'ADDED', 'Welcome bonus NXL credits')",
        [walletRes[0].id]
      );
      await executeQuery('UPDATE nxl_wallet SET balance = 50 WHERE id = $1', [walletRes[0].id]);
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
    return res.status(201).json({ token, user });
  }

  // Fallback Logic (DB unavailable)
  const existingFallback = dbFallback.users.find(u => u.email === email);
  if (existingFallback) return res.status(400).json({ message: "Email already registered" });

  const newUser = { id: `user-${Date.now()}`, name, email, password: hashedPassword, role };
  dbFallback.users.push(newUser);
  dbFallback.wallets[newUser.id] = {
    balance: 50.0,
    transactions: [{
      id: `tx-${Date.now()}`,
      amount: 50.0,
      transaction_type: 'ADDED',
      description: 'Welcome bonus NXL credits',
      created_at: new Date()
    }]
  };

  const token = jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, JWT_SECRET);
  res.status(201).json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  let dbResult = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
  if (dbResult && dbResult.length > 0) {
    const user = dbResult[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid email or password" });

    // If this is a vendor, ensure all local seed products exist in PostgreSQL
    if (user.role === 'vendor') {
      seedVendorProductsToDb(user.id).catch(e =>
        console.warn('[SeedProducts] Error during vendor product seed:', e.message)
      );
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }

  // Fallback Logic
  const user = dbFallback.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Invalid email or password" });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ─── SEED VENDOR'S LOCAL PRODUCTS INTO POSTGRESQL ────────────────────────────
// Called once per vendor login. Checks if the vendor already has products in
// the DB; if not, inserts all dbFallback products as their own so that SQL
// queries (inventory value, product count, etc.) always return real data.
async function seedVendorProductsToDb(vendorId) {
  if (!pool) return; // DB not connected — nothing to seed
  try {
    const existing = await pool.query(
      'SELECT COUNT(*) AS cnt FROM products WHERE vendor_id = $1',
      [vendorId]
    );
    const count = parseInt(existing.rows[0]?.cnt || '0');
    if (count > 0) return; // already seeded — skip

    console.log(`[SeedProducts] No products found for vendor ${vendorId}. Seeding ${dbFallback.products.length} products...`);
    for (const p of dbFallback.products) {
      await pool.query(
        `INSERT INTO products (vendor_id, name, description, price, stock, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          vendorId,
          p.name,
          p.description || '',
          parseFloat(p.price),
          parseInt(p.stock),
          p.image_url || ''
        ]
      );
    }
    console.log(`[SeedProducts] Done seeding products for vendor ${vendorId}.`);
  } catch (e) {
    console.warn('[SeedProducts] Seed failed:', e.message);
  }
}

// 3. Products Endpoints
app.get('/api/products', async (req, res) => {
  let dbResult = await executeQuery('SELECT * FROM products');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.products);
});

app.post('/api/products', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: "Only vendors can add products" });
  const { name, description, price, stock, category, image_url } = req.body;

  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery(
      'INSERT INTO products (vendor_id, name, description, price, stock, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, name, description, price, stock, image_url]
    );
    if (dbResult) return res.status(201).json(dbResult[0]);
  }

  // Fallback
  const newProduct = {
    id: `prod-${Date.now()}`,
    vendor_id: req.user.id,
    name, description,
    price: parseFloat(price),
    stock: parseInt(stock),
    category,
    image_url: image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
  };
  dbFallback.products.push(newProduct);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: "Only vendors can modify products" });
  const { name, description, price, stock, category, image_url } = req.body;

  if (req.user.hasRealUUID && isValidUUID(req.params.id)) {
    let dbResult = await executeQuery(
      'UPDATE products SET name=$1, description=$2, price=$3, stock=$4, image_url=$5 WHERE id=$6 AND vendor_id=$7 RETURNING *',
      [name, description, price, stock, image_url, req.params.id, req.user.id]
    );
    if (dbResult) {
      if (dbResult.length === 0) return res.status(404).json({ message: "Product not found or not owner" });
      return res.json(dbResult[0]);
    }
  }

  // Fallback
  const index = dbFallback.products.findIndex(p => p.id === req.params.id && p.vendor_id === req.user.id);
  if (index === -1) return res.status(404).json({ message: "Product not found or not owner" });
  dbFallback.products[index] = {
    ...dbFallback.products[index],
    name, description,
    price: parseFloat(price),
    stock: parseInt(stock),
    category,
    image_url: image_url || dbFallback.products[index].image_url
  };
  res.json(dbFallback.products[index]);
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: "Only vendors can delete products" });

  if (req.user.hasRealUUID && isValidUUID(req.params.id)) {
    let dbResult = await executeQuery('DELETE FROM products WHERE id=$1 AND vendor_id=$2 RETURNING id', [req.params.id, req.user.id]);
    if (dbResult) {
      if (dbResult.length === 0) return res.status(404).json({ message: "Product not found or not owner" });
      return res.json({ message: "Product deleted successfully" });
    }
  }

  // Fallback
  const index = dbFallback.products.findIndex(p => p.id === req.params.id && p.vendor_id === req.user.id);
  if (index === -1) return res.status(404).json({ message: "Product not found or not owner" });
  dbFallback.products.splice(index, 1);
  res.json({ message: "Product deleted successfully" });
});

// 4. Cart Operations
app.get('/api/cart', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery(
      'SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url, p.description, p.stock, p.vendor_id FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = $1',
      [req.user.id]
    );
    if (dbResult) return res.json(dbResult);
  }
  // Fallback
  const items = dbFallback.cart[req.user.id] || [];
  const populated = items.map(item => {
    const prod = dbFallback.products.find(p => p.id === item.productId);
    return {
      product_id: item.productId,
      quantity: item.quantity,
      name: prod ? prod.name : 'Unknown Product',
      price: prod ? prod.price : 0.00,
      image_url: prod ? prod.image_url : '',
      description: prod ? prod.description : '',
      stock: prod ? prod.stock : 0,
      vendor_id: prod ? prod.vendor_id : ''
    };
  });
  res.json(populated);
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (req.user.hasRealUUID && isValidUUID(product_id)) {
    let dbResult = await executeQuery(
      'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity RETURNING *',
      [req.user.id, product_id, quantity || 1]
    );
    if (dbResult) return res.status(201).json(dbResult[0]);
  }
  // Fallback
  if (!dbFallback.cart[req.user.id]) dbFallback.cart[req.user.id] = [];
  const cartItems = dbFallback.cart[req.user.id];
  const existing = cartItems.find(item => item.productId === product_id);
  if (existing) {
    existing.quantity += (quantity || 1);
  } else {
    cartItems.push({ productId: product_id, quantity: quantity || 1 });
  }
  res.status(201).json({ message: "Added to cart" });
});

// DELETE /api/cart/:productId — remove a single item from cart (user-scoped)
app.delete('/api/cart/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  if (req.user.hasRealUUID && isValidUUID(productId)) {
    let dbResult = await executeQuery(
      'DELETE FROM cart WHERE user_id = $1 AND product_id = $2 RETURNING *',
      [req.user.id, productId]
    );
    if (dbResult !== null) return res.json({ message: 'Removed from cart' });
  }
  // Fallback
  if (dbFallback.cart[req.user.id]) {
    dbFallback.cart[req.user.id] = dbFallback.cart[req.user.id].filter(
      item => item.productId !== productId
    );
  }
  res.json({ message: 'Removed from cart' });
});

// PUT /api/cart/:productId — update quantity of a cart item (user-scoped)
app.put('/api/cart/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) {
    if (req.user.hasRealUUID && isValidUUID(productId)) {
      let del = await executeQuery(
        'DELETE FROM cart WHERE user_id = $1 AND product_id = $2 RETURNING *',
        [req.user.id, productId]
      );
      if (del !== null) return res.json({ message: 'Removed from cart' });
    }
    if (dbFallback.cart[req.user.id]) {
      dbFallback.cart[req.user.id] = dbFallback.cart[req.user.id].filter(
        item => item.productId !== productId
      );
    }
    return res.json({ message: 'Removed from cart' });
  }
  if (req.user.hasRealUUID && isValidUUID(productId)) {
    let dbResult = await executeQuery(
      'UPDATE cart SET quantity = $1 WHERE user_id = $2 AND product_id = $3 RETURNING *',
      [quantity, req.user.id, productId]
    );
    if (dbResult !== null) return res.json(dbResult[0] || { message: 'Updated' });
  }
  // Fallback
  if (dbFallback.cart[req.user.id]) {
    const item = dbFallback.cart[req.user.id].find(i => i.productId === productId);
    if (item) item.quantity = quantity;
  }
  res.json({ message: 'Updated' });
});

// ─── WISHLIST ROUTES (user-scoped) ─────────────────────────────────────────
app.get('/api/wishlist', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery(
      'SELECT product_id FROM wishlist WHERE user_id = $1',
      [req.user.id]
    );
    if (dbResult !== null) return res.json(dbResult.map(r => r.product_id));
  }
  res.json(dbFallback.wishlist[req.user.id] || []);
});

app.post('/api/wishlist', authenticateToken, async (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ message: 'product_id is required' });

  if (req.user.hasRealUUID && isValidUUID(product_id)) {
    let dbResult = await executeQuery(
      'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING RETURNING *',
      [req.user.id, product_id]
    );
    if (dbResult !== null) return res.status(201).json({ message: 'Added to wishlist' });
  }
  // Fallback
  if (!dbFallback.wishlist[req.user.id]) dbFallback.wishlist[req.user.id] = [];
  if (!dbFallback.wishlist[req.user.id].includes(product_id)) {
    dbFallback.wishlist[req.user.id].push(product_id);
  }
  res.status(201).json({ message: 'Added to wishlist' });
});

app.delete('/api/wishlist/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;
  if (req.user.hasRealUUID && isValidUUID(productId)) {
    let dbResult = await executeQuery(
      'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING *',
      [req.user.id, productId]
    );
    if (dbResult !== null) return res.json({ message: 'Removed from wishlist' });
  }
  // Fallback
  if (dbFallback.wishlist[req.user.id]) {
    dbFallback.wishlist[req.user.id] = dbFallback.wishlist[req.user.id].filter(
      id => id !== productId
    );
  }
  res.json({ message: 'Removed from wishlist' });
});

// ─── CUSTOMER: Public coupons list ───────────────────────────────────────────
app.get('/api/coupons', authenticateToken, async (req, res) => {
  const now = new Date().toISOString();
  let dbResult = await executeQuery(
    "SELECT * FROM coupons WHERE (status IS NULL OR status = 'active') AND active_until > $1 ORDER BY active_until ASC",
    [now]
  );
  if (dbResult) return res.json(dbResult);
  const fallback = (dbFallback.coupons || []).filter(c => {
    const exp = new Date(c.active_until);
    return (!c.status || c.status === 'active') && exp > new Date();
  });
  res.json(fallback);
});

// ─── CUSTOMER: Validate / apply a coupon ─────────────────────────────────────
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required' });
  const now = new Date().toISOString();
  let rows = await executeQuery(
    "SELECT * FROM coupons WHERE UPPER(code)=UPPER($1) AND (status IS NULL OR status='active') AND active_until > $2",
    [code.trim(), now]
  );
  let coupon = rows && rows[0];
  if (!coupon) {
    // fallback
    coupon = (dbFallback.coupons || []).find(c =>
      c.code.toUpperCase() === code.trim().toUpperCase() &&
      (!c.status || c.status === 'active') &&
      new Date(c.active_until) > new Date()
    );
  }
  if (!coupon) return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
  const minOrder = parseFloat(coupon.min_order_amount || 0);
  const sub = parseFloat(subtotal || 0);
  if (sub < minOrder) {
    return res.status(400).json({ success: false, message: `Minimum order amount is ₹${minOrder} to use this coupon` });
  }
  let discountAmount = 0;
  const discType = coupon.discount_type || 'percentage';
  if (discType === 'flat') {
    discountAmount = parseFloat(coupon.discount_value || 0);
  } else {
    const pct = parseFloat(coupon.discount_percentage || coupon.discount_value || 0);
    discountAmount = (sub * pct) / 100;
    const maxDisc = parseFloat(coupon.max_discount || 0);
    if (maxDisc > 0) discountAmount = Math.min(discountAmount, maxDisc);
  }
  discountAmount = Math.min(discountAmount, sub);
  res.json({ success: true, coupon, discountAmount: discountAmount.toFixed(2), message: `Coupon applied! You save ₹${discountAmount.toFixed(0)}` });
});

// 5. Wallet
app.get('/api/wallet', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    let wallet = await executeQuery('SELECT balance FROM nxl_wallet WHERE user_id = $1', [req.user.id]);
    let transactions = await executeQuery(
      'SELECT t.* FROM nxl_transactions t JOIN nxl_wallet w ON t.wallet_id = w.id WHERE w.user_id = $1 ORDER BY t.created_at DESC',
      [req.user.id]
    );
    if (wallet) {
      return res.json({
        balance: parseFloat(wallet[0]?.balance || 0),
        transactions: transactions || []
      });
    }
  }
  // Fallback
  if (!dbFallback.wallets[req.user.id]) {
    dbFallback.wallets[req.user.id] = { balance: 0.00, transactions: [] };
  }
  res.json(dbFallback.wallets[req.user.id]);
});

app.post('/api/wallet/add', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

  if (req.user.hasRealUUID) {
    let walletRes = await executeQuery('UPDATE nxl_wallet SET balance = balance + $1 WHERE user_id = $2 RETURNING *', [amount, req.user.id]);
    if (walletRes && walletRes[0]) {
      await executeQuery(
        "INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, $2, 'ADDED', 'Loaded money to wallet')",
        [walletRes[0].id, amount]
      );
      return res.json({ balance: walletRes[0].balance });
    }
  }
  // Fallback
  if (!dbFallback.wallets[req.user.id]) {
    dbFallback.wallets[req.user.id] = { balance: 0.00, transactions: [] };
  }
  dbFallback.wallets[req.user.id].balance += parseFloat(amount);
  dbFallback.wallets[req.user.id].transactions.unshift({
    id: `tx-${Date.now()}`,
    amount: parseFloat(amount),
    transaction_type: 'ADDED',
    description: 'Loaded money to wallet',
    created_at: new Date()
  });
  res.json({ balance: dbFallback.wallets[req.user.id].balance });
});

// 6. Orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    let dbResult;
    if (req.user.role === 'admin') {
      dbResult = await executeQuery(
        'SELECT o.id, o.total_amount, o.discount_amount, o.net_amount, o.status, o.shipping_address, o.created_at, u.name as customer_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
      );
    } else if (req.user.role === 'vendor') {
      dbResult = await executeQuery(
        `SELECT DISTINCT o.id, o.total_amount, o.discount_amount, o.net_amount, o.status, o.shipping_address, o.created_at, u.name as customer_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         WHERE p.vendor_id = $1
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );
    } else {
      dbResult = await executeQuery(
        'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );
    }

    if (dbResult) {
      const orderIds = dbResult.map(o => o.id).filter(id => isValidUUID(id));
      const allItems = orderIds.length > 0
        ? await executeQuery(
            `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price,
                    COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS name,
                    COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS product_name,
                    COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '') AS image_url
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ANY($1::uuid[])`,
            [orderIds]
          )
        : [];
      const itemsByOrder = {};
      for (const item of (allItems || [])) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }
      const enriched = dbResult.map(order => ({
        ...order,
        items: itemsByOrder[order.id] || [],
      }));
      return res.json(enriched);
    }
  }

  // Fallback
  if (req.user.role === 'admin') {
    return res.json(dbFallback.orders);
  }
  if (req.user.role === 'vendor') {
    const vendorProductIds = new Set(
      dbFallback.products.filter(p => p.vendor_id === req.user.id).map(p => p.id)
    );
    return res.json(dbFallback.orders.filter(o =>
      o.items && o.items.some(item => vendorProductIds.has(item.product_id))
    ));
  }
  res.json(dbFallback.orders.filter(o => o.user_id === req.user.id));
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { items, total_amount, discount_amount, net_amount, shipping_address, payment_method, redeem_credits } = req.body;

  // Only attempt DB insert when the user has a real UUID
  if (req.user.hasRealUUID) {
    let dbOrder = await executeQuery(
      "INSERT INTO orders (user_id, total_amount, discount_amount, net_amount, status, shipping_address) VALUES ($1, $2, $3, $4, 'Pending', $5) RETURNING *",
      [req.user.id, total_amount, discount_amount, net_amount, shipping_address]
    );

    if (dbOrder && dbOrder[0]) {
      const order = dbOrder[0];
      for (const item of items) {
        const snapshotName  = (item.name || item.product_name || '').toString().trim();
        const snapshotImage = (item.image_url || '').toString().trim();

        if (isValidUUID(item.product_id)) {
          await executeQuery(
            'INSERT INTO order_items (order_id, product_id, quantity, price, product_name, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [order.id, item.product_id, item.quantity, item.price, snapshotName, snapshotImage]
          );
          await executeQuery('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        } else {
          await executeQuery(
            'INSERT INTO order_items (order_id, product_id, quantity, price, product_name, image_url) VALUES ($1, NULL, $2, $3, $4, $5)',
            [order.id, item.quantity, item.price, snapshotName, snapshotImage]
          );
          const fbProd = dbFallback.products.find(p => p.id === item.product_id);
          if (fbProd) fbProd.stock = Math.max(0, fbProd.stock - item.quantity);
        }
      }
      if (redeem_credits && redeem_credits > 0) {
        let wallet = await executeQuery('UPDATE nxl_wallet SET balance = balance - $1 WHERE user_id = $2 RETURNING id', [redeem_credits, req.user.id]);
        if (wallet && wallet[0]) {
          await executeQuery(
            "INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, $2, 'REDEEMED', $3)",
            [wallet[0].id, redeem_credits, `Discount on Order #${order.id.substring(0,8)}`]
          );
        }
      }
      const earnedCredits = Math.floor(net_amount / 100) * 5;
      if (earnedCredits > 0) {
        let wallet = await executeQuery('UPDATE nxl_wallet SET balance = balance + $1 WHERE user_id = $2 RETURNING id', [earnedCredits, req.user.id]);
        if (wallet && wallet[0]) {
          await executeQuery(
            "INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, $2, 'EARNED', $3)",
            [wallet[0].id, earnedCredits, `Earned from Order #${order.id.substring(0,8)}`]
          );
        }
      }
      await executeQuery(
        "INSERT INTO payments (order_id, payment_method, payment_status, amount_paid) VALUES ($1, $2, 'Success', $3)",
        [order.id, payment_method, net_amount]
      );
      await executeQuery('DELETE FROM cart WHERE user_id = $1', [req.user.id]);

      const savedItems = await executeQuery(
        `SELECT oi.product_id, oi.quantity, oi.price,
                COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS name,
                COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS product_name,
                COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '') AS image_url
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );

      return res.status(201).json({
        ...order,
        items: savedItems || items.map(item => ({
          product_id:   item.product_id,
          name:         item.name || item.product_name || '',
          product_name: item.name || item.product_name || '',
          quantity:     item.quantity,
          price:        item.price,
          image_url:    item.image_url || '',
        }))
      });
    }
  }

  // Fallback (DB unavailable or non-UUID user)
  const newOrder = {
    id: `ord-${Date.now()}`,
    user_id: req.user.id,
    total_amount,
    discount_amount,
    net_amount,
    status: 'Pending',
    shipping_address,
    created_at: new Date(),
    items
  };

  if (redeem_credits && redeem_credits > 0) {
    if (dbFallback.wallets[req.user.id]) {
      dbFallback.wallets[req.user.id].balance -= parseFloat(redeem_credits);
      dbFallback.wallets[req.user.id].transactions.unshift({
        id: `tx-${Date.now()}-red`,
        amount: parseFloat(redeem_credits),
        transaction_type: 'REDEEMED',
        description: `Discount on Order #${newOrder.id.substring(0,8)}`,
        created_at: new Date()
      });
    }
  }

  const earnedCredits = Math.floor(net_amount / 100) * 5;
  if (earnedCredits > 0) {
    if (!dbFallback.wallets[req.user.id]) {
      dbFallback.wallets[req.user.id] = { balance: 0.00, transactions: [] };
    }
    dbFallback.wallets[req.user.id].balance += earnedCredits;
    dbFallback.wallets[req.user.id].transactions.unshift({
      id: `tx-${Date.now()}-earn`,
      amount: parseFloat(earnedCredits),
      transaction_type: 'EARNED',
      description: `Earned from Order #${newOrder.id.substring(0,8)}`,
      created_at: new Date()
    });
  }

  for (const item of items) {
    const prod = dbFallback.products.find(p => p.id === item.product_id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.quantity);
  }

  dbFallback.orders.unshift(newOrder);
  dbFallback.cart[req.user.id] = [];
  res.status(201).json(newOrder);
});

// ─── USER PROFILE & SETTINGS ─────────────────────────────────────────────────

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery(
      'UPDATE users SET name=$1 WHERE id=$2 RETURNING id, name, email, role',
      [name.trim(), req.user.id]
    );
    if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  }
  // Fallback
  const u = dbFallback.users.find(u => u.id === req.user.id);
  if (u) u.name = name.trim();
  res.json({ id: req.user.id, name: name.trim(), email: req.user.email, role: req.user.role });
});

app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery('SELECT password FROM users WHERE id=$1', [req.user.id]);
    if (dbResult && dbResult[0]) {
      const match = await bcrypt.compare(currentPassword, dbResult[0].password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await executeQuery('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.user.id]);
      return res.json({ message: 'Password changed successfully' });
    }
  }
  // Fallback
  const u = dbFallback.users.find(u => u.id === req.user.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  const match = await bcrypt.compare(currentPassword, u.password);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
  u.password = await bcrypt.hash(newPassword, 10);
  res.json({ message: 'Password changed successfully' });
});

app.delete('/api/auth/account', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    await executeQuery('DELETE FROM users WHERE id=$1', [req.user.id]);
  }
  const idx = dbFallback.users.findIndex(u => u.id === req.user.id);
  if (idx !== -1) dbFallback.users.splice(idx, 1);
  res.json({ message: 'Account deleted successfully' });
});

// ─── ADDRESSES ────────────────────────────────────────────────────────────────
if (!dbFallback.addresses) dbFallback.addresses = {};

app.get('/api/addresses', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    let dbResult = await executeQuery(
      'SELECT * FROM user_addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    if (dbResult) return res.json(dbResult);
  }
  res.json(dbFallback.addresses[req.user.id] || []);
});

app.post('/api/addresses', authenticateToken, async (req, res) => {
  const { label, full_name, phone, address_line1, address_line2, city, state, pincode, is_default } = req.body;
  if (!full_name || !address_line1 || !city || !state || !pincode) {
    return res.status(400).json({ message: 'Required fields missing' });
  }
  if (req.user.hasRealUUID) {
    if (is_default) {
      await executeQuery('UPDATE user_addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
    }
    let dbResult = await executeQuery(
      `INSERT INTO user_addresses (user_id, label, full_name, phone, address_line1, address_line2, city, state, pincode, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, label||'Home', full_name, phone||'', address_line1, address_line2||'', city, state, pincode, is_default||false]
    );
    if (dbResult) return res.status(201).json(dbResult[0]);
  }
  // Fallback
  if (is_default && dbFallback.addresses[req.user.id]) {
    dbFallback.addresses[req.user.id].forEach(a => a.is_default = false);
  }
  const newAddr = { id: `addr-${Date.now()}`, user_id: req.user.id, label: label||'Home', full_name, phone: phone||'', address_line1, address_line2: address_line2||'', city, state, pincode, is_default: is_default||false, created_at: new Date() };
  if (!dbFallback.addresses[req.user.id]) dbFallback.addresses[req.user.id] = [];
  dbFallback.addresses[req.user.id].push(newAddr);
  res.status(201).json(newAddr);
});

app.put('/api/addresses/:id', authenticateToken, async (req, res) => {
  const { label, full_name, phone, address_line1, address_line2, city, state, pincode, is_default } = req.body;
  if (req.user.hasRealUUID && isValidUUID(req.params.id)) {
    if (is_default) {
      await executeQuery('UPDATE user_addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
    }
    let dbResult = await executeQuery(
      `UPDATE user_addresses SET label=$1,full_name=$2,phone=$3,address_line1=$4,address_line2=$5,city=$6,state=$7,pincode=$8,is_default=$9
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [label, full_name, phone, address_line1, address_line2, city, state, pincode, is_default, req.params.id, req.user.id]
    );
    if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  }
  // Fallback
  if (is_default && dbFallback.addresses[req.user.id]) {
    dbFallback.addresses[req.user.id].forEach(a => a.is_default = false);
  }
  const addrs = dbFallback.addresses[req.user.id] || [];
  const idx = addrs.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Address not found' });
  addrs[idx] = { ...addrs[idx], label, full_name, phone, address_line1, address_line2, city, state, pincode, is_default };
  res.json(addrs[idx]);
});

app.delete('/api/addresses/:id', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID && isValidUUID(req.params.id)) {
    await executeQuery('DELETE FROM user_addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  }
  if (dbFallback.addresses[req.user.id]) {
    dbFallback.addresses[req.user.id] = dbFallback.addresses[req.user.id].filter(a => a.id !== req.params.id);
  }
  res.json({ message: 'Address deleted' });
});

// ─── NXL TOKEN PURCHASE (Razorpay) ───────────────────────────────────────────
// Token packs: ₹100=105, ₹200=210, ₹500=525, ₹1000=1050, ₹2000=2100
app.post('/api/wallet/buy-tokens', authenticateToken, async (req, res) => {
  const { amount_inr } = req.body; // amount in rupees
  if (!amount_inr || parseFloat(amount_inr) <= 0) return res.status(400).json({ message: 'Invalid amount' });
  if (!razorpay) return res.status(503).json({ message: 'Payment gateway not configured' });

  const amountInPaise = Math.round(parseFloat(amount_inr) * 100);
  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise, currency: 'INR',
      receipt: `nxl_${Date.now()}`, payment_capture: 1,
    });
    return res.json({ order_id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create token purchase order', error: err.message });
  }
});

app.post('/api/wallet/buy-tokens/verify', authenticateToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount_inr, nxl_tokens } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing verification fields' });
  }
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expectedSignature !== razorpay_signature) return res.status(400).json({ message: 'Payment verification failed' });

  // Credit NXL tokens to wallet
  if (req.user.hasRealUUID) {
    let walletRes = await executeQuery('UPDATE nxl_wallet SET balance = balance + $1 WHERE user_id = $2 RETURNING *', [nxl_tokens, req.user.id]);
    if (walletRes && walletRes[0]) {
      await executeQuery(`INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, $2, 'ADDED', $3)`,
        [walletRes[0].id, nxl_tokens, `Purchased ${nxl_tokens} NXL tokens for ₹${amount_inr}`]);
      return res.json({ success: true, balance: walletRes[0].balance, tokens_added: nxl_tokens });
    }
  }
  // Fallback
  if (!dbFallback.wallets[req.user.id]) dbFallback.wallets[req.user.id] = { balance: 0, transactions: [] };
  dbFallback.wallets[req.user.id].balance += parseFloat(nxl_tokens);
  dbFallback.wallets[req.user.id].transactions.unshift({ id: `tx-${Date.now()}`, amount: nxl_tokens, transaction_type: 'ADDED', description: `Purchased ${nxl_tokens} NXL tokens for ₹${amount_inr}`, created_at: new Date() });
  res.json({ success: true, balance: dbFallback.wallets[req.user.id].balance, tokens_added: nxl_tokens });
});

// ─── USER PROFILE & SETTINGS ─────────────────────────────────────────────────

// 7a. Create Razorpay Order
app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
  const { amount } = req.body; // amount in INR (rupees)

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Invalid amount. Must be a positive number.' });
  }

  if (!razorpay) {
    return res.status(503).json({ message: 'Payment gateway not configured. Check server .env keys.' });
  }

  // Razorpay requires amount in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(parseFloat(amount) * 100);
  const receiptId = `rcpt_${Date.now()}`;

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      payment_capture: 1, // auto-capture
    });

    console.log(`Razorpay order created: ${order.id} for ₹${amount}`);
    return res.json({
      order_id: order.id,
      amount: order.amount,       // in paise
      amount_inr: amount,         // in rupees for display
      currency: order.currency,
      receipt: order.receipt,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    return res.status(500).json({ message: 'Failed to create payment order.', error: err.message });
  }
});

// 7b. Verify Razorpay Payment Signature
app.post('/api/payment/verify', authenticateToken, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_method } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: 'Missing payment verification fields.' });
  }

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    console.warn(`Payment signature mismatch! order: ${razorpay_order_id}`);
    return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
  }

  console.log(`Payment verified: ${razorpay_payment_id} for order: ${razorpay_order_id}`);

  // Save transaction to DB
  const amountInRupees = amount ? parseFloat(amount) / 100 : 0;
  let dbResult = await executeQuery(
    `INSERT INTO payments (order_id, payment_method, payment_status, razorpay_payment_id, amount_paid)
     VALUES ($1, $2, 'Success', $3, $4) RETURNING *`,
    [razorpay_order_id, payment_method || 'RAZORPAY', razorpay_payment_id, amountInRupees]
  );

  // Fallback: store in-memory if DB unavailable
  if (!dbResult) {
    if (!dbFallback.transactions) dbFallback.transactions = [];
    dbFallback.transactions.push({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      payment_method: payment_method || 'RAZORPAY',
      status: 'Success',
      amount: amountInRupees,
      user_id: req.user.id,
      created_at: new Date(),
    });
  }

  return res.json({
    success: true,
    message: 'Payment verified and recorded successfully.',
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
  });
});

// ─── END RAZORPAY ROUTES ───────────────────────────────────────────────────────

// ─── VENDOR PROFILE ──────────────────────────────────────────────────────────

app.get('/api/vendor/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access required' });

  if (req.user.hasRealUUID) {
    const userRow = await executeQuery(
      'SELECT id, name, email, phone FROM users WHERE id = $1', [req.user.id]
    );
    const vendorRow = await executeQuery(
      'SELECT store_name, description, address, phone as store_phone FROM vendors WHERE user_id = $1', [req.user.id]
    );
    if (userRow) {
      const u = userRow[0] || {};
      const v = (vendorRow && vendorRow[0]) || {};
      return res.json({
        id: u.id, name: u.name || '', email: u.email || '',
        phone: u.phone || v.store_phone || '',
        store_name: v.store_name || u.name || '',
        description: v.description || '', address: v.address || '', photo_url: u.photo_url || '',
      });
    }
  }
  // Fallback
  const u = dbFallback.users.find(u => u.id === req.user.id) || {};
  res.json({
    id: u.id || req.user.id, name: u.name || '', email: u.email || '',
    phone: u.phone || '', store_name: u.store_name || u.name || '',
    description: u.description || '', address: u.address || '', photo_url: u.photo_url || '',
  });
});

app.put('/api/vendor/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access required' });

  const { store_name, phone, address, photo_url } = req.body;

  if (req.user.hasRealUUID) {
    await executeQuery(
      'UPDATE users SET phone = COALESCE($1, phone), photo_url = COALESCE($2, photo_url) WHERE id = $3',
      [phone || null, photo_url || null, req.user.id]
    );
    const vendorExists = await executeQuery('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
    if (vendorExists && vendorExists.length > 0) {
      await executeQuery(
        'UPDATE vendors SET store_name = COALESCE($1, store_name), address = COALESCE($2, address) WHERE user_id = $3',
        [store_name || null, address || null, req.user.id]
      );
    } else if (vendorExists) {
      await executeQuery(
        'INSERT INTO vendors (user_id, store_name, address) VALUES ($1, $2, $3)',
        [req.user.id, store_name || '', address || '']
      );
    }
    const userRow   = await executeQuery('SELECT id, name, email, phone FROM users WHERE id = $1', [req.user.id]);
    const vendorRow = await executeQuery('SELECT store_name, address FROM vendors WHERE user_id = $1', [req.user.id]);
    if (userRow) {
      const u = userRow[0] || {};
      const v = (vendorRow && vendorRow[0]) || {};
      return res.json({
        id: u.id, name: u.name || '', email: u.email || '', phone: u.phone || '',
        store_name: v.store_name || '', address: v.address || '', photo_url: photo_url || '',
      });
    }
  }
  // Fallback
  const u = dbFallback.users.find(u => u.id === req.user.id);
  if (u) {
    if (store_name) u.store_name = store_name;
    if (phone)      u.phone      = phone;
    if (address)    u.address    = address;
    if (photo_url)  u.photo_url  = photo_url;
  }
  res.json({
    id: req.user.id, name: u?.name || '', email: u?.email || '',
    phone: u?.phone || '', store_name: u?.store_name || '',
    address: u?.address || '', photo_url: u?.photo_url || '',
  });
});

// ─── VENDOR DASHBOARD STATS ───────────────────────────────────────────────────
// Returns all metrics for the vendor's own products & orders only.
// Used by the Dashboard (Metrics) tab in the Flutter Vendor Dashboard.
app.get('/api/vendor/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access required' });

  const vendorId = req.user.id;

  // ── DB path ──────────────────────────────────────────────────────────────
  // Step 1: Get all distinct orders that contain this vendor's products
  const orderRows = await executeQuery(
    `SELECT DISTINCT
        o.id,
        o.total_amount,
        o.discount_amount,
        o.net_amount,
        o.status,
        o.shipping_address,
        o.created_at,
        u.name AS customer_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE p.vendor_id = $1 OR oi.product_id IS NULL
     ORDER BY o.created_at DESC`,
    [vendorId]
  );

  if (orderRows !== null) {
    // Step 2: Fetch only this vendor's items for those orders
    const orderIds = orderRows.map(o => o.id).filter(id => isValidUUID(id));
    const itemRows = orderIds.length > 0
      ? await executeQuery(
          `SELECT
              oi.order_id,
              oi.product_id,
              oi.quantity,
              oi.price,
              COALESCE(NULLIF(oi.product_name, ''), p.name, 'Product') AS product_name,
              COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '')   AS image_url
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = ANY($1::uuid[])
             AND (p.vendor_id = $2 OR oi.product_id IS NULL)`,
          [orderIds, vendorId]
        )
      : [];

    const itemsByOrder = {};
    for (const item of (itemRows || [])) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }
    const enriched = orderRows.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));

    // Step 3: Vendor's own products for product count + out-of-stock + inventory value
    const vendorProductsDb = await executeQuery(
      `SELECT id, name, price, stock, image_url FROM products WHERE vendor_id = $1`,
      [vendorId]
    );

    // After login, seed ensures products exist in DB. If still empty (first request
    // races with seed), fall back to in-memory so value is never wrong.
    const vendorProducts = (vendorProductsDb && vendorProductsDb.length > 0)
      ? vendorProductsDb
      : dbFallback.products.filter(p => p.vendor_id === vendorId);

    const totalOrders     = enriched.length;
    const pendingOrders   = enriched.filter(o => o.status === 'Pending').length;
    const deliveredOrders = enriched.filter(o => o.status === 'Delivered');
    const totalSales      = deliveredOrders.reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);
    const productCount    = vendorProducts.length;
    const outOfStock      = vendorProducts.filter(p => parseInt(p.stock || 0) <= 0).length;
    // Total inventory value = SUM(price × stock) across all vendor products
    const inventoryValue  = vendorProducts.reduce(
      (s, p) => s + (parseFloat(p.price || 0) * Math.max(0, parseInt(p.stock || 0))), 0
    );

    // Recent orders — last 5 for the dashboard preview
    const recentOrders = enriched.slice(0, 5).map(o => ({
      id: o.id,
      customerName: o.customer_name || 'Customer',
      status: o.status,
      netAmount: parseFloat(o.net_amount || 0),
      createdAt: o.created_at,
      items: o.items,
    }));

    return res.json({
      totalSales,
      totalOrders,
      pendingOrders,
      productCount,
      outOfStock,
      inventoryValue,
      recentOrders,
    });
  }

  // ── Fallback (in-memory) ──────────────────────────────────────────────────
  const vendorProdIds = new Set(
    dbFallback.products.filter(p => p.vendor_id === vendorId).map(p => p.id)
  );
  const vendorOrders = dbFallback.orders.filter(o =>
    Array.isArray(o.items) && o.items.some(i => vendorProdIds.has(i.product_id))
  );
  const vendorProds  = dbFallback.products.filter(p => p.vendor_id === vendorId);

  const totalSales   = vendorOrders.filter(o => o.status === 'Delivered').reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);
  const totalOrders  = vendorOrders.length;
  const pendingOrders= vendorOrders.filter(o => o.status === 'Pending').length;
  const productCount = vendorProds.length;
  const outOfStock   = vendorProds.filter(p => parseInt(p.stock) <= 0).length;
  const inventoryValue = vendorProds.reduce(
    (s, p) => s + (parseFloat(p.price || 0) * parseInt(p.stock || 0)), 0
  );

  const recentOrders = vendorOrders.slice(0, 5).map(o => {
    const user = dbFallback.users.find(u => u.id === o.user_id);
    return {
      id: o.id,
      customerName: user?.name || o.customer_name || 'Customer',
      status: o.status,
      netAmount: parseFloat(o.net_amount || 0),
      createdAt: o.created_at,
      items: Array.isArray(o.items) ? o.items.map(i => ({
        product_id: i.product_id,
        product_name: i.name || i.product_name || 'Product',
        quantity: i.quantity,
        price: i.price,
        image_url: i.image_url || '',
      })) : [],
    };
  });

  return res.json({
    totalSales,
    totalOrders,
    pendingOrders,
    productCount,
    outOfStock,
    inventoryValue,
    recentOrders,
  });
});

// ─── VENDOR EARNINGS ─────────────────────────────────────────────────────────
// Now filtered to only this vendor's orders (via products.vendor_id join).
app.get('/api/vendor/earnings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor access required' });

  const vendorId = req.user.id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // DB path — vendor-scoped orders only
  const orderRows = await executeQuery(
    `SELECT DISTINCT
        o.id,
        o.net_amount,
        o.status,
        o.created_at,
        u.name AS customer_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE p.vendor_id = $1 OR oi.product_id IS NULL
     ORDER BY o.created_at DESC`,
    [vendorId]
  );

  if (orderRows !== null) {
    const orderIds = orderRows.map(o => o.id).filter(id => isValidUUID(id));
    const itemRows = orderIds.length > 0
      ? await executeQuery(
          `SELECT
              oi.order_id,
              oi.product_id,
              oi.quantity,
              oi.price,
              COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS name,
              COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS product_name,
              COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '') AS image_url
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = ANY($1::uuid[])
             AND (p.vendor_id = $2 OR oi.product_id IS NULL)`,
          [orderIds, vendorId]
        )
      : [];

    const itemsByOrder = {};
    for (const item of (itemRows || [])) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }
    const enriched = orderRows.map(order => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));

    const completed = enriched.filter(o => o.status === 'Delivered');
    const pending   = enriched.filter(o => !['Delivered','Cancelled','Returned'].includes(o.status));

    const totalEarnings   = completed.reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);
    const pendingEarnings = pending.reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

    const todayEarnings = completed
      .filter(o => new Date(o.created_at) >= new Date(todayStart))
      .reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

    const monthEarnings = completed
      .filter(o => new Date(o.created_at) >= new Date(monthStart))
      .reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

    const transactions = enriched
      .filter(o => o.status !== 'Cancelled')
      .map(o => ({
        orderId: o.id,
        customerName: o.customer_name || 'Customer',
        amount: parseFloat(o.net_amount || 0),
        date: o.created_at,
        status: o.status,
        paymentStatus: o.status === 'Delivered' ? 'Completed' : 'Pending',
        items: o.items,
      }));

    return res.json({
      totalEarnings,
      todayEarnings,
      monthEarnings,
      pendingEarnings,
      completedEarnings: totalEarnings,
      transactions,
    });
  }

  // Fallback (in-memory) — vendor-scoped
  const vendorProdIds = new Set(
    dbFallback.products.filter(p => p.vendor_id === vendorId).map(p => p.id)
  );
  const orders = dbFallback.orders.filter(o =>
    Array.isArray(o.items) && o.items.some(i => vendorProdIds.has(i.product_id))
  );
  const completed = orders.filter(o => o.status === 'Delivered');
  const pending   = orders.filter(o => !['Delivered','Cancelled','Returned'].includes(o.status));

  const totalEarnings   = completed.reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);
  const pendingEarnings = pending.reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

  const todayEarnings = completed
    .filter(o => new Date(o.created_at) >= new Date(todayStart))
    .reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

  const monthEarnings = completed
    .filter(o => new Date(o.created_at) >= new Date(monthStart))
    .reduce((s, o) => s + parseFloat(o.net_amount || 0), 0);

  const transactions = orders
    .filter(o => o.status !== 'Cancelled')
    .map(o => {
      const user = dbFallback.users.find(u => u.id === o.user_id);
      return {
        orderId: o.id,
        customerName: user?.name || o.customer_name || 'Customer',
        amount: parseFloat(o.net_amount || 0),
        date: o.created_at,
        status: o.status,
        paymentStatus: o.status === 'Delivered' ? 'Completed' : 'Pending',
        items: o.items || [],
      };
    });

  res.json({
    totalEarnings,
    todayEarnings,
    monthEarnings,
    pendingEarnings,
    completedEarnings: totalEarnings,
    transactions,
  });
});

// ─── VENDOR-SPECIFIC ORDERS ENDPOINT ─────────────────────────────────────────
// Returns all orders that contain at least one product belonging to this vendor.
// Uses LEFT JOIN so NULL product_id rows (fallback products) are handled gracefully.
// Falls back to products.vendor_id via a separate lookup when oi.product_id is set.
app.get('/api/vendor/orders', authenticateToken, async (req, res) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: 'Vendor access required' });
  }

  const vendorId = req.user.id;
  console.log(`[GET /api/vendor/orders] vendor_id=${vendorId}`);

  // Step 1: Get all distinct orders that have an order_item whose product
  //         belongs to this vendor (joined via products table).
  //         We intentionally use products.vendor_id here — not a snapshot column —
  //         so even orders placed before any migration still match correctly.
  //         NOTE: We also include orders where product_id is NULL (fallback products
  //         purchased from the in-memory seed list) so those orders aren't silently
  //         hidden from the vendor view.
  const orderRows = await executeQuery(
    `SELECT DISTINCT
        o.id,
        o.total_amount,
        o.discount_amount,
        o.net_amount,
        o.status,
        o.shipping_address,
        o.created_at,
        u.name AS customer_name
     FROM orders o
     JOIN users  u  ON u.id  = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE p.vendor_id = $1
        OR oi.product_id IS NULL
     ORDER BY o.created_at DESC`,
    [vendorId]
  );

  if (orderRows === null) {
    // DB unavailable — use in-memory fallback
    console.warn('[GET /api/vendor/orders] DB unavailable, using fallback');
    const vendorProdIds = new Set(
      dbFallback.products.filter(p => p.vendor_id === vendorId).map(p => p.id)
    );
    const fallbackOrders = dbFallback.orders.filter(o =>
      Array.isArray(o.items) && o.items.some(i => vendorProdIds.has(i.product_id))
    );
    return res.json(fallbackOrders);
  }

  console.log(`[GET /api/vendor/orders] found ${orderRows.length} orders for vendor`);

  if (orderRows.length === 0) return res.json([]);

  // Step 2: Fetch all items for those orders in one query.
  //         Return items that belong to this vendor OR have NULL product_id
  //         (fallback/seed products not tracked in the products table).
  const orderIds = orderRows.map(o => o.id);
  const itemRows = await executeQuery(
    `SELECT
        oi.order_id,
        oi.product_id,
        oi.quantity,
        oi.price,
        COALESCE(NULLIF(oi.product_name, ''), p.name, 'Product') AS product_name,
        COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '')   AS image_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[])
       AND (p.vendor_id = $2 OR oi.product_id IS NULL)`,
    [orderIds, vendorId]
  );

  // Group items by order_id
  const itemsByOrder = {};
  for (const item of (itemRows || [])) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  }

  const result = orderRows.map(order => ({
    ...order,
    items: itemsByOrder[order.id] || [],
  }));

  return res.json(result);
});

// Update order status (Vendor flow)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  let dbResult = await executeQuery('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (dbResult) {
    if (dbResult.length === 0) return res.status(404).json({ message: "Order not found" });
    return res.json(dbResult[0]);
  }

  // Fallback
  const order = dbFallback.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.status = status;
  res.json(order);
});

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// Admin: Dashboard stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  const dbUsers      = await executeQuery('SELECT COUNT(*) as count FROM users WHERE role=\'customer\'');
  const dbVendors    = await executeQuery('SELECT COUNT(*) as count FROM users WHERE role=\'vendor\'');
  const dbProducts   = await executeQuery('SELECT COUNT(*) as count FROM products');
  const dbOrders     = await executeQuery('SELECT COUNT(*) as count FROM orders');
  const dbRevenue    = await executeQuery('SELECT COALESCE(SUM(amount_paid),0) as total FROM payments WHERE payment_status=\'Success\'');
  const dbNxl        = await executeQuery('SELECT COALESCE(SUM(balance),0) as total FROM nxl_wallet');

  if (dbUsers) {
    return res.json({
      totalCustomers: parseInt(dbUsers[0]?.count || 0),
      totalVendors:   parseInt(dbVendors[0]?.count || 0),
      totalProducts:  parseInt(dbProducts[0]?.count || 0),
      totalOrders:    parseInt(dbOrders[0]?.count || 0),
      totalRevenue:   parseFloat(dbRevenue[0]?.total || 0),
      totalNxl:       parseFloat(dbNxl[0]?.total || 0),
    });
  }
  // Fallback stats from memory
  const customers = dbFallback.users.filter(u => u.role === 'customer').length;
  const vendors   = dbFallback.users.filter(u => u.role === 'vendor').length;
  const revenue   = dbFallback.orders.reduce((s, o) => s + (parseFloat(o.net_amount) || 0), 0);
  res.json({
    totalCustomers: customers,
    totalVendors:   vendors,
    totalProducts:  dbFallback.products.length,
    totalOrders:    dbFallback.orders.length,
    totalRevenue:   revenue,
    totalNxl:       0,
  });
});

// Admin: All users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT id, name, email, role, is_blocked, created_at FROM users ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_blocked: u.is_blocked || false, created_at: u.created_at || new Date() })));
});

// Admin: Block/Unblock user
app.put('/api/admin/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
  const { is_blocked } = req.body;
  const dbResult = await executeQuery('UPDATE users SET is_blocked=$1 WHERE id=$2 RETURNING id, name, email, role, is_blocked', [is_blocked, req.params.id]);
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  const u = dbFallback.users.find(u => u.id === req.params.id);
  if (u) u.is_blocked = is_blocked;
  res.json({ message: is_blocked ? 'User blocked' : 'User unblocked' });
});

// Admin: Delete user
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM users WHERE id=$1', [req.params.id]);
  const idx = dbFallback.users.findIndex(u => u.id === req.params.id);
  if (idx !== -1) dbFallback.users.splice(idx, 1);
  res.json({ message: 'User deleted' });
});

// Admin: All products
app.get('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM products ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.products);
});

// Admin: Delete any product
app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM products WHERE id=$1', [req.params.id]);
  const idx = dbFallback.products.findIndex(p => p.id === req.params.id);
  if (idx !== -1) dbFallback.products.splice(idx, 1);
  res.json({ message: 'Product deleted' });
});

// Admin: All orders with customer info
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery(
    `SELECT o.*, u.name as customer_name, u.email as customer_email
     FROM orders o LEFT JOIN users u ON o.user_id=u.id
     ORDER BY o.created_at DESC`
  );
  if (dbResult) {
    // Single bulk query — fetch all items for all orders at once (no N+1 queries).
    // Priority: snapshot (product_name saved at purchase time) → live products JOIN.
    const orderIds = dbResult.map(o => o.id);
    const allItems = orderIds.length > 0
      ? await executeQuery(
          `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price,
                  COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS name,
                  COALESCE(NULLIF(oi.product_name, ''), p.name, '') AS product_name,
                  COALESCE(NULLIF(oi.image_url, ''),    p.image_url, '') AS image_url
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ANY($1::uuid[])`,
          [orderIds]
        )
      : [];
    // Group items by order_id
    const itemsByOrder = {};
    for (const item of (allItems || [])) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }
    const enriched = dbResult.map(order => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));
    return res.json(enriched);
  }
  res.json(dbFallback.orders.map(o => {
    const u = dbFallback.users.find(u => u.id === o.user_id);
    return { ...o, customer_name: u?.name || 'Unknown', customer_email: u?.email || '' };
  }));
});

// Admin: All payments
app.get('/api/admin/payments', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM payments ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json([]);
});

// Admin: All wallets
app.get('/api/admin/wallets', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery(
    `SELECT w.id, w.balance, u.name, u.email
     FROM nxl_wallet w JOIN users u ON w.user_id=u.id
     ORDER BY w.balance DESC`
  );
  if (dbResult) return res.json(dbResult);
  const wallets = Object.entries(dbFallback.wallets).map(([uid, w]) => {
    const u = dbFallback.users.find(u => u.id === uid);
    return { id: uid, balance: w.balance, name: u?.name || 'Unknown', email: u?.email || '' };
  });
  res.json(wallets);
});

// Admin: Wallet transactions
app.get('/api/admin/wallet-transactions', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery(
    `SELECT t.*, u.name as user_name, u.email as user_email
     FROM nxl_transactions t
     JOIN nxl_wallet w ON t.wallet_id=w.id
     JOIN users u ON w.user_id=u.id
     ORDER BY t.created_at DESC LIMIT 100`
  );
  if (dbResult) return res.json(dbResult);
  res.json([]);
});

// Seeding fallback collections if not present
if (!dbFallback.banners) {
  dbFallback.banners = [
    { id: 'b1', title: 'Mega Festival Sale', description: 'Up To 70% OFF on premium sneakers!', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', link_type: 'Shoes', status: 'active' },
    { id: 'b2', title: 'Summer Electronics Bonanza', description: 'Flat 20% OFF on ANC Headphones!', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', link_type: 'Electronics', status: 'active' },
    { id: 'b3', title: 'Weekend Flash Sale', description: 'Double reward credits on checkout!', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', link_type: 'General', status: 'active' }
  ];
}
if (!dbFallback.offers) {
  dbFallback.offers = [
    { id: 'o1', title: 'Buy 2 Get 1 Free', description: 'Add any 3 items to cart to trigger free discount.', discount: 'B2G1', image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600', category: 'Fashion', status: 'active' },
    { id: 'o2', title: 'Free Shipping Offer', description: 'Get free standard shipping on orders above ₹499.', discount: 'Free Ship', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800', category: 'Shipping', status: 'active' },
    { id: 'o3', title: 'SBI Card Instant Offer', description: 'Get flat 10% instant discount on checkout.', discount: '10% OFF', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', category: 'Bank', status: 'active' },
    { id: 'o4', title: 'Double Rewards Credit', description: 'Earn 210 NXL credits per ₹100 spent today!', discount: '2X Reward', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', category: 'Wallet Bonus', status: 'active' }
  ];
}
if (!dbFallback.coupon_usage) dbFallback.coupon_usage = [];

// Seed database tables on startup if they are empty
async function seedBannersAndOffers() {
  if (dbConnected && pool) {
    try {
      const bRes = await pool.query('SELECT COUNT(*) FROM offer_banners');
      if (parseInt(bRes.rows[0].count) === 0) {
        for (const b of dbFallback.banners) {
          await pool.query('INSERT INTO offer_banners (id, title, description, image_url, link_type, status) VALUES ($1,$2,$3,$4,$5,$6)',
            [b.id, b.title, b.description, b.image_url, b.link_type, b.status]);
        }
      }
      const oRes = await pool.query('SELECT COUNT(*) FROM offers');
      if (parseInt(oRes.rows[0].count) === 0) {
        for (const o of dbFallback.offers) {
          await pool.query('INSERT INTO offers (id, title, description, discount, image_url, category, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [o.id, o.title, o.description, o.discount, o.image_url, o.category, o.status]);
        }
      }
      const cRes = await pool.query('SELECT COUNT(*) FROM coupons');
      if (parseInt(cRes.rows[0].count) === 0) {
        await pool.query(`INSERT INTO coupons (code, discount_percentage, max_discount, active_until, discount_type, discount_value, min_order_amount, status, category, usage_limit, customer_eligibility, description) VALUES 
          ('NEXORA100', 0, 100, NOW() + INTERVAL '30 days', 'flat', 100, 999, 'active', 'General', 100, 'All', 'Flat ₹100 OFF on orders above ₹999'),
          ('SAVE20', 20, 300, NOW() + INTERVAL '30 days', 'percentage', 0, 0, 'active', 'Festival', 100, 'All', '20% OFF up to ₹300'),
          ('FREESHIP', 0, 99, NOW() + INTERVAL '30 days', 'flat', 99, 0, 'active', 'Shipping', 500, 'All', 'Free standard shipping on all orders'),
          ('WELCOME50', 0, 50, NOW() + INTERVAL '30 days', 'flat', 50, 0, 'active', 'General', 100, 'All', 'Flat ₹50 OFF for new users'),
          ('FLASH10', 10, 200, NOW() + INTERVAL '30 days', 'percentage', 0, 0, 'active', 'Flash Sale', 100, 'All', '10% OFF up to ₹200 on flash sale items')`);
      }
    } catch (e) {
      console.warn("DB Seeding note: ", e.message);
    }
  }
}
setTimeout(seedBannersAndOffers, 1000);

// ── CUSTOMER ROUTES ──────────────────────────────────────────────────────────

// Customer: Get Banners
app.get('/api/banners', authenticateToken, async (req, res) => {
  const dbResult = await executeQuery("SELECT * FROM offer_banners WHERE status='active' ORDER BY created_at DESC");
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.banners.filter(b => b.status === 'active'));
});

// Customer: Get Offers
app.get('/api/offers', authenticateToken, async (req, res) => {
  const dbResult = await executeQuery("SELECT * FROM offers WHERE status='active' ORDER BY created_at DESC");
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.offers.filter(o => o.status === 'active'));
});

// Customer: Get coupons
app.get('/api/coupons', authenticateToken, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM coupons ORDER BY priority DESC, created_at DESC');
  if (dbResult) return res.json(dbResult);
  if (!dbFallback.coupons) dbFallback.coupons = [];
  res.json(dbFallback.coupons);
});

// Customer: Get coupon history (coupons used by current customer)
app.get('/api/coupons/history', authenticateToken, async (req, res) => {
  if (req.user.hasRealUUID) {
    const dbResult = await executeQuery('SELECT * FROM coupon_usage WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    if (dbResult) return res.json(dbResult);
  }
  res.json(dbFallback.coupon_usage.filter(cu => cu.user_id === req.user.id));
});

// Customer: Validate Coupon
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code || subtotal === undefined) return res.status(400).json({ success: false, message: 'Code and subtotal required' });

  // Fetch coupon details
  let coupon;
  const dbResult = await executeQuery('SELECT * FROM coupons WHERE UPPER(code) = $1', [code.toUpperCase()]);
  if (dbResult && dbResult[0]) {
    coupon = dbResult[0];
  } else {
    coupon = dbFallback.coupons.find(c => c.code.toUpperCase() == code.toUpperCase());
  }

  if (!coupon) return res.json({ success: false, message: 'Invalid coupon code' });

  // Expiry check
  if (coupon.active_until && new Date(coupon.active_until) < new Date()) {
    return res.json({ success: false, message: 'This coupon has expired' });
  }

  // Status check
  if (coupon.status === 'disabled') {
    return res.json({ success: false, message: 'This coupon is disabled' });
  }

  // Min order amount check
  const minOrder = parseFloat(coupon.min_order_amount || 0);
  if (subtotal < minOrder) {
    return res.json({ success: false, message: `Minimum order amount to apply this coupon is ₹${minOrder.toFixed(0)}` });
  }

  // Usage Limit Check
  const usageLimit = parseInt(coupon.usage_limit || 0);
  if (usageLimit > 0) {
    let usedCount = 0;
    const countRes = await executeQuery('SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1', [coupon.id]);
    if (countRes) {
      usedCount = parseInt(countRes[0].count);
    } else {
      usedCount = dbFallback.coupon_usage.filter(cu => cu.coupon_id === coupon.id).length;
    }
    if (usedCount >= usageLimit) {
      return res.json({ success: false, message: 'Coupon usage limit reached' });
    }
  }

  // Per User Limit Check
  const perUserLimit = parseInt(coupon.per_user_limit || 1);
  if (perUserLimit > 0 && req.user.hasRealUUID) {
    let userUsedCount = 0;
    const userCountRes = await executeQuery('SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2', [coupon.id, req.user.id]);
    if (userCountRes) {
      userUsedCount = parseInt(userCountRes[0].count);
    } else {
      userUsedCount = dbFallback.coupon_usage.filter(cu => cu.coupon_id === coupon.id && cu.user_id === req.user.id).length;
    }
    if (userUsedCount >= perUserLimit) {
      return res.json({ success: false, message: 'You have already reached the limit for this coupon' });
    }
  } else if (perUserLimit > 0) {
    const userUsedCount = dbFallback.coupon_usage.filter(cu => cu.coupon_id === coupon.id && cu.user_id === req.user.id).length;
    if (userUsedCount >= perUserLimit) {
      return res.json({ success: false, message: 'You have already reached the limit for this coupon' });
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discount_type === 'flat') {
    discountAmount = parseFloat(coupon.discount_value || 0);
  } else {
    const pct = parseFloat(coupon.discount_percentage || 0);
    discountAmount = (subtotal * pct) / 100.0;
    const maxD = parseFloat(coupon.max_discount || 0);
    if (maxD > 0 && discountAmount > maxD) {
      discountAmount = maxD;
    }
  }

  // Cap discount at subtotal
  if (discountAmount > subtotal) discountAmount = subtotal;

  res.json({
    success: true,
    message: `Coupon applied successfully! You saved ₹${discountAmount.toFixed(0)}`,
    coupon,
    discountAmount
  });
});

// Customer: Log Coupon Usage
app.post('/api/coupons/use', authenticateToken, async (req, res) => {
  const { coupon_id, order_id, discount_saved } = req.body;
  if (!coupon_id || !order_id) return res.status(400).json({ message: 'coupon_id and order_id are required' });

  if (req.user.hasRealUUID) {
    const dbResult = await executeQuery(
      'INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_saved) VALUES ($1,$2,$3,$4) RETURNING *',
      [coupon_id, req.user.id, order_id, discount_saved || 0]
    );
    if (dbResult) return res.json(dbResult[0]);
  }

  const newUsage = { id: `usage-${Date.now()}`, coupon_id, user_id: req.user.id, order_id, discount_saved: parseFloat(discount_saved || 0), created_at: new Date() };
  dbFallback.coupon_usage.push(newUsage);
  res.json(newUsage);
});


// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// Admin: Get Coupon Analytics
app.get('/api/admin/coupons/analytics', authenticateToken, requireAdmin, async (req, res) => {
  const cAll = await executeQuery('SELECT COUNT(*) as count FROM coupons');
  const cAct = await executeQuery("SELECT COUNT(*) as count FROM coupons WHERE status='active' AND active_until > NOW()");
  const cExp = await executeQuery("SELECT COUNT(*) as count FROM coupons WHERE status='disabled' OR active_until <= NOW()");
  const cUsd = await executeQuery('SELECT COUNT(*) as count, COALESCE(SUM(discount_saved),0) as sum FROM coupon_usage');
  const cList = await executeQuery(
    `SELECT c.code, COUNT(u.id) as count, COALESCE(SUM(u.discount_saved),0) as saved 
     FROM coupons c LEFT JOIN coupon_usage u ON c.id::varchar = u.coupon_id OR c.code = u.coupon_id
     GROUP BY c.code ORDER BY count DESC LIMIT 10`
  );

  if (cAll && cUsd) {
    return res.json({
      total: parseInt(cAll[0]?.count || 0),
      active: parseInt(cAct[0]?.count || 0),
      expired: parseInt(cExp[0]?.count || 0),
      usedCount: parseInt(cUsd[0]?.count || 0),
      totalDiscountGiven: parseFloat(cUsd[0]?.sum || 0),
      mostUsed: cList || []
    });
  }

  // Fallback calculations
  const total = dbFallback.coupons.length;
  const active = dbFallback.coupons.filter(c => c.status === 'active' && new Date(c.active_until) > new Date()).length;
  const expired = total - active;
  const usedCount = dbFallback.coupon_usage.length;
  const totalDiscountGiven = dbFallback.coupon_usage.reduce((sum, u) => sum + (u.discount_saved || 0), 0);

  // Group by code in fallback
  const counts = {};
  for (const cu of dbFallback.coupon_usage) {
    const cp = dbFallback.coupons.find(c => c.id === cu.coupon_id || c.code === cu.coupon_id);
    const codeName = cp ? cp.code : cu.coupon_id;
    if (!counts[codeName]) counts[codeName] = { code: codeName, count: 0, saved: 0 };
    counts[codeName].count++;
    counts[codeName].saved += cu.discount_saved;
  }
  const mostUsed = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);

  res.json({ total, active, expired, usedCount, totalDiscountGiven, mostUsed });
});

// Admin: Banners CRUD
app.get('/api/admin/banners', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM offer_banners ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.banners);
});

app.post('/api/admin/banners', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, image_url, link_type, status } = req.body;
  if (!title || !image_url) return res.status(400).json({ message: 'Title and image_url are required' });

  const dbResult = await executeQuery(
    'INSERT INTO offer_banners (title, description, image_url, link_type, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [title, description || '', image_url, link_type || 'General', status || 'active']
  );
  if (dbResult) return res.status(201).json(dbResult[0]);

  const nb = { id: `banner-${Date.now()}`, title, description: description || '', image_url, link_type: link_type || 'General', status: status || 'active', created_at: new Date() };
  dbFallback.banners.push(nb);
  res.status(201).json(nb);
});

app.put('/api/admin/banners/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, image_url, link_type, status } = req.body;
  const dbResult = await executeQuery(
    'UPDATE offer_banners SET title=$1, description=$2, image_url=$3, link_type=$4, status=$5 WHERE id=$6 RETURNING *',
    [title, description || '', image_url, link_type || 'General', status || 'active', req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);

  const idx = dbFallback.banners.findIndex(b => b.id === req.params.id);
  if (idx !== -1) {
    dbFallback.banners[idx] = { ...dbFallback.banners[idx], title, description: description || '', image_url, link_type: link_type || 'General', status: status || 'active' };
  }
  res.json(dbFallback.banners[idx] || {});
});

app.delete('/api/admin/banners/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM offer_banners WHERE id=$1', [req.params.id]);
  dbFallback.banners = dbFallback.banners.filter(b => b.id !== req.params.id);
  res.json({ message: 'Banner deleted' });
});

// Admin: Offers CRUD
app.get('/api/admin/offers', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM offers ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.offers);
});

app.post('/api/admin/offers', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, discount, image_url, category, status } = req.body;
  if (!title || !image_url) return res.status(400).json({ message: 'Title and image_url are required' });

  const dbResult = await executeQuery(
    'INSERT INTO offers (title, description, discount, image_url, category, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [title, description || '', discount || '', image_url, category || 'General', status || 'active']
  );
  if (dbResult) return res.status(201).json(dbResult[0]);

  const no = { id: `offer-${Date.now()}`, title, description: description || '', discount: discount || '', image_url, category: category || 'General', status: status || 'active', created_at: new Date() };
  dbFallback.offers.push(no);
  res.status(201).json(no);
});

app.put('/api/admin/offers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, discount, image_url, category, status } = req.body;
  const dbResult = await executeQuery(
    'UPDATE offers SET title=$1, description=$2, discount=$3, image_url=$4, category=$5, status=$6 WHERE id=$7 RETURNING *',
    [title, description || '', discount || '', image_url, category || 'General', status || 'active', req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);

  const idx = dbFallback.offers.findIndex(o => o.id === req.params.id);
  if (idx !== -1) {
    dbFallback.offers[idx] = { ...dbFallback.offers[idx], title, description: description || '', discount: discount || '', image_url, category: category || 'General', status: status || 'active' };
  }
  res.json(dbFallback.offers[idx] || {});
});

app.delete('/api/admin/offers/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM offers WHERE id=$1', [req.params.id]);
  dbFallback.offers = dbFallback.offers.filter(o => o.id !== req.params.id);
  res.json({ message: 'Offer deleted' });
});

// Admin: Coupons CRUD
app.get('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM coupons ORDER BY priority DESC, active_until DESC');
  if (dbResult) return res.json(dbResult);
  if (!dbFallback.coupons) dbFallback.coupons = [];
  res.json(dbFallback.coupons);
});

app.post('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
  const { code, discount_percentage, max_discount, active_until, discount_type, discount_value, min_order_amount, status, category, usage_limit, customer_eligibility, start_date, per_user_limit, applicable_categories, applicable_products, applicable_vendors, applicable_users, priority, banner_image, description } = req.body;
  if (!code || !active_until) return res.status(400).json({ message: 'Code and active_until are required' });
  
  const dp = discount_percentage || 0;
  const md = max_discount || 0;
  const dt = discount_type || 'percentage';
  const dv = discount_value || 0;
  const mo = min_order_amount || 0;
  const st = status || 'active';
  const cat = category || 'General';
  const ul = usage_limit || 0;
  const ce = customer_eligibility || 'All';
  const sd = start_date || new Date().toISOString();
  const pul = per_user_limit || 1;
  const ac = applicable_categories || '';
  const ap = applicable_products || '';
  const av = applicable_vendors || '';
  const au = applicable_users || '';
  const pri = priority || 0;
  const bi = banner_image || '';
  const dsc = description || '';

  const dbResult = await executeQuery(
    `INSERT INTO coupons (code, discount_percentage, max_discount, active_until, discount_type, discount_value, min_order_amount, status, category, usage_limit, customer_eligibility, start_date, per_user_limit, applicable_categories, applicable_products, applicable_vendors, applicable_users, priority, banner_image, description) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [code.toUpperCase(), dp, md, active_until, dt, dv, mo, st, cat, ul, ce, sd, pul, ac, ap, av, au, pri, bi, dsc]
  );
  if (dbResult) return res.status(201).json(dbResult[0]);
  if (!dbFallback.coupons) dbFallback.coupons = [];
  const nc = { id: `coup-${Date.now()}`, code: code.toUpperCase(), discount_percentage: dp, max_discount: md, active_until, discount_type: dt, discount_value: dv, min_order_amount: mo, status: st, category: cat, usage_limit: ul, customer_eligibility: ce, start_date: sd, per_user_limit: pul, applicable_categories: ac, applicable_products: ap, applicable_vendors: av, applicable_users: au, priority: pri, banner_image: bi, description: dsc, created_at: new Date() };
  dbFallback.coupons.push(nc);
  res.status(201).json(nc);
});

app.put('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { code, discount_percentage, max_discount, active_until, discount_type, discount_value, min_order_amount, status, category, usage_limit, customer_eligibility, start_date, per_user_limit, applicable_categories, applicable_products, applicable_vendors, applicable_users, priority, banner_image, description } = req.body;
  
  const dp = discount_percentage || 0;
  const md = max_discount || 0;
  const dt = discount_type || 'percentage';
  const dv = discount_value || 0;
  const mo = min_order_amount || 0;
  const st = status || 'active';
  const cat = category || 'General';
  const ul = usage_limit || 0;
  const ce = customer_eligibility || 'All';
  const sd = start_date || new Date().toISOString();
  const pul = per_user_limit || 1;
  const ac = applicable_categories || '';
  const ap = applicable_products || '';
  const av = applicable_vendors || '';
  const au = applicable_users || '';
  const pri = priority || 0;
  const bi = banner_image || '';
  const dsc = description || '';

  const dbResult = await executeQuery(
    `UPDATE coupons SET code=$1,discount_percentage=$2,max_discount=$3,active_until=$4,discount_type=$5,discount_value=$6,min_order_amount=$7,status=$8,category=$9,usage_limit=$10,customer_eligibility=$11,start_date=$12,per_user_limit=$13,applicable_categories=$14,applicable_products=$15,applicable_vendors=$16,applicable_users=$17,priority=$18,banner_image=$19,description=$20 
     WHERE id=$21 RETURNING *`,
    [code.toUpperCase(), dp, md, active_until, dt, dv, mo, st, cat, ul, ce, sd, pul, ac, ap, av, au, pri, bi, dsc, req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  if (!dbFallback.coupons) dbFallback.coupons = [];
  const idx = dbFallback.coupons.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    dbFallback.coupons[idx] = { ...dbFallback.coupons[idx], code: code.toUpperCase(), discount_percentage: dp, max_discount: md, active_until, discount_type: dt, discount_value: dv, min_order_amount: mo, status: st, category: cat, usage_limit: ul, customer_eligibility: ce, start_date: sd, per_user_limit: pul, applicable_categories: ac, applicable_products: ap, applicable_vendors: av, applicable_users: au, priority: pri, banner_image: bi, description: dsc };
  }
  res.json(dbFallback.coupons[idx] || {});
});

app.delete('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM coupons WHERE id=$1', [req.params.id]);
  if (dbFallback.coupons) dbFallback.coupons = dbFallback.coupons.filter(c => c.id !== req.params.id);
  res.json({ message: 'Coupon deleted' });
});

// Auto-create notifications table on startup if DB is connected
// (called inside initPool after connection confirmed — see bottom of file)

if (!dbFallback.notifications) dbFallback.notifications = [];

// Admin: Add User
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, mobile, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "Name, email, password, and role are required" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  let dbResult = await executeQuery(
    'INSERT INTO users (name, email, phone, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, is_blocked, created_at',
    [name, email, mobile || '', hashedPassword, role]
  );
  if (dbResult && dbResult[0]) {
    const user = dbResult[0];
    if (role === 'vendor') {
      await executeQuery('INSERT INTO vendors (user_id, store_name) VALUES ($1, $2)', [user.id, name + ' Store']);
    }
    // Setup NXL wallet
    const walletRes = await executeQuery('INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 0) RETURNING id', [user.id]);
    if (walletRes && walletRes[0]) {
      await executeQuery('INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1, 50, \'ADDED\', \'Welcome bonus NXL credits\')', [walletRes[0].id]);
      await executeQuery('UPDATE nxl_wallet SET balance = 50 WHERE id = $1', [walletRes[0].id]);
    }
    return res.status(201).json(user);
  }
  
  // Fallback
  const existing = dbFallback.users.find(u => u.email === email);
  if (existing) return res.status(400).json({ message: "Email already registered" });
  const newUser = { id: `user-${Date.now()}`, name, email, password: hashedPassword, role, phone: mobile, is_blocked: false, created_at: new Date() };
  dbFallback.users.push(newUser);
  res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, is_blocked: false, created_at: newUser.created_at });
});

// Admin: Add Vendor
app.post('/api/admin/vendors', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, mobile, shop_name, address, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  let dbResult = await executeQuery(
    'INSERT INTO users (name, email, phone, password, role) VALUES ($1, $2, $3, $4, \'vendor\') RETURNING id, name, email, role, is_blocked, created_at',
    [name, email, mobile || '', hashedPassword]
  );
  if (dbResult && dbResult[0]) {
    const user = dbResult[0];
    await executeQuery('INSERT INTO vendors (user_id, store_name, address) VALUES ($1, $2, $3)', [user.id, shop_name || (name + ' Store'), address || '']);
    // Setup NXL wallet
    const walletRes = await executeQuery('INSERT INTO nxl_wallet (user_id, balance) VALUES ($1, 0) RETURNING id', [user.id]);
    if (walletRes && walletRes[0]) {
      await executeQuery('UPDATE nxl_wallet SET balance = 50 WHERE id = $1', [walletRes[0].id]);
    }
    return res.status(201).json(user);
  }
  
  // Fallback
  const existing = dbFallback.users.find(u => u.email === email);
  if (existing) return res.status(400).json({ message: "Email already registered" });
  const newUser = { id: `vendor-${Date.now()}`, name, email, password: hashedPassword, role: 'vendor', phone: mobile, shop_name, address, is_blocked: false, created_at: new Date() };
  dbFallback.users.push(newUser);
  res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, is_blocked: false, created_at: newUser.created_at });
});

// Admin: Add Product
app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, price, stock, category, image_url, vendor_id } = req.body;
  if (!name || !price || !vendor_id) {
    return res.status(400).json({ message: "Name, price, and vendor_id are required" });
  }
  let dbResult = await executeQuery(
    'INSERT INTO products (vendor_id, name, description, price, stock, image_url, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [vendor_id, name, description || '', price, stock || 0, image_url || '', category || '']
  );
  if (dbResult) return res.status(201).json(dbResult[0]);
  
  // Fallback
  const newProduct = {
    id: `prod-${Date.now()}`,
    vendor_id,
    name,
    description,
    price: parseFloat(price),
    stock: parseInt(stock || 0),
    category,
    image_url: image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
  };
  dbFallback.products.push(newProduct);
  res.status(201).json(newProduct);
});

// Admin: Get Notifications
app.get('/api/admin/notifications', authenticateToken, requireAdmin, async (req, res) => {
  let dbResult = await executeQuery('SELECT * FROM notifications ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.notifications);
});

// Admin: Send Notification
app.post('/api/admin/notifications', authenticateToken, requireAdmin, async (req, res) => {
  const { title, message, target } = req.body;
  if (!title || !message) return res.status(400).json({ message: "Title and message are required" });
  let dbResult = await executeQuery(
    'INSERT INTO notifications (title, message, target) VALUES ($1, $2, $3) RETURNING *',
    [title, message, target || 'All Users']
  );
  if (dbResult) return res.status(201).json(dbResult[0]);
  
  const newNotif = {
    id: `notif-${Date.now()}`,
    title,
    message,
    target: target || 'All Users',
    created_at: new Date()
  };
  dbFallback.notifications.unshift(newNotif);
  res.status(201).json(newNotif);
});

// ─── ADMIN: UPDATE USER ───────────────────────────────────────────────────────
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, mobile, role, is_blocked } = req.body;
  if (!name || !email || !role) return res.status(400).json({ message: 'Name, email, and role are required' });
  const dbResult = await executeQuery(
    'UPDATE users SET name=$1, email=$2, phone=$3, role=$4, is_blocked=$5 WHERE id=$6 RETURNING id, name, email, role, is_blocked, created_at',
    [name, email, mobile || '', role, is_blocked !== undefined ? is_blocked : false, req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  const u = dbFallback.users.find(u => u.id === req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  u.name = name; u.email = email; u.phone = mobile || ''; u.role = role; u.is_blocked = is_blocked || false;
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, is_blocked: u.is_blocked, created_at: u.created_at });
});

// ─── ADMIN: PROMOTIONS CRUD ───────────────────────────────────────────────────
// (promotions fallback init is here, table creation handled in initPool at bottom)
if (!dbFallback.promotions) dbFallback.promotions = [];

app.get('/api/admin/promotions', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM promotions ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.promotions);
});

app.post('/api/admin/promotions', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, discount, start_date, end_date, status } = req.body;
  if (!title || !start_date || !end_date) return res.status(400).json({ message: 'Title, start_date, end_date required' });
  const dbResult = await executeQuery(
    'INSERT INTO promotions (title, description, discount, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [title, description||'', discount||0, start_date, end_date, status||'active']
  );
  if (dbResult) return res.status(201).json(dbResult[0]);
  const np = { id: `promo-${Date.now()}`, title, description: description||'', discount: discount||0, start_date, end_date, status: status||'active', created_at: new Date() };
  dbFallback.promotions.push(np);
  res.status(201).json(np);
});

app.put('/api/admin/promotions/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, discount, start_date, end_date, status } = req.body;
  const dbResult = await executeQuery(
    'UPDATE promotions SET title=$1,description=$2,discount=$3,start_date=$4,end_date=$5,status=$6 WHERE id=$7 RETURNING *',
    [title, description||'', discount||0, start_date, end_date, status||'active', req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  const idx = dbFallback.promotions.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Promotion not found' });
  dbFallback.promotions[idx] = { ...dbFallback.promotions[idx], title, description: description||'', discount: discount||0, start_date, end_date, status: status||'active' };
  res.json(dbFallback.promotions[idx]);
});

app.delete('/api/admin/promotions/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM promotions WHERE id=$1', [req.params.id]);
  dbFallback.promotions = dbFallback.promotions.filter(p => p.id !== req.params.id);
  res.json({ message: 'Promotion deleted' });
});

// (reward_rules table creation handled in initPool at bottom)
if (!dbFallback.rewardRules) dbFallback.rewardRules = [
  { id: 'rule-1', spend_amount: 100, earn_credits: 5, description: '₹100 spent = 5 NXL Credits', is_active: true, created_at: new Date() }
];

app.get('/api/admin/reward-rules', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery('SELECT * FROM reward_rules ORDER BY created_at DESC');
  if (dbResult) return res.json(dbResult);
  res.json(dbFallback.rewardRules);
});

app.post('/api/admin/reward-rules', authenticateToken, requireAdmin, async (req, res) => {
  const { spend_amount, earn_credits, description, is_active } = req.body;
  if (!spend_amount || !earn_credits) return res.status(400).json({ message: 'spend_amount and earn_credits required' });
  const dbResult = await executeQuery(
    'INSERT INTO reward_rules (spend_amount, earn_credits, description, is_active) VALUES ($1,$2,$3,$4) RETURNING *',
    [spend_amount, earn_credits, description||`₹${spend_amount} spent = ${earn_credits} NXL Credits`, is_active !== false]
  );
  if (dbResult) return res.status(201).json(dbResult[0]);
  const nr = { id: `rule-${Date.now()}`, spend_amount, earn_credits, description: description||`₹${spend_amount} spent = ${earn_credits} NXL Credits`, is_active: is_active !== false, created_at: new Date() };
  dbFallback.rewardRules.push(nr);
  res.status(201).json(nr);
});

app.put('/api/admin/reward-rules/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { spend_amount, earn_credits, description, is_active } = req.body;
  const dbResult = await executeQuery(
    'UPDATE reward_rules SET spend_amount=$1,earn_credits=$2,description=$3,is_active=$4 WHERE id=$5 RETURNING *',
    [spend_amount, earn_credits, description, is_active, req.params.id]
  );
  if (dbResult && dbResult[0]) return res.json(dbResult[0]);
  const idx = dbFallback.rewardRules.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Rule not found' });
  dbFallback.rewardRules[idx] = { ...dbFallback.rewardRules[idx], spend_amount, earn_credits, description, is_active };
  res.json(dbFallback.rewardRules[idx]);
});

app.delete('/api/admin/reward-rules/:id', authenticateToken, requireAdmin, async (req, res) => {
  await executeQuery('DELETE FROM reward_rules WHERE id=$1', [req.params.id]);
  dbFallback.rewardRules = dbFallback.rewardRules.filter(r => r.id !== req.params.id);
  res.json({ message: 'Rule deleted' });
});

// ─── ADMIN: WALLET TOPUP ─────────────────────────────────────────────────────
app.get('/api/admin/wallet-topups', authenticateToken, requireAdmin, async (req, res) => {
  const dbResult = await executeQuery(
    `SELECT t.id, t.amount, t.description, t.created_at, u.name as user_name, u.email as user_email
     FROM nxl_transactions t
     JOIN nxl_wallet w ON t.wallet_id=w.id
     JOIN users u ON w.user_id=u.id
     WHERE t.transaction_type='ADDED' AND t.description LIKE 'Admin topup%'
     ORDER BY t.created_at DESC`
  );
  if (dbResult) return res.json(dbResult);
  if (!dbFallback.topups) dbFallback.topups = [];
  res.json(dbFallback.topups);
});

app.post('/api/admin/wallet-topup', authenticateToken, requireAdmin, async (req, res) => {
  const { user_id, amount, description } = req.body;
  if (!user_id || !amount || parseFloat(amount) <= 0) return res.status(400).json({ message: 'user_id and valid amount required' });
  const desc = description || `Admin topup of ${amount} NXL credits`;
  const walletRes = await executeQuery('UPDATE nxl_wallet SET balance = balance + $1 WHERE user_id = $2 RETURNING id, balance', [amount, user_id]);
  if (walletRes && walletRes[0]) {
    await executeQuery('INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1,$2,\'ADDED\',$3)', [walletRes[0].id, amount, desc]);
    return res.json({ success: true, new_balance: walletRes[0].balance });
  }
  // Fallback
  if (!dbFallback.wallets[user_id]) dbFallback.wallets[user_id] = { balance: 0, transactions: [] };
  dbFallback.wallets[user_id].balance += parseFloat(amount);
  const tx = { id: `tx-${Date.now()}`, amount: parseFloat(amount), transaction_type: 'ADDED', description: desc, created_at: new Date() };
  dbFallback.wallets[user_id].transactions.unshift(tx);
  if (!dbFallback.topups) dbFallback.topups = [];
  const u = dbFallback.users.find(u => u.id === user_id);
  dbFallback.topups.unshift({ id: tx.id, amount: parseFloat(amount), description: desc, created_at: tx.created_at, user_name: u?.name||'Unknown', user_email: u?.email||'' });
  res.json({ success: true, new_balance: dbFallback.wallets[user_id].balance });
});

// ─── ADMIN: CREDIT MANAGEMENT ─────────────────────────────────────────────────
app.get('/api/admin/user-wallet/:user_id', authenticateToken, requireAdmin, async (req, res) => {
  const walletRes = await executeQuery('SELECT w.id, w.balance, u.name, u.email FROM nxl_wallet w JOIN users u ON w.user_id=u.id WHERE w.user_id=$1', [req.params.user_id]);
  const txRes = await executeQuery(
    `SELECT t.* FROM nxl_transactions t JOIN nxl_wallet w ON t.wallet_id=w.id WHERE w.user_id=$1 ORDER BY t.created_at DESC LIMIT 50`,
    [req.params.user_id]
  );
  if (walletRes && walletRes[0]) return res.json({ wallet: walletRes[0], transactions: txRes || [] });
  const w = dbFallback.wallets[req.params.user_id] || { balance: 0, transactions: [] };
  const u = dbFallback.users.find(u => u.id === req.params.user_id);
  res.json({ wallet: { balance: w.balance, name: u?.name||'Unknown', email: u?.email||'' }, transactions: w.transactions || [] });
});

app.post('/api/admin/adjust-credits', authenticateToken, requireAdmin, async (req, res) => {
  const { user_id, amount, type, reason } = req.body; // type: 'INCREASE' | 'DECREASE'
  if (!user_id || !amount || !type) return res.status(400).json({ message: 'user_id, amount, type required' });
  const delta = type === 'DECREASE' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
  const txType = type === 'DECREASE' ? 'REDEEMED' : 'ADDED';
  const desc = reason || (type === 'DECREASE' ? `Admin deducted ${Math.abs(delta)} NXL credits` : `Admin added ${delta} NXL credits`);
  const walletRes = await executeQuery('UPDATE nxl_wallet SET balance = GREATEST(0, balance + $1) WHERE user_id = $2 RETURNING id, balance', [delta, user_id]);
  if (walletRes && walletRes[0]) {
    await executeQuery('INSERT INTO nxl_transactions (wallet_id, amount, transaction_type, description) VALUES ($1,$2,$3,$4)', [walletRes[0].id, Math.abs(delta), txType, desc]);
    return res.json({ success: true, new_balance: walletRes[0].balance });
  }
  // Fallback
  if (!dbFallback.wallets[user_id]) dbFallback.wallets[user_id] = { balance: 0, transactions: [] };
  dbFallback.wallets[user_id].balance = Math.max(0, dbFallback.wallets[user_id].balance + delta);
  dbFallback.wallets[user_id].transactions.unshift({ id: `tx-${Date.now()}`, amount: Math.abs(delta), transaction_type: txType, description: desc, created_at: new Date() });
  res.json({ success: true, new_balance: dbFallback.wallets[user_id].balance });
});

// ─── STARTUP: Connect to DB then create tables, then start server ─────────────
async function runStartup() {
  await initPool(); // test DB connection, set pool + dbConnected

  if (dbConnected && pool) {
    // Create all optional tables that don't exist in the base schema
    const startupQueries = [
      `CREATE TABLE IF NOT EXISTS coupons (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) UNIQUE NOT NULL,
        discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
        max_discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
        active_until TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS offer_banners (
        id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT NOT NULL,
        link_type VARCHAR(50) DEFAULT 'General',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS offers (
        id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::varchar,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount VARCHAR(100),
        image_url TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS coupon_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        coupon_id VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        order_id VARCHAR(255) NOT NULL,
        discount_saved NUMERIC(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        target VARCHAR(100) DEFAULT 'All Users',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS promotions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount NUMERIC(5,2) NOT NULL DEFAULT 0,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS reward_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        spend_amount NUMERIC(10,2) NOT NULL,
        earn_credits NUMERIC(10,2) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_percentage_check`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT ''`,
      `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address TEXT DEFAULT ''`,
      `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT ''`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'percentage'`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General'`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 0`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_eligibility VARCHAR(50) DEFAULT 'All'`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT 1`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_categories TEXT`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_products TEXT`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_vendors TEXT`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_users TEXT`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS banner_image TEXT`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT`,
      // ── Order items product snapshot ─────────────────────────────────────
      // Stores name + image at purchase time so orders survive product edits/deletes.
      `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT ''`,
      `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''`,
      // Back-fill existing rows that have no snapshot yet: copy from products table
      `UPDATE order_items oi
         SET product_name = COALESCE(p.name, ''),
             image_url    = COALESCE(p.image_url, '')
         FROM products p
         WHERE oi.product_id = p.id
           AND (oi.product_name IS NULL OR oi.product_name = '')`,
      // ── Allow NULL product_id in order_items ─────────────────────────────
      // Fallback/in-memory products (e.g. "prod-3") are not UUIDs and cannot
      // reference the products table. Making the FK nullable lets the order
      // still be recorded without a DB-level foreign-key violation.
      `ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL`,
    ];

    for (const q of startupQueries) {
      try {
        await pool.query(q);
      } catch (e) {
        // Non-fatal — table may already exist or column already added
        console.warn(`DB schema note: ${e.message}`);
      }
    }
    console.log("✅ Database schema ready.");
  }

  app.listen(PORT, () => {
    const mode = dbConnected ? 'PostgreSQL mode' : 'in-memory mode';
    console.log(`🚀 Nexora Store Server running on port ${PORT} [${mode}]`);
  });
}

runStartup();
