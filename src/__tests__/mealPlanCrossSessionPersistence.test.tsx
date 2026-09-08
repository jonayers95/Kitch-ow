import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeeklyMealPlan } from '../components/WeeklyMealPlan';
import { Household, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';
import { setCachedMealPlan, getCachedMealPlan } from '../services/mealPlanService';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123' } }
}));

let mockFirestoreStore: Record<string, any> = {};

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, _coll, id) => ({ id })),
    onSnapshot: vi.fn((ref, callback) => {
      const docId = ref.id;
      const data = mockFirestoreStore[docId];
      if (data) {
        callback({
          exists: () => true,
          id: docId,
          data: () => data
        });
      } else {
        callback({
          exists: () => false,
          id: docId,
          data: () => ({})
        });
      }
      return () => {};
    }),
    setDoc: vi.fn(async (ref, data, _options) => {
      mockFirestoreStore[ref.id] = data;
    }),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(async (ref) => ({
      exists: () => !!mockFirestoreStore[ref.id],
      data: () => mockFirestoreStore[ref.id] || {}
    })),
    serverTimestamp: () => ({})
  };
});

describe('WeeklyMealPlan Cross-Session Persistence & Refresh Durability', () => {
  const mockHousehold: Household = {
    id: 'hh_persist_123',
    name: 'Durability Kitchen',
    ownerId: 'user_123',
    members: { user_123: 'admin' },
    createdAt: Timestamp.now()
  };

  const mockRecipes: Recipe[] = [
    {
      id: 'rec_pasta',
      title: 'Creamy Mushroom Pasta',
      category: 'Dinner',
      ingredients: ['Pasta', 'Mushrooms'],
      instructions: ['Cook'],
      authorId: 'user_123',
      householdId: 'hh_persist_123',
      createdAt: Timestamp.now()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockFirestoreStore = {};
  });

  it('restores planned meals immediately upon re-mounting (simulated page refresh)', async () => {
    // 1. Initial mount
    const { unmount } = render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // 2. Add meal to Monday
    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Select Creamy Mushroom Pasta
    const pastaOption = screen.getByText('Creamy Mushroom Pasta');
    fireEvent.click(pastaOption);

    // Click "Add to Meal Plan"
    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    // Verify modal closes and meal is rendered
    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });
    expect(screen.getByText('Creamy Mushroom Pasta')).toBeDefined();

    // 3. Simulate page refresh: unmount component
    unmount();

    // 4. Re-mount component (simulate new session / refreshed page)
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // The planned meal MUST remain part of the plan across session refresh!
    await waitFor(() => {
      expect(screen.getByText('Creamy Mushroom Pasta')).toBeDefined();
    });
  });

  it('removes meal when user explicitly deletes it and stays removed across refresh', async () => {
    const { unmount } = render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Add meal
    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);
    fireEvent.click(screen.getByText('Creamy Mushroom Pasta'));
    fireEvent.click(screen.getByRole('button', { name: /Add to Meal Plan/i }));

    await waitFor(() => {
      expect(screen.getByText('Creamy Mushroom Pasta')).toBeDefined();
    });

    // Delete meal
    const deleteBtn = screen.getByTitle(/Remove from meal plan/i);
    fireEvent.click(deleteBtn);

    // Meal is gone
    await waitFor(() => {
      expect(screen.queryByText('Creamy Mushroom Pasta')).toBeNull();
    });

    // Re-mount (refresh)
    unmount();
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Confirms it stays removed
    expect(screen.queryByText('Creamy Mushroom Pasta')).toBeNull();
  });
});
