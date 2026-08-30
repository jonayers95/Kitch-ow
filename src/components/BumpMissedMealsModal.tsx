import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, MealSlot, MealType } from '../types';
import { 
  ArrowRight, 
  Calendar, 
  Clock, 
  Check, 
  Trash2, 
  X, 
  Sparkles, 
  ChefHat, 
  RotateCcw, 
  AlertCircle,
  CalendarClock,
  ArrowRightLeft,
  CheckCircle2,
  HelpCircle,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface MissedMealItem {
  dateKey: string;
  dayName: string;
  monthDay: string;
  slot: MealSlot;
  recipe?: Recipe;
  title: string;
}

export interface WeekDayOption {
  dateKey: string;
  dayName: string;
  monthDay: string;
  isToday: boolean;
  isPast: boolean;
  existingSlots: MealSlot[];
}

interface BumpMissedMealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missedMeals: MissedMealItem[];
  weekDays: WeekDayOption[];
  onBumpSingleMeal: (sourceDateKey: string, slotId: string, targetDateKey: string, targetMealType: MealType) => Promise<void>;
  onAutoBumpAll: (bumpingPlan: { sourceDateKey: string; slot: MealSlot; targetDateKey: string; targetMealType: MealType }[]) => Promise<void>;
  onMarkSlotDone: (dateKey: string, slotId: string) => Promise<void>;
  onDeleteSlot: (dateKey: string, slotId: string) => Promise<void>;
  initialTargetSlotId?: string;
}

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

export const BumpMissedMealsModal: React.FC<BumpMissedMealsModalProps> = ({
  isOpen,
  onClose,
  missedMeals,
  weekDays,
  onBumpSingleMeal,
  onAutoBumpAll,
  onMarkSlotDone,
  onDeleteSlot,
  initialTargetSlotId,
}) => {
  // Available future target days (today + remaining days of current week)
  const availableTargetDays = useMemo(() => {
    return weekDays.filter(d => !d.isPast || d.isToday);
  }, [weekDays]);

  // Per-meal selected target day and meal type
  const [selectedTargets, setSelectedTargets] = useState<{
    [slotId: string]: { dateKey: string; mealType: MealType };
  }>({});

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSlotId, setProcessingSlotId] = useState<string | null>(null);

  // Initialize targets to the earliest open slot for each missed meal
  useEffect(() => {
    if (!isOpen) return;

    const initial: { [slotId: string]: { dateKey: string; mealType: MealType } } = {};
    const simulatedOccupied = new Set<string>();

    // Mark current existing future slots as occupied
    availableTargetDays.forEach(day => {
      day.existingSlots.forEach(s => {
        simulatedOccupied.add(`${day.dateKey}_${s.mealType}`);
      });
    });

    missedMeals.forEach(meal => {
      const preferredMealType = meal.slot.mealType || 'Dinner';
      let foundDateKey = availableTargetDays[0]?.dateKey;
      let foundMealType = preferredMealType;

      // Try to find the earliest open slot with the same meal type
      let found = false;
      for (const day of availableTargetDays) {
        const key = `${day.dateKey}_${preferredMealType}`;
        if (!simulatedOccupied.has(key)) {
          foundDateKey = day.dateKey;
          foundMealType = preferredMealType;
          simulatedOccupied.add(key);
          found = true;
          break;
        }
      }

      // If all preferred meal types are taken, find any open slot
      if (!found) {
        for (const day of availableTargetDays) {
          for (const mt of MEAL_TYPES) {
            const key = `${day.dateKey}_${mt}`;
            if (!simulatedOccupied.has(key)) {
              foundDateKey = day.dateKey;
              foundMealType = mt;
              simulatedOccupied.add(key);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      // Default fallback
      if (!foundDateKey && availableTargetDays.length > 0) {
        foundDateKey = availableTargetDays[availableTargetDays.length - 1].dateKey;
      }

      initial[meal.slot.id] = {
        dateKey: foundDateKey || weekDays[0]?.dateKey || '',
        mealType: foundMealType,
      };
    });

    setSelectedTargets(initial);
  }, [isOpen, missedMeals, availableTargetDays, weekDays]);

  if (!isOpen || missedMeals.length === 0) return null;

  const handleTargetChange = (slotId: string, dateKey: string, mealType: MealType) => {
    setSelectedTargets(prev => ({
      ...prev,
      [slotId]: { dateKey, mealType },
    }));
  };

  const handleBumpSingle = async (meal: MissedMealItem) => {
    const target = selectedTargets[meal.slot.id];
    if (!target || !target.dateKey) return;

    setProcessingSlotId(meal.slot.id);
    try {
      await onBumpSingleMeal(meal.dateKey, meal.slot.id, target.dateKey, target.mealType);
      if (missedMeals.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error("Failed to bump meal:", err);
    } finally {
      setProcessingSlotId(null);
    }
  };

  const handleAutoBumpAll = async () => {
    setIsProcessing(true);
    try {
      const plan = missedMeals.map(meal => {
        const target = selectedTargets[meal.slot.id] || {
          dateKey: availableTargetDays[0]?.dateKey || meal.dateKey,
          mealType: meal.slot.mealType || 'Dinner',
        };
        return {
          sourceDateKey: meal.dateKey,
          slot: meal.slot,
          targetDateKey: target.dateKey,
          targetMealType: target.mealType,
        };
      });

      await onAutoBumpAll(plan);
      onClose();
    } catch (err) {
      console.error("Failed to auto-bump all meals:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-[#fcfbf9] dark:bg-stone-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Bump Missed Meals
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                  {missedMeals.length} unmade
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Reschedule unmade meals from earlier this week to upcoming open days with one click.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Header Banner */}
        <div className="px-6 py-3.5 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Smart Rescheduling:</strong> Open slots on upcoming days have been auto-assigned below. You can customize each meal's destination slot or bump all at once.
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoBumpAll}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 shrink-0 transition-transform active:scale-95 disabled:opacity-50"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>⚡ Bump All to Open Slots</span>
          </button>
        </div>

        {/* Missed Meals List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {missedMeals.map((meal, idx) => {
            const currentTarget = selectedTargets[meal.slot.id] || {
              dateKey: availableTargetDays[0]?.dateKey || '',
              mealType: meal.slot.mealType || 'Dinner',
            };
            const isThisProcessing = processingSlotId === meal.slot.id;

            return (
              <div
                key={`${meal.dateKey}_${meal.slot.id}_${idx}`}
                className={cn(
                  "p-4 rounded-2xl border bg-white dark:bg-stone-800/80 transition-all space-y-4",
                  initialTargetSlotId === meal.slot.id 
                    ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md" 
                    : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
                )}
              >
                {/* Meal Info Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {meal.recipe?.imageUrl ? (
                      <img
                        src={meal.recipe.imageUrl}
                        alt={meal.title}
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center text-xl shrink-0">
                        🍲
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 truncate">
                          {meal.title}
                        </h4>
                        {meal.recipe?.isStaple && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                            ⭐ Staple
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                        <span className="line-through text-rose-500/80 dark:text-rose-400/80">
                          {meal.dayName}, {meal.monthDay} ({meal.slot.mealType})
                        </span>
                        {meal.recipe?.estimatedTime && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {meal.recipe.estimatedTime}m
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Secondary Fast Actions (Mark Done / Dismiss) */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onMarkSlotDone(meal.dateKey, meal.slot.id)}
                      title="Mark as cooked already"
                      className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 text-stone-500 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden md:inline">Already Cooked</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSlot(meal.dateKey, meal.slot.id)}
                      title="Remove missed meal"
                      className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-stone-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Target Rescheduling Selector Row */}
                <div className="pt-3 border-t border-stone-100 dark:border-stone-700/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50/60 dark:bg-stone-900/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-500" /> Move to:
                    </span>

                    {/* Day selector */}
                    <select
                      value={currentTarget.dateKey}
                      onChange={(e) => handleTargetChange(meal.slot.id, e.target.value, currentTarget.mealType)}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {availableTargetDays.map((day) => {
                        const count = day.existingSlots.length;
                        return (
                          <option key={day.dateKey} value={day.dateKey}>
                            {day.dayName}, {day.monthDay} {day.isToday ? '(Today)' : ''} — {count === 0 ? '✨ Empty' : `${count} meal${count > 1 ? 's' : ''}`}
                          </option>
                        );
                      })}
                    </select>

                    {/* Meal type selector */}
                    <select
                      value={currentTarget.mealType}
                      onChange={(e) => handleTargetChange(meal.slot.id, currentTarget.dateKey, e.target.value as MealType)}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {MEAL_TYPES.map((mt) => (
                        <option key={mt} value={mt}>
                          {mt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Single Bump Action */}
                  <button
                    type="button"
                    onClick={() => handleBumpSingle(meal)}
                    disabled={isThisProcessing || isProcessing}
                    className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isThisProcessing ? (
                      <span>Bumping...</span>
                    ) : (
                      <>
                        <span>Bump Meal</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 flex items-center justify-between gap-3">
          <p className="text-xs text-stone-400 dark:text-stone-500 hidden sm:block">
            Bumping moves the recipe to your chosen slot and keeps all prep notes intact.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleAutoBumpAll}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Apply All Bumps</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
