import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ShoppingCart, 
  Copy, 
  Check, 
  Printer, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Sparkles, 
  ChefHat, 
  RotateCcw,
  ArrowRight,
  SlidersHorizontal,
  Share2,
  CheckCircle2,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { MealPlan, Recipe } from '../types';
import { 
  categorizeIngredient, 
  cleanIngredientName, 
  GroceryItem, 
  GroceryCategory 
} from '../utils/groceryUtils';

interface SmartGroceryListModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: MealPlan | null;
  recipes: Recipe[];
  weekRangeLabel: string;
  weekStartDateKey: string;
  householdId: string;
}

interface SavedGroceryState {
  isCommitted: boolean;
  committedItemNames: string[]; // which raw/cleaned ingredient names were committed
  cartChecked: Record<string, boolean>; // which items have been placed in cart
  customItems: GroceryItem[];
  committedAt?: string;
}

export const SmartGroceryListModal: React.FC<SmartGroceryListModalProps> = ({
  isOpen,
  onClose,
  mealPlan,
  recipes,
  weekRangeLabel,
  weekStartDateKey,
  householdId
}) => {
  // Storage key for persisting committed state, cart checks, and custom items for this week
  const storageKey = `kitchow_grocery_${householdId}_${weekStartDateKey}`;

  // Map recipes by ID for fast lookup
  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach(r => {
      if (r.id) map.set(r.id, r);
    });
    return map;
  }, [recipes]);

  // Extract all ingredients across planned recipes in the meal plan
  const allExtractedIngredients = useMemo<GroceryItem[]>(() => {
    if (!mealPlan?.days) return [];

    const itemMap = new Map<string, GroceryItem>();

    Object.values(mealPlan.days).forEach(daySlots => {
      daySlots.forEach(slot => {
        if (slot.recipeId && recipeMap.has(slot.recipeId)) {
          const recipe = recipeMap.get(slot.recipeId)!;
          recipe.ingredients.forEach(rawIng => {
            const cleaned = cleanIngredientName(rawIng);
            if (!cleaned) return;
            const normalizedKey = cleaned.toLowerCase();

            if (itemMap.has(normalizedKey)) {
              const existing = itemMap.get(normalizedKey)!;
              if (!existing.recipeTitles.includes(recipe.title)) {
                existing.recipeTitles.push(recipe.title);
              }
            } else {
              const { tier, category } = categorizeIngredient(cleaned);
              itemMap.set(normalizedKey, {
                id: 'ing_' + normalizedKey.replace(/[^a-z0-9]/g, '_'),
                name: cleaned,
                originalText: rawIng,
                tier,
                category,
                recipeTitles: [recipe.title],
                isChecked: false,
                isCustom: false
              });
            }
          });
        }
      });
    });

    return Array.from(itemMap.values());
  }, [mealPlan, recipeMap]);

  // Split all extracted ingredients into primary and secondary (pantry/staples)
  const primaryIngredients = useMemo(() => {
    return allExtractedIngredients.filter(item => item.tier === 'primary');
  }, [allExtractedIngredients]);

  const secondaryIngredients = useMemo(() => {
    return allExtractedIngredients.filter(item => item.tier === 'pantry');
  }, [allExtractedIngredients]);

  // Persisted state
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const [committedItemNames, setCommittedItemNames] = useState<string[]>([]);
  const [cartChecked, setCartChecked] = useState<Record<string, boolean>>({});
  const [customItems, setCustomItems] = useState<GroceryItem[]>([]);
  
  // Step: 'prompt' (review & commit ingredients) | 'list' (official shopping list)
  const [step, setStep] = useState<'prompt' | 'list'>('prompt');

  // Pre-commit selection state: Primary defaults to TRUE, Secondary defaults to FALSE
  const [preCommitSelection, setPreCommitSelection] = useState<Record<string, boolean>>({});

  const [copyFeedback, setCopyFeedback] = useState(false);

  // Custom Item Form
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState<GroceryCategory>('Produce & Herbs');
  const [newCustomTier, setNewCustomTier] = useState<'primary' | 'pantry'>('primary');

  // Load saved state on mount or week change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: SavedGroceryState = JSON.parse(saved);
        if (parsed.isCommitted) {
          setIsCommitted(true);
          setCommittedItemNames(parsed.committedItemNames || []);
          setCartChecked(parsed.cartChecked || {});
          setCustomItems(parsed.customItems || []);
          setStep('list');
          return;
        }
      }
      // If not committed, default step to 'prompt'
      setIsCommitted(false);
      setStep('prompt');
    } catch (e) {
      console.error("Failed to load grocery state", e);
      setIsCommitted(false);
      setStep('prompt');
    }
  }, [storageKey, isOpen]);

  // Initialize preCommitSelection whenever prompt is active or ingredients change
  useEffect(() => {
    if (!isCommitted || step === 'prompt') {
      const initial: Record<string, boolean> = {};
      
      // Primary ingredients default to TRUE ('include')
      primaryIngredients.forEach(item => {
        initial[item.name] = preCommitSelection[item.name] !== undefined ? preCommitSelection[item.name] : true;
      });

      // Secondary ingredients default to FALSE ('exclude')
      secondaryIngredients.forEach(item => {
        initial[item.name] = preCommitSelection[item.name] !== undefined ? preCommitSelection[item.name] : false;
      });

      setPreCommitSelection(initial);
    }
  }, [primaryIngredients, secondaryIngredients, step, isCommitted]);

  // Toggle selection during pre-commit prompt
  const handleTogglePreCommitItem = (name: string) => {
    setPreCommitSelection(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Bulk actions in pre-commit prompt
  const handleSetAllPrimary = (included: boolean) => {
    setPreCommitSelection(prev => {
      const updated = { ...prev };
      primaryIngredients.forEach(item => {
        updated[item.name] = included;
      });
      return updated;
    });
  };

  const handleSetAllSecondary = (included: boolean) => {
    setPreCommitSelection(prev => {
      const updated = { ...prev };
      secondaryIngredients.forEach(item => {
        updated[item.name] = included;
      });
      return updated;
    });
  };

  // Commit selected ingredients to create the Official Shopping List
  const handleCommitIngredients = () => {
    const selectedNames = Object.keys(preCommitSelection).filter(name => preCommitSelection[name] === true);
    
    setCommittedItemNames(selectedNames);
    setIsCommitted(true);
    setStep('list');

    const stateToSave: SavedGroceryState = {
      isCommitted: true,
      committedItemNames: selectedNames,
      cartChecked,
      customItems,
      committedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Failed to save committed grocery list", e);
    }
  };

  // Re-generate or edit committed ingredients
  const handleReopenPrompt = () => {
    const current: Record<string, boolean> = {};
    const committedSet = new Set(committedItemNames);

    primaryIngredients.forEach(item => {
      current[item.name] = committedSet.has(item.name);
    });
    secondaryIngredients.forEach(item => {
      current[item.name] = committedSet.has(item.name);
    });

    setPreCommitSelection(current);
    setStep('prompt');
  };

  // Build the official shopping list items
  const officialCommittedItems = useMemo<GroceryItem[]>(() => {
    const committedSet = new Set(committedItemNames);
    const items: GroceryItem[] = [];

    allExtractedIngredients.forEach(item => {
      if (committedSet.has(item.name)) {
        items.push({
          ...item,
          isChecked: !!cartChecked[item.name]
        });
      }
    });

    // Append custom household items
    customItems.forEach(ci => {
      items.push({
        ...ci,
        isChecked: !!cartChecked[ci.name]
      });
    });

    return items;
  }, [allExtractedIngredients, committedItemNames, cartChecked, customItems]);

  // Persist cart changes & custom items
  const saveOfficialState = (newCartChecked: Record<string, boolean>, newCustomItems: GroceryItem[]) => {
    try {
      const stateToSave: SavedGroceryState = {
        isCommitted: true,
        committedItemNames,
        cartChecked: newCartChecked,
        customItems: newCustomItems,
        committedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Failed to save grocery state", e);
    }
  };

  // Toggle cart check in official list
  const handleToggleCartItem = (itemName: string) => {
    const updated = {
      ...cartChecked,
      [itemName]: !cartChecked[itemName]
    };
    setCartChecked(updated);
    saveOfficialState(updated, customItems);
  };

  // Reset all cart checks
  const handleResetCart = () => {
    if (window.confirm("Uncheck all items in your cart?")) {
      setCartChecked({});
      saveOfficialState({}, customItems);
    }
  };

  // Add custom extra item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomName.trim()) return;

    const newItem: GroceryItem = {
      id: 'custom_' + Date.now(),
      name: newCustomName.trim(),
      originalText: newCustomName.trim(),
      tier: newCustomTier,
      category: newCustomCategory,
      recipeTitles: ['Household Extra'],
      isChecked: false,
      isCustom: true
    };

    const updatedCustom = [...customItems, newItem];
    setCustomItems(updatedCustom);
    setNewCustomName('');
    saveOfficialState(cartChecked, updatedCustom);
  };

  // Remove custom item
  const handleRemoveCustomItem = (id: string, name: string) => {
    const updatedCustom = customItems.filter(item => item.id !== id);
    const updatedCart = { ...cartChecked };
    delete updatedCart[name];
    setCustomItems(updatedCustom);
    setCartChecked(updatedCart);
    saveOfficialState(updatedCart, updatedCustom);
  };

  // Group official items by category
  const categorizedOfficialGroups = useMemo(() => {
    const groups: { category: GroceryCategory; items: GroceryItem[] }[] = [];
    const categoryOrder: GroceryCategory[] = [
      'Produce & Herbs',
      'Meat & Seafood',
      'Dairy & Refrigerated',
      'Bakery & Bread',
      'Pantry & Canned Goods',
      'Spices & Seasonings',
      'Oils, Vinegars & Condiments',
      'Baking & Grains',
      'Beverages & Other'
    ];

    categoryOrder.forEach(cat => {
      const itemsInCat = officialCommittedItems.filter(i => i.category === cat);
      if (itemsInCat.length > 0) {
        groups.push({ category: cat, items: itemsInCat });
      }
    });

    return groups;
  }, [officialCommittedItems]);

  // Shopping statistics
  const totalOfficialCount = officialCommittedItems.length;
  const inCartCount = useMemo(() => {
    return officialCommittedItems.filter(i => !!cartChecked[i.name]).length;
  }, [officialCommittedItems, cartChecked]);
  const progressPercent = totalOfficialCount > 0 ? Math.round((inCartCount / totalOfficialCount) * 100) : 0;

  // Pre-commit selected counts
  const selectedPrimaryCount = primaryIngredients.filter(i => preCommitSelection[i.name] === true).length;
  const selectedSecondaryCount = secondaryIngredients.filter(i => preCommitSelection[i.name] === true).length;
  const totalSelectedForCommit = selectedPrimaryCount + selectedSecondaryCount;

  // Copy formatted list to clipboard
  const handleCopyFormattedList = () => {
    const primaryItems = officialCommittedItems.filter(i => i.tier === 'primary');
    const pantryItems = officialCommittedItems.filter(i => i.tier === 'pantry');

    const lines = [
      `🛒 OFFICIAL GROCERY LIST (${weekRangeLabel}) - Kitch-ow!`,
      `Cart Progress: ${inCartCount}/${totalOfficialCount} items (${progressPercent}%)`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🥩🥬 PRIMARY INGREDIENTS (Fresh / Meal Specific)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ];

    if (primaryItems.length === 0) {
      lines.push('(None selected)');
    } else {
      primaryItems.forEach(item => {
        const checked = cartChecked[item.name] ? '✓ ' : '□ ';
        const recipeNote = item.recipeTitles.length > 0 && !item.isCustom 
          ? ` (${item.recipeTitles.join(', ')})` 
          : '';
        lines.push(`${checked}${item.name}${recipeNote}`);
      });
    }

    lines.push(
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🧂🥫 SECONDARY / PANTRY REPLENISHMENTS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    if (pantryItems.length === 0) {
      lines.push('(None selected)');
    } else {
      pantryItems.forEach(item => {
        const checked = cartChecked[item.name] ? '✓ ' : '□ ';
        const recipeNote = item.recipeTitles.length > 0 && !item.isCustom 
          ? ` (${item.recipeTitles.join(', ')})` 
          : '';
        lines.push(`${checked}${item.name}${recipeNote}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    });
  };

  const handlePrintList = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 dark:bg-black/75 backdrop-blur-sm print:p-0 print:bg-white print:static"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none"
      >
        {/* Condensed Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 print:pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 print:hidden">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-50 truncate">
                  {step === 'prompt' ? 'Commit Ingredients' : 'Grocery List'}
                </h3>
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  {weekRangeLabel}
                </span>
                {step === 'list' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 print:hidden">
                    {inCartCount}/{totalOfficialCount} in cart ({progressPercent}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 print:hidden">
            {step === 'list' && (
              <>
                <button
                  type="button"
                  onClick={handleReopenPrompt}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1.5"
                  title="Re-review and edit ingredients"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit Items</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFormattedList}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1"
                  title="Copy grocery list"
                >
                  {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline">{copyFeedback ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintList}
                  className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 transition-colors"
                  title="Print grocery list"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Copy Feedback Banner */}
        {copyFeedback && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs py-1.5 px-4 text-center font-medium border-b border-emerald-100 dark:border-emerald-900/50 print:hidden">
            ✓ Copied official grocery list to clipboard!
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: ONE-TIME PROMPT TO COMMIT INGREDIENTS */}
        {/* ========================================================================= */}
        {step === 'prompt' ? (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Prompt Instructions Banner */}
            <div className="px-4 sm:px-6 py-3.5 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-100/80 dark:border-amber-900/40">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  <strong>Primary ingredients</strong> default to <strong>included</strong>, while <strong>pantry basics</strong> default to <strong>excluded</strong>. Select any extras you need, then commit to build your shopping list.
                </div>
              </div>
            </div>

            {/* Main Ingredients Selection Area */}
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              {allExtractedIngredients.length === 0 ? (
                <div className="text-center py-10 px-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                  <ChefHat className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
                  <p className="font-serif font-bold text-sm text-stone-700 dark:text-stone-300">
                    No Planned Meals Detected
                  </p>
                  <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                    Add recipes to your weekly meal plan first, or click "AI Plan Week" to automatically generate a delicious menu.
                  </p>
                </div>
              ) : (
                <>
                  {/* SECTION 1: PRIMARY INGREDIENTS (Included by default) */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🥩🥬</span>
                        <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                          Primary Ingredients
                        </h4>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          {selectedPrimaryCount} of {primaryIngredients.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetAllPrimary(true)}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <button
                          type="button"
                          onClick={() => handleSetAllPrimary(false)}
                          className="text-[11px] text-stone-400 hover:underline font-medium"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {primaryIngredients.length === 0 ? (
                      <p className="text-xs text-stone-400 italic py-1">No primary fresh ingredients found.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {primaryIngredients.map(item => {
                          const isIncluded = preCommitSelection[item.name] === true;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleTogglePreCommitItem(item.name)}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                isIncluded
                                  ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 shadow-2xs"
                                  : "bg-stone-50/60 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-60 hover:opacity-100"
                              }`}
                            >
                              <div className="pt-0.5 flex-shrink-0">
                                {isIncluded ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-stone-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-xs font-semibold truncate ${
                                    isIncluded ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'
                                  }`}>
                                    {item.name}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-medium flex-shrink-0">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-[10px] text-stone-400 block truncate">
                                  {item.recipeTitles.join(', ')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: SECONDARY PANTRY INGREDIENTS (Excluded by default) */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🧂🥫</span>
                        <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm">
                          Pantry & Shelf-Stable Basics
                        </h4>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold border border-stone-200 dark:border-stone-700">
                          {selectedSecondaryCount} of {secondaryIngredients.length}
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium hidden md:inline">
                          (Defaults Excluded)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetAllSecondary(true)}
                          className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          Include All Pantry
                        </button>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <button
                          type="button"
                          onClick={() => handleSetAllSecondary(false)}
                          className="text-[11px] text-stone-400 hover:underline font-medium"
                        >
                          Exclude All
                        </button>
                      </div>
                    </div>

                    {secondaryIngredients.length === 0 ? (
                      <p className="text-xs text-stone-400 italic py-1">No pantry staples detected.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {secondaryIngredients.map(item => {
                          const isIncluded = preCommitSelection[item.name] === true;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleTogglePreCommitItem(item.name)}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                isIncluded
                                  ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 shadow-2xs"
                                  : "bg-white dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 opacity-70 hover:opacity-100"
                              }`}
                            >
                              <div className="pt-0.5 flex-shrink-0">
                                {isIncluded ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-xs font-semibold truncate ${
                                    isIncluded ? 'text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400'
                                  }`}>
                                    {item.name}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-400 font-medium flex-shrink-0">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-[10px] text-stone-400 block truncate">
                                  {item.recipeTitles.join(', ')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Commitment Action Bar */}
            <div className="p-3.5 sm:p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-3 sticky bottom-0 z-10 shadow-md">
              <div className="text-xs text-stone-600 dark:text-stone-300">
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {totalSelectedForCommit} items
                </span> selected
                <span className="text-stone-400 hidden sm:inline"> ({selectedPrimaryCount} Primary + {selectedSecondaryCount} Pantry)</span>
              </div>

              <div className="flex items-center gap-2">
                {isCommitted && (
                  <button
                    type="button"
                    onClick={() => setStep('list')}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCommitIngredients}
                  disabled={totalSelectedForCommit === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create List ({totalSelectedForCommit})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 2: REFINED & SPACE-OPTIMIZED OFFICIAL SHOPPING LIST VIEW */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Slim Progress Bar Header */}
            <div className="px-4 sm:px-6 py-2 bg-stone-50/90 dark:bg-stone-800/40 border-b border-stone-200/60 dark:border-stone-800 flex items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2.5 flex-1 max-w-md">
                <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 flex-shrink-0">
                  {inCartCount} of {totalOfficialCount} done
                </span>
              </div>

              {inCartCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetCart}
                  className="text-[11px] font-medium text-stone-400 hover:text-rose-600 transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Uncheck all items in cart"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Cart</span>
                </button>
              )}
            </div>

            {/* Main Shopping List Aisle Groups - Maximized Vertical Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 print:p-0 print:overflow-visible">
              {officialCommittedItems.length === 0 ? (
                <div className="text-center py-12 px-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                  <ShoppingCart className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
                  <p className="font-serif font-bold text-sm text-stone-700 dark:text-stone-300">
                    No items on your official list
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Click "Edit Items" above to commit ingredients from your planned meals.
                  </p>
                </div>
              ) : (
                categorizedOfficialGroups.map(({ category, items }) => (
                  <div key={category} className="space-y-1.5 print:space-y-1 print:break-inside-avoid">
                    <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-800">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                        <span>{category}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({items.length})</span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 print:grid-cols-2 print:gap-1">
                      {items.map(item => {
                        const isChecked = !!cartChecked[item.name];
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleCartItem(item.name)}
                            className={`flex items-start justify-between gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-stone-50/70 dark:bg-stone-950/30 border-stone-200/60 dark:border-stone-800/60 opacity-55"
                                : item.tier === 'pantry'
                                ? "bg-amber-50/20 dark:bg-stone-800/50 border-amber-100/60 dark:border-stone-700 hover:border-amber-400"
                                : "bg-white dark:bg-stone-800/80 border-stone-200/80 dark:border-stone-700 hover:border-amber-400 shadow-2xs"
                            } print:border-stone-300 print:p-1`}
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <div className="pt-0.5 flex-shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-semibold block truncate ${
                                    isChecked ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-900 dark:text-stone-100'
                                  }`}>
                                    {item.name}
                                  </span>
                                  {item.tier === 'pantry' && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 font-medium">
                                      Pantry
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-stone-400 block truncate">
                                  {item.recipeTitles.join(', ')}
                                </span>
                              </div>
                            </div>

                            {item.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCustomItem(item.id, item.name);
                                }}
                                className="p-1 text-stone-300 hover:text-rose-500 transition-colors flex-shrink-0 print:hidden"
                                title="Remove custom item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Compact Add Household Extra Item Form */}
              <div className="pt-2 print:hidden">
                <form onSubmit={handleAddCustomItem} className="flex flex-col sm:flex-row gap-1.5 p-2 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/80">
                  <input
                    type="text"
                    placeholder="Add extra household item (e.g. Paper towels, Milk)..."
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  <select
                    value={newCustomCategory}
                    onChange={(e) => setNewCustomCategory(e.target.value as GroceryCategory)}
                    className="px-2 py-1.5 rounded-xl text-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-none text-stone-700 dark:text-stone-300"
                  >
                    <option value="Produce & Herbs">Produce & Herbs</option>
                    <option value="Meat & Seafood">Meat & Seafood</option>
                    <option value="Dairy & Refrigerated">Dairy & Refrigerated</option>
                    <option value="Bakery & Bread">Bakery & Bread</option>
                    <option value="Pantry & Canned Goods">Pantry & Canned Goods</option>
                    <option value="Spices & Seasonings">Spices & Seasonings</option>
                    <option value="Oils, Vinegars & Condiments">Oils, Vinegars & Condiments</option>
                    <option value="Baking & Grains">Baking & Grains</option>
                    <option value="Beverages & Other">Beverages & Other</option>
                  </select>

                  <button
                    type="submit"
                    disabled={!newCustomName.trim()}
                    className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-800 disabled:opacity-50 transition-all flex items-center justify-center gap-1 flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Ultra-Slim Footer Bar */}
            <div className="px-4 py-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900 print:hidden">
              <span className="text-[11px] text-stone-400">
                Tap items to check off in-store
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyFormattedList}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
