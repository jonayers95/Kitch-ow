import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HouseholdInvitesBanner } from '../components/HouseholdInvitesBanner';
import { HouseholdInvite } from '../types';

describe('Household Invites Banner & UI Component', () => {
  const mockInvites: HouseholdInvite[] = [
    {
      id: 'invite_1',
      householdId: 'hh_1',
      householdName: 'Grandma’s Recipe Vault',
      invitedByUid: 'user_grandma',
      invitedByName: 'Grandma Rose',
      invitedByEmail: 'grandma@example.com',
      inviteeEmail: 'chef@example.com',
      role: 'member',
      status: 'pending',
      createdAt: { seconds: 1710000000, nanoseconds: 0 }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no pending invites', () => {
    const { container } = render(
      <HouseholdInvitesBanner
        invites={[]}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays the household name, inviter name, and role for pending invites', () => {
    render(
      <HouseholdInvitesBanner
        invites={mockInvites}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText(/Grandma’s Recipe Vault/i)).toBeDefined();
    expect(screen.getByText(/Grandma Rose/i)).toBeDefined();
    expect(screen.getByText(/member/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Join Kitchen|Join/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Decline/i })).toBeDefined();
  });

  it('calls onAccept when the user clicks Join Kitchen', () => {
    const handleAccept = vi.fn();
    render(
      <HouseholdInvitesBanner
        invites={mockInvites}
        onAccept={handleAccept}
        onReject={vi.fn()}
      />
    );

    const joinBtn = screen.getByRole('button', { name: /Join Kitchen|Join/i });
    fireEvent.click(joinBtn);

    expect(handleAccept).toHaveBeenCalledWith(mockInvites[0]);
  });

  it('calls onReject when the user clicks Decline', () => {
    const handleReject = vi.fn();
    render(
      <HouseholdInvitesBanner
        invites={mockInvites}
        onAccept={vi.fn()}
        onReject={handleReject}
      />
    );

    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);

    expect(handleReject).toHaveBeenCalledWith(mockInvites[0]);
  });

  it('disables buttons when an action is processing', () => {
    render(
      <HouseholdInvitesBanner
        invites={mockInvites}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isProcessingId="invite_1"
      />
    );

    const joinBtn = screen.getByRole('button', { name: /Joining|Join/i });
    const declineBtn = screen.getByRole('button', { name: /Decline/i });

    expect((joinBtn as HTMLButtonElement).disabled).toBe(true);
    expect((declineBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
