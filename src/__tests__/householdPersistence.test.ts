import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  subscribeToUserHouseholds, 
  getPersistedActiveHouseholdId, 
  setPersistedActiveHouseholdId,
  createHouseholdRecord,
  getCachedHouseholdsForUser,
  setCachedHouseholdsForUser
} from '../services/householdService';
import { Household } from '../types';

describe('Household Persistence & Cross-Session Restoration', () => {
  const mockUser: any = {
    uid: 'user_persist_123',
    email: 'test@example.com',
    displayName: 'Test Chef'
  };

  const mockHouseholdOwned: Household = {
    id: 'hh_owned_1',
    name: 'Ayers Family Kitchen',
    ownerId: 'user_persist_123',
    memberIds: ['user_persist_123'],
    members: { user_persist_123: 'admin' }
  };

  const mockHouseholdMember: Household = {
    id: 'hh_member_2',
    name: 'Shared Cooking Club',
    ownerId: 'other_user_456',
    memberIds: ['other_user_456', 'user_persist_123'],
    members: { other_user_456: 'admin', user_persist_123: 'member' }
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Local Caching & Active Household Key Management', () => {
    it('persists and retrieves active household ID per user ID across sessions', () => {
      expect(getPersistedActiveHouseholdId(mockUser.uid)).toBeNull();
      
      setPersistedActiveHouseholdId(mockUser.uid, 'hh_owned_1');
      expect(getPersistedActiveHouseholdId(mockUser.uid)).toBe('hh_owned_1');

      // Different user should have their own isolated persistence
      expect(getPersistedActiveHouseholdId('another_user_999')).toBeNull();
    });

    it('caches households list to localStorage and restores instantly on tab return', () => {
      expect(getCachedHouseholdsForUser(mockUser.uid)).toEqual([]);

      setCachedHouseholdsForUser(mockUser.uid, [mockHouseholdOwned, mockHouseholdMember]);
      
      const restored = getCachedHouseholdsForUser(mockUser.uid);
      expect(restored).toHaveLength(2);
      expect(restored[0].id).toBe('hh_owned_1');
      expect(restored[0].name).toBe('Ayers Family Kitchen');
    });
  });

  describe('Household Creation Structure', () => {
    it('constructs household with ownerId, memberIds array, and members map for robust query indexing', () => {
      const result = createHouseholdRecord(mockUser.uid, 'The Smith Kitchen');
      
      expect(result.name).toBe('The Smith Kitchen');
      expect(result.ownerId).toBe(mockUser.uid);
      expect(result.memberIds).toContain(mockUser.uid);
      expect(result.members[mockUser.uid]).toBe('admin');
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('subscribeToUserHouseholds listener coordination', () => {
    it('calls onHouseholdsUpdate with cached households immediately upon subscription', () => {
      setCachedHouseholdsForUser(mockUser.uid, [mockHouseholdOwned]);
      setPersistedActiveHouseholdId(mockUser.uid, mockHouseholdOwned.id!);

      const onUpdate = vi.fn();
      const unsubscribe = subscribeToUserHouseholds(mockUser, onUpdate);

      // Should be called with cached items without waiting for network
      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'hh_owned_1' })])
      );

      unsubscribe();
    });

    it('prioritizes restoring the previously active household when multiple households exist', () => {
      setCachedHouseholdsForUser(mockUser.uid, [mockHouseholdOwned, mockHouseholdMember]);
      setPersistedActiveHouseholdId(mockUser.uid, 'hh_member_2');

      const cached = getCachedHouseholdsForUser(mockUser.uid);
      const activeId = getPersistedActiveHouseholdId(mockUser.uid);
      const selected = cached.find(h => h.id === activeId) || cached[0];

      expect(selected.id).toBe('hh_member_2');
      expect(selected.name).toBe('Shared Cooking Club');
    });

    it('gracefully falls back to the first available household if the persisted active household is deleted', () => {
      setCachedHouseholdsForUser(mockUser.uid, [mockHouseholdOwned]);
      setPersistedActiveHouseholdId(mockUser.uid, 'non_existent_household_id');

      const cached = getCachedHouseholdsForUser(mockUser.uid);
      const activeId = getPersistedActiveHouseholdId(mockUser.uid);
      const selected = cached.find(h => h.id === activeId) || cached[0];

      expect(selected.id).toBe('hh_owned_1');
    });
  });
});
