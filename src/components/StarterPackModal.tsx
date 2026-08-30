import React, { useState, useMemo } from 'react';
import { Recipe, Category } from '../types';
import { STOCK_RECIPES } from '../data/stockRecipes';
import { 
  Sparkles, 
  Check, 
  Plus, 
  Search, 
  Clock, 
  Star, 
  ChefHat, 
  X, 
  RotateCcw, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  Filter,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StarterPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  householdName?: string;
  onLoadAllMissing: () => Promise<number | void>;
  onForceReloadAll: () => Promise<number | void>;
  onAddSingleRecipe: (stockRecipe: Partial<Recipe>) => Promise<void>;
  onViewRecipe?: (recipe: Recipe) => void;
}

export const StarterPackModal: React.FC<StarterPackModalProps> = ({
  isOpen,
  onClose,
  recipes,
  householdName = 'your Kitchen',
  onLoadAllMissing,
  onForceReloadAll,
  onAddSingleRecipe,
  onViewRecipe,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [previewingRecipe, setPreviewingRecipe] = useState<Partial<Recipe> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingRecipeTitle, setProcessingRecipeTitle] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Set of normalized existing titles in the household
  const existingRecipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach(r => {
      if (r.title) {
        map.set(r.title.toLowerCase().trim(), r);
      }
    });
    return map;
  }, [recipes]);

  // Missing count calculation
  const missingCount = useMemo(() => {
    return STOCK_RECIPES.filter(
      sr => sr.title && !existingRecipeMap.has(sr.title.toLowerCase().trim())
    ).length;
  }, [existingRecipeMap]);

  const loadedCount = STOCK_RECIPES.length - missingCount;

  // Filter stock recipes
  const filteredStockRecipes = useMemo(() => {
    return STOCK_RECIPES.filter(r => {
      if (!r.title) return false;
      const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleBatchLoad = async () => {
    setIsProcessing(true);
    setFeedbackMessage(null);
    try {
      const added = await onLoadAllMissing();
      setFeedbackMessage({
        type: 'success',
        text: typeof added === 'number' && added > 0 
          ? `Successfully added ${added} starter recipes to ${householdName}!` 
          : `All 32 starter recipes are loaded in ${householdName}!`
      });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to load recipes. Please check your connection and try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReload = async () => {
    if (!window.confirm(`This will ensure all 32 curated starter recipes are freshly imported into ${householdName}. Proceed?`)) {
      return;
    }
    setIsProcessing(true);
    setFeedbackMessage(null);
    try {
      await onForceReloadAll();
      setFeedbackMessage({
        type: 'success',
        text: `All 32 starter recipes have been freshly imported into ${householdName}!`
      });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to reload starter recipes. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSingle = async (r: Partial<Recipe>) => {
    if (!r.title) return;
    setProcessingRecipeTitle(r.title);
    setFeedbackMessage(null);
    try {
      await onAddSingleRecipe(r);
      setFeedbackMessage({
        type: 'success',
        text: `Added "${r.title}" to ${householdName}!`
      });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to add "${r.title}". Please try again.`
      });
    } finally {
      setProcessingRecipeTitle(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-stone-900 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800"
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-200 dark:border-stone-800 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 dark:from-stone-900 dark:via-stone-900 dark:to-amber-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Starter Recipe Collection
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80">
                  {loadedCount} of {STOCK_RECIPES.length} Loaded
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                32 chef-curated family favorites across dinners, breakfasts, lunches, and staples for {householdName}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Action Banner / Progress Bar */}
        <div className="px-6 py-3.5 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-amber-950 dark:text-amber-200">
            {missingCount > 0 ? (
              <>
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>{missingCount}</strong> starter {missingCount === 1 ? 'recipe is' : 'recipes are'} ready to be added to {householdName}.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  All <strong>{STOCK_RECIPES.length}</strong> curated starter recipes are loaded in {householdName}!
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {missingCount > 0 ? (
              <button
                type="button"
                onClick={handleBatchLoad}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isProcessing ? 'Loading Recipes...' : `Load All Missing (${missingCount})`}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleForceReload}
                disabled={isProcessing}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Force refresh and ensure all 32 recipes are in your kitchen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-import / Refresh All 32</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert Toast */}
        <AnimatePresence>
          {feedbackMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "px-6 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between border-b",
                feedbackMessage.type === 'success' && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
                feedbackMessage.type === 'error' && "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
                feedbackMessage.type === 'info' && "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
              )}
            >
              <span>{feedbackMessage.text}</span>
              <button 
                onClick={() => setFeedbackMessage(null)}
                className="p-1 hover:opacity-75"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Category Filter Controls */}
        <div className="p-4 sm:p-6 pb-2 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes (e.g., kebab, pasta, curry, breakfast, salmon)..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-stone-800 dark:text-stone-100 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {(['All', 'Dinner', 'Breakfast', 'Lunch', 'Dessert', 'Snack'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                    selectedCategory === cat
                      ? "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm"
                      : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recipe Cards List / Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-stone-50/30 dark:bg-stone-950/20">
          {filteredStockRecipes.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ChefHat className="w-10 h-10 text-stone-400 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                No starter recipes found matching "{searchQuery}"
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredStockRecipes.map((stockRecipe) => {
                const titleKey = stockRecipe.title?.toLowerCase().trim() || '';
                const existingRecipe = existingRecipeMap.get(titleKey);
                const isLoaded = Boolean(existingRecipe);
                const isItemProcessing = processingRecipeTitle === stockRecipe.title;

                return (
                  <div
                    key={stockRecipe.title}
                    className={cn(
                      "group relative rounded-2xl p-4 transition-all border flex flex-col justify-between bg-white dark:bg-stone-900",
                      isLoaded 
                        ? "border-stone-200/80 dark:border-stone-800 shadow-sm opacity-95" 
                        : "border-amber-200 dark:border-amber-900/60 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 bg-gradient-to-br from-white via-white to-amber-50/20 dark:from-stone-900 dark:to-amber-950/10"
                    )}
                  >
                    <div className="flex gap-3.5 items-start">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 relative border border-stone-200/60 dark:border-stone-800">
                        {stockRecipe.imageUrl ? (
                          <img
                            src={stockRecipe.imageUrl}
                            alt={stockRecipe.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <ChefHat className="w-6 h-6" />
                          </div>
                        )}
                        {stockRecipe.category && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-900/80 text-white backdrop-blur-xs">
                            {stockRecipe.category}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 line-clamp-2 leading-snug">
                            {stockRecipe.title}
                          </h3>
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 mt-1.5 flex-wrap">
                          {stockRecipe.estimatedTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              {stockRecipe.estimatedTime}m
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            5.0
                          </span>
                          <span className="text-[11px] text-stone-400">
                            {stockRecipe.ingredients?.length || 0} ingredients
                          </span>
                        </div>

                        {/* Quick preview of ingredients */}
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-1 italic">
                          {stockRecipe.ingredients?.slice(0, 3).join(', ')}...
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewingRecipe(stockRecipe)}
                        className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Preview Ingredients</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isLoaded ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              In Kitchen
                            </span>
                            {existingRecipe && onViewRecipe && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onViewRecipe(existingRecipe);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
                              >
                                View
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddSingle(stockRecipe)}
                            disabled={isItemProcessing || isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isItemProcessing ? 'Adding...' : 'Add to Kitchen'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recipe Preview Drawer / Submodal */}
        <AnimatePresence>
          {previewingRecipe && (
            <div 
              className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
              onClick={() => setPreviewingRecipe(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800"
              >
                <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Starter Pack Recipe Preview
                    </span>
                    <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
                      {previewingRecipe.title}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setPreviewingRecipe(null)} 
                    className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm text-stone-700 dark:text-stone-300">
                  {previewingRecipe.imageUrl && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800">
                      <img 
                        src={previewingRecipe.imageUrl} 
                        alt={previewingRecipe.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                      Ingredients ({previewingRecipe.ingredients?.length || 0})
                    </h4>
                    <ul className="space-y-1 bg-stone-50 dark:bg-stone-950/60 p-3.5 rounded-2xl border border-stone-200/60 dark:border-stone-800">
                      {previewingRecipe.ingredients?.map((ing, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                          <span className="text-amber-500">•</span>
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                      Instructions
                    </h4>
                    <ol className="space-y-2 bg-stone-50 dark:bg-stone-950/60 p-3.5 rounded-2xl border border-stone-200/60 dark:border-stone-800">
                      {previewingRecipe.instructions?.map((inst, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{inst}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setPreviewingRecipe(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800"
                  >
                    Close Preview
                  </button>

                  {!existingRecipeMap.has(previewingRecipe.title?.toLowerCase().trim() || '') ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleAddSingle(previewingRecipe);
                        setPreviewingRecipe(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add This Recipe</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> In Your Kitchen
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
