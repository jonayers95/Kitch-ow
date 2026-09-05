import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { KitchenDietaryProfileModal } from '../components/KitchenDietaryProfileModal';
import { Household, HouseholdKitchenProfile } from '../types';

const mockHousehold: Household = {
  id: 'hh_test_123',
  name: 'Test Kitchen Household',
  ownerId: 'user_123',
  members: { user_123: 'admin' },
  kitchenProfile: {
    appliances: ['Air Fryer', 'Instant Pot / Pressure Cooker'],
    dietaryRestrictions: ['Gluten-Free'],
    dislikedIngredients: ['Mushrooms'],
    defaultServings: 4,
    diningOutBalance: 'busy_nights',
    suggestDiningOutOnBusy: true,
  }
};

describe('Household Profile Saving & Reliability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets loading state and displays error notification if save fails rather than hanging indefinitely', async () => {
    const rejectedSave = vi.fn().mockRejectedValue(new Error('Network error writing to database'));

    render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={rejectedSave}
        initialTab="dietary"
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save All Settings|Save/i });
    fireEvent.click(saveButton);

    // Wait for the async rejection
    await waitFor(() => {
      expect(rejectedSave).toHaveBeenCalled();
    });

    // The loading spinner should not persist and an error banner/toast should be displayed
    await waitFor(() => {
      expect(screen.queryByText(/Saving Profile\.\.\./i)).toBeNull();
      expect(screen.getByText(/Network error writing to database|Failed to save profile/i)).toBeDefined();
    });

    // Button should be re-enabled
    const reEnabledSaveButton = screen.getByRole('button', { name: /Save All Settings|Save/i });
    expect(reEnabledSaveButton).toBeDefined();
    expect((reEnabledSaveButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('resets isSaving to false when modal reopens even if previously interrupted', async () => {
    const { rerender } = render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn().mockImplementation(() => new Promise(() => {}))} // Never resolves
        initialTab="dietary"
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Save All Settings|Save/i });
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Saving Profile\.\.\./i)).toBeDefined();

    // Modal closes
    rerender(
      <KitchenDietaryProfileModal
        isOpen={false}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="dietary"
      />
    );

    // Modal reopens
    rerender(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="dietary"
      />
    );

    // Should NOT be stuck in saving state
    expect(screen.queryByText(/Saving Profile\.\.\./i)).toBeNull();
    expect(screen.getByRole('button', { name: /Save All Settings/i })).toBeDefined();
  });

  it('handles successful save with immediate feedback and clean close', async () => {
    const onCloseSpy = vi.fn();
    const onSaveSpy = vi.fn().mockResolvedValue(undefined);

    render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={onCloseSpy}
        household={mockHousehold}
        onSaveProfile={onSaveSpy}
        initialTab="dietary"
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Save All Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaveSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled();
    }, { timeout: 2500 });
  });
});
