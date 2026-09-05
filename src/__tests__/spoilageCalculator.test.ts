import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectSpoilageCategory, evaluateFoodFreshness } from '../utils/spoilageCalculator';

describe('spoilageCalculator', () => {
  describe('detectSpoilageCategory', () => {
    it('detects seafood from title and ingredients', () => {
      expect(detectSpoilageCategory('Pan-Seared Salmon')).toBe('seafood');
      expect(detectSpoilageCategory('Garlic Butter Shrimp Pasta')).toBe('seafood');
      expect(detectSpoilageCategory('Fish Tacos', ['tilapia fillets', 'tortillas'])).toBe('seafood');
    });

    it('detects poultry', () => {
      expect(detectSpoilageCategory('Roast Chicken and Potatoes')).toBe('poultry');
      expect(detectSpoilageCategory('Turkey Chili')).toBe('poultry');
      expect(detectSpoilageCategory('Crispy Duck Breast')).toBe('poultry');
    });

    it('detects meat/beef/pork', () => {
      expect(detectSpoilageCategory('Classic Beef Lasagna')).toBe('meat');
      expect(detectSpoilageCategory('Pork Chops with Apples')).toBe('meat');
      expect(detectSpoilageCategory('Smash Burgers')).toBe('meat');
    });

    it('detects soups, stews, and casseroles', () => {
      expect(detectSpoilageCategory('Vegetable Lentil Soup')).toBe('soup');
      expect(detectSpoilageCategory('Chickpea Coconut Curry')).toBe('soup');
      expect(detectSpoilageCategory('Cheesy Broccoli Casserole')).toBe('soup');
    });

    it('detects grains, rice and pasta', () => {
      expect(detectSpoilageCategory('Fried Rice with Veggies')).toBe('grains');
      expect(detectSpoilageCategory('Mushroom Risotto')).toBe('grains');
      expect(detectSpoilageCategory('Quinoa Power Bowl')).toBe('grains');
    });

    it('detects vegetables and tofu', () => {
      expect(detectSpoilageCategory('Crispy Tofu Stir Fry')).toBe('vegetables');
      expect(detectSpoilageCategory('Greek Salad with Cucumbers')).toBe('vegetables');
    });

    it('detects baked goods', () => {
      expect(detectSpoilageCategory('Blueberry Muffins')).toBe('baked');
      expect(detectSpoilageCategory('Banana Bread')).toBe('baked');
    });
  });

  describe('evaluateFoodFreshness', () => {
    beforeEach(() => {
      // Mock today to 2026-08-31
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('evaluates food cooked today (day 0) as Peak Freshness', () => {
      const evaluation = evaluateFoodFreshness('2026-08-31', 'Roast Chicken');
      expect(evaluation.daysElapsed).toBe(0);
      expect(evaluation.status).toBe('fresh');
      expect(evaluation.statusLabel).toBe('Peak Freshness');
      expect(evaluation.isSafeToEat).toBe(true);
      expect(evaluation.reheatGuideline).toContain('165°F');
    });

    it('evaluates food cooked 1 day ago as Peak Freshness', () => {
      const evaluation = evaluateFoodFreshness('2026-08-30', 'Seafood Paella');
      expect(evaluation.daysElapsed).toBe(1);
      expect(evaluation.status).toBe('fresh');
      expect(evaluation.isSafeToEat).toBe(true);
    });

    it('evaluates food cooked 2 days ago as Eat Soon for seafood', () => {
      const evaluation = evaluateFoodFreshness('2026-08-29', 'Pan-Seared Salmon');
      expect(evaluation.daysElapsed).toBe(2);
      expect(evaluation.status).toBe('eat_soon');
      expect(evaluation.isSafeToEat).toBe(true);
    });

    it('evaluates food cooked 3 days ago as Expiring Soon for seafood (maxSafeDays: 3)', () => {
      const evaluation = evaluateFoodFreshness('2026-08-28', 'Pan-Seared Salmon');
      expect(evaluation.daysElapsed).toBe(3);
      expect(evaluation.status).toBe('expiring');
      expect(evaluation.isSafeToEat).toBe(true);
    });

    it('evaluates food cooked 4 days ago as Past Shelf-Life for seafood', () => {
      const evaluation = evaluateFoodFreshness('2026-08-27', 'Pan-Seared Salmon');
      expect(evaluation.daysElapsed).toBe(4);
      expect(evaluation.status).toBe('past_recommended');
      expect(evaluation.statusLabel).toBe('Past Shelf-Life');
      expect(evaluation.isSafeToEat).toBe(false);
      expect(evaluation.actionRecommendation).toContain('Exceeds USDA');
    });

    it('provides appropriate reheat guideline based on category', () => {
      const poultryEval = evaluateFoodFreshness('2026-08-31', 'Grilled Chicken');
      expect(poultryEval.reheatGuideline).toBe('Reheat leftovers until steaming hot (internal 165°F / 74°C).');

      const vegEval = evaluateFoodFreshness('2026-08-31', 'Steamed Broccoli');
      expect(vegEval.reheatGuideline).toBe('Reheat thoroughly throughout before serving.');
    });
  });
});
