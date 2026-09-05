import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeeklyMealPlan } from '../components/WeeklyMealPlan';
import { Household, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123' } }
}));

const mockSetDoc = vi.fn().mockImplementation(() => Promise.resolve());

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn(),
    onSnapshot: vi.fn((_, callback) => {
      callback({
        exists: () => true,
        data: () => ({
          days: {
            '2026-08-31': [
              {
                id: 'slot_1',
                mealType: 'Dinner',
                recipeId: 'rec_1',
                isDone: false
              }
            ]
          }
        })
      });
      return () => {};
    }),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
    serverTimestamp: () => ({})
  };
});

describe('Add Meal Modal Close Behavior', () => {
  const mockHousehold: Household = {
    id: 'hh_123',
    name: 'Smith Family Kitchen',
    ownerId: 'user_123',
    members: { user_123: 'admin' },
    createdAt: Timestamp.now()
  };

  const mockRecipes: Recipe[] = [
    {
      id: 'rec_1',
      title: 'Tacos Al Pastor',
      category: 'Dinner',
      ingredients: ['Tortillas', 'Pork', 'Pineapple'],
      instructions: ['Grill meat', 'Assemble tacos'],
      authorId: 'user_123',
      householdId: 'hh_123',
      createdAt: Timestamp.now()
    },
    {
      id: 'rec_2',
      title: 'Creamy Mushroom Pasta',
      category: 'Dinner',
      ingredients: ['Pasta', 'Mushrooms', 'Cream'],
      instructions: ['Boil pasta', 'Make sauce'],
      authorId: 'user_123',
      householdId: 'hh_123',
      createdAt: Timestamp.now()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockImplementation(() => Promise.resolve());
  });

  it('does NOT close when selecting or double-clicking a recipe, but selects it', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    expect(screen.getByText('Plan a Meal')).toBeDefined();

    // Click recipe - modal must STAY open
    const pastaOption = screen.getByText('Creamy Mushroom Pasta');
    fireEvent.click(pastaOption);
    expect(screen.getByText('Plan a Meal')).toBeDefined();

    // Double click recipe - modal must STAY open
    fireEvent.doubleClick(pastaOption);
    expect(screen.getByText('Plan a Meal')).toBeDefined();

    // The modal must not close before clicking Add to Meal Plan
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does NOT close when typing or pressing Enter in search box', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    const searchInput = screen.getByPlaceholderText(/Search your recipes/i);
    fireEvent.change(searchInput, { target: { value: 'pasta' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // Modal must still be open
    expect(screen.getByText('Plan a Meal')).toBeDefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('closes when user hits "Add to Meal Plan" and the meal has been added', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Select a recipe
    const pastaOption = screen.getByText('Creamy Mushroom Pasta');
    fireEvent.click(pastaOption);

    // Hit "Add to Meal Plan" button
    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    // setDoc should be called to add the meal
    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalled();
    });

    // The modal closes after hitting Add to Meal Plan and meal added
    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });
  });

  it('closes when user adds a custom meal by hitting "Add to Meal Plan"', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Switch to Custom tab
    const customTabBtn = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTabBtn);

    const input = screen.getByPlaceholderText(/Leftover Roast Chicken/i);
    fireEvent.change(input, { target: { value: 'Homemade Pizza Night' } });

    // Hit "Add to Meal Plan" button
    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });
  });
});
