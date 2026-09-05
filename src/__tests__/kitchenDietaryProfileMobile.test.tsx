import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { KitchenDietaryProfileModal } from '../components/KitchenDietaryProfileModal';
import { Household } from '../types';

const mockHousehold: Household = {
  id: 'hh_test_mobile',
  name: 'Mobile Kitchen Household',
  ownerId: 'user_mobile',
  members: { user_mobile: 'admin' },
  kitchenProfile: {
    appliances: ['Air Fryer', 'Instant Pot / Pressure Cooker'],
    dietaryRestrictions: ['Gluten-Free', 'Vegetarian'],
    dislikedIngredients: ['Mushrooms'],
    defaultServings: 4,
    diningOutBalance: 'busy_nights',
    suggestDiningOutOnBusy: true,
  }
};

describe('KitchenDietaryProfileModal - Mobile Responsive Optimization', () => {
  it('uses full mobile viewport height and zero outer margin on mobile to maximize visible space', () => {
    const { container } = render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="appliances"
      />
    );

    // The modal backdrop wrapper should avoid large fixed outer padding on mobile
    const backdrop = container.querySelector('[data-testid="kitchen-profile-backdrop"]');
    expect(backdrop).not.toBeNull();
    // Should have p-0 or sm:p-6 responsive padding to not waste screen edges on mobile
    expect(backdrop?.className).toContain('p-0');
    expect(backdrop?.className).toContain('sm:p-6');

    // The modal dialog container should use mobile viewport height
    const dialog = container.querySelector('[data-testid="kitchen-profile-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toMatch(/h-\[100dvh\]|h-full/);
    expect(dialog?.className).toContain('sm:max-h-[90vh]');
  });

  it('renders a mobile-friendly horizontal scrollable tab strip instead of multi-row stacked grid', () => {
    const { container } = render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="dietary"
      />
    );

    const tabStrip = container.querySelector('[data-testid="kitchen-profile-tabstrip"]');
    expect(tabStrip).not.toBeNull();
    // On mobile it should be a horizontal flex with overflow-x-auto, not grid-cols-2 wrapping 3 rows
    expect(tabStrip?.className).toContain('overflow-x-auto');
    expect(tabStrip?.className).toContain('flex');
    expect(tabStrip?.className).toContain('sm:grid');
  });

  it('renders appliance and dietary option cards in a 2-column mobile grid so multiple options are visible', () => {
    const { container, rerender } = render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="appliances"
      />
    );

    // Appliances grid should use grid-cols-2 on mobile instead of grid-cols-1
    const appliancesGrid = container.querySelector('[data-testid="appliances-options-grid"]');
    expect(appliancesGrid).not.toBeNull();
    expect(appliancesGrid?.className).toContain('grid-cols-2');

    // Dietary grid should also use grid-cols-2 on mobile instead of grid-cols-1
    rerender(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="dietary"
      />
    );
    const dietaryGrid = container.querySelector('[data-testid="dietary-options-grid"]');
    expect(dietaryGrid).not.toBeNull();
    expect(dietaryGrid?.className).toContain('grid-cols-2');
  });

  it('optimizes content scroll area with compact mobile padding so options have ample room', () => {
    const { container } = render(
      <KitchenDietaryProfileModal
        isOpen={true}
        onClose={vi.fn()}
        household={mockHousehold}
        onSaveProfile={vi.fn()}
        initialTab="appliances"
      />
    );

    const contentArea = container.querySelector('[data-testid="kitchen-profile-content"]');
    expect(contentArea).not.toBeNull();
    // Should have compact padding on mobile like p-3 or p-3.5, and sm:p-6 on desktop
    expect(contentArea?.className).toMatch(/p-3|p-3\.5/);
    expect(contentArea?.className).toContain('sm:p-6');
  });
});
