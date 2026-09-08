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

let pendingSetDocResolve: () => void;
const mockSetDoc = vi.fn().mockImplementation(() => {
  return new Promise<void>((resolve) => {
    pendingSetDocResolve = resolve;
  });
});

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

describe('Optimistic Meal Plan Add (Instant UI Response)', () => {
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
  });

  it('immediately closes modal and optimistically renders the new meal without waiting for setDoc network resolution', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Click Add Meal on Monday
    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Verify modal is open
    expect(screen.getByText('Plan a Meal')).toBeDefined();

    // Select Creamy Mushroom Pasta
    const pastaOption = screen.getByText('Creamy Mushroom Pasta');
    fireEvent.click(pastaOption);

    // Click "Add to Meal Plan" button
    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    // CRITICAL: The modal must close without waiting for mockSetDoc to resolve!
    // Because setIsAddMealModalOpen(false) was triggered immediately,
    // the modal unmounts even though mockSetDoc is still a pending promise.
    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });

    // And the meal must be optimistically visible in the weekly plan immediately!
    expect(screen.getByText('Creamy Mushroom Pasta')).toBeDefined();

    // Clean up pending promise
    if (pendingSetDocResolve) pendingSetDocResolve();
  });

  it('immediately closes modal and renders custom meal with 0 latency', async () => {
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

    // Switch to custom tab
    const customTabBtn = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTabBtn);

    const titleInput = screen.getByPlaceholderText(/Leftover Roast Chicken/i);
    fireEvent.change(titleInput, { target: { value: 'Quick Avocado Toast' } });

    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    // Modal closes immediately without waiting for setDoc
    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });

    // Optimistically rendered
    expect(screen.getByText('Quick Avocado Toast')).toBeDefined();

    if (pendingSetDocResolve) pendingSetDocResolve();
  });

  it('rolls back optimistic state and shows error toast if save fails', async () => {
    mockSetDoc.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

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

    const customTabBtn = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTabBtn);

    const titleInput = screen.getByPlaceholderText(/Leftover Roast Chicken/i);
    fireEvent.change(titleInput, { target: { value: 'Failing Dish' } });

    const submitBtn = screen.getByRole('button', { name: /Add to Meal Plan/i });
    fireEvent.click(submitBtn);

    // Modal closes immediately
    await waitFor(() => {
      expect(screen.queryByText('Plan a Meal')).toBeNull();
    });

    // Feedback toast displays error
    await waitFor(() => {
      expect(screen.getByText(/Could not save meal/i)).toBeDefined();
    });

    // Optimistic item was rolled back
    expect(screen.queryByText('Failing Dish')).toBeNull();
  });
});
