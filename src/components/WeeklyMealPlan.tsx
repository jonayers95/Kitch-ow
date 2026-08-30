import React, { useState, useEffect, useMemo } from 'react';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Recipe, 
  Household, 
  MealPlan, 
  MealSlot, 
  MealType 
} from '../types';
import { AiMealPlannerModal } from './AiMealPlannerModal';
import { SmartGroceryListModal } from './SmartGroceryListModal';
import { LeftoverRemixModal, PastMealItem } from './LeftoverRemixModal';
import { BumpMissedMealsModal, MissedMealItem, WeekDayOption } from './BumpMissedMealsModal';
import { SingleMealBumpModal } from './SingleMealBumpModal';
import { GoogleCalendarSyncModal } from './GoogleCalendarSyncModal';
import { evaluateFoodFreshness } from '../utils/spoilageCalculator';
import { 
  getStoredCalendarToken, 
  fetchWeekCalendarEvents, 
  CalendarAuthStatus 
} from '../services/calendarService';
import { WeekCalendarInsights } from '../types';
import { 
  addDoc, 
  collection, 
  getDoc 
} from 'firebase/firestore';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Check, 
  ShoppingCart, 
  Clock, 
  Utensils, 
  Soup, 
  X, 
  ExternalLink,
  Copy,
  Printer,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  BookOpen,
  RotateCcw,
  Star,
  Shuffle,
  ArrowRightLeft,
  CheckCircle2,
  ShieldCheck,
  ChefHat,
  CalendarClock,
  CalendarCheck,
  Wine,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WeeklyMealPlanProps {
  household: Household | null;
  recipes: Recipe[];
  currentUserId: string;
  onViewRecipe: (recipe: Recipe) => void;
  onRequestAddRecipe: () => void;
}

const MEAL_TYPES: { type: MealType; label: string; icon: string; badgeColor: string }[] = [
  { type: 'Breakfast', label: 'Breakfast', icon: '🌅', badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { type: 'Lunch', label: 'Lunch', icon: '☀️', badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { type: 'Dinner', label: 'Dinner', icon: '🌙', badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { type: 'Snack', label: 'Snack / Treat', icon: '🍪', badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800' }
];

// Date Helpers
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekStartDateKeyForDate(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const monday = getMonday(dateObj);
  return formatDateKey(monday);
}

function sanitizeMealPlanDays(rawDays: { [dateStr: string]: MealSlot[] } | undefined): { [dateStr: string]: MealSlot[] } {
  if (!rawDays) return {};
  const cleaned: { [dateStr: string]: MealSlot[] } = {};
  const seenSlotIds = new Set<string>();

  Object.entries(rawDays).forEach(([dateStr, slots]) => {
    if (!Array.isArray(slots)) return;
    const uniqueDaySlots: MealSlot[] = [];

    slots.forEach((slot, idx) => {
      if (!slot) return;
      let slotId = slot.id;
      if (!slotId || seenSlotIds.has(slotId)) {
        slotId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`;
      }
      seenSlotIds.add(slotId);
      uniqueDaySlots.push({
        ...slot,
        id: slotId,
      });
    });

    if (uniqueDaySlots.length > 0) {
      cleaned[dateStr] = uniqueDaySlots;
    }
  });

  return cleaned;
}

export const WeeklyMealPlan: React.FC<WeeklyMealPlanProps> = ({
  household,
  recipes,
  currentUserId,
  onViewRecipe,
  onRequestAddRecipe
}) => {
  // Current active Monday
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);
  const [isAiPlannerOpen, setIsAiPlannerOpen] = useState(false);
  const [selectedDateForMeal, setSelectedDateForMeal] = useState<string>('');
  const [selectedMealType, setSelectedMealType] = useState<MealType>('Dinner');
  
  // Custom Meal Form inside Modal
  const [activeTab, setActiveTab] = useState<'recipe' | 'custom' | 'dining'>('recipe');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [customDiningPlace, setCustomDiningPlace] = useState('');
  const [customDiningNotes, setCustomDiningNotes] = useState('');

  // Google Calendar Integration State
  const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState(false);
  const [calendarAuthStatus, setCalendarAuthStatus] = useState<CalendarAuthStatus>({ isConnected: false, accessToken: null });
  const [calendarInsights, setCalendarInsights] = useState<WeekCalendarInsights | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Grocery List Drawer
  const [isGroceryModalOpen, setIsGroceryModalOpen] = useState(false);

  // "Not Today" Quick-Swap State
  const [isNotTodayModalOpen, setIsNotTodayModalOpen] = useState(false);
  const [notTodayTarget, setNotTodayTarget] = useState<{ dateKey: string; slot: MealSlot } | null>(null);
  const [notTodaySearchQuery, setNotTodaySearchQuery] = useState('');
  const [isNotTodayRolling, setIsNotTodayRolling] = useState(false);
  const [swapFeedbackToast, setSwapFeedbackToast] = useState<string | null>(null);
  const [showAllQuickInNotToday, setShowAllQuickInNotToday] = useState(false);
  const [isModalStaplesOnly, setIsModalStaplesOnly] = useState(false);

  // Leftover Remix & Freshness State
  const [isLeftoverRemixOpen, setIsLeftoverRemixOpen] = useState(false);
  const [remixInitialMealId, setRemixInitialMealId] = useState<string | undefined>(undefined);

  // Missed Meals Bumping State
  const [isBumpModalOpen, setIsBumpModalOpen] = useState(false);
  const [bumpInitialSlotId, setBumpInitialSlotId] = useState<string | undefined>(undefined);
  const [singleBumpTarget, setSingleBumpTarget] = useState<{
    dateKey: string;
    slot: MealSlot;
    recipe?: Recipe;
  } | null>(null);

  const weekStartDateKey = useMemo(() => formatDateKey(currentMonday), [currentMonday]);

  // Extract all cooked past meals for the Leftover Remix Engine & Freshness Tracker
  const pastMeals = useMemo(() => {
    const list: PastMealItem[] = [];
    const todayKey = formatDateKey(new Date());

    if (mealPlan?.days) {
      Object.entries(mealPlan.days).forEach(([dateStr, slots]) => {
        // Only include meals from strictly past days (before today, as today's haven't been made yet)
        if (dateStr < todayKey) {
          slots.forEach((slot) => {
            const recipe = slot.recipeId ? recipes.find((r) => r.id === slot.recipeId) : undefined;
            const title = recipe?.title || slot.customTitle || 'Meal';
            list.push({
              id: `${dateStr}_${slot.id}`,
              recipeTitle: title,
              cookedDate: dateStr,
              recipeId: slot.recipeId,
              recipe,
              mealType: slot.mealType,
              notes: slot.notes,
            });
          });
        }
      });
    }

    // Sort newest cooked date first
    list.sort((a, b) => b.cookedDate.localeCompare(a.cookedDate));
    return list;
  }, [mealPlan, recipes]);

  // Week days array (Mon -> Sun)
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayKey = formatDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const dateObj = addDays(currentMonday, i);
      const dateKey = formatDateKey(dateObj);
      days.push({
        dateObj,
        dateKey,
        dayName: dayNames[i],
        shortName: shortNames[i],
        monthDay: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isToday: dateKey === todayKey
      });
    }
    return days;
  }, [currentMonday]);

  // Missed unmade meals calculation from past days of the week
  const missedMeals: MissedMealItem[] = useMemo(() => {
    const list: MissedMealItem[] = [];
    const todayKey = formatDateKey(new Date());

    if (mealPlan?.days) {
      weekDays.forEach(({ dateKey, dayName, monthDay }) => {
        if (dateKey < todayKey && mealPlan.days[dateKey]) {
          mealPlan.days[dateKey].forEach((slot) => {
            if (!slot.isDone) {
              const recipe = slot.recipeId ? recipes.find((r) => r.id === slot.recipeId) : undefined;
              const title = recipe?.title || slot.customTitle || 'Meal';
              list.push({
                dateKey,
                dayName,
                monthDay,
                slot,
                recipe,
                title,
              });
            }
          });
        }
      });
    }

    return list;
  }, [mealPlan, weekDays, recipes]);

  // Week days with slot options for the Bump modal
  const weekDaysWithOptions: WeekDayOption[] = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return weekDays.map((d) => ({
      dateKey: d.dateKey,
      dayName: d.dayName,
      monthDay: d.monthDay,
      isToday: d.isToday,
      isPast: d.dateKey < todayKey && !d.isToday,
      existingSlots: mealPlan?.days?.[d.dateKey] || [],
    }));
  }, [weekDays, mealPlan]);

  const weekRangeLabel = useMemo(() => {
    const endSunday = addDays(currentMonday, 6);
    const startStr = currentMonday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = endSunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [currentMonday]);

  // Subscribe to Meal Plan in Firestore
  useEffect(() => {
    if (!household?.id) {
      setMealPlan(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const planDocId = `${household.id}_${weekStartDateKey}`;
    const planRef = doc(db, 'mealPlans', planDocId);

    const unsubscribe = onSnapshot(planRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawDays = data.days || {};
        const sanitizedDays = sanitizeMealPlanDays(rawDays);
        setMealPlan({ id: snapshot.id, ...data, days: sanitizedDays } as MealPlan);
      } else {
        setMealPlan({
          householdId: household.id!,
          weekStartDate: weekStartDateKey,
          days: {},
          authorId: currentUserId
        });
      }
      setLoading(false);
    }, (error) => {
      console.warn("Meal plan sync notice:", error);
      setMealPlan({
        householdId: household.id!,
        weekStartDate: weekStartDateKey,
        days: {},
        authorId: currentUserId
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [household?.id, weekStartDateKey, currentUserId]);

  // Check and fetch Google Calendar insights for current week
  useEffect(() => {
    const auth = getStoredCalendarToken();
    setCalendarAuthStatus(auth);

    if (auth.isConnected && auth.accessToken) {
      let isMounted = true;
      setIsLoadingCalendar(true);

      fetchWeekCalendarEvents(weekStartDateKey)
        .then((insights) => {
          if (isMounted) {
            setCalendarInsights(insights);
          }
        })
        .catch((err) => {
          console.warn("Could not fetch calendar insights:", err);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingCalendar(false);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setCalendarInsights(null);
    }
  }, [weekStartDateKey]);

  // Save meal plan update
  const saveMealPlanUpdate = async (newDays: { [dateStr: string]: MealSlot[] }) => {
    if (!household?.id) return;
    const planDocId = `${household.id}_${weekStartDateKey}`;
    const planRef = doc(db, 'mealPlans', planDocId);
    try {
      const sanitizedDays = cleanUndefined(sanitizeMealPlanDays(newDays));
      await setDoc(planRef, {
        householdId: household.id,
        weekStartDate: weekStartDateKey,
        days: sanitizedDays,
        authorId: currentUserId,
        updatedAt: serverTimestamp()
      });
      // Optimistically update state
      setMealPlan(prev => prev ? { ...prev, days: sanitizedDays } : {
        householdId: household.id!,
        weekStartDate: weekStartDateKey,
        days: sanitizedDays,
        authorId: currentUserId
      });
    } catch (err) {
      console.error("Failed to save meal plan:", err);
      throw err;
    }
  };

  const handlePrevWeek = () => {
    setCurrentMonday(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentMonday(prev => addDays(prev, 7));
  };

  const handleThisWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Open modal to add meal
  const openAddMealDialog = (dateKey: string, defaultType: MealType = 'Dinner') => {
    setSelectedDateForMeal(dateKey);
    setSelectedMealType(defaultType);
    setSelectedRecipeId('');
    setCustomTitle('');
    setCustomNotes('');
    setCustomDiningPlace('');
    setCustomDiningNotes('');
    setActiveTab('recipe');
    setRecipeSearchQuery('');
    setIsAddMealModalOpen(true);
  };

  const handleAddMealSubmit = async () => {
    if (!selectedDateForMeal) return;

    let slot: MealSlot;
    if (activeTab === 'recipe') {
      if (!selectedRecipeId) return;
      slot = {
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        mealType: selectedMealType,
        recipeId: selectedRecipeId,
        isDone: false
      };
    } else if (activeTab === 'dining') {
      const place = customDiningPlace.trim() || 'Dining Out';
      slot = {
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        mealType: selectedMealType,
        isDiningOut: true,
        diningOutPlace: place,
        customTitle: `🍷 ${place}`,
        ...(customDiningNotes.trim() ? { notes: customDiningNotes.trim() } : {}),
        isDone: false
      };
    } else {
      if (!customTitle.trim()) return;
      slot = {
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        mealType: selectedMealType,
        customTitle: customTitle.trim(),
        ...(customNotes.trim() ? { notes: customNotes.trim() } : {}),
        isDone: false
      };
    }

    const currentDays = { ...(mealPlan?.days || {}) };
    const daySlots = currentDays[selectedDateForMeal] ? [...currentDays[selectedDateForMeal]] : [];
    daySlots.push(slot);
    currentDays[selectedDateForMeal] = daySlots;

    try {
      await saveMealPlanUpdate(currentDays);
      setIsAddMealModalOpen(false);
    } catch (err) {
      console.error("Error adding meal:", err);
    }
  };

  const handleToggleDone = async (dateKey: string, slotId: string) => {
    if (!mealPlan) return;
    const currentDays = { ...(mealPlan.days || {}) };
    if (!currentDays[dateKey]) return;

    currentDays[dateKey] = currentDays[dateKey].map(s => {
      if (s.id === slotId) {
        return { ...s, isDone: !s.isDone };
      }
      return s;
    });

    await saveMealPlanUpdate(currentDays);
  };

  const handleDeleteSlot = async (dateKey: string, slotId: string) => {
    if (!mealPlan) return;
    const currentDays = { ...(mealPlan.days || {}) };
    if (!currentDays[dateKey]) return;

    currentDays[dateKey] = currentDays[dateKey].filter(s => s.id !== slotId);
    if (currentDays[dateKey].length === 0) {
      delete currentDays[dateKey];
    }

    await saveMealPlanUpdate(currentDays);
  };

  const handleClearDay = async (dateKey: string) => {
    if (!mealPlan) return;
    const currentDays = { ...(mealPlan.days || {}) };
    delete currentDays[dateKey];
    await saveMealPlanUpdate(currentDays);
  };

  // Household Staples & Quick Recipes
  const stapleRecipes = useMemo(() => recipes.filter(r => r.isStaple), [recipes]);
  const quickRecipes = useMemo(() => recipes.filter(r => (r.estimatedTime && r.estimatedTime <= 35) || r.isStaple), [recipes]);

  // Open "Not Today" Quick-Swap modal
  const handleOpenNotToday = (dateKey: string, slot: MealSlot) => {
    setNotTodayTarget({ dateKey, slot });
    setNotTodaySearchQuery('');
    setShowAllQuickInNotToday(false);
    setIsNotTodayModalOpen(true);
  };

  // Perform the quick swap
  const handleSwapToStaple = async (chosenRecipe: Recipe, markAsStaple: boolean = false) => {
    if (!notTodayTarget) return;
    const { dateKey, slot } = notTodayTarget;
    const currentDays = { ...(mealPlan?.days || {}) };
    const daySlots = currentDays[dateKey] ? [...currentDays[dateKey]] : [];

    const updatedSlot: MealSlot = {
      id: slot.id,
      mealType: slot.mealType,
      recipeId: chosenRecipe.id,
      isDone: false
    };

    const slotIndex = daySlots.findIndex(s => s.id === slot.id);
    if (slotIndex >= 0) {
      daySlots[slotIndex] = updatedSlot;
    } else {
      daySlots.push(updatedSlot);
    }
    currentDays[dateKey] = daySlots;

    try {
      await saveMealPlanUpdate(currentDays);

      // If requested, also mark as staple in Firestore
      if (markAsStaple && !chosenRecipe.isStaple && chosenRecipe.id) {
        try {
          await updateDoc(doc(db, 'recipes', chosenRecipe.id), {
            isStaple: true,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Failed to mark recipe as staple during swap:", err);
        }
      }

      setIsNotTodayModalOpen(false);
      setNotTodayTarget(null);
      setSwapFeedbackToast(`Swapped to "${chosenRecipe.title}"! ⭐`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    } catch (err) {
      console.error("Failed to execute Not Today swap:", err);
      setSwapFeedbackToast(`Could not swap meal. Please try again.`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    }
  };

  // Random Staple Swap ("Surprise Me")
  const handleRandomStapleSwap = async () => {
    const candidates = stapleRecipes.length > 0 ? stapleRecipes : recipes;
    if (candidates.length === 0) return;

    setIsNotTodayRolling(true);
    setTimeout(async () => {
      setIsNotTodayRolling(false);
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const picked = candidates[randomIndex];
      await handleSwapToStaple(picked);
    }, 450);
  };

  // Filtered staples for the Not Today modal
  const filteredStaplesForModal = useMemo(() => {
    const sourceList = (showAllQuickInNotToday || stapleRecipes.length === 0) ? recipes : stapleRecipes;
    return sourceList.filter(r => {
      const matchSearch = r.title.toLowerCase().includes(notTodaySearchQuery.toLowerCase()) ||
        r.ingredients.some(ing => ing.toLowerCase().includes(notTodaySearchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [recipes, stapleRecipes, showAllQuickInNotToday, notTodaySearchQuery]);

  // Filter recipes for picker modal
  const filteredRecipesForModal = useMemo(() => {
    return recipes.filter(r => {
      if (isModalStaplesOnly && !r.isStaple) return false;
      const matchSearch = r.title.toLowerCase().includes(recipeSearchQuery.toLowerCase()) ||
        r.ingredients.some(ing => ing.toLowerCase().includes(recipeSearchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [recipes, recipeSearchQuery, isModalStaplesOnly]);

  // Aggregate grocery list for the whole week
  const weeklyGroceries = useMemo(() => {
    if (!mealPlan?.days) return [];
    const recipeMap = new Map<string, Recipe>();
    recipes.forEach(r => {
      if (r.id) recipeMap.set(r.id, r);
    });

    const ingredientsSet: { ingredient: string; recipeTitles: string[] }[] = [];
    const indexMap = new Map<string, number>();

    Object.values(mealPlan.days).forEach(daySlots => {
      daySlots.forEach(slot => {
        if (slot.recipeId && recipeMap.has(slot.recipeId)) {
          const recipe = recipeMap.get(slot.recipeId)!;
          recipe.ingredients.forEach(ing => {
            const cleanIng = ing.trim();
            if (!cleanIng) return;
            const normalizedKey = cleanIng.toLowerCase();
            if (indexMap.has(normalizedKey)) {
              const idx = indexMap.get(normalizedKey)!;
              if (!ingredientsSet[idx].recipeTitles.includes(recipe.title)) {
                ingredientsSet[idx].recipeTitles.push(recipe.title);
              }
            } else {
              indexMap.set(normalizedKey, ingredientsSet.length);
              ingredientsSet.push({
                ingredient: cleanIng,
                recipeTitles: [recipe.title]
              });
            }
          });
        }
      });
    });

    return ingredientsSet;
  }, [mealPlan, recipes]);

  // Total meals planned count
  const totalMealsPlanned = useMemo(() => {
    if (!mealPlan?.days) return 0;
    return Object.values(mealPlan.days).reduce((acc, slots) => acc + slots.length, 0);
  }, [mealPlan]);

  const completedMealsCount = useMemo(() => {
    if (!mealPlan?.days) return 0;
    return Object.values(mealPlan.days).reduce((acc, slots) => {
      return acc + slots.filter(s => s.isDone).length;
    }, 0);
  }, [mealPlan]);

  const handleSaveRemixAsRecipe = async (recipeData: {
    title: string;
    ingredients: string[];
    instructions: string[];
    category: any;
    estimatedTime: number;
    imageUrl?: string;
  }) => {
    if (!household?.id) return;
    try {
      await addDoc(collection(db, 'recipes'), {
        ...recipeData,
        authorId: currentUserId,
        householdId: household.id,
        createdAt: serverTimestamp(),
        rating: 0,
        isStaple: false,
      });
      setSwapFeedbackToast(`Saved "${recipeData.title}" to your recipe book!`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    } catch (err) {
      console.error("Failed to save remix as recipe:", err);
      throw err;
    }
  };

  const handleAddRemixToMealPlan = async (
    title: string,
    dateStr: string,
    mealType: MealType,
    notes?: string
  ) => {
    if (!household?.id) return;
    try {
      const selectedDate = new Date(dateStr + 'T00:00:00');
      const day = selectedDate.getDay();
      const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(selectedDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const year = monday.getFullYear();
      const month = String(monday.getMonth() + 1).padStart(2, '0');
      const d = String(monday.getDate()).padStart(2, '0');
      const targetWeekStartDateKey = `${year}-${month}-${d}`;

      const planDocId = `${household.id}_${targetWeekStartDateKey}`;
      const planRef = doc(db, 'mealPlans', planDocId);
      const planSnap = await getDoc(planRef);

      let currentDays: { [dateStr: string]: MealSlot[] } = {};
      if (planSnap.exists()) {
        currentDays = planSnap.data().days || {};
      }

      const daySlots = currentDays[dateStr] ? [...currentDays[dateStr]] : [];
      daySlots.push({
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        mealType,
        customTitle: title,
        notes,
        isDone: false,
      });
      currentDays[dateStr] = daySlots;

      await setDoc(planRef, {
        householdId: household.id,
        weekStartDate: targetWeekStartDateKey,
        days: cleanUndefined(currentDays),
        authorId: currentUserId,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSwapFeedbackToast(`Scheduled "${title}" on your meal plan for ${dateStr}!`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    } catch (err) {
      console.error("Failed to schedule remix on meal plan:", err);
      throw err;
    }
  };

  // Bump single missed meal to new date and slot (ensuring clean removal from source day)
  const handleBumpSingleMeal = async (
    sourceDateKey: string,
    slotId: string,
    targetDateKey: string,
    targetMealType: MealType
  ) => {
    if (!household?.id) return;
    const sourceWeekKey = getWeekStartDateKeyForDate(sourceDateKey);
    const targetWeekKey = getWeekStartDateKeyForDate(targetDateKey);

    if (sourceWeekKey === targetWeekKey && sourceWeekKey === weekStartDateKey) {
      // Same week in the currently active view
      const currentDays = JSON.parse(JSON.stringify(mealPlan?.days || {}));
      const sourceSlots: MealSlot[] = currentDays[sourceDateKey] ? [...currentDays[sourceDateKey]] : [];
      const targetSlotIndex = sourceSlots.findIndex((s: MealSlot) => s.id === slotId);
      if (targetSlotIndex === -1) return;

      const [movedSlot] = sourceSlots.splice(targetSlotIndex, 1);
      if (sourceSlots.length === 0) {
        delete currentDays[sourceDateKey];
      } else {
        currentDays[sourceDateKey] = sourceSlots;
      }

      const updatedSlot: MealSlot = {
        ...movedSlot,
        mealType: targetMealType,
        isDone: false,
      };

      const targetSlots: MealSlot[] = currentDays[targetDateKey] ? [...currentDays[targetDateKey]] : [];
      targetSlots.push(updatedSlot);
      currentDays[targetDateKey] = targetSlots;

      // Optimistic update
      setMealPlan((prev) => (prev ? { ...prev, days: currentDays } : null));

      await saveMealPlanUpdate(currentDays);

      const recipe = movedSlot.recipeId ? recipes.find((r) => r.id === movedSlot.recipeId) : undefined;
      const title = recipe?.title || movedSlot.customTitle || 'Meal';
      setSwapFeedbackToast(`Bumped "${title}" to ${targetDateKey} (${targetMealType})! 🚀`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    } else {
      // Cross-week or non-active week bump
      // 1. Remove from source week
      const sourcePlanDocId = `${household.id}_${sourceWeekKey}`;
      const sourcePlanRef = doc(db, 'mealPlans', sourcePlanDocId);
      const sourcePlanSnap = await getDoc(sourcePlanRef);
      let sourceDays: { [d: string]: MealSlot[] } = sourcePlanSnap.exists() ? (sourcePlanSnap.data().days || {}) : {};
      if (sourceWeekKey === weekStartDateKey && mealPlan?.days) {
        sourceDays = JSON.parse(JSON.stringify(mealPlan.days));
      }

      const sourceSlots: MealSlot[] = sourceDays[sourceDateKey] ? [...sourceDays[sourceDateKey]] : [];
      const targetSlotIndex = sourceSlots.findIndex((s: MealSlot) => s.id === slotId);
      if (targetSlotIndex === -1) return;

      const [movedSlot] = sourceSlots.splice(targetSlotIndex, 1);
      if (sourceSlots.length === 0) {
        delete sourceDays[sourceDateKey];
      } else {
        sourceDays[sourceDateKey] = sourceSlots;
      }

      await setDoc(sourcePlanRef, {
        householdId: household.id,
        weekStartDate: sourceWeekKey,
        days: cleanUndefined(sourceDays),
        authorId: currentUserId,
        updatedAt: serverTimestamp(),
      });

      if (sourceWeekKey === weekStartDateKey) {
        setMealPlan((prev) => (prev ? { ...prev, days: sourceDays } : null));
      }

      // 2. Add to target week
      const targetPlanDocId = `${household.id}_${targetWeekKey}`;
      const targetPlanRef = doc(db, 'mealPlans', targetPlanDocId);
      const targetPlanSnap = await getDoc(targetPlanRef);
      let targetDays: { [d: string]: MealSlot[] } = targetPlanSnap.exists() ? (targetPlanSnap.data().days || {}) : {};
      if (targetWeekKey === weekStartDateKey && mealPlan?.days) {
        targetDays = JSON.parse(JSON.stringify(mealPlan.days));
      }

      const updatedSlot: MealSlot = {
        ...movedSlot,
        mealType: targetMealType,
        isDone: false,
      };

      const targetSlots: MealSlot[] = targetDays[targetDateKey] ? [...targetDays[targetDateKey]] : [];
      targetSlots.push(updatedSlot);
      targetDays[targetDateKey] = targetSlots;

      await setDoc(targetPlanRef, {
        householdId: household.id,
        weekStartDate: targetWeekKey,
        days: cleanUndefined(targetDays),
        authorId: currentUserId,
        updatedAt: serverTimestamp(),
      });

      if (targetWeekKey === weekStartDateKey) {
        setMealPlan((prev) => (prev ? { ...prev, days: targetDays } : null));
      }

      const recipe = movedSlot.recipeId ? recipes.find((r) => r.id === movedSlot.recipeId) : undefined;
      const title = recipe?.title || movedSlot.customTitle || 'Meal';
      setSwapFeedbackToast(`Bumped "${title}" to ${targetDateKey} (${targetMealType})! 🚀`);
      setTimeout(() => setSwapFeedbackToast(null), 3500);
    }
  };

  // Auto-bump all missed meals according to calculated plan
  const handleAutoBumpAll = async (
    bumpingPlan: { sourceDateKey: string; slot: MealSlot; targetDateKey: string; targetMealType: MealType }[]
  ) => {
    if (!household?.id || bumpingPlan.length === 0) return;

    // Collect all affected week start dates
    const affectedWeeks = new Set<string>();
    bumpingPlan.forEach((p) => {
      affectedWeeks.add(getWeekStartDateKeyForDate(p.sourceDateKey));
      affectedWeeks.add(getWeekStartDateKeyForDate(p.targetDateKey));
    });

    // Load data for all affected weeks
    const weekDataMap: { [weekKey: string]: { [d: string]: MealSlot[] } } = {};
    for (const wKey of affectedWeeks) {
      if (wKey === weekStartDateKey && mealPlan?.days) {
        weekDataMap[wKey] = JSON.parse(JSON.stringify(mealPlan.days));
      } else {
        const planDocId = `${household.id}_${wKey}`;
        const planSnap = await getDoc(doc(db, 'mealPlans', planDocId));
        weekDataMap[wKey] = planSnap.exists() ? (planSnap.data().days || {}) : {};
      }
    }

    // Apply removals from source dates
    bumpingPlan.forEach(({ sourceDateKey, slot }) => {
      const sWeek = getWeekStartDateKeyForDate(sourceDateKey);
      const days = weekDataMap[sWeek];
      if (days && days[sourceDateKey]) {
        days[sourceDateKey] = days[sourceDateKey].filter((s) => s.id !== slot.id);
        if (days[sourceDateKey].length === 0) {
          delete days[sourceDateKey];
        }
      }
    });

    // Apply additions to target dates
    bumpingPlan.forEach(({ slot, targetDateKey, targetMealType }) => {
      const tWeek = getWeekStartDateKeyForDate(targetDateKey);
      const days = weekDataMap[tWeek] || {};
      const updatedSlot: MealSlot = {
        ...slot,
        mealType: targetMealType,
        isDone: false,
      };
      const slots = days[targetDateKey] ? [...days[targetDateKey]] : [];
      slots.push(updatedSlot);
      days[targetDateKey] = slots;
      weekDataMap[tWeek] = days;
    });

    // Save all affected weeks cleanly
    for (const wKey of affectedWeeks) {
      const planDocId = `${household.id}_${wKey}`;
      const planRef = doc(db, 'mealPlans', planDocId);
      const sanitizedDays = cleanUndefined(weekDataMap[wKey]);
      await setDoc(planRef, {
        householdId: household.id,
        weekStartDate: wKey,
        days: sanitizedDays,
        authorId: currentUserId,
        updatedAt: serverTimestamp(),
      });
      if (wKey === weekStartDateKey) {
        setMealPlan((prev) => (prev ? { ...prev, days: sanitizedDays } : null));
      }
    }

    setSwapFeedbackToast(`Successfully bumped ${bumpingPlan.length} unmade meals to upcoming open slots! 🚀`);
    setTimeout(() => setSwapFeedbackToast(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Week Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">
                Weekly Meal Plan
              </h2>
              {totalMealsPlanned > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                  {completedMealsCount}/{totalMealsPlanned} Cooked
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {weekRangeLabel}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Week Navigation */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-1 border border-stone-200 dark:border-stone-700">
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-white dark:hover:bg-stone-700 rounded-full text-stone-600 dark:text-stone-300 transition-colors"
              title="Previous Week"
              aria-label="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleThisWeek}
              className="px-3 py-1 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-white dark:hover:bg-stone-700 rounded-full text-stone-600 dark:text-stone-300 transition-colors"
              title="Next Week"
              aria-label="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Google Calendar Sync & Insights Button */}
          <button
            onClick={() => setIsGoogleCalendarModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all shadow-xs active:scale-95 border",
              calendarAuthStatus.isConnected
                ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700"
            )}
            title="Connect Google Calendar to sync meal plans and auto-detect dining out schedules"
          >
            <CalendarCheck className={cn("w-4 h-4", calendarAuthStatus.isConnected ? "text-blue-600 dark:text-blue-400" : "text-stone-500")} />
            <span>Calendar Sync</span>
            {calendarAuthStatus.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Google Calendar Active" />
            )}
          </button>

          {/* AI Auto-Plan Week Button */}
          <button
            onClick={() => setIsAiPlannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-semibold transition-all shadow-sm shadow-amber-500/20 active:scale-95"
            title="Use Gemini AI to populate your weekly plan based on seasonal produce and trends"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Plan Week</span>
          </button>

          {/* Leftover Remix & Freshness Tracker Button */}
          <button
            onClick={() => {
              setRemixInitialMealId(undefined);
              setIsLeftoverRemixOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-sm font-semibold transition-all shadow-sm active:scale-95"
            title="Transform fridge leftovers into 3 delicious new meal creations"
          >
            <Soup className="w-4 h-4" />
            <span>Leftover Remix</span>
            {pastMeals.length > 0 && (
              <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                {pastMeals.length}
              </span>
            )}
          </button>

          {/* Grocery List Button */}
          <button
            onClick={() => setIsGroceryModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-stone-800 hover:bg-stone-700 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium transition-all shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Grocery List</span>
            {weeklyGroceries.length > 0 && (
              <span className="bg-amber-700/60 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                {weeklyGroceries.length}
              </span>
            )}
          </button>

          {/* Missed Meals Bump Quick Action Button */}
          {totalMealsPlanned > 0 && (
            <button
              onClick={() => {
                setBumpInitialSlotId(undefined);
                setIsBumpModalOpen(true);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-xs active:scale-95",
                missedMeals.length > 0
                  ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20 animate-pulse font-bold"
                  : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
              )}
              title="Reschedule planned or missed meals to upcoming open slots"
            >
              <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{missedMeals.length > 0 ? 'Reschedule Missed' : 'Reschedule / Bump'}</span>
              {missedMeals.length > 0 && (
                <span className="bg-white text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {missedMeals.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Missed Meals Alert Banner */}
      {missedMeals.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                  {missedMeals.length} Unmade Meal{missedMeals.length === 1 ? '' : 's'} from Past Days
                </h4>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  Action Needed
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                Life happened! Bump your unmade recipes ({missedMeals.map(m => m.title).slice(0, 2).join(', ')}{missedMeals.length > 2 ? `, +${missedMeals.length - 2} more` : ''}) to open slots later this week so groceries don't go to waste.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setBumpInitialSlotId(undefined);
              setIsBumpModalOpen(true);
            }}
            className="flex-shrink-0 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 active:scale-95"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Bump Missed Meals</span>
          </button>
        </motion.div>
      )}

      {/* Empty Week AI Banner Prompt */}
      {totalMealsPlanned === 0 && !loading && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                Plan this week in seconds with AI
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Automatically populate meals from your recipe book with seasonal ingredients, trend-inspired pairings, and balanced weekday pacing.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAiPlannerOpen(true)}
            className="flex-shrink-0 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Plan Week</span>
          </button>
        </div>
      )}

      {/* 7-Day Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDays.map(day => {
          const daySlots = mealPlan?.days?.[day.dateKey] || [];
          
          return (
            <div 
              key={day.dateKey}
              className={cn(
                "flex flex-col rounded-3xl p-4 transition-all border",
                day.isToday 
                  ? "bg-stone-50/90 dark:bg-stone-900/90 border-amber-500/40 dark:border-amber-500/40 ring-2 ring-amber-500/10 shadow-sm" 
                  : "bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800"
              )}
            >
              {/* Day Header */}
              <div className="pb-2.5 mb-2.5 border-b border-stone-100 dark:border-stone-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                        {day.shortName}
                      </span>
                      {day.isToday && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">
                      {day.monthDay}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {daySlots.length > 0 && (
                      <button
                        onClick={() => handleClearDay(day.dateKey)}
                        title="Clear all meals for this day"
                        className="p-1 text-stone-300 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openAddMealDialog(day.dateKey)}
                      className="p-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-full transition-colors"
                      title={`Add meal for ${day.dayName}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Insights Tags for Day */}
                {calendarInsights?.[day.dateKey] && (
                  <div className="flex flex-wrap gap-1">
                    {calendarInsights[day.dateKey].hasDiningOut && (
                      <span 
                        title={`Google Calendar: ${calendarInsights[day.dateKey].diningOutEvents.map(e => e.summary).join(', ')}`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 cursor-help"
                      >
                        <span>🍷</span>
                        <span className="truncate max-w-[85px]">{calendarInsights[day.dateKey].diningOutEvents[0]?.summary || 'Dining Out'}</span>
                      </span>
                    )}
                    {calendarInsights[day.dateKey].isBusyEvening && (
                      <span 
                        title={`Google Calendar: Busy evening (${calendarInsights[day.dateKey].busyEveningEvents.map(e => e.summary).join(', ')})`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700/80 cursor-help"
                      >
                        <span>⚡</span>
                        <span>Busy Eve</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Day Meal Slots */}
              <div className="flex-1 space-y-2.5 min-h-[220px]">
                {daySlots.length === 0 ? (
                  <div 
                    onClick={() => openAddMealDialog(day.dateKey)}
                    className="h-full border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 transition-colors group"
                  >
                    <Utensils className="w-5 h-5 text-stone-300 dark:text-stone-700 group-hover:text-amber-500 transition-colors mb-1" />
                    <span className="text-xs text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 font-medium">
                      + Plan Meal
                    </span>
                  </div>
                ) : (
                  daySlots.map((slot, sIdx) => {
                    const matchedRecipe = slot.recipeId ? recipes.find(r => r.id === slot.recipeId) : null;
                    const typeConfig = MEAL_TYPES.find(t => t.type === slot.mealType) || MEAL_TYPES[2];
                    const uniqueKey = slot.id ? `${day.dateKey}_${slot.id}_${sIdx}` : `${day.dateKey}_slot_${sIdx}`;

                    return (
                      <div
                        key={uniqueKey}
                        className={cn(
                          "group/slot relative rounded-2xl p-2.5 transition-all border text-left",
                          slot.isDone
                            ? "bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800/80 opacity-75"
                            : "bg-white dark:bg-stone-800/90 border-stone-200/80 dark:border-stone-700 shadow-sm hover:border-amber-400 dark:hover:border-amber-600"
                        )}
                      >
                        {/* Meal Type Pill & Action Controls */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", typeConfig.badgeColor)}>
                            <span>{typeConfig.icon}</span>
                            <span>{typeConfig.label}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            {/* Bump / Reschedule button for any unmade meal */}
                            {!slot.isDone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSingleBumpTarget({
                                    dateKey: day.dateKey,
                                    slot,
                                    recipe: matchedRecipe
                                  });
                                }}
                                title="Bump or reschedule this meal to another day"
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800 border border-amber-300/80 dark:border-amber-700 transition-all flex items-center gap-0.5 active:scale-95 shadow-xs"
                              >
                                <CalendarClock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>Bump</span>
                              </button>
                            )}

                            {!slot.isDone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenNotToday(day.dateKey, slot);
                                }}
                                title="Not feeling this meal today? Swap with a quick staple"
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200/90 dark:border-amber-800 transition-all flex items-center gap-0.5 active:scale-95 shadow-xs"
                              >
                                <RotateCcw className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>Not Today</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleDone(day.dateKey, slot.id)}
                              title={slot.isDone ? "Mark as uncooked" : "Mark as cooked"}
                              className={cn(
                                "p-1 rounded transition-colors",
                                slot.isDone ? "text-emerald-500" : "text-stone-300 hover:text-stone-600 dark:hover:text-stone-200"
                              )}
                            >
                              {slot.isDone ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(day.dateKey, slot.id)}
                              title="Remove from meal plan"
                              className="p-1 opacity-0 group-hover/slot:opacity-100 text-stone-300 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Meal Content */}
                        {slot.isDiningOut || slot.recipeId === 'dining_out' ? (
                          <div className="space-y-1.5">
                            <div className="flex gap-2 items-start">
                              <div className="w-10 h-10 rounded-lg bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/80 flex items-center justify-center text-lg flex-shrink-0 text-amber-800 dark:text-amber-200 shadow-2xs">
                                🍷
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                                    Dining Out
                                  </span>
                                </div>
                                <h4 className={cn(
                                  "font-serif font-bold text-xs leading-snug line-clamp-2 text-stone-900 dark:text-stone-100 mt-0.5",
                                  slot.isDone && "line-through text-stone-400 dark:text-stone-500"
                                )}>
                                  {slot.diningOutPlace || slot.customTitle || 'Dining Out'}
                                </h4>
                                {slot.notes && (
                                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 line-clamp-2 italic mt-0.5">
                                    {slot.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : matchedRecipe ? (
                          <div 
                            onClick={() => onViewRecipe(matchedRecipe)}
                            className="cursor-pointer space-y-1.5"
                          >
                            <div className="flex gap-2 items-start">
                              {matchedRecipe.imageUrl ? (
                                <img
                                  src={matchedRecipe.imageUrl}
                                  referrerPolicy="no-referrer"
                                  alt={matchedRecipe.title}
                                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-stone-200 dark:border-stone-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-stone-400 flex-shrink-0">
                                  <Utensils className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className={cn(
                                  "font-serif font-bold text-xs leading-snug line-clamp-2 text-stone-900 dark:text-stone-100 group-hover/slot:text-amber-600 dark:group-hover/slot:text-amber-400 transition-colors",
                                  slot.isDone && "line-through text-stone-400 dark:text-stone-500"
                                )}>
                                  {matchedRecipe.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                                  <span>{matchedRecipe.ingredients.length} ingr.</span>
                                  {matchedRecipe.estimatedTime && (
                                    <span>• {matchedRecipe.estimatedTime}m</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Cooked Leftover / Freshness Badge & Quick Remix trigger */}
                            {slot.isDone && (
                              <div 
                                onClick={(e) => e.stopPropagation()} 
                                className="pt-1.5 mt-1 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-1 text-[10px]"
                              >
                                {(() => {
                                  const evalInfo = evaluateFoodFreshness(
                                    day.dateKey,
                                    matchedRecipe.title,
                                    matchedRecipe.ingredients
                                  );
                                  return (
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border",
                                        evalInfo.badgeBg,
                                        evalInfo.badgeText,
                                        evalInfo.badgeBorder
                                      )}
                                      title={evalInfo.actionRecommendation}
                                    >
                                      <span className={cn("w-1.5 h-1.5 rounded-full", evalInfo.dotColor)} />
                                      <span>{evalInfo.statusLabel}</span>
                                    </span>
                                  );
                                })()}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemixInitialMealId(`${day.dateKey}_${slot.id}`);
                                    setIsLeftoverRemixOpen(true);
                                  }}
                                  className="text-amber-700 dark:text-amber-300 font-bold hover:underline flex items-center gap-0.5"
                                  title="Remix leftovers from this cooked dish"
                                >
                                  <Soup className="w-3 h-3" />
                                  <span>Remix</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <h4 className={cn(
                              "font-serif font-bold text-xs leading-snug text-stone-900 dark:text-stone-100",
                              slot.isDone && "line-through text-stone-400 dark:text-stone-500"
                            )}>
                              {slot.customTitle || 'Custom Meal'}
                            </h4>
                            {slot.notes && (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 italic">
                                {slot.notes}
                              </p>
                            )}

                            {/* Cooked Custom Meal Freshness */}
                            {slot.isDone && (
                              <div className="pt-1.5 mt-1 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-1 text-[10px]">
                                {(() => {
                                  const evalInfo = evaluateFoodFreshness(
                                    day.dateKey,
                                    slot.customTitle || 'Custom Meal',
                                    []
                                  );
                                  return (
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border",
                                        evalInfo.badgeBg,
                                        evalInfo.badgeText,
                                        evalInfo.badgeBorder
                                      )}
                                      title={evalInfo.actionRecommendation}
                                    >
                                      <span className={cn("w-1.5 h-1.5 rounded-full", evalInfo.dotColor)} />
                                      <span>{evalInfo.statusLabel}</span>
                                    </span>
                                  );
                                })()}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemixInitialMealId(`${day.dateKey}_${slot.id}`);
                                    setIsLeftoverRemixOpen(true);
                                  }}
                                  className="text-amber-700 dark:text-amber-300 font-bold hover:underline flex items-center gap-0.5"
                                >
                                  <Soup className="w-3 h-3" />
                                  <span>Remix</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add Button at bottom if already has meals */}
              {daySlots.length > 0 && (
                <button
                  onClick={() => openAddMealDialog(day.dateKey)}
                  className="mt-2 text-center py-1.5 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Meal
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Meal Dialog Modal */}
      <AnimatePresence>
        {isAddMealModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setIsAddMealModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50">
                    Plan a Meal
                  </h3>
                  <p className="text-xs text-stone-500">
                    {selectedDateForMeal && new Date(selectedDateForMeal + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <button 
                  onClick={() => setIsAddMealModalOpen(false)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* Meal Type Selection */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                    Meal Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map(t => (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setSelectedMealType(t.type)}
                        className={cn(
                          "py-2 px-2 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition-all",
                          selectedMealType === t.type
                            ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm"
                            : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-400"
                        )}
                      >
                        <span className="text-base">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Switcher: Existing Recipe vs Custom Meal vs Dining Out */}
                <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 border border-stone-200 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('recipe')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      activeTab === 'recipe'
                        ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm"
                        : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                    )}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Recipes ({recipes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('custom')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      activeTab === 'custom'
                        ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm"
                        : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                    )}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Custom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dining')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                      activeTab === 'dining'
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                    )}
                  >
                    <span>🍷</span>
                    <span>Dining Out</span>
                  </button>
                </div>

                {activeTab === 'recipe' ? (
                  <div className="space-y-3">
                    {/* Search and Filters */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Search your recipes..."
                          value={recipeSearchQuery}
                          onChange={(e) => setRecipeSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsModalStaplesOnly(prev => !prev)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1",
                          isModalStaplesOnly
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200"
                        )}
                        title="Filter by household staple recipes"
                      >
                        <Star className={cn("w-3.5 h-3.5", isModalStaplesOnly ? "fill-white" : "text-amber-500")} />
                        <span>Staples ({stapleRecipes.length})</span>
                      </button>
                    </div>

                    {/* Recipe List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {filteredRecipesForModal.length === 0 ? (
                        <div className="text-center py-8 space-y-2">
                          <p className="text-xs text-stone-400">No matching recipes found.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddMealModalOpen(false);
                              onRequestAddRecipe();
                            }}
                            className="text-xs font-semibold text-amber-600 hover:underline"
                          >
                            + Create a new recipe first
                          </button>
                        </div>
                      ) : (
                        filteredRecipesForModal.map(r => (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRecipeId(r.id || '')}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                              selectedRecipeId === r.id
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-stone-900 dark:text-stone-50"
                                : "bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 hover:border-stone-400"
                            )}
                          >
                            {r.imageUrl ? (
                              <img src={r.imageUrl} referrerPolicy="no-referrer" alt={r.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-stone-400 flex-shrink-0">
                                <Utensils className="w-4 h-4" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-serif font-bold text-sm truncate">{r.title}</h5>
                              <span className="text-[10px] text-stone-400">{r.category} • {r.ingredients.length} ingredients</span>
                            </div>
                            {selectedRecipeId === r.id && (
                              <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : activeTab === 'dining' ? (
                  <div className="space-y-3 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <span>🍷</span>
                      <span>Dining Out / Restaurant Reservation</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block mb-1">
                        Restaurant / Event Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Osteria Francescana, Date Night, Dinner with Sarah..."
                        value={customDiningPlace}
                        onChange={(e) => setCustomDiningPlace(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block mb-1">
                        Reservation Time / Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Table for 4 @ 7:30 PM, Dress code smart casual"
                        value={customDiningNotes}
                        onChange={(e) => setCustomDiningNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block mb-1">
                        Meal Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Leftover Roast Chicken, Tacos with friends..."
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-600 dark:text-stone-300 block mb-1">
                        Notes / Sides (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., Pick up fresh cilantro on the way home"
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMealModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMealSubmit}
                  disabled={
                    activeTab === 'recipe' 
                      ? !selectedRecipeId 
                      : activeTab === 'dining'
                        ? !customDiningPlace.trim()
                        : !customTitle.trim()
                  }
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 disabled:opacity-50 transition-all"
                >
                  Add to Meal Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Weekly Grocery List Modal */}
      <SmartGroceryListModal
        isOpen={isGroceryModalOpen}
        onClose={() => setIsGroceryModalOpen(false)}
        mealPlan={mealPlan}
        recipes={recipes}
        weekRangeLabel={weekRangeLabel}
        weekStartDateKey={weekStartDateKey}
        householdId={household.id || 'default_household'}
      />

      {/* AI Meal Planner Modal */}
      <AiMealPlannerModal
        isOpen={isAiPlannerOpen}
        onClose={() => setIsAiPlannerOpen(false)}
        recipes={recipes}
        weekStartDate={weekStartDateKey}
        weekRangeLabel={weekRangeLabel}
        existingDays={mealPlan?.days || {}}
        onApplyPlan={async (newDays) => {
          await saveMealPlanUpdate(newDays);
        }}
        onRequestAddRecipe={onRequestAddRecipe}
        household={household}
      />

      {/* "Not Today" Quick-Swap Modal */}
      <AnimatePresence>
        {isNotTodayModalOpen && notTodayTarget && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/75 backdrop-blur-sm"
            onClick={() => setIsNotTodayModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50">
                      Not Feeling It Today?
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Quickly swap with a household staple or reliable go-to dinner.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNotTodayModalOpen(false)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Meal Context Card */}
              {(() => {
                const currentSlot = notTodayTarget.slot;
                const currentRecipe = currentSlot.recipeId ? recipes.find(r => r.id === currentSlot.recipeId) : null;
                const currentDayInfo = weekDays.find(d => d.dateKey === notTodayTarget.dateKey);
                
                return (
                  <div className="mt-4 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {currentRecipe?.imageUrl ? (
                        <img 
                          src={currentRecipe.imageUrl} 
                          referrerPolicy="no-referrer" 
                          alt={currentRecipe.title} 
                          className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-stone-400 flex-shrink-0">
                          <Utensils className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Replacing {currentSlot.mealType} • {currentDayInfo?.dayName || notTodayTarget.dateKey}
                        </div>
                        <div className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
                          {currentRecipe?.title || currentSlot.customTitle || 'Current Meal'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Random Surprise Button */}
                    <button
                      type="button"
                      onClick={handleRandomStapleSwap}
                      disabled={isNotTodayRolling || (stapleRecipes.length === 0 && recipes.length === 0)}
                      className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                      title="Randomly pick a household staple"
                    >
                      <Shuffle className={cn("w-3.5 h-3.5", isNotTodayRolling && "animate-spin")} />
                      <span>{isNotTodayRolling ? "Picking..." : "🎲 Random Swap"}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Search & Tabs */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search staples or ingredients..."
                      value={notTodaySearchQuery}
                      onChange={(e) => setNotTodaySearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllQuickInNotToday(prev => !prev)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap",
                      showAllQuickInNotToday
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200"
                    )}
                  >
                    {showAllQuickInNotToday ? "⭐ Staples Only" : "All Recipes"}
                  </button>
                </div>
              </div>

              {/* Staples List */}
              <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2.5 min-h-[260px]">
                {filteredStaplesForModal.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                    <Star className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
                    <h4 className="font-serif font-bold text-sm text-stone-800 dark:text-stone-200">
                      {stapleRecipes.length === 0 
                        ? "No Household Staples Designated Yet"
                        : "No matching recipes found"}
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
                      {stapleRecipes.length === 0 
                        ? "Designate your family's reliable favorite meals as staples in your recipe book, or browse all recipes to swap right now."
                        : "Try clearing your search query or switch to browse all recipes."}
                    </p>
                    {stapleRecipes.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllQuickInNotToday(true)}
                        className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                      >
                        Browse All Household Recipes
                      </button>
                    )}
                  </div>
                ) : (
                  filteredStaplesForModal.map(staple => (
                    <div
                      key={staple.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-stone-200/80 dark:border-stone-700 bg-white dark:bg-stone-800/90 hover:border-amber-400 dark:hover:border-amber-500 transition-all group"
                    >
                      <div 
                        onClick={() => onViewRecipe(staple)} 
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        {staple.imageUrl ? (
                          <img 
                            src={staple.imageUrl} 
                            referrerPolicy="no-referrer" 
                            alt={staple.title} 
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-stone-400 flex-shrink-0">
                            <Utensils className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {staple.isStaple && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" /> Staple
                              </span>
                            )}
                            <span className="text-[10px] text-stone-400">{staple.category}</span>
                          </div>
                          <h5 className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {staple.title}
                          </h5>
                          <div className="flex items-center gap-3 text-[10px] text-stone-400 mt-0.5">
                            <span>{staple.ingredients.length} ingredients</span>
                            {staple.estimatedTime && <span>• {staple.estimatedTime}m</span>}
                            {staple.rating ? <span>• ⭐ {staple.rating}</span> : null}
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSwapToStaple(staple, !staple.isStaple)}
                          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Swap</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <span className="text-xs text-stone-400">
                  {stapleRecipes.length} household staple{stapleRecipes.length === 1 ? '' : 's'} available
                </span>
                <button
                  type="button"
                  onClick={() => setIsNotTodayModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leftover Remix & Freshness Tracker Modal */}
      <LeftoverRemixModal
        isOpen={isLeftoverRemixOpen}
        onClose={() => {
          setIsLeftoverRemixOpen(false);
          setRemixInitialMealId(undefined);
        }}
        pastMeals={pastMeals}
        initialSelectedMealId={remixInitialMealId}
        onSaveAsRecipe={handleSaveRemixAsRecipe}
        onAddToMealPlan={handleAddRemixToMealPlan}
      />

      {/* Bump Missed Meals Modal */}
      <BumpMissedMealsModal
        isOpen={isBumpModalOpen}
        onClose={() => {
          setIsBumpModalOpen(false);
          setBumpInitialSlotId(undefined);
        }}
        missedMeals={missedMeals}
        weekDays={weekDaysWithOptions}
        onBumpSingleMeal={handleBumpSingleMeal}
        onAutoBumpAll={handleAutoBumpAll}
        onMarkSlotDone={handleToggleDone}
        onDeleteSlot={handleDeleteSlot}
        initialTargetSlotId={bumpInitialSlotId}
      />

      {/* Single Meal Bump / Reschedule Modal */}
      <SingleMealBumpModal
        isOpen={Boolean(singleBumpTarget)}
        onClose={() => setSingleBumpTarget(null)}
        sourceDateKey={singleBumpTarget?.dateKey || ''}
        slot={singleBumpTarget?.slot || null}
        recipe={singleBumpTarget?.recipe}
        weekDays={weekDaysWithOptions}
        onBumpMeal={handleBumpSingleMeal}
      />

      {/* Google Calendar Sync & Insights Modal */}
      <GoogleCalendarSyncModal
        isOpen={isGoogleCalendarModalOpen}
        onClose={() => {
          setIsGoogleCalendarModalOpen(false);
          // Refresh calendar auth status and insights when closing modal
          const auth = getStoredCalendarToken();
          setCalendarAuthStatus(auth);
          if (auth.isConnected) {
            fetchWeekCalendarEvents(weekStartDateKey)
              .then(setCalendarInsights)
              .catch(console.warn);
          }
        }}
        mealPlan={mealPlan}
        recipes={recipes}
        weekStartDateKey={weekStartDateKey}
        weekRangeLabel={weekRangeLabel}
        onCalendarUpdated={() => {
          const auth = getStoredCalendarToken();
          setCalendarAuthStatus(auth);
          if (auth.isConnected) {
            fetchWeekCalendarEvents(weekStartDateKey)
              .then(setCalendarInsights)
              .catch(console.warn);
          }
        }}
      />

      {/* Feedback Toast */}
      <AnimatePresence>
        {swapFeedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-stone-900/95 dark:bg-stone-100/95 text-white dark:text-stone-900 text-sm font-semibold shadow-xl backdrop-blur-sm border border-stone-700/50 dark:border-stone-300/50 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-400 dark:text-amber-600" />
            <span>{swapFeedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
