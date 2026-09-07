import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  arrayUnion, 
  deleteDoc
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { Household, HouseholdInvite, HouseholdInviteRole } from '../types';
import { setPersistedActiveHouseholdId } from './householdService';

export interface ValidatedTarget {
  type: 'email' | 'uid';
  normalized: string;
}

export function validateInviteTarget(target: string): ValidatedTarget {
  if (!target || typeof target !== 'string') {
    throw new Error('Please enter an email address or User ID.');
  }

  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error('Please enter an email address or User ID.');
  }

  if (trimmed.includes('@')) {
    // Email normalization
    const emailLower = trimmed.toLowerCase();
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      throw new Error('Please enter a valid email address.');
    }
    return {
      type: 'email',
      normalized: emailLower
    };
  }

  return {
    type: 'uid',
    normalized: trimmed
  };
}

export function createInviteRecord(
  household: Household,
  sender: User | { uid: string; displayName?: string; email?: string },
  target: string,
  targetType: 'email' | 'uid',
  role: HouseholdInviteRole = 'member'
): Omit<HouseholdInvite, 'id'> {
  return {
    householdId: household.id || '',
    householdName: household.name || 'Our Kitchen',
    invitedByUid: sender.uid,
    invitedByName: sender.displayName || 'Family Chef',
    invitedByEmail: sender.email || '',
    inviteeEmail: targetType === 'email' ? target : '',
    inviteeUid: targetType === 'uid' ? target : '',
    role,
    status: 'pending',
    createdAt: serverTimestamp() as any
  };
}

export async function sendHouseholdInvite(
  household: Household,
  sender: User,
  target: string,
  role: HouseholdInviteRole = 'member'
): Promise<HouseholdInvite> {
  if (!household.id) {
    throw new Error('Invalid household selected.');
  }

  const validated = validateInviteTarget(target);

  // 1. Check if user is already in this household
  if (validated.type === 'uid' && household.members && household.members[validated.normalized]) {
    throw new Error('This user is already a member of this household.');
  }
  if (validated.type === 'uid' && validated.normalized === sender.uid) {
    throw new Error('You are already the owner of this household.');
  }
  if (validated.type === 'email' && sender.email && validated.normalized === sender.email.toLowerCase()) {
    throw new Error('You cannot invite yourself to your own household.');
  }

  // 2. Prevent duplicate pending invites
  try {
    const existingQ = validated.type === 'email'
      ? query(
          collection(db, 'household_invites'),
          where('householdId', '==', household.id),
          where('inviteeEmail', '==', validated.normalized),
          where('status', '==', 'pending')
        )
      : query(
          collection(db, 'household_invites'),
          where('householdId', '==', household.id),
          where('inviteeUid', '==', validated.normalized),
          where('status', '==', 'pending')
        );

    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      throw new Error('An invitation is already pending for this user.');
    }
  } catch (err: any) {
    if (err?.message?.includes('An invitation is already pending')) {
      throw err;
    }
    console.warn('Notice checking existing invites:', err);
  }

  // 3. Create the invitation document
  const record = createInviteRecord(household, sender, validated.normalized, validated.type, role);
  const docRef = await addDoc(collection(db, 'household_invites'), record);

  return {
    id: docRef.id,
    ...record
  };
}

export async function acceptHouseholdInvite(
  invite: HouseholdInvite,
  user: User
): Promise<void> {
  if (!invite.id || !invite.householdId) {
    throw new Error('Invalid invitation details.');
  }

  // 1. Mark invite as accepted
  const inviteRef = doc(db, 'household_invites', invite.id);
  await updateDoc(inviteRef, {
    status: 'accepted',
    inviteeUid: user.uid,
    updatedAt: serverTimestamp()
  });

  // 2. Add user to the household's members map and memberIds array
  const householdRef = doc(db, 'households', invite.householdId);
  await updateDoc(householdRef, {
    [`members.${user.uid}`]: invite.role || 'member',
    memberIds: arrayUnion(user.uid)
  });

  // 3. Set newly joined household as active in cross-session persistence
  setPersistedActiveHouseholdId(user.uid, invite.householdId);
}

export async function rejectHouseholdInvite(inviteId: string): Promise<void> {
  if (!inviteId) return;
  const inviteRef = doc(db, 'household_invites', inviteId);
  await updateDoc(inviteRef, {
    status: 'rejected',
    updatedAt: serverTimestamp()
  });
}

export async function cancelHouseholdInvite(inviteId: string): Promise<void> {
  if (!inviteId) return;
  const inviteRef = doc(db, 'household_invites', inviteId);
  await updateDoc(inviteRef, {
    status: 'canceled',
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribes to pending invitations addressed to the current user (by UID or Email).
 */
export function subscribeToPendingInvitesForUser(
  user: User,
  onUpdate: (invites: HouseholdInvite[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let isSubscribed = true;
  const inviteMap = new Map<string, HouseholdInvite>();

  const broadcast = () => {
    if (!isSubscribed) return;
    onUpdate(Array.from(inviteMap.values()));
  };

  const handleSnap = (docs: any[]) => {
    let changed = false;
    docs.forEach((d) => {
      const data = typeof d.data === 'function' ? d.data() : (d.data || {});
      if (data.status === 'pending') {
        const item: HouseholdInvite = { id: d.id, ...data };
        if (!inviteMap.has(d.id) || JSON.stringify(inviteMap.get(d.id)) !== JSON.stringify(item)) {
          inviteMap.set(d.id, item);
          changed = true;
        }
      } else if (inviteMap.has(d.id)) {
        inviteMap.delete(d.id);
        changed = true;
      }
    });
    if (changed) broadcast();
  };

  const unsubs: Array<() => void> = [];

  // Query 1: by user UID
  try {
    const qUid = query(
      collection(db, 'household_invites'),
      where('inviteeUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    unsubs.push(
      onSnapshot(qUid, (snap) => handleSnap(snap.docs), (err) => {
        console.warn('Pending invites UID query notice:', err);
        onError?.(err);
      })
    );
  } catch (err) {
    console.warn('Could not setup UID invite query:', err);
  }

  // Query 2: by user Email (if present)
  if (user.email) {
    try {
      const qEmail = query(
        collection(db, 'household_invites'),
        where('inviteeEmail', '==', user.email.toLowerCase()),
        where('status', '==', 'pending')
      );
      unsubs.push(
        onSnapshot(qEmail, (snap) => handleSnap(snap.docs), (err) => {
          console.warn('Pending invites Email query notice:', err);
          onError?.(err);
        })
      );
    } catch (err) {
      console.warn('Could not setup Email invite query:', err);
    }
  }

  return () => {
    isSubscribed = false;
    unsubs.forEach((u) => u());
  };
}

/**
 * Subscribes to pending invitations created for a specific household (for household management).
 */
export function subscribeToHouseholdPendingInvites(
  householdId: string,
  onUpdate: (invites: HouseholdInvite[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!householdId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'household_invites'),
      where('householdId', '==', householdId),
      where('status', '==', 'pending')
    );

    return onSnapshot(
      q,
      (snap) => {
        const invites = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as HouseholdInvite));
        onUpdate(invites);
      },
      (err) => {
        console.warn('Household pending invites query notice:', err);
        onError?.(err);
      }
    );
  } catch (err) {
    console.warn('Could not setup household invites query:', err);
    onUpdate([]);
    return () => {};
  }
}
