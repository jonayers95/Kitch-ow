import { describe, it, expect } from 'vitest';
import {
  calculateImageExpiration,
  isCustomMealImageExpired,
  getDaysRemaining,
  cleanupExpiredMealSlotImages,
  IMAGE_RETENTION_DAYS,
} from '../utils/customMealImageUtils';
import { MealSlot } from '../types';

describe('Custom Meal Image Retention & Expiration (30-day policy)', () => {
  it('has IMAGE_RETENTION_DAYS set to 30', () => {
    expect(IMAGE_RETENTION_DAYS).toBe(30);
  });

  it('calculates imageCapturedAt and imageExpiresAt exactly 30 days apart', () => {
    const baseDate = new Date('2026-09-08T12:00:00.000Z');
    const { imageCapturedAt, imageExpiresAt } = calculateImageExpiration(baseDate);

    expect(imageCapturedAt).toBe('2026-09-08T12:00:00.000Z');
    // 30 days later: 2026-10-08T12:00:00.000Z
    const expiresDate = new Date(imageExpiresAt);
    const diffDays = (expiresDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('identifies an image as NOT expired when within 30 days', () => {
    const capturedAt = new Date('2026-09-01T10:00:00.000Z');
    const { imageCapturedAt, imageExpiresAt } = calculateImageExpiration(capturedAt);

    const slot: MealSlot = {
      id: 'slot_1',
      mealType: 'Dinner',
      customTitle: 'Smoked Salmon Salad',
      imageUrl: 'data:image/jpeg;base64,mock',
      imageCapturedAt,
      imageExpiresAt,
    };

    // 10 days later: 2026-09-11
    const testNow = new Date('2026-09-11T10:00:00.000Z');
    expect(isCustomMealImageExpired(slot, testNow)).toBe(false);
    expect(getDaysRemaining(slot, testNow)).toBe(20);
  });

  it('identifies an image as EXPIRED when past 30 days', () => {
    const capturedAt = new Date('2026-08-01T10:00:00.000Z');
    const { imageCapturedAt, imageExpiresAt } = calculateImageExpiration(capturedAt);

    const slot: MealSlot = {
      id: 'slot_old',
      mealType: 'Dinner',
      customTitle: 'Past Dish',
      imageUrl: 'data:image/jpeg;base64,mock',
      imageCapturedAt,
      imageExpiresAt,
    };

    // 35 days later: 2026-09-05
    const testNow = new Date('2026-09-05T10:00:00.000Z');
    expect(isCustomMealImageExpired(slot, testNow)).toBe(true);
    expect(getDaysRemaining(slot, testNow)).toBe(0);
  });

  it('cleans up and removes expired images from meal plan days so they are not stored beyond 30 days', () => {
    const referenceDate = new Date('2026-09-08T12:00:00.000Z');

    const freshDate = new Date('2026-09-01T12:00:00.000Z'); // 7 days old
    const expiredDate = new Date('2026-07-20T12:00:00.000Z'); // 50 days old

    const days: { [dateStr: string]: MealSlot[] } = {
      '2026-09-01': [
        {
          id: 'slot_fresh',
          mealType: 'Lunch',
          customTitle: 'Fresh Salad',
          imageUrl: 'data:image/jpeg;base64,fresh',
          ...calculateImageExpiration(freshDate),
        },
      ],
      '2026-07-20': [
        {
          id: 'slot_expired',
          mealType: 'Dinner',
          customTitle: 'Ancient Roast',
          imageUrl: 'data:image/jpeg;base64,expired',
          ...calculateImageExpiration(expiredDate),
        },
        {
          id: 'slot_no_image',
          mealType: 'Dinner',
          customTitle: 'No Image Dish',
        },
      ],
    };

    const { cleanedDays, expiredCount } = cleanupExpiredMealSlotImages(days, referenceDate);

    expect(expiredCount).toBe(1);

    // Fresh image remains untouched
    const freshSlot = cleanedDays['2026-09-01'][0];
    expect(freshSlot.imageUrl).toBe('data:image/jpeg;base64,fresh');
    expect(freshSlot.imageCapturedAt).toBeDefined();

    // Expired image has imageUrl and retention metadata completely removed
    const expiredSlot = cleanedDays['2026-07-20'][0];
    expect(expiredSlot.imageUrl).toBeUndefined();
    expect(expiredSlot.imageCapturedAt).toBeUndefined();
    expect(expiredSlot.imageExpiresAt).toBeUndefined();
    expect(expiredSlot.customTitle).toBe('Ancient Roast');

    // Other slot untouched
    expect(cleanedDays['2026-07-20'][1].customTitle).toBe('No Image Dish');
  });
});
