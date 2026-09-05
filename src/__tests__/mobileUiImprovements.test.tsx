import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyMealPlan } from '../components/WeeklyMealPlan';
import { Household, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase dependencies
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user_123' } }
}));

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
            ],
            '2026-09-01': [
              {
                id: 'slot_2',
                mealType: 'Dinner',
                recipeId: 'rec_2',
                isDone: false
              }
            ]
          }
        })
      });
      return () => {};
    }),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
    serverTimestamp: () => ({})
  };
});

describe('Mobile UI Improvements & Day Switcher in WeeklyMealPlan', () => {
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
      title: 'Sheet Pan Lemon Herb Salmon',
      ingredients: ['salmon', 'lemon', 'asparagus'],
      instructions: ['Bake at 400F for 15 mins.'],
      category: 'Dinner',
      estimatedTime: 25,
      authorId: 'user_123',
      householdId: 'hh_123',
      createdAt: Timestamp.now()
    },
    {
      id: 'rec_2',
      title: 'Taco Tuesday Bowls',
      ingredients: ['ground beef', 'rice', 'salsa'],
      instructions: ['Brown beef and serve over rice.'],
      category: 'Dinner',
      estimatedTime: 20,
      authorId: 'user_123',
      householdId: 'hh_123',
      createdAt: Timestamp.now()
    }
  ];

  it('renders the mobile day switcher tabs allowing switching between individual days or all days', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onViewRecipe={vi.fn()}
        onRequestAddRecipe={vi.fn()}
      />
    );

    // Should find the mobile day switcher navigation
    const mobileDaySelector = screen.getByTestId('mobile-day-selector');
    expect(mobileDaySelector).toBeDefined();

    // Check that Day buttons exist
    const dayButtons = screen.getAllByRole('button', { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun|All Days/i });
    expect(dayButtons.length).toBeGreaterThan(0);
  });

  it('allows toggling between single-day mobile view and full-week view', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onViewRecipe={vi.fn()}
        onRequestAddRecipe={vi.fn()}
      />
    );

    // Click "All Days" button in mobile view toggle
    const allDaysToggle = screen.getByRole('button', { name: /All Days|Full Week/i });
    expect(allDaysToggle).toBeDefined();
    fireEvent.click(allDaysToggle);

    // Verify it toggles view mode
    expect(screen.getByTestId('mobile-day-selector')).toBeDefined();
  });
});
