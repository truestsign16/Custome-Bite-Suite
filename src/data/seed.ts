import * as Crypto from 'expo-crypto';
import { db, SqlRunner } from './schema';
import { logAudit } from './audit';

type UserRow = {
  id: number;
  role: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  date_of_birth: string;
  password_hash: string;
  address_line: string;
  latitude: number;
  longitude: number;
  notes: string;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function hashPassword(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

async function countRows(table: string) {
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
  return row?.count ?? 0;
}

export async function seedDatabase() {
  const existingUsers = await countRows('users');
  if (existingUsers > 0) {
    return;
  }

  const [customerHash, managerHash, riderHash] = await Promise.all([
    hashPassword('Customer123'),
    hashPassword('Manager123'),
    hashPassword('Rider123'),
  ]);

  const seededAt = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO users
        (role, first_name, last_name, username, email, phone, date_of_birth, password_hash, address_line, latitude, longitude, notes, created_at)
       VALUES
        ('customer', 'Sara', 'Ahmed', 'sara', 'sara@custombite.app', '01710000001', '1998-05-14', ?, 'House 14, Dhanmondi, Dhaka', 23.7465, 90.3760, 'Ring the blue gate bell.', ?),
        ('manager', 'Nadia', 'Rahman', 'manager', 'manager@custombite.app', '01710000002', '1991-08-10', ?, 'Custom-Bite Kitchen HQ', 23.7508, 90.3906, 'Manager control room', ?),
        ('rider', 'Arif', 'Hasan', 'rider1', 'rider@custombite.app', '01710000003', '1996-11-23', ?, 'Rider Bay, Mirpur', 23.8069, 90.3687, 'Primary rider', ?)`,
      customerHash,
      seededAt,
      managerHash,
      seededAt,
      riderHash,
      seededAt
    );

    await txn.execAsync(`
      INSERT INTO categories (name, description, sort_order) VALUES
      ('Signature Burgers', 'High-protein burgers with ingredient transparency.', 1),
      ('Rice Bowls', 'Balanced bowls for lunch and dinner.', 2),
      ('Sides', 'Quick add-ons and snacks.', 3),
      ('Drinks', 'Fresh beverages and shakes.', 4);

      INSERT INTO ingredients (name, is_allergen) VALUES
      ('Brioche Bun', 1),
      ('Chicken Patty', 0),
      ('Beef Patty', 0),
      ('Lettuce', 0),
      ('Tomato', 0),
      ('Cheddar', 1),
      ('Caramelized Onion', 0),
      ('Jalapeno', 0),
      ('Garlic Mayo', 1),
      ('Basmati Rice', 0),
      ('Grilled Chicken', 0),
      ('Cucumber', 0),
      ('House Pickle', 0),
      ('Loaded Fries', 0),
      ('Cola', 0),
      ('Greek Yogurt Sauce', 1),
      ('Avocado', 0);
    `);

    await txn.runAsync(
      `INSERT INTO dishes
        (category_id, name, description, price, prep_time_minutes, calories, spice_level, is_available, image_url, created_at)
       VALUES
        (1, 'Fireline Chicken Burger', 'Smoky grilled chicken, cheddar, jalapeno, and garlic mayo.', 8.9, 18, 650, 'Medium', 1, '', ?),
        (1, 'Stackhouse Beef Burger', 'Double beef with caramelized onion and house pickle.', 10.5, 20, 790, 'Mild', 1, '', ?),
        (2, 'Power Bowl', 'Basmati rice with grilled chicken, cucumber, yogurt sauce, and herbs.', 9.6, 16, 560, 'Mild', 1, '', ?),
        (3, 'Loaded Fries', 'Crisp fries with cheddar, onion, and sauce drizzle.', 4.8, 10, 420, 'Medium', 1, '', ?),
        (4, 'Citrus Cola Cooler', 'Citrus-spiked cola over ice.', 2.9, 4, 120, 'None', 1, '', ?)`,
      seededAt,
      seededAt,
      seededAt,
      seededAt,
      seededAt
    );

    await txn.execAsync(`
      INSERT INTO dish_ingredients (dish_id, ingredient_id, is_default, extra_price, can_add, can_remove) VALUES
      (1, 1, 1, 0, 0, 0), (1, 2, 1, 0, 0, 0), (1, 4, 1, 0, 1, 1), (1, 5, 1, 0, 1, 1),
      (1, 6, 1, 1.20, 1, 1), (1, 8, 1, 0.75, 1, 1), (1, 9, 1, 0.50, 1, 1), (1, 17, 0, 1.50, 1, 0),
      (2, 1, 1, 0, 0, 0), (2, 3, 1, 0, 0, 0), (2, 4, 1, 0, 1, 1), (2, 7, 1, 0.60, 1, 1),
      (2, 13, 1, 0.40, 1, 1), (2, 6, 0, 1.20, 1, 0),
      (3, 10, 1, 0, 0, 0), (3, 11, 1, 0, 0, 0), (3, 12, 1, 0, 1, 1), (3, 16, 1, 0.60, 1, 1),
      (3, 17, 0, 1.50, 1, 0), (4, 6, 1, 0.80, 1, 1), (4, 7, 1, 0.50, 1, 1), (4, 9, 1, 0.50, 1, 1),
      (5, 15, 1, 0, 0, 0);

      INSERT INTO offers (title, description, discount_percent, active_from, active_to, banner_color) VALUES
      ('Weekday Lunch Saver', '12% off bowls before 3 PM.', 12, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', '#D45D31'),
      ('Burger Night', 'Free loaded fries on two burger combos.', 8, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', '#174C4F');

      INSERT INTO reviews (dish_id, customer_id, rating, comment, created_at) VALUES
      (1, 1, 5, 'Excellent balance of heat and freshness.', '${seededAt}'),
      (3, 1, 4, 'Great portion size for lunch.', '${seededAt}');
    `);

    await txn.runAsync(
      `INSERT INTO orders
        (customer_id, rider_id, address_line, latitude, longitude, delivery_notes, status, payment_method, payment_status, subtotal, discount, delivery_fee, total, created_at, accepted_at, preparing_at, ready_at, picked_up_at, delivered_at, cash_collected_at)
       VALUES
        (1, 3, 'House 14, Dhanmondi, Dhaka', 23.7465, 90.3760, 'Call when arriving at lane entry.', 'delivered', 'cod', 'cod_collected', 18.50, 1.48, 3.50, 20.52, '2026-04-10T06:30:00.000Z', '2026-04-10T06:33:00.000Z', '2026-04-10T06:40:00.000Z', '2026-04-10T06:56:00.000Z', '2026-04-10T07:02:00.000Z', '2026-04-10T07:19:00.000Z', '2026-04-10T07:21:00.000Z'),
        (1, 3, 'House 14, Dhanmondi, Dhaka', 23.7465, 90.3760, 'Please avoid knocking loudly.', 'on_the_way', 'card', 'paid', 9.60, 1.15, 3.50, 11.95, '2026-04-11T00:20:00.000Z', '2026-04-11T00:22:00.000Z', '2026-04-11T00:28:00.000Z', '2026-04-11T00:40:00.000Z', '2026-04-11T00:47:00.000Z', NULL, NULL)`
    );

    await txn.execAsync(`
      INSERT INTO order_items (order_id, dish_id, quantity, unit_price, instructions) VALUES
      (1, 1, 1, 9.65, 'Extra jalapeno'), (1, 4, 1, 4.80, 'Keep fries crisp'), (2, 3, 1, 9.60, 'No cucumber');

      INSERT INTO order_item_customizations (order_item_id, ingredient_id, action, price_delta) VALUES
      (1, 8, 'add', 0.75), (2, 7, 'add', 0.50), (3, 12, 'remove', 0);

      INSERT INTO refund_requests (order_id, customer_id, reason, details, status, resolution_note, created_at)
      VALUES (1, 1, 'Missing sauce', 'Loaded fries arrived without the requested sauce.', 'approved', 'Refund approved as wallet credit equivalent.', '2026-04-10T08:00:00.000Z');
    `);

    await logAudit(txn, 2, 'dish', 1, 'seed', 'Initial sample data created');
    await logAudit(txn, 2, 'order', 1, 'delivered', 'Historical delivered order seeded');
    await logAudit(txn, 3, 'order', 2, 'picked_up', 'Seed active delivery assigned to rider');
  });
}