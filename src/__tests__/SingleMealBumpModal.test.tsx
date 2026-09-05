import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SingleMealBumpModal } from '../components/SingleMealBumpModal';
import { MealSlot, Recipe } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('SingleMealBumpModal Component', () => {
  const mockRecipe: Recipe = {
    id: 'rec_10',
    title: 'Creamy Tuscan Chicken',
    ingredients: ['chicken', 'spinach', 'cream'],
    instructions: ['Cook chicken and simmer sauce.'],
    category: 'Dinner',
    authorId: 'user_1',
    householdId: 'hh_1',
    createdAt: Timestamp.now(),
  };

  const mockSlot: MealSlot = {
    id: 'slot_10',
    mealType: 'Dinner',
    recipeId: 'rec_10',
  };

  const mockWeekDays = [
    {
      dateKey: '2026-08-31',
      dayName: 'Monday',
      monthDay: 'Aug 31',
      isToday: true,
      isPast: false,
      existingSlots: [mockSlot],
    },
    {
      dateKey: '2026-09-01',
      dayName: 'Tuesday',
      monthDay: 'Sep 1',
      isToday: false,
      isPast: false,
      existingSlots: [],
    },
  ];

  it('renders null when closed', () => {
    const { container } = render(
      <SingleMealBumpModal
        isOpen={false}
        onClose={vi.fn()}
        sourceDateKey="2026-08-31"
        slot={mockSlot}
        recipe={mockRecipe}
        weekDays={mockWeekDays}
        onBumpMeal={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders bump options when open', () => {
    render(
      <SingleMealBumpModal
        isOpen={true}
        onClose={vi.fn()}
        sourceDateKey="2026-08-31"
        slot={mockSlot}
        recipe={mockRecipe}
        weekDays={mockWeekDays}
        onBumpMeal={vi.fn()}
      />
    );

    expect(screen.getByText(/Reschedule Meal/i)).toBeDefined();
    expect(screen.getByText(/Creamy Tuscan Chicken/i)).toBeDefined();
  });
});
