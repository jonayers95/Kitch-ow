import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Household, HouseholdInvite } from '../types';

// Mock firestore functions before importing the service
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'invite_new_999' });
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] });
const mockDoc = vi.fn((...args: any[]) => ({ path: `${args[1]}/${args[2]}`, id: args[2] }));
const mockCollection = vi.fn((...args: any[]) => ({ path: args[1] }));
const mockQuery = vi.fn((...args: any[]) => ({ queryArgs: args }));
const mockWhere = vi.fn((...args: any[]) => ({ field: args[0], op: args[1], val: args[2] }));
const mockArrayUnion = vi.fn((...items: any[]) => items);
const mockServerTimestamp = vi.fn(() => ({ _seconds: 123456789, _nanoseconds: 0 }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: vi.fn(),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  setDoc: vi.fn(),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  deleteDoc: vi.fn(),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: vi.fn(),
  deleteField: vi.fn(),
  onSnapshot: vi.fn()
}));

vi.mock('../firebase', () => ({
  db: {}
}));

import { 
  validateInviteTarget,
  createInviteRecord,
  sendHouseholdInvite,
  acceptHouseholdInvite,
  rejectHouseholdInvite,
  cancelHouseholdInvite
} from '../services/householdInviteService';
import { getPersistedActiveHouseholdId } from '../services/householdService';

describe('Household Invite Service', () => {
  const mockOwnerUser: any = {
    uid: 'owner_uid_123',
    email: 'chef@example.com',
    displayName: 'Chef Jon'
  };

  const mockInviteeUser: any = {
    uid: 'invitee_uid_456',
    email: 'souschef@example.com',
    displayName: 'Sous Chef Sam'
  };

  const mockHousehold: Household = {
    id: 'household_abc',
    name: 'Ayers Family Kitchen',
    ownerId: 'owner_uid_123',
    members: {
      owner_uid_123: 'admin'
    },
    memberIds: ['owner_uid_123']
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Target Identifier Validation & Normalization', () => {
    it('correctly identifies and normalizes email addresses', () => {
      const result = validateInviteTarget('  SousChef@Example.COM  ');
      expect(result.type).toBe('email');
      expect(result.normalized).toBe('souschef@example.com');
    });

    it('identifies and trims User UIDs', () => {
      const result = validateInviteTarget('  user_xyz_789  ');
      expect(result.type).toBe('uid');
      expect(result.normalized).toBe('user_xyz_789');
    });

    it('rejects empty or whitespace-only targets', () => {
      expect(() => validateInviteTarget('')).toThrow('Please enter an email address or User ID.');
      expect(() => validateInviteTarget('   ')).toThrow('Please enter an email address or User ID.');
    });

    it('rejects invalid email formats', () => {
      expect(() => validateInviteTarget('invalid-email@')).toThrow('Please enter a valid email address.');
      expect(() => validateInviteTarget('test@nodomain')).toThrow('Please enter a valid email address.');
    });
  });

  describe('Invite Record Creation', () => {
    it('creates an invite record with pending status, normalized email, and household metadata', () => {
      const invite = createInviteRecord(
        mockHousehold,
        mockOwnerUser,
        'souschef@example.com',
        'email',
        'member'
      );

      expect(invite.householdId).toBe('household_abc');
      expect(invite.householdName).toBe('Ayers Family Kitchen');
      expect(invite.invitedByUid).toBe('owner_uid_123');
      expect(invite.invitedByName).toBe('Chef Jon');
      expect(invite.invitedByEmail).toBe('chef@example.com');
      expect(invite.inviteeEmail).toBe('souschef@example.com');
      expect(invite.inviteeUid).toBe('');
      expect(invite.role).toBe('member');
      expect(invite.status).toBe('pending');
      expect(invite.createdAt).toBeDefined();
    });

    it('creates an invite record targeted by User UID', () => {
      const invite = createInviteRecord(
        mockHousehold,
        mockOwnerUser,
        'invitee_uid_456',
        'uid',
        'admin'
      );

      expect(invite.inviteeUid).toBe('invitee_uid_456');
      expect(invite.inviteeEmail).toBe('');
      expect(invite.role).toBe('admin');
      expect(invite.status).toBe('pending');
    });
  });

  describe('Membership and Duplicate Prevention', () => {
    it('prevents inviting a user who is already a member of the household by UID', async () => {
      await expect(
        sendHouseholdInvite(mockHousehold, mockOwnerUser, 'owner_uid_123', 'member')
      ).rejects.toThrow('This user is already a member of this household.');
    });

    it('prevents owner from inviting their own email address', async () => {
      await expect(
        sendHouseholdInvite(mockHousehold, mockOwnerUser, 'chef@example.com', 'member')
      ).rejects.toThrow('You cannot invite yourself to your own household.');
    });
  });

  describe('Sending Invitations', () => {
    it('successfully creates an invitation document in Firestore and returns the record', async () => {
      const result = await sendHouseholdInvite(
        mockHousehold,
        mockOwnerUser,
        'souschef@example.com',
        'member'
      );

      expect(mockAddDoc).toHaveBeenCalled();
      expect(result.id).toBe('invite_new_999');
      expect(result.inviteeEmail).toBe('souschef@example.com');
      expect(result.status).toBe('pending');
    });
  });

  describe('Accepting Invitations', () => {
    it('marks invite as accepted, adds invitee to household members, and sets active household', async () => {
      const mockInvite: HouseholdInvite = {
        id: 'invite_123',
        householdId: 'household_abc',
        householdName: 'Ayers Family Kitchen',
        invitedByUid: 'owner_uid_123',
        role: 'member',
        status: 'pending'
      };

      await acceptHouseholdInvite(mockInvite, mockInviteeUser);

      // 1. Checks invite update
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'household_invites/invite_123' }),
        expect.objectContaining({
          status: 'accepted',
          inviteeUid: 'invitee_uid_456'
        })
      );

      // 2. Checks household members update
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'households/household_abc' }),
        expect.objectContaining({
          'members.invitee_uid_456': 'member'
        })
      );

      // 3. Checks active household local persistence for the newly joined user
      expect(getPersistedActiveHouseholdId(mockInviteeUser.uid)).toBe('household_abc');
    });
  });

  describe('Rejecting & Canceling Invitations', () => {
    it('marks invite as rejected on rejectHouseholdInvite', async () => {
      await rejectHouseholdInvite('invite_123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'household_invites/invite_123' }),
        expect.objectContaining({
          status: 'rejected'
        })
      );
    });

    it('marks invite as canceled on cancelHouseholdInvite', async () => {
      await cancelHouseholdInvite('invite_123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'household_invites/invite_123' }),
        expect.objectContaining({
          status: 'canceled'
        })
      );
    });
  });
});
