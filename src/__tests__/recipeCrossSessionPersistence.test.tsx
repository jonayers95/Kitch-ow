import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyMealPlan } from '../components/WeeklyMealPlan';
import { Household, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';
import { 
  getCachedRecipes, 
  setCachedRecipes, 
  saveRecipe, 
  deleteRecipe, 
  toggleRecipeStaple 
} from '../services/recipeService';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123' } }
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

let mockDocCount = 0;

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ coll, id: id || `doc_mock_${++mockDocCount}` })),
    collection: vi.fn((_db, coll) => ({ coll })),
    query: vi.fn((coll) => ({ coll })),
    where: vi.fn(() => ({})),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    onSnapshot: vi.fn(() => () => {}),
    serverTimestamp: () => ({})
  };
});

describe('Recipe Cross-Session Persistence & Refresh Hydration', () => {
  const householdId = 'hh_persisting_kitchen';
  const testUser = { uid: 'user_123' };
  const mockHousehold: Household = {
    id: householdId,
    name: 'Persistent Kitchen',
    ownerId: 'user_123',
    members: { user_123: 'admin' },
    createdAt: Timestamp.now()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('restores recipes immediately from local cache upon re-render simulating page refresh', async () => {
    // 1. Initial save of recipe
    const saved = await saveRecipe(
      {
        title: 'Homemade Sourdough Pizza',
        ingredients: ['Flour', 'Water', 'Yeast', 'Tomato sauce', 'Mozzarella'],
        instructions: ['Ferment dough for 24h', 'Stretch dough', 'Top and bake at 500F'],
        category: 'Dinner',
        rating: 5,
        isStaple: true
      },
      testUser,
      householdId
    );

    expect(saved.id).toBeTruthy();

    // 2. Simulate refresh: read directly from getCachedRecipes
    const hydratedRecipes = getCachedRecipes(householdId);
    expect(hydratedRecipes.length).toBe(1);
    expect(hydratedRecipes[0].title).toBe('Homemade Sourdough Pizza');
    expect(hydratedRecipes[0].isStaple).toBe(true);

    // 3. Render WeeklyMealPlan with hydrated recipes
    const { unmount } = render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={hydratedRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    expect(screen.getByText(/Weekly Meal Plan/i)).toBeDefined();
    unmount();

    // 4. Simulate second mount (another browser refresh)
    const secondHydrated = getCachedRecipes(householdId);
    expect(secondHydrated.length).toBe(1);
    expect(secondHydrated[0].title).toBe('Homemade Sourdough Pizza');
  });

  it('persists recipe updates across session reloads', async () => {
    const saved = await saveRecipe(
      {
        title: 'Original Stew',
        ingredients: ['Beef', 'Carrots', 'Potatoes'],
        instructions: ['Simmer 2 hours'],
        category: 'Dinner'
      },
      testUser,
      householdId
    );

    // Update the recipe
    const updated = await saveRecipe(
      {
        ...saved,
        title: 'Upgraded Beef Stew with Rosemary',
        ingredients: ['Beef', 'Carrots', 'Potatoes', 'Fresh Rosemary', 'Red Wine']
      },
      testUser,
      householdId
    );

    expect(updated.title).toBe('Upgraded Beef Stew with Rosemary');

    // Simulate session reload
    const fromCache = getCachedRecipes(householdId);
    expect(fromCache.length).toBe(1);
    expect(fromCache[0].title).toBe('Upgraded Beef Stew with Rosemary');
    expect(fromCache[0].ingredients).toContain('Fresh Rosemary');
  });

  it('persists recipe deletion across session reloads', async () => {
    const r1 = await saveRecipe({ 
      title: 'Recipe 1',
      ingredients: ['Ing 1'],
      instructions: ['Step 1']
    }, testUser, householdId);
    const r2 = await saveRecipe({ 
      title: 'Recipe 2',
      ingredients: ['Ing 2'],
      instructions: ['Step 2']
    }, testUser, householdId);

    expect(getCachedRecipes(householdId).length).toBe(2);

    await deleteRecipe(r1.id, householdId);

    // Simulate session reload
    const fromCache = getCachedRecipes(householdId);
    expect(fromCache.length).toBe(1);
    expect(fromCache[0].title).toBe('Recipe 2');
    expect(fromCache.some(r => r.id === r1.id)).toBe(false);
  });

  it('persists staple status toggle across session reloads', async () => {
    const recipe = await saveRecipe(
      { 
        title: 'Tacos', 
        isStaple: false,
        ingredients: ['Tortillas', 'Ground Beef'],
        instructions: ['Cook beef and fill tortillas']
      },
      testUser,
      householdId
    );

    const nextStaple = await toggleRecipeStaple(recipe.id, householdId, false);
    expect(nextStaple).toBe(true);

    // Simulate session reload
    const fromCache = getCachedRecipes(householdId);
    expect(fromCache.length).toBe(1);
    expect(fromCache[0].isStaple).toBe(true);
  });
});
