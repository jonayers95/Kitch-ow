import { describe, it, expect } from 'vitest';
import { STOCK_RECIPES } from '../data/stockRecipes';

describe('stockRecipes data suite', () => {
  it('contains a valid collection of stock recipes', () => {
    expect(Array.isArray(STOCK_RECIPES)).toBe(true);
    expect(STOCK_RECIPES.length).toBeGreaterThan(0);
  });

  it('validates that every stock recipe has mandatory fields', () => {
    const validCategories = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Other'];

    STOCK_RECIPES.forEach((recipe) => {
      expect(recipe.title).toBeTruthy();
      expect(typeof recipe.title).toBe('string');
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(Array.isArray(recipe.instructions)).toBe(true);
      expect(recipe.instructions.length).toBeGreaterThan(0);
      expect(validCategories).toContain(recipe.category);
    });
  });
});
