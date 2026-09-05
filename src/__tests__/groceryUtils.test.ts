import { describe, it, expect } from 'vitest';
import { categorizeIngredient, cleanIngredientName } from '../utils/groceryUtils';

describe('groceryUtils', () => {
  describe('categorizeIngredient', () => {
    it('categorizes pantry spices and seasonings correctly', () => {
      const result1 = categorizeIngredient('1 tsp kosher salt');
      expect(result1).toEqual({ tier: 'pantry', category: 'Spices & Seasonings' });

      const result2 = categorizeIngredient('2 tbsp smoked paprika');
      expect(result2).toEqual({ tier: 'pantry', category: 'Spices & Seasonings' });

      const result3 = categorizeIngredient('1/2 tsp ground cumin');
      expect(result3).toEqual({ tier: 'pantry', category: 'Spices & Seasonings' });

      const result4 = categorizeIngredient('1 tsp garlic powder');
      expect(result4).toEqual({ tier: 'pantry', category: 'Spices & Seasonings' });
    });

    it('categorizes oils, vinegars and condiments correctly', () => {
      const result1 = categorizeIngredient('2 tbsp extra virgin olive oil');
      expect(result1).toEqual({ tier: 'pantry', category: 'Oils, Vinegars & Condiments' });

      const result2 = categorizeIngredient('1 tbsp balsamic vinegar');
      expect(result2).toEqual({ tier: 'pantry', category: 'Oils, Vinegars & Condiments' });

      const result3 = categorizeIngredient('2 tbsp soy sauce');
      expect(result3).toEqual({ tier: 'pantry', category: 'Oils, Vinegars & Condiments' });

      const result4 = categorizeIngredient('1 tbsp dijon mustard');
      expect(result4).toEqual({ tier: 'pantry', category: 'Oils, Vinegars & Condiments' });
    });

    it('categorizes baking staples and grains in pantry', () => {
      const result1 = categorizeIngredient('2 cups all-purpose flour');
      expect(result1).toEqual({ tier: 'pantry', category: 'Baking & Grains' });

      const result2 = categorizeIngredient('1/2 cup brown sugar');
      expect(result2).toEqual({ tier: 'pantry', category: 'Baking & Grains' });

      const result3 = categorizeIngredient('1 tsp baking powder');
      expect(result3).toEqual({ tier: 'pantry', category: 'Baking & Grains' });
    });

    it('categorizes primary meats and seafood', () => {
      const result1 = categorizeIngredient('1 lb boneless skinless chicken breast');
      expect(result1).toEqual({ tier: 'primary', category: 'Meat & Seafood' });

      const result2 = categorizeIngredient('1 lb ground beef 85/15');
      expect(result2).toEqual({ tier: 'primary', category: 'Meat & Seafood' });

      const result3 = categorizeIngredient('2 salmon fillets');
      expect(result3).toEqual({ tier: 'primary', category: 'Meat & Seafood' });

      const result4 = categorizeIngredient('1 lb shrimp, peeled and deveined');
      expect(result4).toEqual({ tier: 'primary', category: 'Meat & Seafood' });
    });

    it('categorizes dairy and refrigerated goods', () => {
      const result1 = categorizeIngredient('2 large eggs');
      expect(result1).toEqual({ tier: 'primary', category: 'Dairy & Refrigerated' });

      const result2 = categorizeIngredient('1/2 cup unsalted butter');
      expect(result2).toEqual({ tier: 'primary', category: 'Dairy & Refrigerated' });

      const result3 = categorizeIngredient('1 cup shredded cheddar');
      expect(result3).toEqual({ tier: 'primary', category: 'Dairy & Refrigerated' });

      const result4 = categorizeIngredient('1/2 cup heavy cream');
      expect(result4).toEqual({ tier: 'primary', category: 'Dairy & Refrigerated' });
    });

    it('categorizes bakery and bread products', () => {
      const result1 = categorizeIngredient('1 loaf sourdough bread');
      expect(result1).toEqual({ tier: 'primary', category: 'Bakery & Bread' });

      const result2 = categorizeIngredient('8 corn tortillas');
      expect(result2).toEqual({ tier: 'primary', category: 'Bakery & Bread' });

      const result3 = categorizeIngredient('4 brioche burger buns');
      expect(result3).toEqual({ tier: 'primary', category: 'Bakery & Bread' });
    });

    it('categorizes produce and fresh herbs', () => {
      const result1 = categorizeIngredient('1 yellow onion, diced');
      expect(result1).toEqual({ tier: 'primary', category: 'Produce & Herbs' });

      const result2 = categorizeIngredient('4 cloves garlic, minced');
      expect(result2).toEqual({ tier: 'primary', category: 'Produce & Herbs' });

      const result3 = categorizeIngredient('2 cups fresh spinach');
      expect(result3).toEqual({ tier: 'primary', category: 'Produce & Herbs' });

      const result4 = categorizeIngredient('1 fresh lemon');
      expect(result4).toEqual({ tier: 'primary', category: 'Produce & Herbs' });
    });

    it('categorizes pasta, rice, and canned pantry items as primary shopping items', () => {
      const result1 = categorizeIngredient('1 box penne pasta');
      expect(result1).toEqual({ tier: 'primary', category: 'Pantry & Canned Goods' });

      const result2 = categorizeIngredient('1 can of black beans');
      expect(result2).toEqual({ tier: 'primary', category: 'Pantry & Canned Goods' });

      const result3 = categorizeIngredient('1 cup jasmine rice');
      expect(result3).toEqual({ tier: 'primary', category: 'Pantry & Canned Goods' });
    });
  });

  describe('cleanIngredientName', () => {
    it('cleans leading bullet characters', () => {
      expect(cleanIngredientName('- 2 cups flour')).toBe('2 cups flour');
      expect(cleanIngredientName('* 1 tsp salt')).toBe('1 tsp salt');
      expect(cleanIngredientName('• 1 bunch cilantro')).toBe('1 bunch cilantro');
    });

    it('trims extraneous whitespace', () => {
      expect(cleanIngredientName('   1 tbsp olive oil   ')).toBe('1 tbsp olive oil');
    });
  });
});
