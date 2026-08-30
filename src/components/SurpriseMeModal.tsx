import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Recipe, Category, MealType } from '../types';
import { 
  Sparkles, 
  Shuffle, 
  Clock, 
  Star, 
  Utensils, 
  Calendar, 
  BookOpen, 
  X, 
  Check, 
  Flame, 
  RotateCcw,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SurpriseMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  onViewRecipe: (recipe: Recipe) => void;
  onAddToMealPlan: (recipe: Recipe, dateStr: string, mealType: MealType) => Promise<void>;
  initialCategory?: Category | 'All';
}

export const SurpriseMeModal: React.FC<SurpriseMeModalProps> = ({
  isOpen,
  onClose,
  recipes,
  onViewRecipe,
  onAddToMealPlan,
  initialCategory = 'All',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(initialCategory);
  const [timeFilter, setTimeFilter] = useState<'all' | 'quick' | 'weekend'>('all');
  const [staplesOnly, setStaplesOnly] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [pickedRecipe, setPickedRecipe] = useState<Recipe | null>(null);
  const [rollCount, setRollCount] = useState(0);

  // Plan date selector state
  const [planDate, setPlanDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [planMealType, setPlanMealType] = useState<MealType>('Dinner');
  const [isAddingToPlan, setIsAddingToPlan] = useState(false);
  const [planAddedSuccess, setPlanAddedSuccess] = useState(false);

  // Filter candidates based on selected criteria
  const matchingCandidates = useMemo(() => {
    return recipes.filter((r) => {
      if (selectedCategory !== 'All' && r.category !== selectedCategory) {
        return false;
      }
      if (staplesOnly && !r.isStaple) {
        return false;
      }
      if (timeFilter === 'quick') {
        const time = r.estimatedTime || 30;
        if (time > 35) return false;
      } else if (timeFilter === 'weekend') {
        const time = r.estimatedTime || 30;
        if (time < 40) return false;
      }
      return true;
    });
  }, [recipes, selectedCategory, staplesOnly, timeFilter]);

  // Roll / Pick a random recipe
  const rollRecipe = (forceDifferent = true) => {
    if (matchingCandidates.length === 0) {
      setPickedRecipe(null);
      return;
    }

    setIsRolling(true);
    setPlanAddedSuccess(false);

    let candidates = matchingCandidates;
    if (forceDifferent && pickedRecipe && matchingCandidates.length > 1) {
      candidates = matchingCandidates.filter((r) => r.id !== pickedRecipe.id);
    }

    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * candidates.length);
      const chosen = candidates[randomIdx];
      setPickedRecipe(chosen);
      setIsRolling(false);
      setRollCount((prev) => prev + 1);

      // Auto-set meal type based on recipe category if applicable
      if (chosen.category === 'Breakfast') setPlanMealType('Breakfast');
      else if (chosen.category === 'Lunch') setPlanMealType('Lunch');
      else if (chosen.category === 'Dinner') setPlanMealType('Dinner');
      else if (chosen.category === 'Snack' || chosen.category === 'Dessert') setPlanMealType('Snack');
    }, 400);
  };

  // Initial roll on open
  useEffect(() => {
    if (isOpen) {
      rollRecipe(false);
    }
  }, [isOpen]);

  // Handle Add to Meal Plan
  const handleScheduleMeal = async () => {
    if (!pickedRecipe) return;
    setIsAddingToPlan(true);
    try {
      await onAddToMealPlan(pickedRecipe, planDate, planMealType);
      setPlanAddedSuccess(true);
      setTimeout(() => {
        setPlanAddedSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to add to meal plan:", err);
    } finally {
      setIsAddingToPlan(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfbf9] dark:bg-stone-900 rounded-[2.5rem] w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200/80 dark:border-stone-800"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200/70 dark:border-stone-800 flex justify-between items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Surprise Me!
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Random recipe picker for quick meal inspiration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Filter Controls Bar */}
          <div className="bg-stone-100/80 dark:bg-stone-800/60 p-4 rounded-2xl border border-stone-200/60 dark:border-stone-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter Pool ({matchingCandidates.length} recipes)
              </span>
              {(selectedCategory !== 'All' || timeFilter !== 'all' || staplesOnly) && (
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setTimeFilter('all');
                    setStaplesOnly(false);
                  }}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                    selectedCategory === cat
                      ? "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                      : "bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick toggles */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setStaplesOnly(!staplesOnly)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border",
                  staplesOnly
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300"
                )}
              >
                <Star className={cn("w-3 h-3", staplesOnly ? "fill-current" : "text-amber-500")} />
                <span>Staples Only</span>
              </button>

              <button
                onClick={() => setTimeFilter(timeFilter === 'quick' ? 'all' : 'quick')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border",
                  timeFilter === 'quick'
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300"
                )}
              >
                <Clock className="w-3 h-3" />
                <span>Quick (≤ 35m)</span>
              </button>

              <button
                onClick={() => setTimeFilter(timeFilter === 'weekend' ? 'all' : 'weekend')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border",
                  timeFilter === 'weekend'
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300"
                )}
              >
                <Flame className="w-3 h-3" />
                <span>Project (40m+)</span>
              </button>
            </div>
          </div>

          {/* Reveal Card Area */}
          {matchingCandidates.length === 0 ? (
            <div className="py-12 px-6 text-center space-y-3 bg-white dark:bg-stone-900 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700">
              <Utensils className="w-10 h-10 mx-auto text-stone-400 opacity-60" />
              <h3 className="font-serif text-lg font-bold text-stone-800 dark:text-stone-200">
                No matching recipes found
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
                Try widening your category or time filters to draw from more recipes in your collection.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setTimeFilter('all');
                  setStaplesOnly(false);
                }}
                className="mt-2 px-4 py-2 bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="relative">
              <AnimatePresence mode="wait">
                {isRolling ? (
                  <motion.div
                    key="rolling"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="aspect-[16/10] bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:to-transparent rounded-3xl border border-amber-300/60 dark:border-amber-700/50 flex flex-col items-center justify-center p-8 text-center space-y-4"
                  >
                    <motion.div
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                      className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <Shuffle className="w-7 h-7" />
                    </motion.div>
                    <div>
                      <h4 className="font-serif text-xl font-bold text-stone-800 dark:text-stone-100">
                        Selecting the perfect dish...
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        Shuffling {matchingCandidates.length} delicious candidates
                      </p>
                    </div>
                  </motion.div>
                ) : pickedRecipe ? (
                  <motion.div
                    key={pickedRecipe.id || 'picked'}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-md overflow-hidden"
                  >
                    {/* Card Photo & Badges */}
                    <div className="aspect-[16/9] relative overflow-hidden bg-stone-200 dark:bg-stone-800">
                      {pickedRecipe.imageUrl ? (
                        <img
                          src={pickedRecipe.imageUrl}
                          referrerPolicy="no-referrer"
                          alt={pickedRecipe.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <Utensils className="w-12 h-12 opacity-30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100 shadow-sm">
                          {pickedRecipe.category}
                        </span>
                        {pickedRecipe.isStaple && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> Staple
                          </span>
                        )}
                      </div>

                      {/* Bottom Title Overlay */}
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <h3 className="text-2xl font-serif font-bold drop-shadow-md leading-tight">
                          {pickedRecipe.title}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-stone-200 mt-1 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{pickedRecipe.estimatedTime || 30} mins</span>
                          </div>
                          {pickedRecipe.rating && pickedRecipe.rating > 0 ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                              <span>{pickedRecipe.rating} / 5</span>
                            </div>
                          ) : null}
                          <div>{pickedRecipe.ingredients?.length || 0} ingredients</div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredients Snippet */}
                    <div className="p-5 space-y-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                          Key Ingredients:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(pickedRecipe.ingredients || []).slice(0, 6).map((ing, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium"
                            >
                              {ing}
                            </span>
                          ))}
                          {(pickedRecipe.ingredients?.length || 0) > 6 && (
                            <span className="px-2 py-1 text-xs text-stone-400">
                              +{(pickedRecipe.ingredients?.length || 0) - 6} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Add to Meal Plan Bar */}
                      <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-2xl border border-stone-200/60 dark:border-stone-700/50">
                          <div className="flex items-center gap-2 flex-1">
                            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <input
                              type="date"
                              value={planDate}
                              onChange={(e) => setPlanDate(e.target.value)}
                              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs rounded-xl px-2.5 py-1.5 text-stone-800 dark:text-stone-200 focus:outline-none"
                            />
                            <select
                              value={planMealType}
                              onChange={(e) => setPlanMealType(e.target.value as MealType)}
                              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs rounded-xl px-2.5 py-1.5 text-stone-800 dark:text-stone-200 focus:outline-none"
                            >
                              <option value="Breakfast">Breakfast</option>
                              <option value="Lunch">Lunch</option>
                              <option value="Dinner">Dinner</option>
                              <option value="Snack">Snack</option>
                            </select>
                          </div>

                          <button
                            onClick={handleScheduleMeal}
                            disabled={isAddingToPlan}
                            className={cn(
                              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm",
                              planAddedSuccess
                                ? "bg-emerald-600 text-white"
                                : "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-200"
                            )}
                          >
                            {planAddedSuccess ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Added to Plan!
                              </>
                            ) : isAddingToPlan ? (
                              "Adding..."
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" /> Add to Plan
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-stone-50 dark:bg-stone-900/90 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (pickedRecipe) {
                onClose();
                onViewRecipe(pickedRecipe);
              }
            }}
            disabled={!pickedRecipe || isRolling}
            className="px-4 py-2.5 rounded-2xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 hover:border-stone-400 font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-40"
          >
            <BookOpen className="w-4 h-4" />
            <span>View Full Recipe</span>
          </button>

          <button
            onClick={() => rollRecipe(true)}
            disabled={matchingCandidates.length <= 1 || isRolling}
            className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-40"
          >
            <Shuffle className={cn("w-4 h-4", isRolling && "animate-spin")} />
            <span>Roll Again 🎲</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
