import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { MealPlan, MealSlot } from '../types';
import { isCustomMealImageExpired } from '../utils/customMealImageUtils';

const MEAL_PLAN_CACHE_PREFIX = 'kitchow_mealplan_';
export const MEAL_PLAN_RETENTION_DAYS = 30;

/**
 * Format a Date object as 'YYYY-MM-DD'
 */
export function formatDateKeyString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the date key exactly 30 days prior to the given reference date (defaults to now)
 */
export function get30DaysAgoDateKey(referenceDate: Date = new Date()): string {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - MEAL_PLAN_RETENTION_DAYS);
  return formatDateKeyString(cutoff);
}

/**
 * Check if a date string is older than 30 days compared to the reference date
 */
export function isDateOlderThan30Days(dateStr: string, referenceDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const cutoffKey = get30DaysAgoDateKey(referenceDate);
  return dateStr < cutoffKey;
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
 * Sanitize and prune meal plan days:
 * 1. Prunes meals older than 30 days from the plan (user retention requirement).
 * 2. Keeps meals within the 30-day window and all future planned meals.
 * 3. Enforces unique slot IDs and cleans up custom photo expirations.
 */
export function sanitizeAndPruneMealPlanDays(
  rawDays: { [dateStr: string]: MealSlot[] } | undefined,
  referenceDate: Date = new Date()
): { [dateStr: string]: MealSlot[] } {
  if (!rawDays) return {};
  const cleaned: { [dateStr: string]: MealSlot[] } = {};
  const seenSlotIds = new Set<string>();

  Object.entries(rawDays).forEach(([dateStr, slots]) => {
    if (!Array.isArray(slots)) return;

    // Prune entries older than 30 days
    if (isDateOlderThan30Days(dateStr, referenceDate)) {
      return;
    }

    const uniqueDaySlots: MealSlot[] = [];

    slots.forEach((slot, idx) => {
      if (!slot) return;
      let slotId = slot.id;
      if (!slotId || seenSlotIds.has(slotId)) {
        slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`;
      }
      seenSlotIds.add(slotId);

      const sanitizedSlot: MealSlot = {
        ...slot,
        id: slotId
      };

      // 30-day storage ceiling for custom meal photos
      if (slot.imageUrl && isCustomMealImageExpired(slot, referenceDate)) {
        delete sanitizedSlot.imageUrl;
        delete sanitizedSlot.imageCapturedAt;
        delete sanitizedSlot.imageExpiresAt;
      }

      uniqueDaySlots.push(sanitizedSlot);
    });

    if (uniqueDaySlots.length > 0) {
      cleaned[dateStr] = uniqueDaySlots;
    }
  });

  return cleanUndefinedValues(cleaned);
}

/**
 * Generate localStorage cache key for a meal plan week
 */
export function getMealPlanCacheKey(householdId: string, weekStartDateKey: string): string {
  return `${MEAL_PLAN_CACHE_PREFIX}${householdId}_${weekStartDateKey}`;
}

/**
 * Retrieve cached meal plan from localStorage, pruning any entries older than 30 days
 */
export function getCachedMealPlan(
  householdId: string,
  weekStartDateKey: string,
  referenceDate: Date = new Date()
): MealPlan | null {
  if (typeof window === 'undefined' || !householdId || !weekStartDateKey) return null;
  try {
    const raw = localStorage.getItem(getMealPlanCacheKey(householdId, weekStartDateKey));
    if (!raw) return null;
    const parsed: MealPlan = JSON.parse(raw);
    if (parsed && parsed.days) {
      parsed.days = sanitizeAndPruneMealPlanDays(parsed.days, referenceDate);
    }
    return parsed;
  } catch (err) {
    console.warn('Notice reading cached meal plan:', err);
    return null;
  }
}

/**
 * Store meal plan into localStorage for instant cross-session persistence
 */
export function setCachedMealPlan(
  householdId: string,
  weekStartDateKey: string,
  mealPlan: MealPlan,
  referenceDate: Date = new Date()
): void {
  if (typeof window === 'undefined' || !householdId || !weekStartDateKey || !mealPlan) return;
  try {
    const toStore: MealPlan = {
      ...mealPlan,
      days: sanitizeAndPruneMealPlanDays(mealPlan.days, referenceDate)
    };
    localStorage.setItem(
      getMealPlanCacheKey(householdId, weekStartDateKey),
      JSON.stringify(toStore)
    );
  } catch (err) {
    console.warn('Notice caching meal plan:', err);
  }
}

/**
 * Save meal plan update to both localStorage (instant offline/refresh durability)
 * and Firestore (with merge: true and server timestamp).
 */
export async function saveMealPlan(
  householdId: string,
  weekStartDateKey: string,
  newDays: { [dateStr: string]: MealSlot[] },
  authorId: string,
  referenceDate: Date = new Date()
): Promise<MealPlan> {
  const sanitizedDays = sanitizeAndPruneMealPlanDays(newDays, referenceDate);
  const planDocId = `${householdId}_${weekStartDateKey}`;

  const updatedPlan: MealPlan = {
    id: planDocId,
    householdId,
    weekStartDate: weekStartDateKey,
    days: sanitizedDays,
    authorId
  };

  // 1. Immediately write to localStorage so refresh never loses data
  setCachedMealPlan(householdId, weekStartDateKey, updatedPlan, referenceDate);

  // 2. Commit to Firestore with merge: true
  const planRef = doc(db, 'mealPlans', planDocId);
  await setDoc(planRef, {
    householdId,
    weekStartDate: weekStartDateKey,
    days: sanitizedDays,
    authorId,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return updatedPlan;
}

/**
 * Subscribes to a weekly meal plan with instant cache hydration and real-time Firestore sync.
 */
export function subscribeToWeeklyMealPlan(
  householdId: string,
  weekStartDateKey: string,
  currentUserId: string,
  onUpdate: (plan: MealPlan) => void,
  onError?: (err: unknown) => void,
  referenceDate: Date = new Date()
): () => void {
  let isSubscribed = true;

  // 1. Instant Cache Hydration: Provide cached plan synchronously
  const cached = getCachedMealPlan(householdId, weekStartDateKey, referenceDate);
  if (cached) {
    onUpdate(cached);
  }

  // 2. Real-time Firestore onSnapshot
  const planDocId = `${householdId}_${weekStartDateKey}`;
  const planRef = doc(db, 'mealPlans', planDocId);

  const unsubscribe = onSnapshot(
    planRef,
    (snapshot) => {
      if (!isSubscribed) return;

      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawDays = data.days || {};
        const sanitizedDays = sanitizeAndPruneMealPlanDays(rawDays, referenceDate);
        const resolvedPlan: MealPlan = {
          id: snapshot.id,
          ...data,
          householdId: data.householdId || householdId,
          weekStartDate: data.weekStartDate || weekStartDateKey,
          days: sanitizedDays,
          authorId: data.authorId || currentUserId
        };

        // Cache update
        setCachedMealPlan(householdId, weekStartDateKey, resolvedPlan, referenceDate);
        onUpdate(resolvedPlan);
      } else {
        // Document does not exist yet in Firestore
        // If we have cached items from optimistic actions, preserve them or provide empty
        if (!cached) {
          const emptyPlan: MealPlan = {
            householdId,
            weekStartDate: weekStartDateKey,
            days: {},
            authorId: currentUserId
          };
          onUpdate(emptyPlan);
        }
      }
    },
    (error) => {
      console.warn("Notice syncing meal plan:", error);
      if (onError) onError(error);
      if (!cached && isSubscribed) {
        onUpdate({
          householdId,
          weekStartDate: weekStartDateKey,
          days: {},
          authorId: currentUserId
        });
      }
    }
  );

  return () => {
    isSubscribed = false;
    unsubscribe();
  };
}
