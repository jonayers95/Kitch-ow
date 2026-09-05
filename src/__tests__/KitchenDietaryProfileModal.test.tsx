import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KitchenDietaryProfileModal } from '../components/KitchenDietaryProfileModal';
import { Household } from '../types';

const mockHousehold: Household = {
  id: 'hh_test_1',
  name: 'Ayers Household',
  ownerId: 'user_1',
  members: { user_1: 'admin' },
  kitchenProfile: {
    appliances: ['Air Fryer'],
    dietaryRestrictions: [],
    dislikedIngredients: [],
    defaultServings: 4,
    diningOutBalance: 'always_cook',
    suggestDiningOutOnBusy: false,
  }
};

describe('KitchenDietaryProfileModal Component - Dining & Takeout Balance Tab', () => {
  it('renders the Dining & Takeout tab and displays balance mode options', () => {
    render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="dining"
      />
    );

    expect(screen.getByText(/Dining Out & Takeout Balance/i)).toBeDefined();
    expect(screen.getByText(/Suggest dining out if the week is too busy/i)).toBeDefined();
    expect(screen.getByText(/Always Cook at Home/i)).toBeDefined();
    expect(screen.getByText(/Weekly Balanced Rhythm/i)).toBeDefined();
  });

  it('allows switching balance mode to busy nights auto-relief and saving profile', async () => {
    const onSaveSpy = vi.fn().mockResolvedValue(undefined);

    render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={onSaveSpy}
        initialTab="dining"
      />
    );

    const busyNightsOption = screen.getByText(/Suggest dining out if the week is too busy/i);
    fireEvent.click(busyNightsOption);

    const saveButton = screen.getByRole('button', { name: /Save All Settings|Save/i });
    fireEvent.click(saveButton);

    expect(onSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        diningOutBalance: 'busy_nights',
        suggestDiningOutOnBusy: true,
      })
    );
  });
});
