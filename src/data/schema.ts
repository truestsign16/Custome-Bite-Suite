import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('custom_bite_suite.db');

export type SqlRunner = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync'
>;

export async function execSchema() {
  console.log('Executing database schema initialization...');

  try {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL CHECK(role IN ('customer', 'manager', 'rider')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL UNIQUE,
        date_of_birth TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        address_line TEXT NOT NULL,
        latitude REAL NOT NULL DEFAULT 23.8103,
        longitude REAL NOT NULL DEFAULT 90.4125,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_session (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        user_id INTEGER,
        role TEXT,
        last_login_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        prep_time_minutes INTEGER NOT NULL,
        calories INTEGER NOT NULL,
        spice_level TEXT NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 1,
        image_url TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_allergen INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS dish_ingredients (
        dish_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 1,
        extra_price REAL NOT NULL DEFAULT 0,
        can_add INTEGER NOT NULL DEFAULT 1,
        can_remove INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY(dish_id, ingredient_id),
        FOREIGN KEY(dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
        FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
      );

      CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        discount_percent REAL NOT NULL,
        active_from TEXT NOT NULL,
        active_to TEXT NOT NULL,
        banner_color TEXT NOT NULL
      );


      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        rider_id INTEGER,
        address_line TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        delivery_notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'preparing', 'ready', 'in_progress', 'on_the_way', 'delivered', 'canceled', 'rejected')),
        payment_method TEXT NOT NULL DEFAULT 'cod',
        payment_status TEXT NOT NULL DEFAULT 'cod_pending',
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        delivery_fee REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        accepted_at TEXT,
        preparing_at TEXT,
        ready_at TEXT,
        picked_up_at TEXT,
        delivered_at TEXT,
        rejected_at TEXT,
        canceled_at TEXT,
        cash_collected_at TEXT,
        rider_latitude REAL,
        rider_longitude REAL,
        last_location_update TEXT,
        updated_at TEXT,
        FOREIGN KEY(customer_id) REFERENCES users(id),
        FOREIGN KEY(rider_id) REFERENCES users(id)
      );
  -- Migration: Add columns only if upgrading from an old DB (do not add if already in CREATE TABLE)
  -- If you ever remove a column from CREATE TABLE, add its ALTER TABLE here for migration.

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        dish_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        instructions TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(dish_id) REFERENCES dishes(id)
      );

      CREATE TABLE IF NOT EXISTS order_item_customizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_item_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('add', 'remove')),
        price_delta REAL NOT NULL DEFAULT 0,
        FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
        FOREIGN KEY(ingredient_id) REFERENCES ingredients(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dish_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(dish_id, customer_id),
        FOREIGN KEY(dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
        FOREIGN KEY(customer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS refund_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('requested', 'approved', 'denied')),
        resolution_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by INTEGER,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(customer_id) REFERENCES users(id),
        FOREIGN KEY(reviewed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(actor_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS app_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audience TEXT NOT NULL CHECK(audience IN ('user', 'role')),
        recipient_user_id INTEGER,
        recipient_role TEXT CHECK(recipient_role IN ('customer', 'manager', 'rider')),
        order_id INTEGER,
        kind TEXT NOT NULL CHECK(kind IN ('new_order', 'order_status_changed')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(recipient_user_id) REFERENCES users(id),
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS banner_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'operator',
        external_key TEXT
      );
    `);

    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Error during database schema initialization:', error);
    throw error;
  }
}

export { db };
