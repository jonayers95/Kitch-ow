import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedRecipes,
  setCachedRecipes,
  saveRecipe,
  deleteRecipe,
  subscribeToRecipes,
  toggleRecipeStaple,
  saveStockRecipes,
  RECIPES_CACHE_PREFIX
} from '../services/recipeService';
import { Recipe } from '../types';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123' } }
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
let mockSnapshotCallback: any = null;
let mockSnapshotErrorCallback: any = null;

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ coll, id: id || `mock_doc_${Date.now()}` })),
    collection: vi.fn((_db, coll) => ({ coll })),
    query: vi.fn((coll, ..._clauses) => ({ coll })),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      commit: () => mockBatchCommit()
    })),
    onSnapshot: vi.fn((_ref, callback, errorCallback) => {
      mockSnapshotCallback = callback;
      mockSnapshotErrorCallback = errorCallback;
      return () => {};
    }),
    serverTimestamp: () => 'SERVER_TIMESTAMP'
  };
});

describe('Recipe Persistence & Cross-Session Synchronization Service', () => {
  const testHouseholdId = 'hh_culinary_alpha';
  const testUser = { uid: 'user_123' };

  const sampleRecipe: Recipe = {
    id: 'rec_101',
    title: 'Lemon Herb Roast Chicken',
    ingredients: ['1 whole chicken', '2 lemons', 'fresh rosemary', 'garlic'],
    instructions: ['Season chicken', 'Stuff with lemon and herbs', 'Roast at 400F for 1 hour'],
    category: 'Dinner',
    rating: 5,
    estimatedTime: 75,
    isStaple: true,
    authorId: 'user_123',
    householdId: testHouseholdId,
    createdAt: { seconds: 1700000000, nanoseconds: 0, toMillis: () => 1700000000000 } as any
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Local Storage Cache Hydration Across Sessions', () => {
    it('persists recipes to localStorage and restores them immediately on simulated page refresh', () => {
      // 1. Initial state is empty
      expect(getCachedRecipes(testHouseholdId)).toEqual([]);

      // 2. Set recipes into cache
      setCachedRecipes(testHouseholdId, [sampleRecipe]);

      // 3. Verify it is persisted in localStorage with appropriate key
      const rawStored = localStorage.getItem(`${RECIPES_CACHE_PREFIX}${testHouseholdId}`);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.length).toBe(1);
      expect(parsed[0].title).toBe('Lemon Herb Roast Chicken');

      // 4. Read back via getCachedRecipes (simulating page reload)
      const restored = getCachedRecipes(testHouseholdId);
      expect(restored.length).toBe(1);
      expect(restored[0].id).toBe('rec_101');
      expect(restored[0].title).toBe('Lemon Herb Roast Chicken');
      expect(restored[0].isStaple).toBe(true);
    });

    it('handles invalid or empty householdId and corrupted cache gracefully', () => {
      expect(getCachedRecipes('')).toEqual([]);
      localStorage.setItem(`${RECIPES_CACHE_PREFIX}${testHouseholdId}`, '{invalid-json');
      expect(getCachedRecipes(testHouseholdId)).toEqual([]);
    });
  });

  describe('saveRecipe: Optimistic Persistence and Firestore Sync', () => {
    it('validates required fields before saving', async () => {
      // Missing title
      await expect(
        saveRecipe({ ingredients: ['salt'], instructions: ['mix'] }, testUser, testHouseholdId)
      ).rejects.toThrow(/title/i);

      // Missing ingredients
      await expect(
        saveRecipe({ title: 'Soup', ingredients: [], instructions: ['boil'] }, testUser, testHouseholdId)
      ).rejects.toThrow(/ingredient/i);

      // Missing instructions
      await expect(
        saveRecipe({ title: 'Soup', ingredients: ['water'], instructions: [] }, testUser, testHouseholdId)
      ).rejects.toThrow(/instruction/i);
    });

    it('optimistically saves a new recipe to local cache and persists to Firestore', async () => {
      const newRecipeData = {
        title: 'Spicy Garlic Noodles',
        ingredients: ['noodles', 'garlic', 'chili oil', 'soy sauce'],
        instructions: ['Boil noodles', 'Sauté garlic in oil', 'Toss with sauce'],
        category: 'Dinner' as const,
        estimatedTime: 15,
        isStaple: false
      };

      const saved = await saveRecipe(newRecipeData, testUser, testHouseholdId);

      expect(saved.id).toBeTruthy();
      expect(saved.title).toBe('Spicy Garlic Noodles');
      expect(saved.authorId).toBe(testUser.uid);
      expect(saved.householdId).toBe(testHouseholdId);

      // Check local cache immediately contains the new recipe
      const cached = getCachedRecipes(testHouseholdId);
      expect(cached.length).toBe(1);
      expect(cached[0].title).toBe('Spicy Garlic Noodles');

      // Check setDoc was called with cleaned data
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('updates an existing recipe in cache and Firestore', async () => {
      setCachedRecipes(testHouseholdId, [sampleRecipe]);

      const updated = await saveRecipe(
        {
          id: 'rec_101',
          title: 'Lemon Herb Roast Chicken (Extra Crispy)',
          rating: 4,
          ingredients: sampleRecipe.ingredients,
          instructions: sampleRecipe.instructions
        },
        testUser,
        testHouseholdId
      );

      expect(updated.title).toBe('Lemon Herb Roast Chicken (Extra Crispy)');
      expect(updated.rating).toBe(4);

      // Cache is updated
      const cached = getCachedRecipes(testHouseholdId);
      expect(cached.length).toBe(1);
      expect(cached[0].title).toBe('Lemon Herb Roast Chicken (Extra Crispy)');

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteRecipe: Optimistic Removal and Sync', () => {
    it('removes recipe from local cache immediately and calls deleteDoc', async () => {
      setCachedRecipes(testHouseholdId, [sampleRecipe]);
      expect(getCachedRecipes(testHouseholdId).length).toBe(1);

      await deleteRecipe('rec_101', testHouseholdId);

      expect(getCachedRecipes(testHouseholdId).length).toBe(0);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleRecipeStaple', () => {
    it('updates staple status in cache immediately and syncs to Firestore', async () => {
      setCachedRecipes(testHouseholdId, [sampleRecipe]);

      const nextStaple = await toggleRecipeStaple('rec_101', testHouseholdId, true);
      expect(nextStaple).toBe(false);

      const cached = getCachedRecipes(testHouseholdId);
      expect(cached[0].isStaple).toBe(false);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveStockRecipes', () => {
    it('batches stock recipes into local cache and commits to Firestore', async () => {
      const stockList = [
        {
          title: 'Classic Smash Burger',
          ingredients: ['ground beef', 'buns', 'cheese'],
          instructions: ['Smash patties', 'Flip and melt cheese', 'Serve'],
          category: 'Dinner' as const
        },
        {
          title: 'Avocado Toast',
          ingredients: ['sourdough', 'avocado', 'salt', 'pepper'],
          instructions: ['Toast bread', 'Mash avocado on top'],
          category: 'Breakfast' as const
        }
      ];

      const count = await saveStockRecipes(stockList, testUser, testHouseholdId);
      expect(count).toBe(2);

      const cached = getCachedRecipes(testHouseholdId);
      expect(cached.length).toBe(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToRecipes', () => {
    it('immediately delivers cached recipes to the listener with zero latency on refresh', () => {
      setCachedRecipes(testHouseholdId, [sampleRecipe]);

      const onUpdate = vi.fn();
      const unsubscribe = subscribeToRecipes(testHouseholdId, onUpdate);

      // Instant delivery before any network request
      expect(onUpdate).toHaveBeenCalledTimes(1);
      const firstCallArg = onUpdate.mock.calls[0][0];
      expect(firstCallArg.length).toBe(1);
      expect(firstCallArg[0].id).toBe('rec_101');
      expect(firstCallArg[0].title).toBe('Lemon Herb Roast Chicken');
      expect(firstCallArg[0].createdAt.toMillis()).toBe(1700000000000);

      // When Firestore onSnapshot emits updated data
      const remoteRecipe = { ...sampleRecipe, title: 'Updated from Cloud' };
      mockSnapshotCallback({
        docs: [
          {
            id: remoteRecipe.id,
            data: () => remoteRecipe
          }
        ]
      });

      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenLastCalledWith([remoteRecipe]);

      // Local cache should also be updated with new remote data
      const updatedCache = getCachedRecipes(testHouseholdId);
      expect(updatedCache[0].title).toBe('Updated from Cloud');

      unsubscribe();
    });

    it('does not overwrite existing cache if Firestore returns an offline error', () => {
      setCachedRecipes(testHouseholdId, [sampleRecipe]);

      const onUpdate = vi.fn();
      const onError = vi.fn();
      const unsubscribe = subscribeToRecipes(testHouseholdId, onUpdate, onError);

      expect(onUpdate).toHaveBeenCalledTimes(1);

      // Simulate Firestore error
      mockSnapshotErrorCallback(new Error('client is offline'));
      expect(onError).toHaveBeenCalledTimes(1);

      // Cached recipes must still remain safe in cache
      expect(getCachedRecipes(testHouseholdId).length).toBe(1);

      unsubscribe();
    });
  });
});
