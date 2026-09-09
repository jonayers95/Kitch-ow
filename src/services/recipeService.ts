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

/**
 * Generate cache key for a household's recipes in localStorage
 */
export function getRecipeCacheKey(householdId: string): string {
  return `${RECIPES_CACHE_PREFIX}${householdId}`;
}

/**
 * Strips undefined values from an object/array so Firestore setDoc does not throw
 */
export function cleanUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
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
        : (typeof r.createdAt === 'number' ? r.createdAt : Date.now());
      const { _createdAtMillis, ...rest } = r;
      return {
        ...rest,
        createdAt: {
          toMillis: () => millis,
          seconds: Math.floor(millis / 1000),
          nanoseconds: 0
        }
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
      return {
        ...r,
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
    createdAt: recipeData.createdAt || Timestamp.now()
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

  // 2. Sync to Firestore with timeout fallback
  try {
    const docRef = doc(db, 'recipes', recipeId!);
    const firestorePayload = cleanUndefinedValues({
      ...resolvedRecipe,
      createdAt: isNew ? serverTimestamp() : (resolvedRecipe.createdAt || serverTimestamp()),
      updatedAt: serverTimestamp()
    });

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

  // 1. Optimistically remove from cache
  const cached = getCachedRecipes(householdId);
  const filtered = cached.filter(r => r.id !== recipeId);
  setCachedRecipes(householdId, filtered);

  // 2. Delete from Firestore
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

    const payload = cleanUndefinedValues({
      ...item,
      createdAt: serverTimestamp()
    });
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
 * Subscribe to household recipes with instant local cache delivery on reload
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
      const fetched: Recipe[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Recipe));

      const sorted = sortRecipesNewestFirst(fetched);

      // Persist latest to cache
      setCachedRecipes(householdId, sorted);

      // Broadcast to subscriber
      onUpdate(sorted);
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
