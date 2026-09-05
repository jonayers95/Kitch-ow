import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmartGroceryListModal } from '../components/SmartGroceryListModal';
import { MealPlan, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('SmartGroceryListModal Component', () => {
  const mockRecipes: Recipe[] = [
    {
      id: 'rec_1',
      title: 'Garlic Butter Salmon',
      ingredients: ['2 salmon fillets', '2 tbsp butter', '3 cloves garlic, minced'],
      instructions: ['Sear salmon in butter with garlic.'],
      category: 'Dinner',
      authorId: 'user_1',
      householdId: 'hh_1',
      createdAt: Timestamp.now(),
    },
  ];

  const mockMealPlan: MealPlan = {
    id: 'mp_1',
    householdId: 'hh_1',
    weekStartDate: '2026-08-31',
    authorId: 'user_1',
    days: {
      '2026-08-31': [
        {
          id: 'slot_1',
          mealType: 'Dinner',
          recipeId: 'rec_1',
        },
      ],
    },
  };

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <SmartGroceryListModal
        isOpen={false}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={mockRecipes}
        weekRangeLabel="Aug 31 - Sep 6"
        weekStartDateKey="2026-08-31"
        householdId="hh_1"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content and ingredients when open', () => {
    render(
      <SmartGroceryListModal
        isOpen={true}
        onClose={vi.fn()}
        mealPlan={mockMealPlan}
        recipes={mockRecipes}
        weekRangeLabel="Aug 31 - Sep 6"
        weekStartDateKey="2026-08-31"
        householdId="hh_1"
      />
    );

    expect(screen.getByText(/Commit Ingredients|Smart Grocery List/i)).toBeDefined();
    expect(screen.getByText(/Aug 31 - Sep 6/i)).toBeDefined();
  });
});
