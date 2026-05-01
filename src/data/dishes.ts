import { db } from './schema';
import { logAudit } from './audit';
import type { Category, Dish, DishIngredient, ManagerDishPayload, Offer } from '../types';

type CategoryRow = {
  id: number;
  name: string;
  description: string;
  sort_order: number;
};

type DishRow = {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string;
  price: number;
  prep_time_minutes: number;
  calories: number;
  spice_level: string;
  is_available: number;
  image_url: string;
  average_rating: number | null;
  review_count: number;
};

type DishIngredientRow = {
  dish_id: number;
  ingredient_id: number;
  ingredient_name: string;
  is_allergen: number;
  is_default: number;
  extra_price: number;
  can_add: number;
  can_remove: number;
};

type ReviewRow = {
  id: number;
  dish_id: number;
  customer_id: number;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export async function getOffers() {
  return db.getAllAsync<Offer>(`SELECT * FROM offers ORDER BY id`);
}

export async function getCategories() {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories ORDER BY sort_order, id`
  );
  return rows.map<Category>((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  }));
}

export async function getDishes() {
  const [dishRows, ingredientRows, reviewRows] = await Promise.all([
    db.getAllAsync<DishRow>(
      `SELECT
          d.id,
          d.category_id,
          c.name AS category_name,
          d.name,
          d.description,
          d.price,
          d.prep_time_minutes,
          d.calories,
          d.spice_level,
          d.is_available,
          d.image_url,
          AVG(r.rating) AS average_rating,
          COUNT(r.id) AS review_count
        FROM dishes d
        JOIN categories c ON c.id = d.category_id
        LEFT JOIN reviews r ON r.dish_id = d.id
        GROUP BY d.id
        ORDER BY c.sort_order, d.name`
    ),
    db.getAllAsync<DishIngredientRow>(
      `SELECT
         di.dish_id,
         di.ingredient_id,
         i.name AS ingredient_name,
         i.is_allergen,
         di.is_default,
         di.extra_price,
         di.can_add,
         di.can_remove
       FROM dish_ingredients di
       JOIN ingredients i ON i.id = di.ingredient_id
       ORDER BY di.dish_id, i.name`
    ),
    db.getAllAsync<ReviewRow>(
      `SELECT
         r.id,
         r.dish_id,
         r.customer_id,
         u.first_name || ' ' || u.last_name AS customer_name,
         r.rating,
         r.comment,
         r.created_at
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       ORDER BY r.created_at DESC`
    ),
  ]);

  const ingredientMap = ingredientRows.reduce<Record<number, DishIngredient[]>>((acc, row) => {
    const current = acc[row.dish_id] ?? [];
    current.push({
      ingredientId: row.ingredient_id,
      ingredientCategoryId: 0,
      ingredientCategoryName: '',
      name: row.ingredient_name,
      isDefault: !!row.is_default,
      isMandatory: false,
      extraPrice: row.extra_price,
      canAdd: !!row.can_add,
      canRemove: !!row.can_remove,
    });
    acc[row.dish_id] = current;
    return acc;
  }, {});

  const reviewMap = reviewRows.reduce<Record<number, import('../types').Review[]>>((acc, row) => {
    const current = acc[row.dish_id] ?? [];
    current.push({
      id: row.id,
      dishId: row.dish_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
    });
    acc[row.dish_id] = current;
    return acc;
  }, {});

  return dishRows.map<Dish>((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description,
    price: row.price,
    prepTimeMinutes: row.prep_time_minutes,
    calories: row.calories,
    spiceLevel: row.spice_level,
    isAvailable: !!row.is_available,
    imageUrl: row.image_url,
    ingredients: ingredientMap[row.id] ?? [],
    reviews: reviewMap[row.id] ?? [],
    averageRating: Number((row.average_rating ?? 0).toFixed(1)),
    reviewCount: row.review_count,
  }));
}

export async function upsertDishRecord(actorUserId: number, payload: ManagerDishPayload) {
  if (payload.id) {
    await db.runAsync(
      `UPDATE dishes
       SET category_id = ?, name = ?, description = ?, price = ?, prep_time_minutes = ?, calories = ?, spice_level = ?, is_available = ?
       WHERE id = ?`,
      payload.categoryId,
      payload.name.trim(),
      payload.description.trim(),
      payload.price,
      payload.prepTimeMinutes,
      payload.calories,
      payload.spiceLevel.trim(),
      payload.isAvailable ? 1 : 0,
      payload.id
    );
    await logAudit(db, actorUserId, 'dish', payload.id, 'update', payload.name.trim());
  } else {
    const result = await db.runAsync(
      `INSERT INTO dishes
        (category_id, name, description, price, prep_time_minutes, calories, spice_level, is_available, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
      payload.categoryId,
      payload.name.trim(),
      payload.description.trim(),
      payload.price,
      payload.prepTimeMinutes,
      payload.calories,
      payload.spiceLevel.trim(),
      payload.isAvailable ? 1 : 0,
      new Date().toISOString()
    );
    await logAudit(
      db,
      actorUserId,
      'dish',
      Number(result.lastInsertRowId),
      'create',
      payload.name.trim()
    );
  }
}

export async function deleteDishRecord(actorUserId: number, dishId: number) {
  await db.runAsync(`DELETE FROM dishes WHERE id = ?`, dishId);
  await logAudit(db, actorUserId, 'dish', dishId, 'delete', 'Dish removed from menu');
}