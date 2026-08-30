import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, MealSlot, MealType } from '../types';
import { 
  CalendarClock, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Sparkles, 
  X, 
  Check, 
  Utensils,
  ChevronRight,
  Sun,
  Coffee,
  Moon,
  Cookie,
  Cake
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface WeekDayOption {
  dateKey: string;
  dayName: string;
  monthDay: string;
  isToday: boolean;
  isPast: boolean;
  existingSlots: MealSlot[];
}

interface SingleMealBumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDateKey: string;
  slot: MealSlot | null;
  recipe?: Recipe;
  weekDays: WeekDayOption[];
  onBumpMeal: (sourceDateKey: string, slotId: string, targetDateKey: string, targetMealType: MealType) => Promise<void>;
}

const MEAL_TYPES: { type: MealType; label: string; icon: string }[] = [
  { type: 'Breakfast', label: 'Breakfast', icon: '🌅' },
  { type: 'Lunch', label: 'Lunch', icon: '☀️' },
  { type: 'Dinner', label: 'Dinner', icon: '🌙' },
  { type: 'Snack', label: 'Snack', icon: '🥪' },
  { type: 'Dessert', label: 'Dessert', icon: '🍰' },
];

function addDaysToKey(dateKey: string, daysToAdd: number): string {
  const parts = dateKey.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const SingleMealBumpModal: React.FC<SingleMealBumpModalProps> = ({
  isOpen,
  onClose,
  sourceDateKey,
  slot,
  recipe,
  weekDays,
  onBumpMeal,
}) => {
  if (!isOpen || !slot) return null;

  const currentMealType = slot.mealType || 'Dinner';
  const title = recipe?.title || slot.customTitle || 'Meal';

  // Calculate smart default target (e.g. tomorrow or next open slot)
  const defaultTargetDate = useMemo(() => {
    // Try to find the day after sourceDateKey in current weekDays
    const nextDay = addDaysToKey(sourceDateKey, 1);
    const inWeek = weekDays.find(d => d.dateKey === nextDay);
    if (inWeek) return inWeek.dateKey;

    // Otherwise next day in weekDays that is after sourceDateKey
    const laterDay = weekDays.find(d => d.dateKey > sourceDateKey);
    if (laterDay) return laterDay.dateKey;

    // Or just next day
    return nextDay;
  }, [sourceDateKey, weekDays]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(defaultTargetDate);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(currentMealType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && slot) {
      setSelectedDateKey(defaultTargetDate);
      setSelectedMealType(currentMealType);
    }
  }, [isOpen, slot?.id, defaultTargetDate, currentMealType]);

  // Quick Preset Options
  const presets = useMemo(() => {
    const tomorrowKey = addDaysToKey(sourceDateKey, 1);
    const twoDaysKey = addDaysToKey(sourceDateKey, 2);
    
    // Find next completely open slot in weekDays
    let nextOpenKey = '';
    for (const d of weekDays) {
      if (d.dateKey > sourceDateKey && d.existingSlots.length === 0) {
        nextOpenKey = d.dateKey;
        break;
      }
    }
    if (!nextOpenKey) {
      // Find day with least meals after sourceDateKey
      const laterDays = weekDays.filter(d => d.dateKey > sourceDateKey);
      if (laterDays.length > 0) {
        laterDays.sort((a, b) => a.existingSlots.length - b.existingSlots.length);
        nextOpenKey = laterDays[0].dateKey;
      }
    }

    const list = [
      {
        id: 'tomorrow',
        label: 'Tomorrow',
        dateKey: tomorrowKey,
        mealType: currentMealType,
        desc: formatDateLabel(tomorrowKey),
        icon: '⚡',
      },
      {
        id: 'two_days',
        label: '+2 Days',
        dateKey: twoDaysKey,
        mealType: currentMealType,
        desc: formatDateLabel(twoDaysKey),
        icon: '📅',
      },
    ];

    if (nextOpenKey && nextOpenKey !== tomorrowKey && nextOpenKey !== twoDaysKey) {
      list.push({
        id: 'open_slot',
        label: 'Next Open Slot',
        dateKey: nextOpenKey,
        mealType: currentMealType,
        desc: formatDateLabel(nextOpenKey),
        icon: '✨',
      });
    }

    return list;
  }, [sourceDateKey, currentMealType, weekDays]);

  const handleApplyBump = async (targetDate: string, targetType: MealType) => {
    if (!slot) return;
    setIsSubmitting(true);
    try {
      await onBumpMeal(sourceDateKey, slot.id, targetDate, targetType);
      onClose();
    } catch (err) {
      console.error("Failed to bump meal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedSourceDate = useMemo(() => {
    return formatDateLabel(sourceDateKey);
  }, [sourceDateKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#fcfbf9] dark:bg-stone-900 w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                Bump / Reschedule Meal
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Move this recipe to another day or time slot
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

        {/* Meal Preview Card */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex items-center gap-3.5 shadow-xs">
            {recipe?.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={title}
                className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
                🍲
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 truncate">
                {title}
              </h4>
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  Currently: {formattedSourceDate} ({slot.mealType})
                </span>
                {recipe?.estimatedTime && (
                  <span>• {recipe.estimatedTime}m</span>
                )}
              </div>
            </div>
          </div>

          {/* 1-Click Quick Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick 1-Click Bump</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyBump(preset.dateKey, preset.mealType)}
                  disabled={isSubmitting}
                  className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-300/70 dark:border-amber-700/70 text-left transition-all active:scale-95 group flex flex-col justify-between disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{preset.icon}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="mt-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate block">
                      {preset.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date & Slot Selection */}
          <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/70 space-y-3.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 block">
              Or Choose Specific Target Slot
            </label>

            {/* Target Day Picker */}
            <div className="space-y-1.5">
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium block">
                Target Day
              </span>
              <select
                value={selectedDateKey}
                onChange={(e) => setSelectedDateKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500"
              >
                {weekDays.map((d) => {
                  const count = d.existingSlots.length;
                  const isCurrent = d.dateKey === sourceDateKey;
                  return (
                    <option key={d.dateKey} value={d.dateKey}>
                      {d.dayName}, {d.monthDay} {d.isToday ? '(Today)' : ''} {isCurrent ? '(Current)' : ''} — {count === 0 ? '✨ Empty Day' : `${count} meal${count > 1 ? 's' : ''} planned`}
                    </option>
                  );
                })}
                {/* Additional option for Next Week's Monday */}
                <option value={addDaysToKey(weekDays[0]?.dateKey || sourceDateKey, 7)}>
                  Next Week (Monday, {formatDateLabel(addDaysToKey(weekDays[0]?.dateKey || sourceDateKey, 7))})
                </option>
                <option value={addDaysToKey(weekDays[0]?.dateKey || sourceDateKey, 8)}>
                  Next Week (Tuesday, {formatDateLabel(addDaysToKey(weekDays[0]?.dateKey || sourceDateKey, 8))})
                </option>
              </select>
            </div>

            {/* Meal Type Selection */}
            <div className="space-y-1.5">
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium block">
                Meal Slot
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MEAL_TYPES.map((mt) => (
                  <button
                    key={mt.type}
                    type="button"
                    onClick={() => setSelectedMealType(mt.type)}
                    className={cn(
                      "py-2 px-1.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-0.5 transition-all text-center",
                      selectedMealType === mt.type
                        ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-xs font-bold"
                        : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300"
                    )}
                  >
                    <span className="text-sm">{mt.icon}</span>
                    <span className="text-[11px]">{mt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleApplyBump(selectedDateKey, selectedMealType)}
            disabled={isSubmitting || (selectedDateKey === sourceDateKey && selectedMealType === currentMealType)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            <CalendarClock className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Bumping...' : `Confirm Bump to ${formatDateLabel(selectedDateKey)} (${selectedMealType})`}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
