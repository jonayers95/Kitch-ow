import React, { useState, useEffect, useMemo } from 'react';
import { Household, HouseholdKitchenProfile, DiningOutBalanceMode } from '../types';
import { 
  Utensils, 
  Leaf, 
  Ban, 
  Users, 
  Sparkles, 
  Check, 
  X, 
  Save, 
  Flame, 
  Loader2, 
  Info,
  SlidersHorizontal,
  RotateCcw,
  ChefHat,
  Wine,
  ShoppingBag,
  UtensilsCrossed,
  CalendarClock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type KitchenProfileTab = 'dietary' | 'appliances' | 'dislikes' | 'dining' | 'servings';

export interface KitchenDietaryProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: Household | null;
  onSaveProfile: (profile: HouseholdKitchenProfile) => Promise<void>;
  initialTab?: KitchenProfileTab;
}

// Curated standard appliances
export const COMMON_APPLIANCES = [
  { id: 'Air Fryer', label: 'Air Fryer', icon: '⚡', desc: 'Crispy & rapid weeknight cooking' },
  { id: 'Instant Pot / Pressure Cooker', label: 'Instant Pot / Pressure Cooker', icon: '🍲', desc: 'Fast tenderizing & pressure braises' },
  { id: 'Slow Cooker / Crockpot', label: 'Slow Cooker / Crockpot', icon: '⏳', desc: 'All-day low & slow stews' },
  { id: 'Cast Iron Skillet', label: 'Cast Iron Skillet', icon: '🍳', desc: 'High-heat searing & crusts' },
  { id: 'Dutch Oven', label: 'Dutch Oven', icon: '🥘', desc: 'Deep braising, soups & sourdough' },
  { id: 'Outdoor Grill / Smoker', label: 'Outdoor Grill / Smoker', icon: '🔥', desc: 'Charcoal, wood smoke & grilling' },
  { id: 'Blender / Food Processor', label: 'Blender / Food Processor', icon: '🌪️', desc: 'Sauces, soups, smoothies & dips' },
  { id: 'Sous Vide Machine', label: 'Sous Vide Machine', icon: '🌡️', desc: 'Precision water bath temperature' },
  { id: 'Stand Mixer', label: 'Stand Mixer', icon: '🧁', desc: 'Dough kneading, baking & batters' },
  { id: 'Rice Cooker', label: 'Rice Cooker', icon: '🍚', desc: 'Perfect grains, rice & quinoa' },
  { id: 'Sheet Pans / Roasting Pan', label: 'Sheet Pans / Roaster', icon: '✨', desc: 'One-pan roasts & crisp veg' },
  { id: 'Toaster Oven / Convection', label: 'Toaster Oven / Convection', icon: '🍞', desc: 'Small-batch baking & reheating' },
  { id: 'Waffle Maker / Panini Press', label: 'Waffle Maker / Press', icon: '🧇', desc: 'Crisp pressed sandwiches & waffles' },
  { id: 'Wok', label: 'Wok', icon: '🥢', desc: 'High-heat stir-fries & tossed noodles' },
  { id: 'Microwave', label: 'Microwave', icon: '⏱️', desc: 'Rapid steaming & meal reheating' },
];

// Curated dietary restrictions & nutrition lifestyles
export const COMMON_DIETARY_RESTRICTIONS = [
  { id: 'Vegetarian', label: 'Vegetarian', icon: '🌱', desc: 'Plant-based with dairy & eggs' },
  { id: 'Vegan', label: 'Vegan', icon: '🌿', desc: '100% plant-derived meals' },
  { id: 'Pescatarian', label: 'Pescatarian', icon: '🐟', desc: 'Fish, seafood & plant-forward' },
  { id: 'Gluten-Free', label: 'Gluten-Free', icon: '🌾', desc: 'Zero wheat, barley, or rye' },
  { id: 'Dairy-Free / Lactose-Free', label: 'Dairy-Free', icon: '🥛', desc: 'Dairy-free plant milks & fats' },
  { id: 'Nut-Free (Peanut & Tree Nut)', label: 'Nut-Free', icon: '🥜', desc: 'Peanut & tree nut allergy safe' },
  { id: 'Egg-Free', label: 'Egg-Free', icon: '🥚', desc: 'No whole eggs or egg binders' },
  { id: 'Shellfish-Free', label: 'Shellfish-Free', icon: '🦐', desc: 'No crustaceans or mollusks' },
  { id: 'Low-Carb / Keto', label: 'Low-Carb / Keto', icon: '🥑', desc: 'Minimal net carbohydrates' },
  { id: 'Paleo / Whole30', label: 'Paleo / Whole30', icon: '🥩', desc: 'Unrefined, whole food focus' },
  { id: 'Low-Sodium / Heart-Healthy', label: 'Low-Sodium', icon: '🧂', desc: 'Reduced sodium & heart-conscious' },
  { id: 'Diabetic-Friendly / Low-Sugar', label: 'Diabetic-Friendly', icon: '🩺', desc: 'Balanced glycemic response' },
  { id: 'Mediterranean Diet', label: 'Mediterranean', icon: '🫒', desc: 'Olive oil, legumes & fresh greens' },
  { id: 'Halal', label: 'Halal', icon: '🌙', desc: 'Islamic dietary compliance' },
  { id: 'Kosher', label: 'Kosher', icon: '✡️', desc: 'Jewish dietary laws' },
];

// Curated common disliked ingredients / food aversions
export const COMMON_DISLIKES = [
  { id: 'Cilantro / Coriander', label: 'Cilantro / Coriander', icon: '🌿' },
  { id: 'Mushrooms', label: 'Mushrooms', icon: '🍄' },
  { id: 'Spicy / Hot Peppers', label: 'Spicy / Hot Peppers', icon: '🌶️' },
  { id: 'Olives', label: 'Olives', icon: '🫒' },
  { id: 'Blue Cheese / Strong Cheeses', label: 'Blue Cheese', icon: '🧀' },
  { id: 'Eggplant', label: 'Eggplant', icon: '🍆' },
  { id: 'Brussels Sprouts', label: 'Brussels Sprouts', icon: '🥬' },
  { id: 'Anchovies / Sardines', label: 'Anchovies / Sardines', icon: '🐟' },
  { id: 'Mayonnaise', label: 'Mayonnaise', icon: '🥪' },
  { id: 'Tofu / Tempeh', label: 'Tofu / Tempeh', icon: '🍲' },
  { id: 'Beets', label: 'Beets', icon: '🍠' },
  { id: 'Liver / Organ Meats', label: 'Liver / Organ Meats', icon: '🥩' },
  { id: 'Celery', label: 'Celery', icon: '🥗' },
  { id: 'Capers', label: 'Capers', icon: '🫙' },
  { id: 'Artificial Sweeteners', label: 'Artificial Sweeteners', icon: '🍬' },
];

export const KitchenDietaryProfileModal: React.FC<KitchenDietaryProfileModalProps> = ({
  isOpen,
  onClose,
  household,
  onSaveProfile,
  initialTab = 'dietary',
}) => {
  const [activeTab, setActiveTab] = useState<KitchenProfileTab>(initialTab || 'dietary');

  // Form states
  const [selectedAppliances, setSelectedAppliances] = useState<string[]>([]);
  const [customAppliances, setCustomAppliances] = useState<string>('');

  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [customDietary, setCustomDietary] = useState<string>('');

  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [customDislikes, setCustomDislikes] = useState<string>('');

  const [diningOutBalance, setDiningOutBalance] = useState<DiningOutBalanceMode>('busy_nights');
  const [suggestDiningOutOnBusy, setSuggestDiningOutOnBusy] = useState<boolean>(true);
  const [maxDiningOutPerWeek, setMaxDiningOutPerWeek] = useState<number>(2);
  const [preferredDiningOutDays, setPreferredDiningOutDays] = useState<string[]>(['Friday']);
  const [diningOutCustomNotes, setDiningOutCustomNotes] = useState<string>('');

  const [defaultServings, setDefaultServings] = useState<number>(4);
  const [notes, setNotes] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state when household changes or modal opens
  useEffect(() => {
    setIsSaving(false);
    setSaveSuccessToast(false);
    setSaveError(null);
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (household) {
        const p = household.kitchenProfile;
        setSelectedAppliances(p?.appliances || []);
        setCustomAppliances(p?.customAppliances || '');
        setSelectedDietary(p?.dietaryRestrictions || []);
        setCustomDietary(p?.customDietaryRestrictions || '');
        setSelectedDislikes(p?.dislikedIngredients || []);
        setCustomDislikes(p?.customDislikedIngredients || '');
        setDiningOutBalance(p?.diningOutBalance || (p?.suggestDiningOutOnBusy ? 'busy_nights' : 'busy_nights'));
        setSuggestDiningOutOnBusy(p?.suggestDiningOutOnBusy !== undefined ? p.suggestDiningOutOnBusy : true);
        setMaxDiningOutPerWeek(p?.maxDiningOutPerWeek || 2);
        setPreferredDiningOutDays(p?.preferredDiningOutDays || ['Friday']);
        setDiningOutCustomNotes(p?.diningOutCustomNotes || '');
        setDefaultServings(p?.defaultServings || 4);
        setNotes(p?.notes || '');
      }
    }
  }, [isOpen, household, initialTab]);

  // Helper to split comma-separated items for live preview badges
  const parsedCustomAppliances = useMemo(() => {
    return customAppliances
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [customAppliances]);

  const parsedCustomDietary = useMemo(() => {
    return customDietary
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [customDietary]);

  const parsedCustomDislikes = useMemo(() => {
    return customDislikes
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [customDislikes]);

  // Toggle helpers
  const toggleAppliance = (id: string) => {
    setSelectedAppliances((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDietary = (id: string) => {
    setSelectedDietary((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDislike = (id: string) => {
    setSelectedDislikes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePreferredDay = (day: string) => {
    setPreferredDiningOutDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updatedProfile: HouseholdKitchenProfile = {
        appliances: selectedAppliances || [],
        customAppliances: (customAppliances || '').trim(),
        dietaryRestrictions: selectedDietary || [],
        customDietaryRestrictions: (customDietary || '').trim(),
        dislikedIngredients: selectedDislikes || [],
        customDislikedIngredients: (customDislikes || '').trim(),
        diningOutBalance: diningOutBalance || 'busy_nights',
        suggestDiningOutOnBusy: diningOutBalance === 'busy_nights' || diningOutBalance === 'balanced' || diningOutBalance === 'frequent' ? !!suggestDiningOutOnBusy : false,
        maxDiningOutPerWeek: Number(maxDiningOutPerWeek) || 2,
        preferredDiningOutDays: preferredDiningOutDays || ['Friday'],
        diningOutCustomNotes: (diningOutCustomNotes || '').trim(),
        defaultServings: Number(defaultServings) || 4,
        notes: (notes || '').trim(),
      };
      
      const savePromise = onSaveProfile(updatedProfile);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Saving profile timed out. Please try again.')), 6000)
      );

      await Promise.race([savePromise, timeoutPromise]);
      setSaveSuccessToast(true);
      setTimeout(() => {
        setSaveSuccessToast(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to save kitchen profile:', err);
      setSaveError(err?.message || 'Failed to save profile. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAll = () => {
    if (activeTab === 'appliances') {
      setSelectedAppliances([]);
      setCustomAppliances('');
    } else if (activeTab === 'dietary') {
      setSelectedDietary([]);
      setCustomDietary('');
    } else if (activeTab === 'dislikes') {
      setSelectedDislikes([]);
      setCustomDislikes('');
    } else if (activeTab === 'dining') {
      setDiningOutBalance('always_cook');
      setSuggestDiningOutOnBusy(false);
      setPreferredDiningOutDays([]);
      setDiningOutCustomNotes('');
    } else {
      setDefaultServings(4);
      setNotes('');
    }
  };

  if (!isOpen) return null;

  const totalApplianceCount = selectedAppliances.length + parsedCustomAppliances.length;
  const totalDietaryCount = selectedDietary.length + parsedCustomDietary.length;
  const totalDislikeCount = selectedDislikes.length + parsedCustomDislikes.length;

  return (
    <div
      data-testid="kitchen-profile-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-hidden bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <motion.div
        data-testid="kitchen-profile-dialog"
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-[#fcfbf9] dark:bg-stone-900 w-full max-w-3xl sm:rounded-3xl rounded-t-3xl sm:rounded-b-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:p-6 sm:pb-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <h2 className="text-base sm:text-2xl font-serif font-bold text-stone-900 dark:text-stone-100 truncate">
                  Kitchen & Dietary
                </h2>
                {household?.name && (
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium truncate max-w-[130px] sm:max-w-none">
                    {household.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-sm text-stone-500 dark:text-stone-400 hidden xs:block sm:block line-clamp-1">
                Select your kitchen gear, diet rules & ingredients to avoid for tailored AI recipes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-stone-200 dark:border-stone-800 px-3 sm:px-6 pt-2 sm:pt-3 bg-stone-50/90 dark:bg-stone-950/60 shrink-0">
          <div
            data-testid="kitchen-profile-tabstrip"
            className="flex sm:grid sm:grid-cols-5 gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 overflow-x-auto no-scrollbar scroll-smooth"
          >
            {/* Tab 1: Dietary */}
            <button
              type="button"
              onClick={() => setActiveTab('dietary')}
              className={cn(
                'shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
                activeTab === 'dietary'
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
              )}
            >
              <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Dietary</span>
              {totalDietaryCount > 0 && (
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold shrink-0">
                  {totalDietaryCount}
                </span>
              )}
            </button>

            {/* Tab 2: Appliances */}
            <button
              type="button"
              onClick={() => setActiveTab('appliances')}
              className={cn(
                'shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
                activeTab === 'appliances'
                  ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-400 text-amber-800 dark:text-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
              )}
            >
              <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Appliances</span>
              {totalApplianceCount > 0 && (
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold shrink-0">
                  {totalApplianceCount}
                </span>
              )}
            </button>

            {/* Tab 3: Dislikes */}
            <button
              type="button"
              onClick={() => setActiveTab('dislikes')}
              className={cn(
                'shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
                activeTab === 'dislikes'
                  ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-400 text-rose-800 dark:text-rose-300 ring-2 ring-rose-400/20'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
              )}
            >
              <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Avoid Foods</span>
              {totalDislikeCount > 0 && (
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-900 text-rose-900 dark:text-rose-200 font-bold shrink-0">
                  {totalDislikeCount}
                </span>
              )}
            </button>

            {/* Tab 4: Dining & Takeout Balance */}
            <button
              type="button"
              onClick={() => setActiveTab('dining')}
              className={cn(
                'shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
                activeTab === 'dining'
                  ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 text-blue-800 dark:text-blue-300 ring-2 ring-blue-400/20'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
              )}
            >
              <Wine className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Dining & Takeout</span>
              {diningOutBalance !== 'always_cook' && (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
              )}
            </button>

            {/* Tab 5: Servings */}
            <button
              type="button"
              onClick={() => setActiveTab('servings')}
              className={cn(
                'shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all border shadow-xs',
                activeTab === 'servings'
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-400/20'
                  : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-700'
              )}
            >
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Servings</span>
            </button>
          </div>

          {/* Quick Selected Overview bar - Desktop only */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 pb-3 pt-1 text-xs border-t border-stone-200/60 dark:border-stone-800/60">
            <span className="text-stone-400 text-[11px] font-medium mr-1">Quick Jumps:</span>
            <button
              type="button"
              onClick={() => setActiveTab('dietary')}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                totalDietaryCount > 0 
                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200" 
                  : "bg-stone-200/60 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-300/60"
              )}
            >
              <span>🌱</span>
              <span>{totalDietaryCount > 0 ? `${totalDietaryCount} Diet Rule${totalDietaryCount > 1 ? 's' : ''}` : 'Diet Rules'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appliances')}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                totalApplianceCount > 0 
                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 hover:bg-amber-200" 
                  : "bg-stone-200/60 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-300/60"
              )}
            >
              <span>⚡</span>
              <span>{totalApplianceCount > 0 ? `${totalApplianceCount} Appliances` : 'Appliances'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dislikes')}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                totalDislikeCount > 0 
                  ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-rose-200" 
                  : "bg-stone-200/60 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-300/60"
              )}
            >
              <span>🚫</span>
              <span>{totalDislikeCount > 0 ? `${totalDislikeCount} Avoided` : 'Avoided'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dining')}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-all flex items-center gap-1",
                diningOutBalance !== 'always_cook'
                  ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 hover:bg-blue-200"
                  : "bg-stone-200/60 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-300/60"
              )}
            >
              <span>🍷</span>
              <span>{diningOutBalance === 'busy_nights' ? 'Auto-Relief on Busy' : diningOutBalance === 'balanced' ? 'Balanced (1-2 Takeout)' : diningOutBalance === 'frequent' ? 'Frequent Takeout' : 'Always Cook'}</span>
            </button>
          </div>
        </div>

        {/* Tab Body Content */}
        <div data-testid="kitchen-profile-content" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {/* TAB 1: KITCHEN APPLIANCES */}
          {activeTab === 'appliances' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>🍳 Available Kitchen Appliances & Tools</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Select the equipment in your kitchen. AI meal planning will optimize cooking techniques for what you actually own.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>

              {/* Grid of Standard Appliances */}
              <div data-testid="appliances-options-grid" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                {COMMON_APPLIANCES.map((appliance) => {
                  const isSelected = selectedAppliances.includes(appliance.id);
                  return (
                    <button
                      key={appliance.id}
                      type="button"
                      onClick={() => toggleAppliance(appliance.id)}
                      className={cn(
                        'p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all relative flex flex-col justify-between group',
                        isSelected
                          ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500 dark:border-amber-400 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span className="text-base sm:text-lg shrink-0">{appliance.icon}</span>
                          <span className="font-semibold text-xs sm:text-sm truncate">{appliance.label}</span>
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border text-[9px] sm:text-[10px] shrink-0 transition-colors',
                            isSelected
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'border-stone-300 dark:border-stone-600 group-hover:border-stone-400'
                          )}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-stone-500 mt-1 line-clamp-1">
                        {appliance.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Other Custom Appliances Input */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Other Appliances & Equipment (please separate with commas)</span>
                  <span className="text-[11px] font-normal text-stone-400">Optional</span>
                </label>
                <input
                  type="text"
                  value={customAppliances}
                  onChange={(e) => setCustomAppliances(e.target.value)}
                  placeholder="e.g. Pizza oven, Tortilla press, Pasta machine, Ice cream maker, Carbon steel wok"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all"
                />

                {/* Live parsed badges */}
                {parsedCustomAppliances.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-stone-400">Added custom:</span>
                    {parsedCustomAppliances.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-800/50"
                      >
                        <span>⚡ {item}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIETARY RESTRICTIONS & NUTRITION GOALS */}
          {activeTab === 'dietary' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>🥗 Dietary Restrictions & Preferences</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Select any household allergies or dietary styles. AI recommendations will strictly adhere to these criteria.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>

              {/* Grid of Standard Dietary Options */}
              <div data-testid="dietary-options-grid" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                {COMMON_DIETARY_RESTRICTIONS.map((diet) => {
                  const isSelected = selectedDietary.includes(diet.id);
                  return (
                    <button
                      key={diet.id}
                      type="button"
                      onClick={() => toggleDietary(diet.id)}
                      className={cn(
                        'p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all relative flex flex-col justify-between group',
                        isSelected
                          ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500 dark:border-emerald-400 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span className="text-base sm:text-lg shrink-0">{diet.icon}</span>
                          <span className="font-semibold text-xs sm:text-sm truncate">{diet.label}</span>
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border text-[9px] sm:text-[10px] shrink-0 transition-colors',
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'border-stone-300 dark:border-stone-600 group-hover:border-stone-400'
                          )}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-stone-400 dark:text-stone-500 mt-1 line-clamp-1">
                        {diet.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Other Custom Dietary Restrictions Input */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Other Dietary Needs & Allergies (please separate with commas)</span>
                  <span className="text-[11px] font-normal text-stone-400">Optional</span>
                </label>
                <input
                  type="text"
                  value={customDietary}
                  onChange={(e) => setCustomDietary(e.target.value)}
                  placeholder="e.g. Low-FODMAP, Nightshade-Free, Soy-Free, Corn-Free, Sesame-Free, Autoimmune Protocol"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
                />

                {/* Live parsed badges */}
                {parsedCustomDietary.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-stone-400">Added custom:</span>
                    {parsedCustomDietary.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50"
                      >
                        <span>🌱 {item}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DISLIKED & AVOID INGREDIENTS */}
          {activeTab === 'dislikes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>🚫 Disliked & Avoid Ingredients</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Select ingredients members of this household dislike or cannot stand. AI will avoid proposing recipes featuring these.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>

              {/* Grid of Standard Dislikes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                {COMMON_DISLIKES.map((item) => {
                  const isSelected = selectedDislikes.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleDislike(item.id)}
                      className={cn(
                        'p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-left transition-all relative flex items-center justify-between gap-1.5 sm:gap-2 group',
                        isSelected
                          ? 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500 dark:border-rose-400 text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm sm:text-base shrink-0">{item.icon}</span>
                        <span className="font-medium text-xs truncate">{item.label}</span>
                      </div>
                      <div
                        className={cn(
                          'w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center border text-[8px] sm:text-[9px] shrink-0 transition-colors',
                          isSelected
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'border-stone-300 dark:border-stone-600 group-hover:border-stone-400'
                        )}
                      >
                        {isSelected && <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Other Custom Disliked Ingredients Input */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Other Disliked Ingredients (please separate with commas)</span>
                  <span className="text-[11px] font-normal text-stone-400">Optional</span>
                </label>
                <input
                  type="text"
                  value={customDislikes}
                  onChange={(e) => setCustomDislikes(e.target.value)}
                  placeholder="e.g. Raw onions, Bell peppers, Fennel, Dill, Mustard, Raisins, Cumin"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />

                {/* Live parsed badges */}
                {parsedCustomDislikes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-stone-400">Added custom:</span>
                    {parsedCustomDislikes.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800/50"
                      >
                        <span>🚫 {item}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DINING OUT & TAKEOUT BALANCING */}
          {activeTab === 'dining' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <span>🍷 Dining Out & Takeout Balance</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Set your permanent preference for balancing home-cooked meals with dining out or takeout. AI will continuously plan around this rhythm.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-semibold text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Mode Selection Cards */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                  Weekly Dining Out & Takeout Balancing Strategy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {/* Mode 1: Auto-Relief on Busy Evenings */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiningOutBalance('busy_nights');
                      setSuggestDiningOutOnBusy(true);
                    }}
                    className={cn(
                      'p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-start gap-2.5 sm:gap-3.5 group relative',
                      diningOutBalance === 'busy_nights'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 dark:border-blue-400 text-stone-900 dark:text-stone-100 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 transition-colors',
                      diningOutBalance === 'busy_nights' ? 'bg-blue-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    )}>
                      ⚡
                    </div>
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          Auto-Relief on Busy Evenings
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 sm:mt-1 leading-normal sm:leading-relaxed">
                        <strong>Suggest dining out if the week is too busy.</strong> Automatically recommends takeout or eating out on nights with packed schedules.
                      </p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                      diningOutBalance === 'busy_nights' ? 'bg-blue-500 border-blue-500 text-white' : 'border-stone-300 dark:border-stone-600'
                    )}>
                      {diningOutBalance === 'busy_nights' && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Mode 2: Weekly Balanced Rhythm */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiningOutBalance('balanced');
                      setSuggestDiningOutOnBusy(true);
                    }}
                    className={cn(
                      'p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-start gap-2.5 sm:gap-3.5 group relative',
                      diningOutBalance === 'balanced'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 dark:border-amber-400 text-stone-900 dark:text-stone-100 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 transition-colors',
                      diningOutBalance === 'balanced' ? 'bg-amber-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    )}>
                      ⚖️
                    </div>
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          Weekly Balanced Rhythm
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 sm:mt-1 leading-normal sm:leading-relaxed">
                        Continuously balances 1–2 scheduled dining out / takeout nights (e.g. Friday date night) with home cooking.
                      </p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                      diningOutBalance === 'balanced' ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-300 dark:border-stone-600'
                    )}>
                      {diningOutBalance === 'balanced' && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Mode 3: Frequent Takeout / Low Effort */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiningOutBalance('frequent');
                      setSuggestDiningOutOnBusy(true);
                    }}
                    className={cn(
                      'p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-start gap-2.5 sm:gap-3.5 group relative',
                      diningOutBalance === 'frequent'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 dark:border-purple-400 text-stone-900 dark:text-stone-100 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 transition-colors',
                      diningOutBalance === 'frequent' ? 'bg-purple-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    )}>
                      🛵
                    </div>
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          Frequent Takeout / Low-Effort
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 sm:mt-1 leading-normal sm:leading-relaxed">
                        Plans 2–3 dining out or takeout evenings per week. Perfect for busy households that prefer minimal cooking.
                      </p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                      diningOutBalance === 'frequent' ? 'bg-purple-500 border-purple-500 text-white' : 'border-stone-300 dark:border-stone-600'
                    )}>
                      {diningOutBalance === 'frequent' && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                    </div>
                  </button>

                  {/* Mode 4: Always Cook at Home */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiningOutBalance('always_cook');
                      setSuggestDiningOutOnBusy(false);
                    }}
                    className={cn(
                      'p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-start gap-2.5 sm:gap-3.5 group relative',
                      diningOutBalance === 'always_cook'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-400 text-stone-900 dark:text-stone-100 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 transition-colors',
                      diningOutBalance === 'always_cook' ? 'bg-emerald-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                    )}>
                      🏠
                    </div>
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          Always Cook at Home
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 sm:mt-1 leading-normal sm:leading-relaxed">
                        Fills all 7 days with home-cooked recipes from your collection, unless explicitly scheduled on your calendar.
                      </p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                      diningOutBalance === 'always_cook' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 dark:border-stone-600'
                    )}>
                      {diningOutBalance === 'always_cook' && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Preferred Days for Dining Out / Takeout */}
              {diningOutBalance !== 'always_cook' && (
                <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-stone-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                    Preferred Nights for Dining Out / Takeout
                  </label>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Select days where your household usually prefers taking a break from cooking:
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const isSelected = preferredDiningOutDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => togglePreferredDay(day)}
                          className={cn(
                            'px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white shadow-xs'
                              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                          <span>{day}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Favorite Takeout & Restaurant Cuisines */}
              <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Favorite Takeout Cuisines & Dining Notes</span>
                  <span className="text-[11px] font-normal text-stone-400">Optional</span>
                </label>
                <input
                  type="text"
                  value={diningOutCustomNotes}
                  onChange={(e) => setDiningOutCustomNotes(e.target.value)}
                  placeholder="e.g. Thai curry, Wood-fired pizza, Ramen, Sushi, Local taco spot..."
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                />
                <p className="text-[11px] text-stone-400">
                  AI will use these notes when suggesting takeout or dining out slots on your weekly plan.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: DEFAULT SERVINGS & NOTES */}
          {activeTab === 'servings' && (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
                  🍽️ Household Servings & Kitchen Notes
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Set standard portion yields and custom cooking notes for your household.
                </p>
              </div>

              {/* Default Servings Selection */}
              <div className="space-y-2.5 sm:space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                  Default Household Servings Target
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { value: 2, label: '1 - 2 People', desc: 'Solo or Couple' },
                    { value: 4, label: '3 - 4 People', desc: 'Standard Family' },
                    { value: 6, label: '5 - 6 People', desc: 'Large Family' },
                    { value: 8, label: '7+ People', desc: 'Big Feasts / Batch' },
                  ].map((tier) => (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() => setDefaultServings(tier.value)}
                      className={cn(
                        'p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border text-center transition-all flex flex-col items-center justify-center',
                        defaultServings === tier.value
                          ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500 dark:border-amber-400 text-stone-900 dark:text-stone-100 shadow-xs font-bold'
                          : 'bg-white dark:bg-stone-800/80 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                      )}
                    >
                      <span className="text-lg sm:text-xl font-bold font-serif">{tier.value}</span>
                      <span className="text-xs font-semibold mt-0.5 sm:mt-1">{tier.label}</span>
                      <span className="text-[9px] sm:text-[10px] text-stone-400 mt-0.5">{tier.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Kitchen Notes */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                  Additional Kitchen Habits or Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. We love packing leftovers for lunch next day; we prefer weekday dinners under 35 minutes; we do big family breakfasts on Sundays..."
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm transition-all resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action Bar */}
        <div className="p-3 sm:p-6 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 flex flex-col gap-2.5 sm:gap-3 shrink-0">
          {saveError && (
            <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between gap-2 text-red-700 dark:text-red-300 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="truncate">{saveError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-200 font-semibold text-xs shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 overflow-x-auto no-scrollbar py-0.5 min-w-0">
              <span className="hidden sm:inline font-semibold text-stone-800 dark:text-stone-200">Active:</span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 text-[11px] whitespace-nowrap">
                🌱 {totalDietaryCount}
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 text-[11px] whitespace-nowrap">
                ⚡ {totalApplianceCount}
              </span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/50 text-[11px] whitespace-nowrap">
                🚫 {totalDislikeCount}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Step navigation for desktop */}
              {activeTab === 'dietary' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('appliances')}
                  className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden sm:inline-flex items-center gap-1"
                >
                  <span>Next: Appliances</span>
                  <span>→</span>
                </button>
              )}
              {activeTab === 'appliances' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dislikes')}
                  className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden sm:inline-flex items-center gap-1"
                >
                  <span>Next: Avoided Foods</span>
                  <span>→</span>
                </button>
              )}
              {activeTab === 'dislikes' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dining')}
                  className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden sm:inline-flex items-center gap-1"
                >
                  <span>Next: Dining & Takeout</span>
                  <span>→</span>
                </button>
              )}
              {activeTab === 'dining' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('servings')}
                  className="px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors hidden sm:inline-flex items-center gap-1"
                >
                  <span>Next: Servings</span>
                  <span>→</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 sm:gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span className="hidden xs:inline sm:inline">Saving Profile...</span>
                    <span className="xs:hidden sm:hidden">Saving...</span>
                  </>
                ) : saveSuccessToast ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Save All Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
