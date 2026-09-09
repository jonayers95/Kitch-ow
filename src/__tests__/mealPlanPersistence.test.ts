import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  get30DaysAgoDateKey,
  isDateOlderThan30Days,
  sanitizeAndPruneMealPlanDays,
  getCachedMealPlan,
  setCachedMealPlan,
  saveMealPlan,
  subscribeToWeeklyMealPlan
} from '../services/mealPlanService';
import { MealSlot, MealPlan } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test_user_1' } }
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
let mockSnapshotCallback: any = null;

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ coll, id })),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    onSnapshot: vi.fn((_ref, callback) => {
      mockSnapshotCallback = callback;
      return () => {};
    }),
    serverTimestamp: () => 'SERVER_TIMESTAMP'
  };
});

describe('Meal Plan Persistence & 30-Day Retention Service', () => {
  const fixedNow = new Date('2026-09-08T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('30-Day Retention Window Calculations', () => {
    it('calculates the date key exactly 30 days prior', () => {
      const cutoff = get30DaysAgoDateKey(fixedNow);
      // 30 days before Sept 8 is August 9
      expect(cutoff).toBe('2026-08-09');
    });

    it('identifies dates older than 30 days vs active dates', () => {
      // 31 days ago (Aug 8) is older than 30 days -> expired
      expect(isDateOlderThan30Days('2026-08-08', fixedNow)).toBe(true);
      // 40 days ago is older than 30 days -> expired
      expect(isDateOlderThan30Days('2026-07-30', fixedNow)).toBe(true);

      // Exactly 30 days ago (Aug 9) is retained
      expect(isDateOlderThan30Days('2026-08-09', fixedNow)).toBe(false);
      // 10 days ago (Aug 29) is retained
      expect(isDateOlderThan30Days('2026-08-29', fixedNow)).toBe(false);
      // Today (Sept 8) is retained
      expect(isDateOlderThan30Days('2026-09-08', fixedNow)).toBe(false);
      // Tomorrow / future (Sept 9) is retained
      expect(isDateOlderThan30Days('2026-09-09', fixedNow)).toBe(false);
    });

    it('prunes meals older than 30 days while keeping meals within 30 days and all future meals', () => {
      const sampleDays: { [dateStr: string]: MealSlot[] } = {
        '2026-07-15': [
          { id: 's_old', mealType: 'Dinner', recipeId: 'r_old', isDone: true }
        ],
        '2026-08-08': [ // 31 days ago
          { id: 's_31_days', mealType: 'Lunch', recipeId: 'r_lunch', isDone: true }
        ],
        '2026-08-20': [ // 19 days ago -> Keep
          { id: 's_recent_past', mealType: 'Dinner', recipeId: 'r_dinner', isDone: true }
        ],
        '2026-09-08': [ // Today -> Keep
          { id: 's_today', mealType: 'Dinner', recipeId: 'r_today', isDone: false }
        ],
        '2026-09-12': [ // Future -> Keep
          { id: 's_future', mealType: 'Dinner', recipeId: 'r_future', isDone: false }
        ]
      };

      const result = sanitizeAndPruneMealPlanDays(sampleDays, fixedNow);

      expect(result['2026-07-15']).toBeUndefined();
      expect(result['2026-08-08']).toBeUndefined();
      expect(result['2026-08-20']).toBeDefined();
      expect(result['2026-08-20'].length).toBe(1);
      expect(result['2026-09-08']).toBeDefined();
      expect(result['2026-09-08'][0].recipeId).toBe('r_today');
      expect(result['2026-09-12']).toBeDefined();
      expect(result['2026-09-12'][0].recipeId).toBe('r_future');
    });
  });

  describe('Local Storage Cache Hydration Across Sessions', () => {
    it('persists meal plan to localStorage and restores it immediately on page refresh', () => {
      const plan: MealPlan = {
        id: 'hh_1_2026-09-07',
        householdId: 'hh_1',
        weekStartDate: '2026-09-07',
        authorId: 'user_1',
        days: {
          '2026-09-08': [
            { id: 's_taco', mealType: 'Dinner', recipeId: 'rec_tacos', isDone: false }
          ]
        }
      };

      setCachedMealPlan('hh_1', '2026-09-07', plan);

      // Verify it was stored in localStorage
      const cached = getCachedMealPlan('hh_1', '2026-09-07', fixedNow);
      expect(cached).not.toBeNull();
      expect(cached?.householdId).toBe('hh_1');
      expect(cached?.days['2026-09-08'][0].recipeId).toBe('rec_tacos');
    });

    it('prunes stale items older than 30 days when reading from cache', () => {
      const planWithOldMeal: MealPlan = {
        id: 'hh_1_2026-07-06',
        householdId: 'hh_1',
        weekStartDate: '2026-07-06',
        authorId: 'user_1',
        days: {
          '2026-07-08': [ // > 30 days ago
            { id: 's_expired', mealType: 'Dinner', recipeId: 'rec_old', isDone: true }
          ],
          '2026-09-08': [ // Today
            { id: 's_today', mealType: 'Dinner', recipeId: 'rec_today', isDone: false }
          ]
        }
      };

      setCachedMealPlan('hh_1', '2026-07-06', planWithOldMeal);
      const restored = getCachedMealPlan('hh_1', '2026-07-06', fixedNow);

      expect(restored?.days['2026-07-08']).toBeUndefined();
      expect(restored?.days['2026-09-08']).toBeDefined();
    });
  });

  describe('saveMealPlan & subscribeToWeeklyMealPlan', () => {
    it('saveMealPlan writes to localStorage cache and commits full document to Firestore without merge', async () => {
      const days = {
        '2026-09-08': [
          { id: 'slot_pasta', mealType: 'Dinner' as const, recipeId: 'rec_pasta', isDone: false }
        ]
      };

      const result = await saveMealPlan('hh_test', '2026-09-07', days, 'user_test', fixedNow);

      expect(result.days['2026-09-08'][0].recipeId).toBe('rec_pasta');

      // Check localStorage
      const cached = getCachedMealPlan('hh_test', '2026-09-07', fixedNow);
      expect(cached?.days['2026-09-08'][0].recipeId).toBe('rec_pasta');

      // Check Firestore call
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const setDocArgs = mockSetDoc.mock.calls[0];
      expect(setDocArgs[1].householdId).toBe('hh_test');
      expect(setDocArgs[1].weekStartDate).toBe('2026-09-07');
      expect(setDocArgs[1].days['2026-09-08'][0].recipeId).toBe('rec_pasta');
      expect(setDocArgs[2]).toBeUndefined();
    });

    it('subscribeToWeeklyMealPlan immediately hydrates from cache before Firestore snapshot', () => {
      const plan: MealPlan = {
        householdId: 'hh_cache',
        weekStartDate: '2026-09-07',
        authorId: 'user_cache',
        days: {
          '2026-09-08': [
            { id: 'cached_slot', mealType: 'Lunch', customTitle: 'Cached Salad', isDone: false }
          ]
        }
      };
      setCachedMealPlan('hh_cache', '2026-09-07', plan);

      const receivedPlans: MealPlan[] = [];
      const unsubscribe = subscribeToWeeklyMealPlan(
        'hh_cache',
        '2026-09-07',
        'user_cache',
        (p) => receivedPlans.push(p)
      );

      // 1. Immediately fired with cached data synchronously on subscribe
      expect(receivedPlans.length).toBe(1);
      expect(receivedPlans[0].days['2026-09-08'][0].customTitle).toBe('Cached Salad');

      // 2. When Firestore snapshot arrives, it updates and refreshes cache
      mockSnapshotCallback({
        exists: () => true,
        id: 'hh_cache_2026-09-07',
        data: () => ({
          householdId: 'hh_cache',
          weekStartDate: '2026-09-07',
          authorId: 'user_cache',
          days: {
            '2026-09-08': [
              { id: 'cached_slot', mealType: 'Lunch', customTitle: 'Cached Salad', isDone: false },
              { id: 'remote_slot', mealType: 'Dinner', customTitle: 'Grilled Salmon', isDone: false }
            ]
          }
        })
      });

      expect(receivedPlans.length).toBe(2);
      expect(receivedPlans[1].days['2026-09-08'].length).toBe(2);

      unsubscribe();
    });
  });
});
