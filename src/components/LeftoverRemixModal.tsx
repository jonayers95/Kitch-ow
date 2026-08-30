import React, { useState, useEffect, useMemo } from 'react';
import { Recipe, Household, MealType } from '../types';
import { 
  remixLeftovers, 
  RemixProposal, 
  LeftoverRemixRequest,
  generateRecipeImage 
} from '../services/geminiService';
import { evaluateFoodFreshness, SpoilageEvaluation } from '../utils/spoilageCalculator';
import { 
  Sparkles, 
  Soup, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Bookmark, 
  Calendar, 
  Copy, 
  RotateCcw, 
  ShieldCheck, 
  Utensils, 
  Info,
  Flame,
  ArrowRight,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PastMealItem {
  id: string;
  recipeTitle: string;
  cookedDate: string; // "YYYY-MM-DD"
  recipeId?: string;
  recipe?: Recipe;
  mealType: MealType;
  notes?: string;
}

export interface LeftoverRemixModalProps {
  isOpen: boolean;
  onClose: () => void;
  pastMeals: PastMealItem[];
  household?: Household | null;
  recipes?: Recipe[];
  onSaveAsRecipe?: (recipeData: {
    title: string;
    ingredients: string[];
    instructions: string[];
    category: any;
    estimatedTime: number;
    imageUrl?: string;
  }) => Promise<void>;
  onSaveRemixAsRecipe?: (recipeData: {
    title: string;
    ingredients: string[];
    instructions: string[];
    category: any;
    estimatedTime: number;
    imageUrl?: string;
  }) => Promise<void>;
  onAddToMealPlan?: (
    title: string,
    dateStr: string,
    mealType: MealType,
    notes?: string
  ) => Promise<void>;
  onAddRemixToMealPlan?: (
    title: string,
    dateStr: string,
    mealType: MealType,
    notes?: string
  ) => Promise<void>;
  initialSelectedMealId?: string;
}

export const LeftoverRemixModal: React.FC<LeftoverRemixModalProps> = ({
  isOpen,
  onClose,
  pastMeals,
  household,
  recipes,
  onSaveAsRecipe,
  onSaveRemixAsRecipe,
  onAddToMealPlan,
  onAddRemixToMealPlan,
  initialSelectedMealId,
}) => {
  const saveRecipeAction = onSaveRemixAsRecipe || onSaveAsRecipe;
  const addMealPlanAction = onAddRemixToMealPlan || onAddToMealPlan;
  const [activeTab, setActiveTab] = useState<'remix' | 'freshness'>('remix');

  // Selected past meals for remixing
  const [selectedPastMealIds, setSelectedPastMealIds] = useState<string[]>([]);
  const [customIngredients, setCustomIngredients] = useState<string>('');
  const [customInputDraft, setCustomInputDraft] = useState<string>('');
  const [quickOnly, setQuickOnly] = useState<boolean>(true);

  // Remix Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [remixes, setRemixes] = useState<RemixProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRemixId, setExpandedRemixId] = useState<string | null>(null);

  // Action status per remix
  const [savingRecipeIds, setSavingRecipeIds] = useState<{ [id: string]: boolean }>({});
  const [savedRecipeIds, setSavedRecipeIds] = useState<{ [id: string]: boolean }>({});
  const [planningRemixId, setPlanningRemixId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [planMealType, setPlanMealType] = useState<MealType>('Dinner');
  const [plannedSuccessIds, setPlannedSuccessIds] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Evaluate freshness for all past meals (strictly meals from past days)
  const evaluatedPastMeals = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayKey = `${year}-${month}-${day}`;

    return pastMeals
      .filter((meal) => meal.cookedDate < todayKey)
      .map((meal) => {
        const evaluation = evaluateFoodFreshness(
          meal.cookedDate,
          meal.recipeTitle,
          meal.recipe?.ingredients || []
        );
        return {
          ...meal,
          evaluation,
        };
      });
  }, [pastMeals]);

  // Initial selection when opening
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMealId) {
        setSelectedPastMealIds([initialSelectedMealId]);
      } else if (pastMeals.length > 0 && selectedPastMealIds.length === 0) {
        // Pre-select most recent safe meal if available
        const recentSafe = evaluatedPastMeals.find((m) => m.evaluation.isSafeToEat);
        if (recentSafe) {
          setSelectedPastMealIds([recentSafe.id]);
        }
      }
    }
  }, [isOpen, initialSelectedMealId, pastMeals]);

  const toggleSelectMeal = (id: string) => {
    setSelectedPastMealIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddCustomIngredientTag = () => {
    if (!customInputDraft.trim()) return;
    const clean = customInputDraft.trim();
    const current = customIngredients
      ? customIngredients.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!current.includes(clean)) {
      current.push(clean);
      setCustomIngredients(current.join(', '));
    }
    setCustomInputDraft('');
  };

  const handleRemoveCustomIngredientTag = (tagToRemove: string) => {
    const current = customIngredients
      ? customIngredients.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const updated = current.filter((tag) => tag.toLowerCase() !== tagToRemove.toLowerCase());
    setCustomIngredients(updated.join(', '));
  };

  // Generate Remixes
  const handleGenerateRemixes = async () => {
    const selectedMealObjects = evaluatedPastMeals.filter((m) =>
      selectedPastMealIds.includes(m.id)
    );

    if (selectedMealObjects.length === 0 && !customIngredients.trim()) {
      setError('Please select at least one previous meal or type an ingredient from your fridge.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const requestPayload: LeftoverRemixRequest = {
      leftoverItems: selectedMealObjects.map((m) => ({
        name: m.recipeTitle,
        cookedDate: m.cookedDate,
        notes: `Prepared as ${m.mealType}. Category: ${m.evaluation.categoryLabel}`,
      })),
      customIngredients: customIngredients.trim() || undefined,
      preferences: {
        quickOnly,
      },
    };

    try {
      const response = await remixLeftovers(requestPayload);
      if (response && response.remixes && response.remixes.length > 0) {
        setRemixes(response.remixes);
        setExpandedRemixId(response.remixes[0].id);
      } else {
        throw new Error('Could not generate remixes. Please try again.');
      }
    } catch (err: any) {
      console.error('Error generating remixes:', err);
      setError(err.message || 'Failed to generate leftover remixes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Remix as Permanent Recipe
  const handleSaveRecipe = async (remix: RemixProposal) => {
    if (!saveRecipeAction) return;
    setSavingRecipeIds((prev) => ({ ...prev, [remix.id]: true }));
    try {
      const imageUrl = await generateRecipeImage(remix.title, remix.category);
      await saveRecipeAction({
        title: remix.title,
        ingredients: remix.ingredients,
        instructions: remix.instructions,
        category: remix.category || 'Dinner',
        estimatedTime: remix.estimatedTime || 20,
        imageUrl: imageUrl || '',
      });
      setSavedRecipeIds((prev) => ({ ...prev, [remix.id]: true }));
    } catch (err) {
      console.error('Failed to save remix as recipe:', err);
      alert('Failed to save remix as recipe. Please try again.');
    } finally {
      setSavingRecipeIds((prev) => ({ ...prev, [remix.id]: false }));
    }
  };

  // Schedule Remix on Meal Plan
  const handleScheduleRemix = async (remix: RemixProposal) => {
    if (!addMealPlanAction) return;
    try {
      const notes = `Leftover Remix: ${remix.remixStyle}. Utilizes: ${remix.leftoversUtilized.join(', ')}`;
      await addMealPlanAction(remix.title, planDate, planMealType, notes);
      setPlannedSuccessIds((prev) => ({ ...prev, [remix.id]: true }));
      setPlanningRemixId(null);
      setTimeout(() => {
        setPlannedSuccessIds((prev) => ({ ...prev, [remix.id]: false }));
      }, 3000);
    } catch (err) {
      console.error('Failed to schedule remix:', err);
      alert('Failed to schedule remix to meal plan.');
    }
  };

  // Copy instructions
  const handleCopyInstructions = (remix: RemixProposal) => {
    const text = `🍳 ${remix.title} (${remix.remixStyle})
⏱️ Cook Time: ${remix.estimatedTime} mins
🥘 Leftovers Used: ${remix.leftoversUtilized.join(', ')}
🧂 Pantry Items: ${remix.pantryItemsNeeded.join(', ')}

INGREDIENTS:
${remix.ingredients.map((i) => `• ${i}`).join('\n')}

INSTRUCTIONS:
${remix.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

${remix.proTips ? `💡 CHEF PRO-TIP: ${remix.proTips}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(remix.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fcfbf9] dark:bg-stone-900 rounded-[2.5rem] w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200/80 dark:border-stone-800"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200/70 dark:border-stone-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-inner">
              <Soup className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Leftover Remix & Freshness
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Zero Food Waste
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Transform past meals and fridge extras into mouthwatering new dishes
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="flex p-1 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
              <button
                onClick={() => setActiveTab('remix')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'remix'
                    ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Remix Kitchen</span>
              </button>
              <button
                onClick={() => setActiveTab('freshness')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === 'freshness'
                    ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                    : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Fridge Tracker</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'remix' ? (
            <div className="space-y-6">
              {/* Leftover Selector Section */}
              <div className="bg-stone-100/70 dark:bg-stone-800/40 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>1. Select Available Leftovers from Recent Meals</span>
                  </h3>
                  <span className="text-xs text-stone-500">
                    {selectedPastMealIds.length} selected
                  </span>
                </div>

                {evaluatedPastMeals.length === 0 ? (
                  <div className="p-4 bg-white/80 dark:bg-stone-900/80 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-1">
                    <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                      No recent meal plan history found in the past 14 days.
                    </p>
                    <p className="text-[11px] text-stone-400">
                      No problem! You can type custom fridge leftovers and ingredients below.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {evaluatedPastMeals.map((meal) => {
                      const isSelected = selectedPastMealIds.includes(meal.id);
                      const { evaluation } = meal;

                      return (
                        <div
                          key={meal.id}
                          onClick={() => toggleSelectMeal(meal.id)}
                          className={cn(
                            "p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none",
                            isSelected
                              ? "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/80 dark:border-amber-400 shadow-sm"
                              : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-md mt-0.5 flex items-center justify-center transition-colors shrink-0",
                                  isSelected
                                    ? "bg-amber-600 text-white"
                                    : "border border-stone-300 dark:border-stone-600"
                                )}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                                {meal.recipeTitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-stone-400 dark:text-stone-500">
                              Cooked {meal.cookedDate.slice(5)}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border",
                                evaluation.badgeBg,
                                evaluation.badgeText,
                                evaluation.badgeBorder
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", evaluation.dotColor)} />
                              {evaluation.statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Custom Fridge Ingredients Quick-Add */}
                <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/50 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>2. Add Extra Fridge & Pantry Ingredients (Optional)</span>
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. cooked rice, black beans, half avocado, cheddar, salsa..."
                      value={customInputDraft}
                      onChange={(e) => setCustomInputDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomIngredientTag();
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomIngredientTag}
                      className="px-4 py-2.5 bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold shrink-0 hover:bg-stone-700 dark:hover:bg-stone-200"
                    >
                      Add Item
                    </button>
                  </div>

                  {/* Active tags preview */}
                  {customIngredients && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customIngredients
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-center gap-1.5 border border-amber-200 dark:border-amber-800"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomIngredientTag(tag)}
                              className="hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Quick Preferences Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={quickOnly}
                      onChange={(e) => setQuickOnly(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="font-semibold">Quick Meals Only (≤ 20 mins)</span>
                  </label>

                  <button
                    onClick={handleGenerateRemixes}
                    disabled={isGenerating || (selectedPastMealIds.length === 0 && !customIngredients.trim())}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-amber-200" />
                        <span>Remixing with AI Chef...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>✨ Generate 3 Remix Dishes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
                  <span>{error}</span>
                  <button
                    onClick={handleGenerateRemixes}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Remix Results Cards */}
              {remixes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <span>Chef's Creative Remix Proposals</span>
                    </h3>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      Standard pantry staples assumed on hand
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {remixes.map((remix, index) => {
                      const isExpanded = expandedRemixId === remix.id;
                      const isSaving = !!savingRecipeIds[remix.id];
                      const isSaved = !!savedRecipeIds[remix.id];
                      const isPlanningThis = planningRemixId === remix.id;
                      const isPlannedSuccess = !!plannedSuccessIds[remix.id];
                      const isCopied = copiedId === remix.id;

                      return (
                        <motion.div
                          key={remix.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden"
                        >
                          {/* Card Header Summary */}
                          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800/80">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                                  {remix.remixStyle}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-semibold">
                                  {remix.category}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-stone-500 font-medium">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{remix.estimatedTime} mins</span>
                                </div>
                              </div>

                              <h4 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                                {remix.title}
                              </h4>
                              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                                {remix.description}
                              </p>
                            </div>

                            {/* Top Action Pills */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <button
                                onClick={() => handleSaveRecipe(remix)}
                                disabled={isSaving || isSaved}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm",
                                  isSaved
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                    : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-stone-400"
                                )}
                              >
                                {isSaved ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved!
                                  </>
                                ) : isSaving ? (
                                  "Saving..."
                                ) : (
                                  <>
                                    <Bookmark className="w-3.5 h-3.5 text-amber-500" /> Save as Recipe
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() =>
                                  setPlanningRemixId(isPlanningThis ? null : remix.id)
                                }
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm",
                                  isPlannedSuccess
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : isPlanningThis
                                    ? "bg-stone-800 text-white border-stone-800 dark:bg-stone-100 dark:text-stone-900"
                                    : "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700"
                                )}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{isPlannedSuccess ? 'Scheduled!' : 'Plan Meal'}</span>
                              </button>

                              <button
                                onClick={() => setExpandedRemixId(isExpanded ? null : remix.id)}
                                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                                title="Toggle recipe instructions"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Quick Plan Inline Drawer */}
                          <AnimatePresence>
                            {isPlanningThis && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-amber-500/10 dark:bg-amber-500/15 p-4 border-b border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                    Schedule on:
                                  </span>
                                  <input
                                    type="date"
                                    value={planDate}
                                    onChange={(e) => setPlanDate(e.target.value)}
                                    className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200"
                                  />
                                  <select
                                    value={planMealType}
                                    onChange={(e) => setPlanMealType(e.target.value as MealType)}
                                    className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200"
                                  >
                                    <option value="Dinner">Dinner</option>
                                    <option value="Lunch">Lunch</option>
                                    <option value="Breakfast">Breakfast</option>
                                    <option value="Snack">Snack</option>
                                  </select>
                                </div>

                                <button
                                  onClick={() => handleScheduleRemix(remix)}
                                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors shrink-0"
                                >
                                  Confirm to Schedule
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Leftovers & Pantry items summary */}
                          <div className="px-5 py-3 bg-stone-50/80 dark:bg-stone-800/40 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider text-[10px]">
                                Leftovers:
                              </span>
                              {remix.leftoversUtilized.map((item, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold text-[11px]"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider text-[10px]">
                                Pantry:
                              </span>
                              <span className="text-stone-600 dark:text-stone-300 text-[11px]">
                                {remix.pantryItemsNeeded.slice(0, 3).join(', ')}
                                {remix.pantryItemsNeeded.length > 3 && ` +${remix.pantryItemsNeeded.length - 3} more`}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Step-by-Step Recipe Details */}
                          {isExpanded && (
                            <div className="p-5 space-y-4 bg-white dark:bg-stone-900 text-xs">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Ingredients */}
                                <div className="space-y-2">
                                  <h5 className="font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 text-[11px]">
                                    Required Ingredients
                                  </h5>
                                  <ul className="space-y-1.5">
                                    {remix.ingredients.map((ing, i) => (
                                      <li key={i} className="flex items-start gap-2 text-stone-700 dark:text-stone-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                        <span>{ing}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Step-by-Step Cooking Steps */}
                                <div className="space-y-2">
                                  <h5 className="font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 text-[11px]">
                                    Cooking Instructions
                                  </h5>
                                  <ol className="space-y-2">
                                    {remix.instructions.map((step, idx) => (
                                      <li key={idx} className="flex items-start gap-2.5 text-stone-700 dark:text-stone-300">
                                        <span className="w-5 h-5 rounded-full bg-stone-100 dark:bg-stone-800 font-bold text-stone-600 dark:text-stone-300 flex items-center justify-center shrink-0 text-[10px]">
                                          {idx + 1}
                                        </span>
                                        <span className="leading-relaxed">{step}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>

                              {/* Pro-Tips & Copy */}
                              {remix.proTips && (
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <span className="font-bold">Chef's Flavor Secret: </span>
                                    <span>{remix.proTips}</span>
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 flex justify-end">
                                <button
                                  onClick={() => handleCopyInstructions(remix)}
                                  className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-xs font-semibold flex items-center gap-1"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied to clipboard!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" /> Copy Instructions
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Fridge Tracker & Spoilage Guide Tab */
            <div className="space-y-6">
              {/* Header explanation banner */}
              <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:to-transparent rounded-3xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                      USDA Refrigerator Shelf-Life & Freshness Tracker
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                      Monitors elapsed time for cooked meals and highlights safe remixing windows (refrigerated at 40°F / 4°C).
                    </p>
                  </div>
                </div>
              </div>

              {/* Meals Freshness List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Cooked Meals in Your Log ({evaluatedPastMeals.length})
                </h4>

                {evaluatedPastMeals.length === 0 ? (
                  <div className="py-12 px-6 text-center space-y-3 bg-white dark:bg-stone-900 rounded-3xl border border-dashed border-stone-300 dark:border-stone-700">
                    <Utensils className="w-10 h-10 mx-auto text-stone-400 opacity-50" />
                    <h5 className="font-serif text-base font-bold text-stone-800 dark:text-stone-200">
                      No cooked meals logged yet
                    </h5>
                    <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                      As you check off cooked meals in your Weekly Meal Plan, their freshness and USDA shelf-life will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {evaluatedPastMeals.map((meal) => {
                      const { evaluation } = meal;

                      return (
                        <div
                          key={meal.id}
                          className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                                {meal.recipeTitle}
                              </h5>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                {evaluation.categoryLabel}
                              </span>
                            </div>

                            {/* Freshness progress bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                                  <span className={cn("w-2 h-2 rounded-full", evaluation.dotColor)} />
                                  {evaluation.statusHeadline} • {evaluation.statusLabel}
                                </span>
                                <span className="text-stone-400">
                                  Cooked on {meal.cookedDate}
                                </span>
                              </div>

                              <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full transition-all rounded-full",
                                    evaluation.status === 'fresh'
                                      ? 'bg-emerald-500'
                                      : evaluation.status === 'eat_soon'
                                      ? 'bg-amber-500'
                                      : evaluation.status === 'expiring'
                                      ? 'bg-orange-500'
                                      : 'bg-red-500'
                                  )}
                                  style={{ width: `${Math.min(100, evaluation.percentElapsed)}%` }}
                                />
                              </div>
                            </div>

                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {evaluation.actionRecommendation}
                            </p>
                          </div>

                          {/* Remix Action Button */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              onClick={() => {
                                setSelectedPastMealIds([meal.id]);
                                setActiveTab('remix');
                              }}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Remix This</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Standard Food Safety Shelf Life Guide Table */}
              <div className="bg-stone-50 dark:bg-stone-800/40 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-700/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>USDA Refrigerator Shelf-Life Reference</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Cooked Poultry & Meat</span>
                    <p className="text-stone-500 mt-0.5">3 to 4 days</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Cooked Fish & Seafood</span>
                    <p className="text-stone-500 mt-0.5">2 to 3 days</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Soups & Stews</span>
                    <p className="text-stone-500 mt-0.5">3 to 4 days</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Cooked Rice & Pasta</span>
                    <p className="text-stone-500 mt-0.5">3 to 5 days</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Cooked Vegetables / Tofu</span>
                    <p className="text-stone-500 mt-0.5">4 to 5 days</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200">Reheating Safety</span>
                    <p className="text-stone-500 mt-0.5">Heat to 165°F (74°C)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-stone-50 dark:bg-stone-900/90 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {activeTab === 'remix'
              ? `${selectedPastMealIds.length} leftover item(s) selected`
              : 'All guidelines sourced from USDA Food Safety Standards'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:bg-stone-700"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
