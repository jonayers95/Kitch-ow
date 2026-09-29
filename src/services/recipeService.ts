import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Recipe, Category } from '../types';

export const RECIPES_CACHE_PREFIX = 'kitchow_recipes_';
export const DELETED_RECIPES_PREFIX = 'kitchow_deleted_recipes_';

/**
 * Generate cache key for a household's recipes in localStorage
 */
export function getRecipeCacheKey(householdId: string): string {
  return `${RECIPES_CACHE_PREFIX}${householdId}`;
}

/**
 * Generate key for deleted recipe tombstones in localStorage
 */
export function getRecipeTombstonesKey(householdId: string): string {
  return `${DELETED_RECIPES_PREFIX}${householdId}`;
}

/**
 * Retrieve deleted recipe IDs (tombstones) for a household
 */
export function getDeletedRecipeIds(householdId: string): Set<string> {
  if (typeof window === 'undefined' || !householdId) return new Set();
  try {
    const raw = localStorage.getItem(getRecipeTombstonesKey(householdId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Add a deleted recipe ID to the household's tombstone set
 */
export function addDeletedRecipeTombstone(householdId: string, recipeId: string): void {
  if (typeof window === 'undefined' || !householdId || !recipeId) return;
  try {
    const current = getDeletedRecipeIds(householdId);
    current.add(recipeId);
    localStorage.setItem(getRecipeTombstonesKey(householdId), JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn('Notice adding recipe deletion tombstone:', err);
  }
}

/**
 * Remove a recipe ID from the tombstone set (e.g. once confirmed deleted from Firestore or re-added)
 */
export function removeDeletedRecipeTombstone(householdId: string, recipeId: string): void {
  if (typeof window === 'undefined' || !householdId || !recipeId) return;
  try {
    const current = getDeletedRecipeIds(householdId);
    if (current.delete(recipeId)) {
      localStorage.setItem(getRecipeTombstonesKey(householdId), JSON.stringify(Array.from(current)));
    }
  } catch (err) {
    console.warn('Notice removing recipe deletion tombstone:', err);
  }
}

/**
 * Safely converts any timestamp representation (Firestore Timestamp, cached object, Date, number, or millis)
 * into a genuine Firestore Timestamp instance.
 */
export function toFirestoreTimestamp(val: any): Timestamp {
  if (!val) return Timestamp.now();
  if (val instanceof Timestamp) return val;
  if (typeof val.toMillis === 'function') {
    try {
      return Timestamp.fromMillis(val.toMillis());
    } catch {
      // Fallback
    }
  }
  if (typeof val.seconds === 'number') {
    return new Timestamp(val.seconds, typeof val.nanoseconds === 'number' ? val.nanoseconds : 0);
  }
  if (typeof val === 'number') {
    return Timestamp.fromMillis(val);
  }
  if (val instanceof Date) {
    return Timestamp.fromDate(val);
  }
  return Timestamp.now();
}

/**
 * Strips undefined values from an object/array so Firestore setDoc does not throw
 */
export function cleanUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp || obj instanceof Date || (obj && (obj as any)._isServerTimestamp)) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    if (typeof (obj as any).toMillis === 'function') {
      return obj;
    }
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefinedValues(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Sanitizes a Recipe object into a clean payload for Firestore setDoc / updateDoc.
 * Ensures:
 * - No plain function properties (e.g. toMillis) that cause Firestore serialization crashes.
 * - Real Timestamp instances or serverTimestamp() for createdAt and updatedAt.
 * - Undefined values stripped.
 */
export function cleanRecipeForFirestore(recipe: Partial<Recipe>, isNew: boolean): Record<string, any> {
  const { id, _createdAtMillis, ...rest } = recipe as any;

  let createdAt: any;
  if (isNew) {
    createdAt = serverTimestamp();
  } else if (recipe.createdAt) {
    createdAt = toFirestoreTimestamp(recipe.createdAt);
  } else {
    createdAt = serverTimestamp();
  }

  const payload: Record<string, any> = {
    ...rest,
    id: recipe.id,
    createdAt,
    updatedAt: serverTimestamp()
  };

  return cleanUndefinedValues(payload);
}

/**
 * Retrieve cached recipes for a household from localStorage
 */
export function getCachedRecipes(householdId: string): Recipe[] {
  if (typeof window === 'undefined' || !householdId) return [];
  try {
    const raw = localStorage.getItem(getRecipeCacheKey(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: any) => {
      const millis = typeof r._createdAtMillis === 'number'
        ? r._createdAtMillis
        : (typeof r.createdAt === 'number'
          ? r.createdAt
          : (typeof r.createdAt?.seconds === 'number'
            ? r.createdAt.seconds * 1000
            : Date.now()));
      const { _createdAtMillis, createdAt: _ignored, ...rest } = r;
      return {
        ...rest,
        createdAt: Timestamp.fromMillis(millis)
      } as Recipe;
    });
  } catch (err) {
    console.warn('Notice reading cached recipes:', err);
    return [];
  }
}

/**
 * Persist recipes for a household to localStorage
 */
export function setCachedRecipes(householdId: string, recipes: Recipe[]): void {
  if (typeof window === 'undefined' || !householdId || !Array.isArray(recipes)) return;
  try {
    const serialized = recipes.map(r => {
      const millis = (r.createdAt as any)?.toMillis?.() ||
        (typeof (r.createdAt as any)?.seconds === 'number' ? (r.createdAt as any).seconds * 1000 : null) ||
        (typeof r.createdAt === 'number' ? r.createdAt : null) ||
        Date.now();
      const { createdAt, _createdAtMillis, ...rest } = r as any;
      return {
        ...rest,
        _createdAtMillis: millis
      };
    });
    localStorage.setItem(getRecipeCacheKey(householdId), JSON.stringify(serialized));
  } catch (err) {
    console.warn('Notice saving recipes to cache:', err);
  }
}

/**
 * Helper to sort recipes by creation date (newest first)
 */
export function sortRecipesNewestFirst(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => {
    const timeA = (a.createdAt as any)?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : Date.now());
    const timeB = (b.createdAt as any)?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : Date.now());
    return timeB - timeA;
  });
}

/**
 * Save a recipe (create or update) with optimistic local caching and Firestore sync
 */
export async function saveRecipe(
  recipeData: Partial<Recipe>,
  user: { uid: string },
  householdId: string
): Promise<Recipe> {
  if (!user?.uid) {
    throw new Error("Authentication required to save recipe.");
  }
  if (!householdId) {
    throw new Error("Household ID required to save recipe.");
  }

  // Validate title
  const trimmedTitle = recipeData.title?.trim();
  if (!trimmedTitle) {
    throw new Error("Please enter a recipe title.");
  }

  // Validate ingredients
  const rawIngredients = Array.isArray(recipeData.ingredients)
    ? recipeData.ingredients
    : [];
  const cleanedIngredients = rawIngredients
    .map(i => String(i).trim())
    .filter(i => i.length > 0);

  if (cleanedIngredients.length === 0) {
    throw new Error("Please add at least one ingredient.");
  }

  // Validate instructions
  const rawInstructions = Array.isArray(recipeData.instructions)
    ? recipeData.instructions
    : [];
  const cleanedInstructions = rawInstructions
    .map(i => String(i).trim())
    .filter(i => i.length > 0);

  if (cleanedInstructions.length === 0) {
    throw new Error("Please add at least one instruction step.");
  }

  // Ensure ID
  let recipeId = recipeData.id?.trim();
  const isNew = !recipeId;
  if (isNew) {
    const newDocRef = doc(collection(db, 'recipes'));
    recipeId = newDocRef.id;
  }

  // Clear any tombstone if re-saving / updating recipe
  removeDeletedRecipeTombstone(householdId, recipeId!);

  // Title length ceiling to comply with Firestore security rules (< 200 chars)
  const safeTitle = trimmedTitle.length > 195 ? trimmedTitle.substring(0, 195) : trimmedTitle;

  const resolvedRecipe: Recipe = {
    ...recipeData,
    id: recipeId!,
    title: safeTitle,
    ingredients: cleanedIngredients,
    instructions: cleanedInstructions,
    category: (recipeData.category as Category) || 'Dinner',
    rating: typeof recipeData.rating === 'number' ? recipeData.rating : 0,
    estimatedTime: typeof recipeData.estimatedTime === 'number' ? recipeData.estimatedTime : 30,
    sourceUrl: recipeData.sourceUrl?.trim() || '',
    imageUrl: recipeData.imageUrl?.trim() || '',
    isStaple: Boolean(recipeData.isStaple),
    authorId: recipeData.authorId || user.uid,
    householdId: householdId,
    createdAt: recipeData.createdAt ? toFirestoreTimestamp(recipeData.createdAt) : Timestamp.now()
  };

  // 1. Optimistic Local Persistence
  const currentCached = getCachedRecipes(householdId);
  const existingIdx = currentCached.findIndex(r => r.id === recipeId);
  let updatedList: Recipe[];

  if (existingIdx >= 0) {
    updatedList = [...currentCached];
    updatedList[existingIdx] = resolvedRecipe;
  } else {
    updatedList = [resolvedRecipe, ...currentCached];
  }

  setCachedRecipes(householdId, updatedList);

  // 2. Sync to Firestore with timeout fallback and sanitized payload
  try {
    const docRef = doc(db, 'recipes', recipeId!);
    const firestorePayload = cleanRecipeForFirestore(resolvedRecipe, isNew);

    const writePromise = setDoc(docRef, firestorePayload, { merge: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore sync timeout')), 4000)
    );

    await Promise.race([writePromise, timeoutPromise]).catch((timeoutErr) => {
      console.warn('Recipe synced to local cache, remote write pending in background:', timeoutErr);
    });
  } catch (err) {
    console.warn('Notice saving recipe to remote Firestore, retained in local cache:', err);
  }

  return resolvedRecipe;
}

/**
 * Delete a recipe with optimistic local cache removal and Firestore deletion
 */
export async function deleteRecipe(recipeId: string, householdId: string): Promise<void> {
  if (!recipeId) return;

  // 1. Record deletion tombstone to prevent lagging remote snapshot from reviving deleted recipe
  addDeletedRecipeTombstone(householdId, recipeId);

  // 2. Optimistically remove from cache
  const cached = getCachedRecipes(householdId);
  const filtered = cached.filter(r => r.id !== recipeId);
  setCachedRecipes(householdId, filtered);

  // 3. Delete from Firestore
  try {
    const docRef = doc(db, 'recipes', recipeId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Notice deleting recipe from Firestore:', err);
  }
}

/**
 * Toggle staple status of a recipe with instant local cache update
 */
export async function toggleRecipeStaple(
  recipeId: string,
  householdId: string,
  currentStaple: boolean
): Promise<boolean> {
  const nextStaple = !currentStaple;

  // 1. Optimistically update in local cache
  const cached = getCachedRecipes(householdId);
  const updated = cached.map(r => {
    if (r.id === recipeId) {
      return { ...r, isStaple: nextStaple };
    }
    return r;
  });
  setCachedRecipes(householdId, updated);

  // 2. Sync updateDoc to Firestore
  try {
    const docRef = doc(db, 'recipes', recipeId);
    await updateDoc(docRef, {
      isStaple: nextStaple,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Notice toggling recipe staple status in Firestore:', err);
  }

  return nextStaple;
}

/**
 * Batch add stock starter recipes with local cache hydration
 */
export async function saveStockRecipes(
  stockRecipes: Partial<Recipe>[],
  user: { uid: string },
  householdId: string
): Promise<number> {
  if (!user?.uid || !householdId || !Array.isArray(stockRecipes) || stockRecipes.length === 0) {
    return 0;
  }

  const currentCached = getCachedRecipes(householdId);
  const existingTitles = new Set(
    currentCached.map(r => (r.title || '').toLowerCase().trim())
  );

  const missing = stockRecipes.filter(
    sr => sr.title && !existingTitles.has(sr.title.toLowerCase().trim())
  );

  if (missing.length === 0) {
    return 0;
  }

  const batch = writeBatch(db);
  const newlyCreated: Recipe[] = [];

  for (const sr of missing) {
    const newRef = doc(collection(db, 'recipes'));
    const safeTitle = (sr.title || 'Untitled').trim().substring(0, 195);
    const item: Recipe = {
      id: newRef.id,
      title: safeTitle,
      category: (sr.category as Category) || 'Other',
      rating: sr.rating || 5,
      estimatedTime: sr.estimatedTime || 30,
      sourceUrl: sr.sourceUrl || '',
      imageUrl: sr.imageUrl || '',
      ingredients: Array.isArray(sr.ingredients) ? sr.ingredients : [],
      instructions: Array.isArray(sr.instructions) ? sr.instructions : [],
      isStock: true,
      isStaple: Boolean(sr.isStaple),
      authorId: user.uid,
      householdId: householdId,
      createdAt: Timestamp.now()
    };

    newlyCreated.push(item);

    const payload = cleanRecipeForFirestore(item, true);
    batch.set(newRef, payload);
  }

  // Update local cache immediately
  const combined = [...newlyCreated, ...currentCached];
  setCachedRecipes(householdId, combined);

  // Commit batch in background with safety
  try {
    await batch.commit();
  } catch (err) {
    console.warn('Notice committing stock recipes batch to Firestore:', err);
  }

  return newlyCreated.length;
}

/**
 * Background-sync local-only recipes to Firestore so they are never lost
 */
export async function syncPendingRecipesToFirestore(householdId: string, pending: Recipe[]): Promise<void> {
  for (const recipe of pending) {
    try {
      const docRef = doc(db, 'recipes', recipe.id);
      const payload = cleanRecipeForFirestore(recipe, false);
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      console.warn('Background sync notice for pending recipe:', recipe.id, err);
    }
  }
}

/**
 * Subscribe to household recipes with instant local cache delivery and resilient remote merging
 */
export function subscribeToRecipes(
  householdId: string,
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!householdId) {
    onUpdate([]);
    return () => {};
  }

  // 1. Instant Cache Hydration: Deliver cached recipes immediately
  const cached = getCachedRecipes(householdId);
  if (cached.length > 0) {
    onUpdate(cached);
  }

  // 2. Real-time Firestore Listener
  const q = query(
    collection(db, 'recipes'),
    where('householdId', '==', householdId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const fetched: Recipe[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: toFirestoreTimestamp(data?.createdAt)
        } as Recipe;
      });

      // Retrieve current cached recipes and active deletion tombstones
      const currentCached = getCachedRecipes(householdId);
      const deletedIds = getDeletedRecipeIds(householdId);

      const mergedMap = new Map<string, Recipe>();

      // 1. Populate remote docs that are not tombstoned
      fetched.forEach(r => {
        if (!deletedIds.has(r.id)) {
          mergedMap.set(r.id, r);
        } else {
          // If Firestore still returns a tombstoned doc, delete it in background
          try {
            deleteDoc(doc(db, 'recipes', r.id)).catch(() => {});
          } catch {
            // Non-blocking
          }
        }
      });

      // Clean up tombstones that are no longer in remote Firestore docs
      const remoteIds = new Set(fetched.map(r => r.id));
      deletedIds.forEach(id => {
        if (!remoteIds.has(id)) {
          removeDeletedRecipeTombstone(householdId, id);
        }
      });

      // 2. Preserve any local recipes that were added locally but not yet in remote snapshot
      const pendingSyncList: Recipe[] = [];
      currentCached.forEach(cachedRecipe => {
        if (!deletedIds.has(cachedRecipe.id) && !mergedMap.has(cachedRecipe.id)) {
          mergedMap.set(cachedRecipe.id, cachedRecipe);
          pendingSyncList.push(cachedRecipe);
        }
      });

      const sorted = sortRecipesNewestFirst(Array.from(mergedMap.values()));

      // Persist merged latest to cache
      setCachedRecipes(householdId, sorted);

      // Broadcast to subscriber
      onUpdate(sorted);

      // Background-sync any pending recipes to Firestore
      if (pendingSyncList.length > 0) {
        syncPendingRecipesToFirestore(householdId, pendingSyncList);
      }
    },
    (err) => {
      console.warn('Recipe listener notice:', err);
      if (onError) onError(err);
      // Fall back to cache so UI never becomes blank upon offline or listener error
      const fallbackCached = getCachedRecipes(householdId);
      if (fallbackCached.length > 0) {
        onUpdate(fallbackCached);
      }
    }
  );

  return unsubscribe;
}

