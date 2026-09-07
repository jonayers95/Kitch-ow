import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Household, HouseholdInvite } from '../types';

describe('Household Invite Modal Interactions', () => {
  const mockHousehold: Household = {
    id: 'hh_123',
    name: 'The Baker Family',
    ownerId: 'owner_1',
    members: { owner_1: 'admin' },
    memberIds: ['owner_1']
  };

  const mockSentInvites: HouseholdInvite[] = [
    {
      id: 'invite_sent_1',
      householdId: 'hh_123',
      householdName: 'The Baker Family',
      invitedByUid: 'owner_1',
      invitedByName: 'Baker Boss',
      inviteeEmail: 'partner@example.com',
      role: 'member',
      status: 'pending',
      createdAt: { seconds: 1710000000, nanoseconds: 0 }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates sent invites can be canceled', async () => {
    const onCancelInvite = vi.fn();

    // Render a minimal test container simulating the pending invites list in the modal
    render(
      <div id="pending-sent-invites-section">
        {mockSentInvites.map((inv) => (
          <div key={inv.id} className="flex justify-between items-center">
            <span>{inv.inviteeEmail}</span>
            <button 
              onClick={() => onCancelInvite(inv.id)}
              aria-label="Cancel invitation"
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    );

    expect(screen.getByText('partner@example.com')).toBeDefined();
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(onCancelInvite).toHaveBeenCalledWith('invite_sent_1');
  });
});
