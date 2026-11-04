import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local or .env
const envLocalPath = resolve(__dirname, '../.env.local');
const envPath = resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project')) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const products = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    slug: 'macbook-air-m4',
    name: 'MacBook Air M4',
    price: 1850000.00,
    stock_quantity: 10,
    image_url: '/products/macbook-air-m4.svg',
    description: 'Supercharged by the next-generation Apple M4 chip with an 8-core CPU and 10-core GPU. Liquid Retina display, all-day battery life up to 18 hours, and a razor-thin unibody aluminum enclosure.',
    category: 'Laptops & Computers',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    slug: 'samsung-galaxy-s25-ultra',
    name: 'Samsung Galaxy S25 Ultra',
    price: 1650000.00,
    stock_quantity: 8,
    image_url: '/products/samsung-galaxy-s25-ultra.svg',
    description: 'The pinnacle of Galaxy AI and mobile craftsmanship. Features a titanium frame, 200MP ultra-quad camera system, embedded S Pen, and Snapdragon 8 Elite processor for unmatched performance.',
    category: 'Smartphones',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0003-4000-8000-000000000003',
    slug: 'playstation-5-slim',
    name: 'PlayStation 5 Slim',
    price: 950000.00,
    stock_quantity: 2,
    image_url: '/products/playstation-5-slim.svg',
    description: 'Experience lightning-fast loading with an ultra-high speed 1TB SSD, deeper immersion with haptic feedback, adaptive triggers, and 3D Audio in a sleek, compact console profile.',
    category: 'Gaming Consoles',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0004-4000-8000-000000000004',
    slug: 'ipad-air',
    name: 'iPad Air',
    price: 1100000.00,
    stock_quantity: 7,
    image_url: '/products/ipad-air.svg',
    description: 'Stunning 11-inch Liquid Retina display with P3 wide color, powered by Apple Silicon for blazing speed, Apple Pencil Pro support, and USB-C connectivity.',
    category: 'Tablets & e-Readers',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0005-4000-8000-000000000005',
    slug: 'sony-wh-1000xm5',
    name: 'Sony WH-1000XM5',
    price: 650000.00,
    stock_quantity: 5,
    image_url: '/products/sony-wh-1000xm5.svg',
    description: 'Industry-leading active noise cancellation with 8 microphones and Auto NC Optimizer. High-resolution audio, crystal-clear hands-free calling, and up to 30 hours of continuous playback.',
    category: 'Audio & Headphones',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0006-4000-8000-000000000006',
    slug: 'samsung-55-inch-4k-tv',
    name: 'Samsung 55-inch 4K TV',
    price: 1400000.00,
    stock_quantity: 3,
    image_url: '/products/samsung-55-inch-4k-tv.svg',
    description: 'Crystal Processor 4K transforms everything you watch into 4K clarity. Dynamic Crystal Color, HDR10+, sleek AirSlim aesthetic, and Object Tracking Sound Lite for an immersive home cinema.',
    category: 'Television & Video',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0007-4000-8000-000000000007',
    slug: 'logitech-wireless-mouse',
    name: 'Logitech Wireless Mouse',
    price: 180000.00,
    stock_quantity: 20,
    image_url: '/products/logitech-wireless-mouse.svg',
    description: 'Precision ergonomic wireless mouse featuring ultra-fast MagSpeed scrolling, high-accuracy Darkfield 8,000 DPI sensor, quiet click switches, and dual Bluetooth / 2.4GHz connectivity.',
    category: 'Computer Accessories',
    is_active: true
  },
  {
    id: 'a1b2c3d4-0008-4000-8000-000000000008',
    slug: 'anker-power-bank',
    name: 'Anker Power Bank',
    price: 95000.00,
    stock_quantity: 0,
    image_url: '/products/anker-power-bank.svg',
    description: 'High-capacity 24,000mAh portable power bank with 140W ultra-fast two-way Power Delivery 3.1. Smart digital display shows output and recharge progress. (Currently out of stock).',
    category: 'Power & Accessories',
    is_active: true
  }
];

async function seed() {
  console.log('⚡ Seeding VoltEdge product catalogue to Supabase...');
  for (const product of products) {
    const { error } = await supabase
      .from('products')
      .upsert(product, { onConflict: 'id' });

    if (error) {
      console.error(`Failed to seed ${product.name}:`, error.message);
    } else {
      console.log(`✓ Seeded ${product.name} (₦${product.price.toLocaleString('en-NG')}, Stock: ${product.stock_quantity})`);
    }
  }
  console.log('✅ VoltEdge catalogue seeding completed.');
}

seed().catch(err => {
  console.error('Seed script error:', err);
  process.exit(1);
});
