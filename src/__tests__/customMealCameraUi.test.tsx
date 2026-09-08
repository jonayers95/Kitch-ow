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
            '2026-09-08': [
              {
                id: 'slot_with_photo',
                mealType: 'Dinner',
                customTitle: 'Seared Steak with Herbs',
                imageUrl: 'data:image/jpeg;base64,mockphoto123',
                imageCapturedAt: '2026-09-08T10:00:00.000Z',
                imageExpiresAt: '2026-10-08T10:00:00.000Z',
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

describe('WeeklyMealPlan Custom Entry with Camera Photo', () => {
  const mockHousehold: Household = {
    id: 'hh_123',
    name: 'Test Kitchen',
    ownerId: 'user_123',
    members: { user_123: 'admin' },
    createdAt: Timestamp.now()
  };

  const mockRecipes: Recipe[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders photo thumbnail for custom meal slot that includes an image', () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Slot title should be present
    expect(screen.getByText('Seared Steak with Herbs')).toBeDefined();

    // The image thumbnail should be rendered
    const imageThumb = screen.getByAltText('Seared Steak with Herbs');
    expect(imageThumb).toBeDefined();
    expect(imageThumb.getAttribute('src')).toBe('data:image/jpeg;base64,mockphoto123');
  });

  it('provides camera capture options in Custom Meal tab with 30-day retention note', async () => {
    render(
      <WeeklyMealPlan
        household={mockHousehold}
        recipes={mockRecipes}
        currentUserId="user_123"
        onRequestAddRecipe={vi.fn()}
        onViewRecipe={vi.fn()}
      />
    );

    // Click "+ Add Meal"
    const addButtons = screen.getAllByRole('button', { name: /Add Meal/i });
    fireEvent.click(addButtons[0]);

    // Switch to Custom tab
    const customTabBtn = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTabBtn);

    // Verify camera capture trigger button exists
    const cameraTrigger = screen.getByRole('button', { name: /Take Photo with Camera/i });
    expect(cameraTrigger).toBeDefined();

    // Verify 30-day retention notice is present
    const retentionNotices = screen.getAllByText(/30 days/i);
    expect(retentionNotices.length).toBeGreaterThan(0);
  });
});
