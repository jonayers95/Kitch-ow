import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeeklyMealPlan } from '../components/WeeklyMealPlan';
import { Household, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_delete_test' } }
}));

let mockFirestoreDocs: Record<string, any> = {};

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, _coll, id) => ({ id })),
    onSnapshot: vi.fn((ref, callback) => {
      const docId = ref.id;
      const data = mockFirestoreDocs[docId];
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
    setDoc: vi.fn(async (ref, data) => {
      mockFirestoreDocs[ref.id] = data;
    }),
    getDoc: vi.fn(async (ref) => ({
      exists: () => !!mockFirestoreDocs[ref.id],
      data: () => mockFirestoreDocs[ref.id] || {}
    })),
    serverTimestamp: () => ({})
  };
});

describe('WeeklyMealPlan Delete Button Interaction', () => {
  const mockHousehold: Household = {
    id: 'hh_ui_del_1',
    name: 'Test Kitchen',
    ownerId: 'user_delete_test',
    members: { user_delete_test: 'admin' },
    createdAt: Timestamp.now()
  };

  const mockRecipes: Recipe[] = [
    {
      id: 'rec_pizza_123',
      title: 'Artisan Margherita Pizza',
      category: 'Dinner',
      ingredients: ['Flour', 'Tomatoes', 'Mozzarella'],
      instructions: ['Bake'],
      authorId: 'user_delete_test',
      householdId: 'hh_ui_del_1',
      createdAt: Timestamp.now()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFirestoreDocs = {};
  });

  it('removes meal slot when delete button on slot is clicked and keeps it removed', async () => {
    const { unmount } = render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_delete_test"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // 1. Add meal to Monday
    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Choose the pizza recipe
    fireEvent.click(screen.getByText('Artisan Margherita Pizza'));
    fireEvent.click(screen.getByRole('button', { name: /Add to Meal Plan/i }));

    await waitFor(() => {
      expect(screen.getByText('Artisan Margherita Pizza')).toBeDefined();
    });

    // 2. Locate delete button by aria-label or title
    const deleteBtn = screen.getByLabelText(/Delete meal from plan/i);
    expect(deleteBtn).toBeDefined();

    // Click delete
    fireEvent.click(deleteBtn);

    // 3. Verify meal is removed
    await waitFor(() => {
      expect(screen.queryByText('Artisan Margherita Pizza')).toBeNull();
    });

    // 4. Re-mount component (simulate session reload)
    unmount();
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_delete_test"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Verify it is still removed
    expect(screen.queryByText('Artisan Margherita Pizza')).toBeNull();
  });
});
