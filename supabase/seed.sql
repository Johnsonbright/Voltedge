-- VoltEdge Electronics Seed Data
-- Seed with the 8 mandatory products with accurate Naira pricing and deliberate stock quantities for testing scenarios

INSERT INTO public.products (id, slug, name, price, stock_quantity, image_url, description, category, is_active)
VALUES
    (
        'a1b2c3d4-0001-4000-8000-000000000001',
        'macbook-air-m4',
        'MacBook Air M4',
        1850000.00,
        10,
        '/products/macbook-air-m4.svg',
        'Supercharged by the next-generation Apple M4 chip with an 8-core CPU and 10-core GPU. Liquid Retina display, all-day battery life up to 18 hours, and a razor-thin unibody aluminum enclosure.',
        'Laptops & Computers',
        true
    ),
    (
        'a1b2c3d4-0002-4000-8000-000000000002',
        'samsung-galaxy-s25-ultra',
        'Samsung Galaxy S25 Ultra',
        1650000.00,
        8,
        '/products/samsung-galaxy-s25-ultra.svg',
        'The pinnacle of Galaxy AI and mobile craftsmanship. Features a titanium frame, 200MP ultra-quad camera system, embedded S Pen, and Snapdragon 8 Elite processor for unmatched performance.',
        'Smartphones',
        true
    ),
    (
        'a1b2c3d4-0003-4000-8000-000000000003',
        'playstation-5-slim',
        'PlayStation 5 Slim',
        950000.00,
        2,
        '/products/playstation-5-slim.svg',
        'Experience lightning-fast loading with an ultra-high speed 1TB SSD, deeper immersion with haptic feedback, adaptive triggers, and 3D Audio in a sleek, compact console profile.',
        'Gaming Consoles',
        true
    ),
    (
        'a1b2c3d4-0004-4000-8000-000000000004',
        'ipad-air',
        'iPad Air',
        1100000.00,
        7,
        '/products/ipad-air.svg',
        'Stunning 11-inch Liquid Retina display with P3 wide color, powered by Apple Silicon for blazing speed, Apple Pencil Pro support, and USB-C connectivity.',
        'Tablets & e-Readers',
        true
    ),
    (
        'a1b2c3d4-0005-4000-8000-000000000005',
        'sony-wh-1000xm5',
        'Sony WH-1000XM5',
        650000.00,
        5,
        '/products/sony-wh-1000xm5.svg',
        'Industry-leading active noise cancellation with 8 microphones and Auto NC Optimizer. High-resolution audio, crystal-clear hands-free calling, and up to 30 hours of continuous playback.',
        'Audio & Headphones',
        true
    ),
    (
        'a1b2c3d4-0006-4000-8000-000000000006',
        'samsung-55-inch-4k-tv',
        'Samsung 55-inch 4K TV',
        1400000.00,
        3,
        '/products/samsung-55-inch-4k-tv.svg',
        'Crystal Processor 4K transforms everything you watch into 4K clarity. Dynamic Crystal Color, HDR10+, sleek AirSlim aesthetic, and Object Tracking Sound Lite for an immersive home cinema.',
        'Television & Video',
        true
    ),
    (
        'a1b2c3d4-0007-4000-8000-000000000007',
        'logitech-wireless-mouse',
        'Logitech Wireless Mouse',
        180000.00,
        25,
        '/products/logitech-wireless-mouse.svg',
        'Precision ergonomic wireless mouse featuring ultra-fast MagSpeed scrolling, high-accuracy Darkfield 8,000 DPI sensor, quiet click switches, and dual Bluetooth / 2.4GHz connectivity.',
        'Computer Accessories',
        true
    ),
    (
        'a1b2c3d4-0008-4000-8000-000000000008',
        'anker-power-bank',
        'Anker Power Bank',
        95000.00,
        0,
        '/products/anker-power-bank.svg',
        'High-capacity 24,000mAh portable power bank with 140W ultra-fast two-way Power Delivery 3.1. Smart digital display shows output and recharge progress. (Currently out of stock).',
        'Power & Accessories',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock_quantity = EXCLUDED.stock_quantity,
    image_url = EXCLUDED.image_url,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = now();
