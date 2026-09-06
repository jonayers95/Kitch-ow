import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove, 
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { Household, Category } from '../types';
import { STOCK_RECIPES } from '../data/stockRecipes';

const ACTIVE_HOUSEHOLD_PREFIX = 'kitchow_active_household_';
const CACHED_HOUSEHOLDS_PREFIX = 'kitchow_cached_households_';

export function getPersistedActiveHouseholdId(userId: string): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    return localStorage.getItem(`${ACTIVE_HOUSEHOLD_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function setPersistedActiveHouseholdId(userId: string, householdId: string): void {
  if (typeof window === 'undefined' || !userId || !householdId) return;
  try {
    localStorage.setItem(`${ACTIVE_HOUSEHOLD_PREFIX}${userId}`, householdId);
  } catch (err) {
    console.warn('Failed to persist active household ID:', err);
  }
}

export function clearPersistedActiveHouseholdId(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(`${ACTIVE_HOUSEHOLD_PREFIX}${userId}`);
  } catch {
    // Ignore
  }
}

export function getCachedHouseholdsForUser(userId: string): Household[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`${CACHED_HOUSEHOLDS_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCachedHouseholdsForUser(userId: string, households: Household[]): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${CACHED_HOUSEHOLDS_PREFIX}${userId}`, JSON.stringify(households));
  } catch (err) {
    console.warn('Failed to cache households for user:', err);
  }
}

export function createHouseholdRecord(userId: string, name: string): Omit<Household, 'id'> {
  return {
    name: name.trim(),
    ownerId: userId,
    memberIds: [userId],
    members: { [userId]: 'admin' },
    createdAt: serverTimestamp() as any
  };
}

export async function createHouseholdWithStarterPack(
  user: User, 
  name: string
): Promise<Household> {
  const newHouseholdData = createHouseholdRecord(user.uid, name);
  const docRef = await addDoc(collection(db, 'households'), newHouseholdData);
  const createdHousehold: Household = {
    id: docRef.id,
    ...newHouseholdData
  };

  // Persist as active immediately
  setPersistedActiveHouseholdId(user.uid, docRef.id);

  // Sync to user document profile
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      activeHouseholdId: docRef.id,
      householdIds: arrayUnion(docRef.id)
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to link household to user profile doc:', err);
  }

  // Batch add starter recipes
  try {
    const batch = writeBatch(db);
    for (const recipe of STOCK_RECIPES) {
      const cleanedRecipe = {
        title: recipe.title?.trim() || "Untitled Recipe",
        category: (recipe.category as Category) || "Other",
        rating: recipe.rating || 5,
        estimatedTime: recipe.estimatedTime || 30,
        sourceUrl: recipe.sourceUrl || "",
        imageUrl: recipe.imageUrl || "",
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
        isStock: true,
        isStaple: !!recipe.isStaple,
        authorId: user.uid,
        householdId: docRef.id,
        createdAt: serverTimestamp(),
      };
      const rRef = doc(collection(db, 'recipes'));
      batch.set(rRef, cleanedRecipe);
    }
    await batch.commit();
  } catch (seedErr) {
    console.warn("Starter recipes auto-population notice:", seedErr);
  }

  return createdHousehold;
}

export async function addMemberToHousehold(
  householdId: string, 
  memberUserId: string, 
  role: 'admin' | 'member' | 'viewer' = 'member'
): Promise<void> {
  const hRef = doc(db, 'households', householdId);
  await updateDoc(hRef, {
    [`members.${memberUserId}`]: role,
    memberIds: arrayUnion(memberUserId)
  });
}

export async function removeMemberFromHousehold(
  householdId: string, 
  memberUserId: string
): Promise<void> {
  const hRef = doc(db, 'households', householdId);
  await updateDoc(hRef, {
    [`members.${memberUserId}`]: deleteField(),
    memberIds: arrayRemove(memberUserId)
  });
}

export function subscribeToUserHouseholds(
  user: User,
  onHouseholdsUpdate: (households: Household[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let isSubscribed = true;
  const householdMap = new Map<string, Household>();

  // 1. Instant Cache Hydration: Deliver cached data immediately so UI never flickers
  const cached = getCachedHouseholdsForUser(user.uid);
  if (cached.length > 0) {
    cached.forEach(h => {
      if (h.id) householdMap.set(h.id, h);
    });
    onHouseholdsUpdate(Array.from(householdMap.values()));
  }

  const broadcast = () => {
    if (!isSubscribed) return;
    const currentList = Array.from(householdMap.values());
    if (currentList.length > 0) {
      setCachedHouseholdsForUser(user.uid, currentList);
    }
    onHouseholdsUpdate(currentList);
  };

  // 2. Direct fetch of user profile's activeHouseholdId as fast fallback
  (async () => {
    try {
      const persistedId = getPersistedActiveHouseholdId(user.uid);
      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      const profileActiveId = (userDocSnap && typeof userDocSnap.exists === 'function' && userDocSnap.exists()) 
        ? userDocSnap.data()?.activeHouseholdId 
        : null;
      const targetId = profileActiveId || persistedId;

      if (targetId && !householdMap.has(targetId)) {
        const directDoc = await getDoc(doc(db, 'households', targetId));
        if (directDoc && typeof directDoc.exists === 'function' && directDoc.exists() && isSubscribed) {
          householdMap.set(directDoc.id, { id: directDoc.id, ...directDoc.data() } as Household);
          broadcast();
        }
      }
    } catch (err) {
      console.warn('Notice: direct household lookup fallback:', err);
    }
  })();

  // 3. Dual Queries: Query owned households AND memberIds array-contains
  // This guarantees finding both existing households (where ownerId == uid)
  // and newly invited or joined households (where memberIds array-contains uid)
  const qOwner = query(collection(db, 'households'), where('ownerId', '==', user.uid));
  const qMember = query(collection(db, 'households'), where('memberIds', 'array-contains', user.uid));

  let ownerFetched = false;
  let memberFetched = false;

  const handleDocs = (docs: any[]) => {
    let hasChanges = false;
    docs.forEach(d => {
      const data = typeof d.data === 'function' ? d.data() : (d.data || {});
      const existing = householdMap.get(d.id);
      const item: Household = { id: d.id, ...data };
      
      // If document is missing memberIds, backfill it in Firestore
      if (!data.memberIds && data.members && d.id) {
        const derivedMemberIds = Object.keys(data.members);
        if (data.ownerId && !derivedMemberIds.includes(data.ownerId)) {
          derivedMemberIds.push(data.ownerId);
        }
        item.memberIds = derivedMemberIds;
        // Non-blocking backfill update
        try {
          const updatePromise = updateDoc(doc(db, 'households', d.id), { memberIds: derivedMemberIds });
          if (updatePromise && typeof (updatePromise as any).catch === 'function') {
            (updatePromise as any).catch(() => {});
          }
        } catch {
          // Ignore
        }
      }

      if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
        householdMap.set(d.id, item);
        hasChanges = true;
      }
    });

    if (hasChanges || (!ownerFetched && !memberFetched)) {
      broadcast();
    }
  };

  const unsubOwner = onSnapshot(qOwner, (snapshot) => {
    ownerFetched = true;
    handleDocs(snapshot.docs);
  }, (err) => {
    console.warn('Household owner query notice:', err);
    onError?.(err);
  });

  const unsubMember = onSnapshot(qMember, (snapshot) => {
    memberFetched = true;
    handleDocs(snapshot.docs);
  }, (err) => {
    console.warn('Household member query notice:', err);
    onError?.(err);
  });

  return () => {
    isSubscribed = false;
    unsubOwner();
    unsubMember();
  };
}
