import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, MealSlot, MealType, Household } from '../types';
import { generateAiMealPlan, AiMealPlanResponse } from '../services/geminiService';
import { 
  getStoredCalendarToken, 
  requestGoogleCalendarAccess, 
  fetchWeekCalendarEvents, 
  CalendarAuthStatus 
} from '../services/calendarService';
import { WeekCalendarInsights } from '../types';
import { 
  Sparkles, 
  X, 
  Calendar, 
  Clock, 
  Utensils, 
  Loader2, 
  Check, 
  RefreshCw, 
  Flame, 
  Leaf, 
  Zap, 
  Sun, 
  SlidersHorizontal, 
  Info,
  ChevronRight,
  Plus,
  ChefHat,
  Ban,
  Scale,
  Repeat,
  Compass,
  CalendarCheck,
  Wine
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AiMealPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  weekStartDate: string; // YYYY-MM-DD
  weekRangeLabel: string;
  existingDays: { [dateStr: string]: MealSlot[] };
  onApplyPlan: (newDays: { [dateStr: string]: MealSlot[] }) => Promise<void>;
  onRequestAddRecipe: () => void;
  household?: Household | null;
}

const AVAILABLE_MEAL_TYPES: { type: MealType; label: string; icon: string; desc: string }[] = [
  { type: 'Breakfast', label: 'Breakfast', icon: '🌅', desc: 'Morning energy & quick starts' },
  { type: 'Lunch', label: 'Lunch', icon: '☀️', desc: 'Midday meals & fresh bowls' },
  { type: 'Dinner', label: 'Dinner', icon: '🌙', desc: 'Evening mains & comfort dishes' },
  { type: 'Snack', label: 'Snack / Treat', icon: '🍪', desc: 'Afternoon bites & desserts' }
];

const VARIETY_CONFIGS: {
  [level: number]: {
    label: string;
    tagline: string;
    description: string;
    icon: any;
    bgTint: string;
    borderTint: string;
    badgeBg: string;
    badgeText: string;
    highlights: string[];
  };
} = {
  1: {
    label: 'Max Consistency',
    tagline: 'Batch Cooking & Planned Leftovers',
    description: 'Selects 2–3 core recipes and repeats them across multiple days. Minimizes cooking time, grocery complexity, and weekday decision fatigue with deliberate batch prep.',
    icon: Repeat,
    bgTint: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    borderTint: 'border-emerald-200 dark:border-emerald-800/60',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    highlights: ['🔁 2–3 Core Recipes', '⏱️ Batch Prep & Leftovers', '🧺 Simple Grocery Run']
  },
  2: {
    label: 'Familiar Routine',
    tagline: 'Tested Staples & Light Repeats',
    description: 'Focuses on proven household classics with 1–2 scheduled batch repeats or crossover lunches across the 7 days to keep cooking streamlined.',
    icon: Utensils,
    bgTint: 'bg-teal-50/70 dark:bg-teal-950/30',
    borderTint: 'border-teal-200 dark:border-teal-800/60',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/50',
    badgeText: 'text-teal-800 dark:text-teal-300',
    highlights: ['⭐ Go-To Classics', '🍱 Crossover Meals', '🌱 Low Friction']
  },
  3: {
    label: 'Balanced Mix',
    tagline: 'Golden Balance of Staples & Variety',
    description: 'The recommended weekly balance — blends dependable household favorites with fresh daily variety and zero consecutive identical dinners.',
    icon: Scale,
    bgTint: 'bg-amber-50/70 dark:bg-amber-950/30',
    borderTint: 'border-amber-200 dark:border-amber-800/60',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/50',
    badgeText: 'text-amber-800 dark:text-amber-300',
    highlights: ['⚖️ Golden Balance', '🔄 No Consecutive Repeats', '🥗 Fresh Pacing']
  },
  4: {
    label: 'Broad Variety',
    tagline: 'Rotated Proteins & Global Flavors',
    description: 'Maximizes culinary diversity by rotating protein types (poultry, seafood, veggie, beef/pasta) and distinct flavor styles across each day with minimal repeats.',
    icon: Sparkles,
    bgTint: 'bg-orange-50/70 dark:bg-orange-950/30',
    borderTint: 'border-orange-200 dark:border-orange-800/60',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/50',
    badgeText: 'text-orange-800 dark:text-orange-300',
    highlights: ['🥩 Rotated Proteins', '🌮 Distinct Cuisines', '✨ Minimal Repeats']
  },
  5: {
    label: 'Max Exploration',
    tagline: '100% Unique Daily Recipes',
    description: 'Every single day and meal slot is completely unique. Broad exploration across your entire recipe catalog with zero repetition throughout the week.',
    icon: Compass,
    bgTint: 'bg-indigo-50/70 dark:bg-indigo-950/30',
    borderTint: 'border-indigo-200 dark:border-indigo-800/60',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    highlights: ['🧭 100% Unique Daily', '📚 Deep Catalog Exploration', '🎉 Zero Repeats']
  }
};

export const AiMealPlannerModal: React.FC<AiMealPlannerModalProps> = ({
  isOpen,
  onClose,
  recipes,
  weekStartDate,
  weekRangeLabel,
  existingDays,
  onApplyPlan,
  onRequestAddRecipe,
  household
}) => {
  // Config state
  const [selectedMealTypes, setSelectedMealTypes] = useState<MealType[]>(['Dinner']);
  const [varietyLevel, setVarietyLevel] = useState<number>(3);
  const [seasonalFocus, setSeasonalFocus] = useState(true);
  const [trendFocus, setTrendFocus] = useState(true);
  const [quickWeekdays, setQuickWeekdays] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace');

  // Google Calendar Integration State
  const [calendarAuth, setCalendarAuth] = useState<CalendarAuthStatus>({ isConnected: false, accessToken: null });
  const [calendarInsights, setCalendarInsights] = useState<WeekCalendarInsights | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [autoOmitDiningOut, setAutoOmitDiningOut] = useState(true);
  const [prioritizeQuickOnBusy, setPrioritizeQuickOnBusy] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiMealPlanResponse | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Load calendar on open if connected
  useEffect(() => {
    if (isOpen) {
      const auth = getStoredCalendarToken();
      setCalendarAuth(auth);
      if (auth.isConnected && auth.accessToken) {
        setIsLoadingCalendar(true);
        fetchWeekCalendarEvents(weekStartDate, auth.accessToken)
          .then((insights) => setCalendarInsights(insights))
          .catch((err) => console.warn("Could not load calendar events for planner:", err))
          .finally(() => setIsLoadingCalendar(false));
      }
    }
  }, [isOpen, weekStartDate]);

  const handleConnectCalendar = async () => {
    setIsConnectingCalendar(true);
    try {
      const { accessToken, email } = await requestGoogleCalendarAccess();
      setCalendarAuth({ isConnected: true, accessToken, userEmail: email });
      setIsLoadingCalendar(true);
      const insights = await fetchWeekCalendarEvents(weekStartDate, accessToken);
      setCalendarInsights(insights);
    } catch (err: any) {
      console.error("Failed to connect Google Calendar in planner:", err);
      setError(err?.message || "Failed to connect Google Calendar.");
    } finally {
      setIsConnectingCalendar(false);
      setIsLoadingCalendar(false);
    }
  };

  // Household Profile Details
  const profile = household?.kitchenProfile;
  const activeAppliances = useMemo(() => {
    const std = profile?.appliances || [];
    const custom = profile?.customAppliances ? profile.customAppliances.split(',').map(s => s.trim()).filter(Boolean) : [];
    return [...std, ...custom];
  }, [profile]);

  const activeDietary = useMemo(() => {
    const std = profile?.dietaryRestrictions || [];
    const custom = profile?.customDietaryRestrictions ? profile.customDietaryRestrictions.split(',').map(s => s.trim()).filter(Boolean) : [];
    return [...std, ...custom];
  }, [profile]);

  const activeDislikes = useMemo(() => {
    const std = profile?.dislikedIngredients || [];
    const custom = profile?.customDislikedIngredients ? profile.customDislikedIngredients.split(',').map(s => s.trim()).filter(Boolean) : [];
    return [...std, ...custom];
  }, [profile]);

  const currentVarietyConfig = VARIETY_CONFIGS[varietyLevel] || VARIETY_CONFIGS[3];
  const VarietyIcon = currentVarietyConfig.icon;

  // Derive season and date information
  const { monthName, seasonName, seasonDetails, trendBadges } = useMemo(() => {
    const d = new Date(weekStartDate + 'T00:00:00');
    const m = d.getMonth();
    const month = d.toLocaleString('en-US', { month: 'long' });

    let season = 'Summer';
    let details = 'Heirloom tomatoes, sweet corn, zucchini, fresh basil, berries, peaches & grilling.';
    let trends = ['Vibrant Mediterranean Bowls', 'Sheet Pan Dinners', 'Fresh Herb Dressings'];

    if (m >= 2 && m <= 4) {
      season = 'Spring';
      details = 'Asparagus, sweet peas, radishes, artichokes, fresh herbs, strawberries & tender greens.';
      trends = ['Green Goddess Bowls', 'Bright Citrus Marinades', 'Light Spring Pastas'];
    } else if (m >= 5 && m <= 7) {
      season = 'Summer';
      details = 'Sweet corn, tomatoes, zucchini, stone fruits, cucumbers, peppers & grilled proteins.';
      trends = ['Crisp Grain Bowls', 'Farmstand Salads', 'Smoky Barbecue'];
    } else if (m >= 8 && m <= 10) {
      season = 'Autumn';
      details = 'Butternut squash, apples, pumpkin, mushrooms, Brussels sprouts, sage & warm root veg.';
      trends = ['Roasted Veggie Bowls', 'One-Pot Braises', 'Warm Harvest Spices'];
    } else {
      season = 'Winter';
      details = 'Citrus, hearty greens, winter squash, slow-cooked soups, root veggies & warming curries.';
      trends = ['Cozy Stews & Broths', 'High-Protein Skillets', 'Comforting Bakes'];
    }

    return {
      monthName: month,
      seasonName: season,
      seasonDetails: details,
      trendBadges: trends
    };
  }, [weekStartDate]);

  // Count recipes per category
  const recipeCategoryCounts = useMemo(() => {
    const counts: { [key: string]: number } = {
      Breakfast: 0,
      Lunch: 0,
      Dinner: 0,
      Snack: 0,
      Dessert: 0
    };
    recipes.forEach(r => {
      if (counts[r.category] !== undefined) {
        counts[r.category]++;
      } else {
        counts.Dinner++;
      }
    });
    return counts;
  }, [recipes]);

  // Handle toggling meal type
  const toggleMealType = (type: MealType) => {
    if (selectedMealTypes.includes(type)) {
      if (selectedMealTypes.length === 1) return; // Must have at least one
      setSelectedMealTypes(prev => prev.filter(t => t !== type));
    } else {
      setSelectedMealTypes(prev => [...prev, type]);
    }
  };

  // Cycling loading steps
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationStep(0);
      const steps = [0, 1, 2, 3];
      let stepIndex = 0;
      timer = setInterval(() => {
        stepIndex = (stepIndex + 1) % steps.length;
        setGenerationStep(stepIndex);
      }, 1400);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const loadingMessages = [
    `Checking ${seasonName} seasonal produce & trending flavor profiles...`,
    `Analyzing ${recipes.length} recipes in your collection for best pairings...`,
    `Balancing busy weekday prep times vs weekend cooking...`,
    `Curating a wholesome 7-day culinary schedule...`
  ];

  // Run AI Planner
  const handleGenerate = async () => {
    if (recipes.length === 0) {
      setError("You don't have any recipes in your collection yet. Add some recipes first!");
      return;
    }
    if (selectedMealTypes.length === 0) {
      setError("Please select at least one meal time to plan.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await generateAiMealPlan({
        recipes,
        weekStartDate,
        selectedMealTypes,
        householdProfile: household?.kitchenProfile,
        preferences: {
          seasonalFocus,
          trendFocus,
          quickWeekdays,
          varietyLevel,
          customNote: customNote.trim() || undefined
        },
        calendarContext: calendarInsights || undefined,
        calendarOptions: {
          autoOmitDiningOut,
          prioritizeQuickOnBusy
        }
      });
      setAiResult(response);
    } catch (err: any) {
      console.warn("AI Meal Plan service encountered an issue; assembling optimized plan locally:", err);
      
      // Resilient local generator fallback
      try {
        const localDays: { [dateStr: string]: { mealType: MealType; recipeId: string; recipeTitle: string; reason?: string; isDiningOut?: boolean; diningOutPlace?: string }[] } = {};
        const startDate = new Date(weekStartDate + "T00:00:00");
        const usedIds = new Set<string>();
        const lastProteinMap: { [k in MealType]?: string } = {};

        const getProteinTag = (r: Recipe): string => {
          const text = ((r?.title || "") + " " + (Array.isArray(r?.ingredients) ? r.ingredients.join(" ") : "")).toLowerCase();
          if (text.includes("chicken") || text.includes("turkey") || text.includes("poultry")) return "poultry";
          if (text.includes("beef") || text.includes("steak") || text.includes("burger") || text.includes("meatball") || text.includes("brisket")) return "beef";
          if (text.includes("pork") || text.includes("bacon") || text.includes("sausage") || text.includes("ribs") || text.includes("ham")) return "pork";
          if (text.includes("salmon") || text.includes("shrimp") || text.includes("fish") || text.includes("tuna") || text.includes("seafood") || text.includes("crab")) return "seafood";
          if (text.includes("tofu") || text.includes("tempeh") || text.includes("lentil") || text.includes("bean") || text.includes("chickpea") || text.includes("falafel")) return "vegetarian";
          if (text.includes("pasta") || text.includes("noodle") || text.includes("spaghetti") || text.includes("lasagna") || text.includes("gnocchi")) return "pasta";
          return "other";
        };

        const categorized: { [k in MealType]?: Recipe[] } = {
          Breakfast: recipes.filter(r => r.category === 'Breakfast'),
          Lunch: recipes.filter(r => r.category === 'Lunch'),
          Dinner: recipes.filter(r => r.category === 'Dinner' || !['Breakfast', 'Lunch', 'Dessert'].includes(r.category)),
          Snack: recipes.filter(r => r.category === 'Snack'),
          Dessert: recipes.filter(r => r.category === 'Dessert'),
        };

        for (let i = 0; i < 7; i++) {
          const cur = new Date(startDate);
          cur.setDate(startDate.getDate() + i);
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, "0");
          const d = String(cur.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${d}`;
          const isWeekend = i >= 4;

          localDays[dateStr] = [];

          // Calendar check for dining out
          const dayCalendar = calendarInsights?.[dateStr];
          const hasDiningOutOnDay = dayCalendar?.hasDiningOut && autoOmitDiningOut;
          const isBusyEveningOnDay = dayCalendar?.isBusyEvening && prioritizeQuickOnBusy;

          selectedMealTypes.forEach(mealType => {
            if (mealType === 'Dinner' && hasDiningOutOnDay) {
              const eventTitle = dayCalendar?.diningOutEvents?.[0]?.summary || 'Dining Out';
              localDays[dateStr].push({
                mealType: 'Dinner',
                recipeId: 'dining_out',
                recipeTitle: `🍷 Dining Out: ${eventTitle}`,
                isDiningOut: true,
                diningOutPlace: eventTitle,
                reason: `Google Calendar: Scheduled dining out (${eventTitle}) — home cooking omitted to avoid conflict.`
              });
              return;
            }

            let pool = (categorized[mealType] && categorized[mealType]!.length > 0)
              ? categorized[mealType]!
              : recipes;

            // If busy evening, prioritize quick meals
            if (mealType === 'Dinner' && isBusyEveningOnDay) {
              const quickPool = pool.filter(r => (r.estimatedTime || 30) <= 25);
              if (quickPool.length > 0) {
                pool = quickPool;
              }
            }

            let pick: Recipe | undefined;

            if (varietyLevel >= 4) {
              const prevProt = lastProteinMap[mealType];
              const unused = pool.filter(r => !usedIds.has(r.id));
              const diffProt = unused.filter(r => getProteinTag(r) !== prevProt);

              if (diffProt.length > 0) {
                pick = diffProt[Math.floor(Math.random() * diffProt.length)];
              } else if (unused.length > 0) {
                pick = unused[Math.floor(Math.random() * unused.length)];
              } else {
                pick = pool[Math.floor(Math.random() * pool.length)];
              }
            } else {
              pick = pool.find(r => !usedIds.has(r.id));
              if (!pick) {
                pick = pool[Math.floor(Math.random() * pool.length)];
              }
            }

            if (pick && pick.id) {
              usedIds.add(pick.id);
              lastProteinMap[mealType] = getProteinTag(pick);
            }

            if (pick) {
              const prot = getProteinTag(pick);
              const protLabel = prot !== "other" ? `${prot.charAt(0).toUpperCase() + prot.slice(1)} rotation` : "Distinct flavor profile";

              let reason = varietyLevel >= 4
                ? (isWeekend ? `Culinary exploration: ${protLabel} seasonal highlight` : `${protLabel} (~${pick.estimatedTime || 30}m) for balanced weekly variety`)
                : (isWeekend ? "Cozy weekend favorite matching seasonal profiles" : `Quick weekday prep (~${pick.estimatedTime || 30} mins) for smooth pacing`);

              if (isBusyEveningOnDay && mealType === 'Dinner') {
                reason = `⚡ Quick prep (~${pick.estimatedTime || 20}m) chosen to fit your busy evening schedule (${dayCalendar?.busyEveningEvents?.[0]?.summary || 'event'}).`;
              }

              localDays[dateStr].push({
                mealType,
                recipeId: pick.id,
                recipeTitle: pick.title,
                reason
              });
            }
          });
        }

        const varietyNames: Record<number, string> = {
          1: "Batch-Cooked & Consistent",
          2: "Familiar Classics",
          3: "Balanced Curation",
          4: "Broad Variety",
          5: "Maximum Culinary Exploration"
        };

        setAiResult({
          seasonalTheme: `${varietyNames[varietyLevel] || "Curated"} Weekly Plan`,
          trendHighlights: `Carefully assembled based on your selected ${varietyNames[varietyLevel]} strategy and recipe collection${calendarAuth.isConnected ? ' with Google Calendar awareness' : ''}.`,
          days: localDays
        });
      } catch (localErr) {
        console.error("Local fallback generation error:", localErr);
        setError(err?.message || "Failed to generate AI meal plan. Please check your network and try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply to Meal Plan
  const handleApplyToPlan = async () => {
    if (!aiResult) return;
    setIsApplying(true);

    try {
      let finalDays: { [dateStr: string]: MealSlot[] } = {};

      if (applyMode === 'merge') {
        // Keep existing slots, append or add missing ones
        finalDays = { ...existingDays };
        Object.entries(aiResult.days).forEach(([dateStr, proposedMeals]) => {
          const existingSlotList = finalDays[dateStr] ? [...finalDays[dateStr]] : [];
          proposedMeals.forEach(meal => {
            // Check if slot with this mealType already exists
            const alreadyHasType = existingSlotList.some(s => s.mealType === meal.mealType);
            if (!alreadyHasType) {
              const isDining = !!meal.isDiningOut || meal.recipeId === 'dining_out';
              existingSlotList.push({
                id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                mealType: meal.mealType,
                recipeId: isDining ? undefined : meal.recipeId,
                customTitle: isDining ? (meal.diningOutPlace || meal.recipeTitle || 'Dining Out') : undefined,
                isDiningOut: isDining || undefined,
                diningOutPlace: isDining ? (meal.diningOutPlace || meal.recipeTitle) : undefined,
                notes: meal.reason ? `✨ AI: ${meal.reason}` : undefined,
                isDone: false
              });
            }
          });
          finalDays[dateStr] = existingSlotList;
        });
      } else {
        // Replace mode: fresh new plan for this week
        Object.entries(aiResult.days).forEach(([dateStr, proposedMeals]) => {
          finalDays[dateStr] = proposedMeals.map(meal => {
            const isDining = !!meal.isDiningOut || meal.recipeId === 'dining_out';
            return {
              id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              mealType: meal.mealType,
              recipeId: isDining ? undefined : meal.recipeId,
              customTitle: isDining ? (meal.diningOutPlace || meal.recipeTitle || 'Dining Out') : undefined,
              isDiningOut: isDining || undefined,
              diningOutPlace: isDining ? (meal.diningOutPlace || meal.recipeTitle) : undefined,
              notes: meal.reason ? `✨ AI: ${meal.reason}` : undefined,
              isDone: false
            };
          });
        });
      }

      await onApplyPlan(finalDays);
      onClose();
    } catch (err) {
      console.error("Failed to apply plan:", err);
      setError("Failed to apply meal plan. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  // Recipe Map for fast lookup
  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach(r => {
      if (r.id) map.set(r.id, r);
    });
    return map;
  }, [recipes]);

  // Week days breakdown for preview
  const previewDays = useMemo(() => {
    if (!aiResult) return [];
    const startDate = new Date(weekStartDate + 'T00:00:00');
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysList = [];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayName = dayNames[i];
      const monthDay = cur.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const meals = aiResult.days[dateStr] || [];

      daysList.push({
        dateStr,
        dayName,
        monthDay,
        meals
      });
    }
    return daysList;
  }, [aiResult, weekStartDate]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                  AI Meal Planner
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Gemini 3.7
                  </span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span>Planning for: <strong className="text-stone-700 dark:text-stone-300 font-semibold">{weekRangeLabel}</strong></span>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-xs sm:text-sm">{error}</p>
                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || recipes.length === 0}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try Again
                    </button>
                    {recipes.length === 0 && (
                      <button
                        onClick={() => {
                          onClose();
                          onRequestAddRecipe();
                        }}
                        className="text-xs font-bold text-amber-800 dark:text-amber-200 underline hover:no-underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add your first recipe now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* If no AI result yet: Show Options Form */}
            {!aiResult && (
              <div className="space-y-6">
                {/* Seasonal & Trend Banner */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent border border-amber-200/70 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌿</span>
                      <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                        {seasonName} Season & Culinary Trends ({monthName})
                      </h4>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-stone-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 shadow-2xs">
                      {recipes.length} recipes in your collection
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    <strong>In Season:</strong> {seasonDetails}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {trendBadges.map((badge, idx) => (
                      <span 
                        key={idx}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/80 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border border-stone-200/80 dark:border-stone-700 flex items-center gap-1"
                      >
                        <Flame className="w-3 h-3 text-amber-500" />
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Meal Times Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                      1. Select Meal Times to Include
                    </label>
                    <span className="text-xs text-stone-400">
                      {selectedMealTypes.length} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {AVAILABLE_MEAL_TYPES.map(meal => {
                      const isSelected = selectedMealTypes.includes(meal.type);
                      const count = recipeCategoryCounts[meal.type] || 0;

                      return (
                        <div
                          key={meal.type}
                          onClick={() => toggleMealType(meal.type)}
                          className={cn(
                            "p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 select-none",
                            isSelected
                              ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/60 dark:border-amber-500/50 ring-2 ring-amber-500/20"
                              : "bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 hover:border-stone-400"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{meal.icon}</span>
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center border transition-all",
                              isSelected
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-stone-300 dark:border-stone-600"
                            )}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100">
                                {meal.label}
                              </span>
                              {count > 0 && (
                                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                                  {count} avail.
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                              {meal.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Variety vs Consistency Strategy */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        2. Variety vs. Consistency Strategy
                      </label>
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1",
                      currentVarietyConfig.badgeBg,
                      currentVarietyConfig.badgeText,
                      currentVarietyConfig.borderTint
                    )}>
                      <span>Level {varietyLevel}:</span>
                      <span>{currentVarietyConfig.label}</span>
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 space-y-4 shadow-2xs">
                    {/* Slider & Anchors */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-medium">
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <Repeat className="w-3.5 h-3.5" /> High Consistency (Batch)
                        </span>
                        <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-semibold">
                          <Compass className="w-3.5 h-3.5" /> Max Exploration (Unique)
                        </span>
                      </div>

                      <div className="relative pt-1 pb-1">
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={varietyLevel}
                          onChange={(e) => setVarietyLevel(Number(e.target.value))}
                          className="w-full h-2.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-indigo-500 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                          aria-label="Variety vs Consistency Slider"
                        />

                        {/* Step Numbers / Clickable markers */}
                        <div className="flex justify-between px-1 text-[10px] font-bold text-stone-400 dark:text-stone-500 mt-1.5">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setVarietyLevel(lvl)}
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                                varietyLevel === lvl
                                  ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-extrabold scale-110 shadow-xs"
                                  : "hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500"
                              )}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quick Presets Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                      {[
                        { level: 1, label: 'Batch Prep', icon: '🔁' },
                        { level: 2, label: 'Familiar', icon: '⭐' },
                        { level: 3, label: 'Balanced', icon: '⚖️' },
                        { level: 4, label: 'Diverse', icon: '✨' },
                        { level: 5, label: '100% Unique', icon: '🧭' }
                      ].map((preset) => {
                        const isActive = varietyLevel === preset.level;
                        return (
                          <button
                            key={preset.level}
                            type="button"
                            onClick={() => setVarietyLevel(preset.level)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all border",
                              isActive
                                ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30 font-bold"
                                : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400"
                            )}
                          >
                            <span>{preset.icon}</span>
                            <span className="truncate">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dynamic Active Description Card */}
                    <div className={cn(
                      "p-3.5 rounded-xl border transition-all space-y-2",
                      currentVarietyConfig.bgTint,
                      currentVarietyConfig.borderTint
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <VarietyIcon className={cn("w-4 h-4", currentVarietyConfig.badgeText)} />
                          <span className="font-serif font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                            {currentVarietyConfig.tagline}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        {currentVarietyConfig.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {currentVarietyConfig.highlights.map((badge, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/80 dark:bg-stone-900/80 text-stone-700 dark:text-stone-300 border border-stone-200/80 dark:border-stone-700/80"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Calendar Smart Conflict Avoidance Section */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-200/80 dark:border-blue-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        Google Calendar Awareness
                      </span>
                    </div>

                    {calendarAuth.isConnected ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected ({calendarAuth.userEmail || 'Google'})
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectCalendar}
                        disabled={isConnectingCalendar}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                      >
                        {isConnectingCalendar ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarCheck className="w-3 h-3" />}
                        Connect Calendar
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-300">
                    Automatically detect restaurant reservations, dinner parties, and late meetings to prevent cooking conflicts and food waste.
                  </p>

                  {calendarAuth.isConnected ? (
                    <div className="space-y-2 pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                      {/* Detected Insights summary */}
                      {calendarInsights && (
                        <div className="flex flex-wrap gap-2 text-[11px] text-stone-600 dark:text-stone-300 mb-1.5">
                          {Object.values(calendarInsights).filter(d => d.hasDiningOut).length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                              <span>🍷</span>
                              {Object.values(calendarInsights).filter(d => d.hasDiningOut).length} Dining Out day(s) detected
                            </span>
                          )}
                          {Object.values(calendarInsights).filter(d => d.isBusyEvening).length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 font-medium flex items-center gap-1">
                              <span>⚡</span>
                              {Object.values(calendarInsights).filter(d => d.isBusyEvening).length} Busy evening(s) detected
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-white/70 dark:bg-stone-900/70 cursor-pointer hover:bg-white dark:hover:bg-stone-900 transition-colors">
                          <input
                            type="checkbox"
                            checked={autoOmitDiningOut}
                            onChange={(e) => setAutoOmitDiningOut(e.target.checked)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500/20"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                              Auto-Omit Dining Out
                            </span>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400">
                              Leave dinner open when a restaurant or dinner event is scheduled.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-white/70 dark:bg-stone-900/70 cursor-pointer hover:bg-white dark:hover:bg-stone-900 transition-colors">
                          <input
                            type="checkbox"
                            checked={prioritizeQuickOnBusy}
                            onChange={(e) => setPrioritizeQuickOnBusy(e.target.checked)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500/20"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                              Quick Meals on Busy Nights
                            </span>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400">
                              Prioritize 15-20 min recipes on nights with events or late practices.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                      Connect your calendar to automatically skip cooking on dinner dates and pick rapid recipes for packed evenings.
                    </div>
                  )}
                </div>

                {/* Planning Focus Preferences */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    3. AI Seasonal & Pacing Focus
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-start gap-3 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={seasonalFocus}
                        onChange={(e) => setSeasonalFocus(e.target.checked)}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-500/20"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                          Prioritize Seasonal Ingredients
                        </span>
                        <span className="text-stone-500 dark:text-stone-400">
                          Highlights recipes using {seasonName.toLowerCase()} produce & vibes.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={quickWeekdays}
                        onChange={(e) => setQuickWeekdays(e.target.checked)}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-500/20"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block">
                          Smart Weekday Pacing
                        </span>
                        <span className="text-stone-500 dark:text-stone-400">
                          Faster 20-30m meals Mon–Thu, relaxed cooking Fri–Sun.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Household Profile Subtle Status */}
                {(activeDietary.length > 0 || activeAppliances.length > 0 || activeDislikes.length > 0) && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-300">
                    <ChefHat className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">
                      Applying household dietary & appliance settings ({[
                        activeDietary.length ? `${activeDietary.length} dietary` : '',
                        activeAppliances.length ? `${activeAppliances.length} appliances` : '',
                        activeDislikes.length ? `${activeDislikes.length} avoided` : ''
                      ].filter(Boolean).join(', ')})
                    </span>
                  </div>
                )}

                {/* Custom Note Input */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                    4. Optional Custom Preferences or Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 'Focus on high protein', 'Use chicken recipes first', 'Keep lunches light'..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* While Generating */}
            {isGenerating && (
              <div className="py-16 text-center space-y-6">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                  <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h4 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
                    Gemini AI is crafting your meal plan...
                  </h4>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium min-h-[20px] transition-all">
                    {loadingMessages[generationStep]}
                  </p>
                </div>
              </div>
            )}

            {/* Generated Plan Preview & Review */}
            {aiResult && !isGenerating && (
              <div className="space-y-6">
                {/* Theme & Rationale Header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-200 dark:border-amber-800/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                        {aiResult.seasonalTheme}
                      </h4>
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                        currentVarietyConfig.badgeBg,
                        currentVarietyConfig.badgeText,
                        currentVarietyConfig.borderTint
                      )}>
                        Level {varietyLevel}: {currentVarietyConfig.label}
                      </span>
                    </div>
                    <button
                      onClick={() => setAiResult(null)}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 bg-white dark:bg-stone-800 px-3 py-1 rounded-full border border-stone-200 dark:border-stone-700 self-start sm:self-auto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Re-tune
                    </button>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {aiResult.trendHighlights}
                  </p>
                </div>

                {/* 7-Day Plan Preview Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      Curated 7-Day Schedule
                    </h5>
                    <span className="text-xs text-stone-400">
                      Monday through Sunday
                    </span>
                  </div>

                  <div className="space-y-3">
                    {previewDays.map((day) => {
                      return (
                        <div
                          key={day.dateStr}
                          className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="sm:w-32 flex-shrink-0">
                            <span className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 block">
                              {day.dayName}
                            </span>
                            <span className="text-[11px] text-stone-400">
                              {day.monthDay}
                            </span>
                          </div>

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {day.meals.map((meal, idx) => {
                              const isDining = !!meal.isDiningOut || meal.recipeId === 'dining_out';
                              const recipe = isDining ? null : recipeMap.get(meal.recipeId);
                              const mealMeta = AVAILABLE_MEAL_TYPES.find(m => m.type === meal.mealType);

                              if (isDining) {
                                return (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 flex items-start gap-2.5 shadow-2xs"
                                  >
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-lg flex-shrink-0 text-amber-800 dark:text-amber-200">
                                      🍷
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                                          Dining Out
                                        </span>
                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                          Google Calendar
                                        </span>
                                      </div>
                                      <h6 className="font-serif font-bold text-xs text-stone-900 dark:text-stone-100 truncate mt-0.5">
                                        {meal.diningOutPlace || meal.recipeTitle || 'Dining Out'}
                                      </h6>
                                      {meal.reason && (
                                        <p className="text-[10px] text-amber-800 dark:text-amber-300 line-clamp-1 italic mt-0.5">
                                          {meal.reason}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700/80 flex items-start gap-2.5 shadow-2xs"
                                >
                                  {recipe?.imageUrl ? (
                                    <img
                                      src={recipe.imageUrl}
                                      referrerPolicy="no-referrer"
                                      alt={recipe.title}
                                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-base flex-shrink-0">
                                      {mealMeta?.icon || '🍽️'}
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                                        {meal.mealType}
                                      </span>
                                      {recipe?.estimatedTime && (
                                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5" /> {recipe.estimatedTime}m
                                        </span>
                                      )}
                                    </div>
                                    <h6 className="font-serif font-bold text-xs text-stone-900 dark:text-stone-100 truncate mt-0.5">
                                      {meal.recipeTitle}
                                    </h6>
                                    {meal.reason && (
                                      <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-1 italic mt-0.5">
                                        {meal.reason}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Apply Mode Selector */}
                <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                      Application Mode
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      Choose how to handle any meals already scheduled for this week.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setApplyMode('replace')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-semibold transition-all",
                        applyMode === 'replace'
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                      )}
                    >
                      Replace Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyMode('merge')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-semibold transition-all",
                        applyMode === 'merge'
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                      )}
                    >
                      Merge / Fill Gaps
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 bg-stone-50/50 dark:bg-stone-900/50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>

            {!aiResult ? (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || recipes.length === 0 || selectedMealTypes.length === 0}
                className="px-6 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Planning...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Plan with Gemini
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isApplying}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleApplyToPlan}
                  disabled={isApplying}
                  className="px-6 py-2.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving to Meal Plan...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Apply to Weekly Meal Plan
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
