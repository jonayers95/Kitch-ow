import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  cleanRecipeForFirestore,
  toFirestoreTimestamp,
  getCachedRecipes,
  setCachedRecipes,
  saveRecipe,
  deleteRecipe,
  subscribeToRecipes,
  getDeletedRecipeIds
} from '../services/recipeService';
import {
  getPersistedActiveHouseholdId,
  setPersistedActiveHouseholdId
} from '../services/householdService';
import { Recipe } from '../types';

// Mock Firebase
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
let snapshotListenerCallback: ((snap: any) => void) | null = null;

vi.mock('../firebase', () => ({
  db: { _isMockDb: true },
  auth: { currentUser: { uid: 'user_live_test' } }
}));

let mockDocCounter = 0;
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ coll, id: id || `rec_${++mockDocCounter}_${Date.now()}` })),
    collection: vi.fn((_db, coll) => ({ coll })),
    query: vi.fn((coll) => ({ coll })),
    where: vi.fn(() => ({})),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    onSnapshot: vi.fn((_query, onNext) => {
      snapshotListenerCallback = onNext;
      return () => {
        snapshotListenerCallback = null;
      };
    }),
    serverTimestamp: () => ({ _isServerTimestamp: true })
  };
});

describe('Recipe Loss Prevention & Resilient Persistence (TDD)', () => {
  const householdId = 'household_live_loss_test';
  const testUser = { uid: 'user_live_test' };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    snapshotListenerCallback = null;
  });

  describe('Timestamp Serialization & Firestore Compatibility', () => {
    it('converts cached plain objects with toMillis functions into real Firestore Timestamps', () => {
      const cachedCreatedAt = {
        toMillis: () => 1715000000000,
        seconds: 1715000000,
        nanoseconds: 0
      };

      const converted = toFirestoreTimestamp(cachedCreatedAt);
      expect(converted).toBeInstanceOf(Timestamp);
      expect(converted.toMillis()).toBe(1715000000000);
    });

    it('cleanRecipeForFirestore produces a payload free of bare functions that would cause setDoc crashes', () => {
      const recipeWithFunctionInCreatedAt: Recipe = {
        id: 'rec_func_test',
        title: 'Grandma Italian Meatballs',
        ingredients: ['1 lb beef', '1/2 cup breadcrumbs', '1 egg'],
        instructions: ['Roll into balls', 'Simmer in marinara for 45 min'],
        category: 'Dinner',
        rating: 5,
        estimatedTime: 45,
        authorId: 'user_live_test',
        householdId,
        createdAt: {
          toMillis: () => 1715000000000,
          seconds: 1715000000,
          nanoseconds: 0
        } as any
      };

      const payload = cleanRecipeForFirestore(recipeWithFunctionInCreatedAt, false);
      expect(typeof (payload.createdAt as any)?.toMillis).toBe('function');
      expect(payload.createdAt).toBeInstanceOf(Timestamp);
      expect(typeof payload.createdAt).not.toBe('function');
      // Verify no functions exist anywhere in payload
      for (const [key, value] of Object.entries(payload)) {
        if (key !== 'createdAt' && key !== 'updatedAt') {
          expect(typeof value).not.toBe('function');
        }
      }
    });

    it('successfully saves an edited recipe previously hydrated from localStorage without throwing', async () => {
      // 1. Put raw serialized recipe in localStorage (as if reloaded from disk)
      const cached = [
        {
          id: 'rec_persisted_1',
          title: 'Creamy Garlic Butter Salmon',
          ingredients: ['Salmon fillets', 'Garlic', 'Butter', 'Cream'],
          instructions: ['Sear salmon', 'Make garlic cream sauce', 'Simmer together'],
          category: 'Dinner',
          rating: 5,
          estimatedTime: 20,
          authorId: testUser.uid,
          householdId,
          _createdAtMillis: 1712000000000
        }
      ];
      localStorage.setItem(`kitchow_recipes_${householdId}`, JSON.stringify(cached));

      // 2. Hydrate from cache
      const hydrated = getCachedRecipes(householdId);
      expect(hydrated.length).toBe(1);
      expect(hydrated[0].title).toBe('Creamy Garlic Butter Salmon');

      // 3. Edit and save the recipe
      const updated = await saveRecipe(
        {
          ...hydrated[0],
          title: 'Creamy Tuscan Garlic Butter Salmon with Spinach'
        },
        testUser,
        householdId
      );

      expect(updated.title).toBe('Creamy Tuscan Garlic Butter Salmon with Spinach');
      expect(mockSetDoc).toHaveBeenCalled();

      // Check setDoc payload
      const setDocCall = mockSetDoc.mock.calls[0];
      const payloadPassedToFirestore = setDocCall[1];
      expect(payloadPassedToFirestore.createdAt).toBeInstanceOf(Timestamp);
    });
  });

  describe('Snapshot Merge & Cache Protection (Zero Lost Recipes)', () => {
    it('does NOT wipe locally added recipes if Firestore onSnapshot fires with empty docs', () => {
      const localRecipe: Recipe = {
        id: 'rec_local_only',
        title: 'Crispy Smashed Fingerling Potatoes',
        ingredients: ['Fingerling potatoes', 'Rosemary', 'Flaky salt'],
        instructions: ['Boil until tender', 'Smash flat', 'Roast at 425F until crispy'],
        category: 'Dinner',
        rating: 5,
        estimatedTime: 35,
        authorId: testUser.uid,
        householdId,
        createdAt: Timestamp.now()
      };

      setCachedRecipes(householdId, [localRecipe]);

      let deliveredRecipes: Recipe[] = [];
      const unsub = subscribeToRecipes(householdId, (recipes) => {
        deliveredRecipes = recipes;
      });

      // Initial hydration delivers local recipe immediately
      expect(deliveredRecipes.length).toBe(1);
      expect(deliveredRecipes[0].title).toBe('Crispy Smashed Fingerling Potatoes');

      // Simulate Firestore onSnapshot returning empty docs (e.g. network latency or new collection query)
      expect(snapshotListenerCallback).not.toBeNull();
      snapshotListenerCallback!({
        docs: []
      });

      // The local recipe must NOT be wiped!
      expect(deliveredRecipes.length).toBe(1);
      expect(deliveredRecipes[0].title).toBe('Crispy Smashed Fingerling Potatoes');
      expect(getCachedRecipes(householdId).length).toBe(1);

      unsub();
    });

    it('merges remote docs with locally pending recipes and triggers background sync for local-only recipes', async () => {
      const localRecipe: Recipe = {
        id: 'rec_pending_sync',
        title: 'Avocado Toast with Poached Egg',
        ingredients: ['Sourdough', 'Avocado', 'Egg', 'Chili flakes'],
        instructions: ['Toast sourdough', 'Mash avocado', 'Poach egg and assemble'],
        category: 'Breakfast',
        rating: 5,
        estimatedTime: 10,
        authorId: testUser.uid,
        householdId,
        createdAt: Timestamp.now()
      };

      setCachedRecipes(householdId, [localRecipe]);

      let deliveredRecipes: Recipe[] = [];
      const unsub = subscribeToRecipes(householdId, (recipes) => {
        deliveredRecipes = recipes;
      });

      // Firestore returns an existing recipe from the cloud
      const cloudDoc = {
        id: 'rec_cloud_1',
        data: () => ({
          title: 'Greek Yogurt Bowl',
          ingredients: ['Greek yogurt', 'Berries', 'Granola'],
          instructions: ['Layer yogurt and toppings'],
          category: 'Breakfast',
          rating: 4,
          authorId: testUser.uid,
          householdId,
          createdAt: Timestamp.now()
        })
      };

      snapshotListenerCallback!({
        docs: [cloudDoc]
      });

      // Delivered list must contain BOTH the remote and local recipes
      expect(deliveredRecipes.length).toBe(2);
      const titles = deliveredRecipes.map(r => r.title);
      expect(titles).toContain('Greek Yogurt Bowl');
      expect(titles).toContain('Avocado Toast with Poached Egg');

      unsub();
    });

    it('respects explicit recipe deletions via deletion tombstone so deleted recipes are not resurrected by merge', async () => {
      const r1 = await saveRecipe(
        {
          title: 'To Be Kept',
          ingredients: ['Ing 1'],
          instructions: ['Step 1']
        },
        testUser,
        householdId
      );

      const r2 = await saveRecipe(
        {
          title: 'To Be Deleted',
          ingredients: ['Ing 2'],
          instructions: ['Step 2']
        },
        testUser,
        householdId
      );

      expect(getCachedRecipes(householdId).length).toBe(2);

      // User deletes r2
      await deleteRecipe(r2.id, householdId);
      expect(getDeletedRecipeIds(householdId).has(r2.id)).toBe(true);

      let delivered: Recipe[] = [];
      const unsub = subscribeToRecipes(householdId, (recs) => {
        delivered = recs;
      });

      expect(delivered.some(r => r.id === r2.id)).toBe(false);

      // Even if Firestore listener fires with stale doc for r2, tombstone prevents resurrection
      snapshotListenerCallback!({
        docs: [
          {
            id: r1.id,
            data: () => ({ ...r1 })
          },
          {
            id: r2.id,
            data: () => ({ ...r2 })
          }
        ]
      });

      expect(delivered.some(r => r.id === r2.id)).toBe(false);
      expect(delivered.length).toBe(1);
      expect(delivered[0].id).toBe(r1.id);

      unsub();
    });
  });

  describe('Household Active Selection Cross-Session Fallback', () => {
    it('persists and retrieves active household ID across user-specific and generic keys', () => {
      setPersistedActiveHouseholdId('user_abc', 'hh_12345');

      // Can be retrieved with user ID
      expect(getPersistedActiveHouseholdId('user_abc')).toBe('hh_12345');

      // Can also be retrieved without user ID (e.g. before auth callback fires on refresh)
      expect(getPersistedActiveHouseholdId()).toBe('hh_12345');
    });
  });
});
