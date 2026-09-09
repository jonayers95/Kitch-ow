import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveMealPlan,
  getCachedMealPlan,
  setCachedMealPlan,
  subscribeToWeeklyMealPlan
} from '../services/mealPlanService';
import { MealSlot, MealPlan } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test_user_delete' } }
}));

let mockFirestoreStore: Record<string, any> = {};
let mockSetDocCalls: any[] = [];
let mockSnapshotListener: ((snap: any) => void) | null = null;

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ coll, id })),
    setDoc: vi.fn(async (ref, data, options) => {
      mockSetDocCalls.push({ ref, data, options });
      if (options?.merge) {
        // Real Firestore merge behavior: maps are merged recursively, keys are NOT removed
        const existing = mockFirestoreStore[ref.id] || {};
        const mergedDays = { ...(existing.days || {}), ...(data.days || {}) };
        mockFirestoreStore[ref.id] = {
          ...existing,
          ...data,
          days: mergedDays
        };
      } else {
        mockFirestoreStore[ref.id] = data;
      }
    }),
    onSnapshot: vi.fn((ref, callback) => {
      mockSnapshotListener = callback;
      return () => {};
    }),
    serverTimestamp: () => 'MOCK_SERVER_TIMESTAMP'
  };
});

describe('Meal Plan Deletion and Persistence', () => {
  const fixedDate = new Date('2026-09-08T12:00:00Z');
  const householdId = 'hh_del_1';
  const weekKey = '2026-09-07';
  const userId = 'test_user_delete';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFirestoreStore = {};
    mockSetDocCalls = [];
    mockSnapshotListener = null;
  });

  it('deleting a meal removes it from Firestore and does NOT restore it when document updates', async () => {
    // 1. Initial state: Monday has a meal, Tuesday has a meal
    const initialDays: { [dateStr: string]: MealSlot[] } = {
      '2026-09-07': [
        { id: 'slot_mon', mealType: 'Dinner', recipeId: 'rec_pizza', isDone: false }
      ],
      '2026-09-08': [
        { id: 'slot_tue', mealType: 'Dinner', recipeId: 'rec_tacos', isDone: false }
      ]
    };

    // Save initial plan
    await saveMealPlan(householdId, weekKey, initialDays, userId, fixedDate);

    expect(mockFirestoreStore[`${householdId}_${weekKey}`].days['2026-09-07']).toBeDefined();
    expect(mockFirestoreStore[`${householdId}_${weekKey}`].days['2026-09-08']).toBeDefined();

    // 2. User deletes Monday's meal (only Tuesday remains)
    const updatedDays: { [dateStr: string]: MealSlot[] } = {
      '2026-09-08': [
        { id: 'slot_tue', mealType: 'Dinner', recipeId: 'rec_tacos', isDone: false }
      ]
    };

    const savedPlan = await saveMealPlan(householdId, weekKey, updatedDays, userId, fixedDate);

    // Monday MUST NOT exist in the saved plan
    expect(savedPlan.days['2026-09-07']).toBeUndefined();
    expect(savedPlan.days['2026-09-08']).toBeDefined();

    // In Firestore document, Monday MUST be completely removed, NOT merged back
    const firestoreData = mockFirestoreStore[`${householdId}_${weekKey}`];
    expect(firestoreData.days['2026-09-07']).toBeUndefined();
    expect(firestoreData.days['2026-09-08']).toBeDefined();

    // Cache must also reflect deletion
    const cached = getCachedMealPlan(householdId, weekKey, fixedDate);
    expect(cached?.days['2026-09-07']).toBeUndefined();
    expect(cached?.days['2026-09-08']).toBeDefined();
  });

  it('deleting all meals in a week leaves days empty in Firestore and does not retain old meals', async () => {
    // Initial plan with 1 meal
    await saveMealPlan(
      householdId,
      weekKey,
      {
        '2026-09-07': [{ id: 'slot_1', mealType: 'Dinner', recipeId: 'rec_pasta', isDone: false }]
      },
      userId,
      fixedDate
    );

    expect(mockFirestoreStore[`${householdId}_${weekKey}`].days['2026-09-07']).toBeDefined();

    // User deletes all meals in the week
    const result = await saveMealPlan(householdId, weekKey, {}, userId, fixedDate);

    expect(Object.keys(result.days).length).toBe(0);
    expect(mockFirestoreStore[`${householdId}_${weekKey}`].days).toEqual({});

    const cached = getCachedMealPlan(householdId, weekKey, fixedDate);
    expect(cached?.days).toEqual({});
  });

  it('saveMealPlan does not call setDoc with merge: true because merge prevents map key deletion', async () => {
    await saveMealPlan(
      householdId,
      weekKey,
      {
        '2026-09-08': [{ id: 'slot_1', mealType: 'Lunch', isDone: false }]
      },
      userId,
      fixedDate
    );

    expect(mockSetDocCalls.length).toBe(1);
    const lastCall = mockSetDocCalls[0];
    // options should NOT be { merge: true }
    expect(lastCall.options?.merge).toBeFalsy();
  });
});
