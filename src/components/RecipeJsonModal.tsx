import React, { useState, useMemo, useRef } from 'react';
import { Recipe, Household, HouseholdKitchenProfile, Category } from '../types';
import { STOCK_RECIPES } from '../data/stockRecipes';
import { 
  Download, 
  Upload, 
  Copy, 
  Check, 
  FileJson, 
  X, 
  Sparkles, 
  AlertCircle, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  ChefHat, 
  CheckSquare, 
  Square, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  Leaf, 
  Utensils 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface KitchOwExportBundle {
  version: string;
  appName: string;
  exportedAt: string;
  householdName?: string;
  kitchenProfile?: HouseholdKitchenProfile;
  recipes: Partial<Recipe>[];
}

interface RecipeJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  household: Household | null;
  onImportRecipes: (
    recipesToImport: Partial<Recipe>[],
    duplicateStrategy: 'skip' | 'overwrite' | 'add_as_new',
    importedKitchenProfile?: HouseholdKitchenProfile
  ) => Promise<{ importedCount: number; overwrittenCount: number; skippedCount: number }>;
}

export const RecipeJsonModal: React.FC<RecipeJsonModalProps> = ({
  isOpen,
  onClose,
  recipes,
  household,
  onImportRecipes,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // --- EXPORT STATE ---
  const [includeKitchenProfile, setIncludeKitchenProfile] = useState(true);
  const [hasCopiedExport, setHasCopiedExport] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);

  // --- IMPORT STATE ---
  const [importInputMode, setImportInputMode] = useState<'file' | 'paste'>('file');
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [parsedImportBundle, setParsedImportBundle] = useState<KitchOwExportBundle | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedRecipeIndices, setSelectedRecipeIndices] = useState<Set<number>>(new Set());
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite' | 'add_as_new'>('skip');
  const [importKitchenProfileToggle, setImportKitchenProfileToggle] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultSummary, setImportResultSummary] = useState<{
    importedCount: number;
    overwrittenCount: number;
    skippedCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate standard export data bundle
  const exportData: KitchOwExportBundle = useMemo(() => {
    const cleanedRecipes: Partial<Recipe>[] = recipes.map((r) => {
      const { id, authorId, householdId, createdAt, ...rest } = r;
      return {
        ...rest,
        title: r.title,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        category: r.category || 'Other',
        rating: r.rating || 0,
        estimatedTime: r.estimatedTime || null,
        isStaple: !!r.isStaple,
        sourceUrl: r.sourceUrl || '',
        imageUrl: r.imageUrl || '',
      };
    });

    return {
      version: '1.0',
      appName: 'Kitch-ow!',
      exportedAt: new Date().toISOString(),
      householdName: household?.name || 'My Kitchen',
      ...(includeKitchenProfile && household?.kitchenProfile
        ? { kitchenProfile: household.kitchenProfile }
        : {}),
      recipes: cleanedRecipes,
    };
  }, [recipes, household, includeKitchenProfile]);

  const exportJsonString = useMemo(() => {
    return JSON.stringify(exportData, null, 2);
  }, [exportData]);

  // Handle file download
  const handleDownloadFile = () => {
    const blob = new Blob([exportJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (household?.name || 'kitchen')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `kitch-ow-recipes-${safeName}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle copy export JSON
  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportJsonString);
    setHasCopiedExport(true);
    setTimeout(() => setHasCopiedExport(false), 2500);
  };

  // Parse raw JSON text or uploaded file
  const parseJsonContent = (rawText: string) => {
    setImportError(null);
    setImportResultSummary(null);
    try {
      if (!rawText.trim()) {
        setImportError("Please provide or upload valid JSON text.");
        setParsedImportBundle(null);
        return;
      }

      const parsed = JSON.parse(rawText);
      let bundle: KitchOwExportBundle;

      if (Array.isArray(parsed)) {
        // Raw array of recipes
        bundle = {
          version: '1.0',
          appName: 'Kitch-ow!',
          exportedAt: new Date().toISOString(),
          recipes: parsed.map(normalizeRawRecipe),
        };
      } else if (parsed && Array.isArray(parsed.recipes)) {
        // Standard Kitch-ow export or generic bundle with recipes array
        bundle = {
          version: parsed.version || '1.0',
          appName: parsed.appName || 'Kitch-ow!',
          exportedAt: parsed.exportedAt || new Date().toISOString(),
          householdName: parsed.householdName,
          kitchenProfile: parsed.kitchenProfile,
          recipes: parsed.recipes.map(normalizeRawRecipe),
        };
      } else if (parsed && typeof parsed === 'object' && parsed.title) {
        // Single recipe object
        bundle = {
          version: '1.0',
          appName: 'Kitch-ow!',
          exportedAt: new Date().toISOString(),
          recipes: [normalizeRawRecipe(parsed)],
        };
      } else {
        throw new Error("Could not find a valid recipe list or object in this JSON file.");
      }

      if (bundle.recipes.length === 0) {
        throw new Error("The file was parsed successfully, but contains 0 recipes.");
      }

      setParsedImportBundle(bundle);
      // Select all valid recipes by default
      setSelectedRecipeIndices(new Set(bundle.recipes.map((_, i) => i)));
    } catch (err: any) {
      console.error("JSON parse error:", err);
      setImportError(err?.message || "Invalid JSON syntax. Please verify formatting.");
      setParsedImportBundle(null);
    }
  };

  // Helper to normalize unknown external recipe structure into Kitch-ow Recipe format
  const normalizeRawRecipe = (item: any): Partial<Recipe> => {
    const rawCategory = item.category || item.recipeCategory || 'Dinner';
    const validCategories: Category[] = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Other'];
    const matchedCategory = validCategories.find(c => c.toLowerCase() === String(rawCategory).toLowerCase()) || 'Dinner';

    const ingredients: string[] = Array.isArray(item.ingredients)
      ? item.ingredients.map(String)
      : Array.isArray(item.recipeIngredient)
      ? item.recipeIngredient.map(String)
      : typeof item.ingredients === 'string'
      ? item.ingredients.split('\n').filter(Boolean)
      : [];

    const instructions: string[] = Array.isArray(item.instructions)
      ? item.instructions.map(String)
      : Array.isArray(item.recipeInstructions)
      ? item.recipeInstructions.map((step: any) => typeof step === 'string' ? step : step?.text || '')
      : typeof item.instructions === 'string'
      ? item.instructions.split('\n').filter(Boolean)
      : [];

    return {
      title: String(item.title || item.name || 'Untitled Recipe').trim(),
      category: matchedCategory,
      ingredients,
      instructions,
      rating: Number(item.rating) || 0,
      estimatedTime: Number(item.estimatedTime || item.cookTime || item.totalTime) || null,
      isStaple: Boolean(item.isStaple),
      sourceUrl: item.sourceUrl || item.url || '',
      imageUrl: item.imageUrl || item.image || '',
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseJsonContent(content);
    };
    reader.onerror = () => {
      setImportError("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  const handleLoadStockBundle = () => {
    const bundle: KitchOwExportBundle = {
      version: '1.0.0',
      appName: 'Kitch-ow',
      exportedAt: new Date().toISOString(),
      householdName: 'Curated Starter Recipes',
      recipes: STOCK_RECIPES.map((r) => normalizeRawRecipe(r)),
    };
    setParsedImportBundle(bundle);
    setSelectedRecipeIndices(new Set(bundle.recipes.map((_, i) => i)));
    setImportError(null);
  };

  // Existing household titles for duplicate detection
  const existingTitles = useMemo(() => {
    return new Set(recipes.map((r) => r.title.toLowerCase().trim()));
  }, [recipes]);

  // Execute import
  const handleExecuteImport = async () => {
    if (!parsedImportBundle) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const chosenRecipes = parsedImportBundle.recipes.filter((_, idx) =>
        selectedRecipeIndices.has(idx)
      );

      if (chosenRecipes.length === 0) {
        setImportError("Please select at least one recipe to import.");
        setIsImporting(false);
        return;
      }

      const kitchenProfileToImport =
        importKitchenProfileToggle && parsedImportBundle.kitchenProfile
          ? parsedImportBundle.kitchenProfile
          : undefined;

      const result = await onImportRecipes(
        chosenRecipes,
        duplicateStrategy,
        kitchenProfileToImport
      );

      setImportResultSummary(result);
    } catch (err: any) {
      console.error("Failed to complete import:", err);
      setImportError(err?.message || "An error occurred while saving imported recipes.");
    } finally {
      setIsImporting(false);
    }
  };

  const toggleRecipeSelection = (index: number) => {
    setSelectedRecipeIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!parsedImportBundle) return;
    setSelectedRecipeIndices(new Set(parsedImportBundle.recipes.map((_, i) => i)));
  };

  const selectNewOnly = () => {
    if (!parsedImportBundle) return;
    const newIndices = new Set<number>();
    parsedImportBundle.recipes.forEach((r, i) => {
      if (!existingTitles.has((r.title || '').toLowerCase().trim())) {
        newIndices.add(i);
      }
    });
    setSelectedRecipeIndices(newIndices);
  };

  const deselectAll = () => {
    setSelectedRecipeIndices(new Set());
  };

  if (!isOpen) return null;

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
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  Recipe Data & Portability (JSON)
                </h2>
                {household?.name && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
                    {household.name}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Export your full recipe collection for backup, or import recipes from other files.
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

        {/* Tab switcher */}
        <div className="border-b border-stone-200 dark:border-stone-800 px-6 pt-3 bg-stone-50/90 dark:bg-stone-950/60 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={cn(
              'flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
              activeTab === 'export'
                ? 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 ring-2 ring-amber-500/20'
                : 'bg-transparent border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            )}
          >
            <Download className="w-4 h-4 text-amber-500" />
            <span>Export Recipes (JSON)</span>
            <span className="text-xs px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {recipes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={cn(
              'flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
              activeTab === 'import'
                ? 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 ring-2 ring-amber-500/20'
                : 'bg-transparent border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            )}
          >
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>Import from JSON</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Summary Stats Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                      Export Summary
                    </h3>
                  </div>
                  <span className="text-xs text-stone-400">
                    Schema v1.0 • Portable & JSON-Compliant
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-100 dark:border-stone-800">
                    <p className="text-[11px] font-medium text-stone-400">Total Recipes</p>
                    <p className="text-xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-0.5">
                      {recipes.length}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Staple Dishes</p>
                    <p className="text-xl font-bold font-serif text-amber-900 dark:text-amber-200 mt-0.5">
                      {recipes.filter((r) => r.isStaple).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Dietary Rules</p>
                    <p className="text-xl font-bold font-serif text-emerald-900 dark:text-emerald-200 mt-0.5">
                      {household?.kitchenProfile?.dietaryRestrictions?.length || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                    <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">Kitchen Gear</p>
                    <p className="text-xl font-bold font-serif text-indigo-900 dark:text-indigo-200 mt-0.5">
                      {household?.kitchenProfile?.appliances?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Optional Include Household Kitchen Profile */}
                <label className="flex items-center gap-3 pt-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeKitchenProfile}
                    onChange={(e) => setIncludeKitchenProfile(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>
                    Include household kitchen appliances, dietary rules, and portions in export bundle
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={recipes.length === 0}
                  className="flex-1 py-3 px-5 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .JSON Backup File</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  disabled={recipes.length === 0}
                  className="py-3 px-5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {hasCopiedExport ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-400" />
                      <span>Copy Raw JSON</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preview Toggle */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowExportPreview((prev) => !prev)}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>{showExportPreview ? 'Hide' : 'View'} Raw JSON Structure</span>
                  <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', showExportPreview && 'rotate-90')} />
                </button>

                {showExportPreview && (
                  <pre className="p-4 rounded-2xl bg-stone-950 text-stone-300 font-mono text-[11px] overflow-x-auto max-h-60 border border-stone-800 leading-relaxed select-all">
                    {exportJsonString}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Input mode switcher */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportInputMode('file')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                    importInputMode === 'file'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                  )}
                >
                  📁 Upload .JSON File
                </button>
                <button
                  type="button"
                  onClick={() => setImportInputMode('paste')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                    importInputMode === 'paste'
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                  )}
                >
                  📝 Paste Raw JSON Text
                </button>
                <button
                  type="button"
                  onClick={handleLoadStockBundle}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border border-amber-300 dark:border-amber-700 bg-amber-500/10 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 flex items-center gap-1.5 ml-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Load Starter Pack (32)</span>
                </button>
              </div>

              {/* Upload or Paste Area */}
              {importInputMode === 'file' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-400 bg-white dark:bg-stone-800/60 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 group-hover:scale-105 transition-transform flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-stone-800 dark:text-stone-200">
                      Click to choose or drag & drop a JSON file
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                      Supports Kitch-ow backups, recipe JSON arrays, or Schema.org Recipe JSON
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={pastedJsonText}
                    onChange={(e) => setPastedJsonText(e.target.value)}
                    placeholder='[&#10;  {&#10;    "title": "Grandma\u0027s Lasagna",&#10;    "ingredients": ["1 lb pasta", "2 cups marinara"],&#10;    "instructions": ["Layer sheets", "Bake 35 mins"]&#10;  }&#10;]'
                    className="w-full p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => parseJsonContent(pastedJsonText)}
                    className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:bg-stone-800"
                  >
                    Parse JSON Content
                  </button>
                </div>
              )}

              {/* Error Box */}
              {importError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Result Summary */}
              {importResultSummary && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>✨ {importResultSummary.importedCount} Added</span>
                    {importResultSummary.overwrittenCount > 0 && (
                      <span>🔄 {importResultSummary.overwrittenCount} Overwritten</span>
                    )}
                    {importResultSummary.skippedCount > 0 && (
                      <span>⏭️ {importResultSummary.skippedCount} Skipped</span>
                    )}
                  </div>
                </div>
              )}

              {/* Parsed Preview & Conflict Options */}
              {parsedImportBundle && (
                <div className="space-y-5 pt-2 border-t border-stone-200 dark:border-stone-800 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <span>📋 Found {parsedImportBundle.recipes.length} Recipe{parsedImportBundle.recipes.length > 1 ? 's' : ''}</span>
                        {parsedImportBundle.householdName && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-normal">
                            from {parsedImportBundle.householdName}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-stone-500">
                        {selectedRecipeIndices.size} selected for import
                      </p>
                    </div>

                    {/* Quick selection buttons */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={selectNewOnly}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-800/60"
                      >
                        New Only
                      </button>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="px-2.5 py-1 rounded-lg text-stone-400 hover:text-stone-600"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Duplicate Strategy Selection */}
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                      Duplicate Conflict Strategy
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'skip',
                          label: 'Skip Duplicates',
                          desc: 'Do not import recipes matching existing titles',
                        },
                        {
                          id: 'overwrite',
                          label: 'Update & Overwrite',
                          desc: 'Replace existing recipes with imported version',
                        },
                        {
                          id: 'add_as_new',
                          label: 'Import All As New',
                          desc: 'Import all selected as separate new copies',
                        },
                      ].map((strategy) => (
                        <button
                          key={strategy.id}
                          type="button"
                          onClick={() => setDuplicateStrategy(strategy.id as any)}
                          className={cn(
                            'p-3 rounded-xl border text-left transition-all',
                            duplicateStrategy === strategy.id
                              ? 'bg-white dark:bg-stone-800 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                              : 'bg-white/60 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                              {strategy.label}
                            </span>
                            {duplicateStrategy === strategy.id && (
                              <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400 mt-1 leading-snug">
                            {strategy.desc}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Import kitchen profile toggle */}
                    {parsedImportBundle.kitchenProfile && (
                      <label className="flex items-center gap-2.5 pt-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none border-t border-stone-200/60 dark:border-stone-800/60">
                        <input
                          type="checkbox"
                          checked={importKitchenProfileToggle}
                          onChange={(e) => setImportKitchenProfileToggle(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span>
                          Also import Kitchen Equipment & Dietary Settings from this backup file
                        </span>
                      </label>
                    )}
                  </div>

                  {/* List of parsed recipes to select/deselect */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {parsedImportBundle.recipes.map((r, idx) => {
                      const isSelected = selectedRecipeIndices.has(idx);
                      const isDuplicate = existingTitles.has((r.title || '').toLowerCase().trim());

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleRecipeSelection(idx)}
                          className={cn(
                            'p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all',
                            isSelected
                              ? 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600 shadow-xs'
                              : 'bg-stone-50/50 dark:bg-stone-900/40 border-stone-200/60 dark:border-stone-800/60 opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 text-stone-400">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                                  {r.title || 'Untitled'}
                                </span>
                                {isDuplicate && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-medium">
                                    Already in library
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                                <span>{r.category || 'Other'}</span>
                                <span>•</span>
                                <span>{r.ingredients?.length || 0} ingredients</span>
                                {r.estimatedTime && (
                                  <>
                                    <span>•</span>
                                    <span>{r.estimatedTime}m</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {r.isStaple && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold shrink-0">
                              ⭐ Staple
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Import Button */}
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedRecipeIndices.size === 0}
                    className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing {selectedRecipeIndices.size} Recipes...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Confirm & Import {selectedRecipeIndices.size} Recipes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 flex items-center justify-between">
          <p className="text-xs text-stone-400">
            JSON files can be freely shared across families or stored as personal backups.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
