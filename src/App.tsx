import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  setDoc,
  getDoc,
  getDocs,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  signIn, 
  logOut 
} from './firebase';
import { 
  Recipe, 
  Household, 
  Category,
  MealSlot,
  MealType,
  HouseholdKitchenProfile
} from './types';
import { 
  extractRecipeFromUrl,
  generateRecipeImage
} from './services/geminiService';
import { STOCK_RECIPES } from './data/stockRecipes';
import { WeeklyMealPlan } from './components/WeeklyMealPlan';
import { SurpriseMeModal } from './components/SurpriseMeModal';
import { LeftoverRemixModal, PastMealItem } from './components/LeftoverRemixModal';
import { KitchenDietaryProfileModal } from './components/KitchenDietaryProfileModal';
import { RecipeJsonModal } from './components/RecipeJsonModal';
import { StarterPackModal } from './components/StarterPackModal';
import { 
  Plus, 
  Search, 
  Filter, 
  Link as LinkIcon, 
  LogOut, 
  Users, 
  Star, 
  ChevronRight, 
  ChefHat, 
  X, 
  Loader2,
  Trash2,
  Edit2,
  Clock,
  Utensils,
  AlertCircle,
  Soup,
  Sparkles,
  Sun,
  Moon,
  CalendarDays,
  Calendar,
  BookOpen,
  Bookmark,
  Dices,
  Shuffle,
  SlidersHorizontal,
  Leaf,
  Ban,
  FileJson,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app, but we log it clearly
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-2xl font-serif font-bold text-stone-900">Something went wrong</h1>
          <p className="text-stone-500">We encountered an unexpected error. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh App</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants = {
    primary: 'bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-200',
    secondary: 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700',
    outline: 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900',
    ghost: 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-full font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant as keyof typeof variants],
        className
      )} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-800', className)}>
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling on body
      document.body.style.overflow = 'hidden';
      
      // Set aria-hidden on main content
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.setAttribute('aria-hidden', 'true');

      // Focus the modal
      modalRef.current?.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCloseRef.current();
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            // If focus is outside the modal, bring it back in
            if (!modalRef.current?.contains(document.activeElement)) {
              firstElement.focus();
              e.preventDefault();
              return;
            }

            if (e.shiftKey) {
              if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
                lastElement.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
              }
            }
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        if (mainContent) mainContent.removeAttribute('aria-hidden');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <motion.div 
        ref={modalRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 dark:bg-stone-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl outline-none"
      >
        <div className="p-6 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center bg-white dark:bg-stone-900">
          <h2 id="modal-title" className="text-2xl font-serif font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors" aria-label="Close modal">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-stone-600 dark:text-stone-300">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All' | 'Staples'>('All');
  const [currentTab, setCurrentTab] = useState<'recipes' | 'mealPlan'>('recipes');
  
  // Quick Add to Meal Plan Modal State
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null);
  const [targetPlanDate, setTargetPlanDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [targetMealType, setTargetMealType] = useState<MealType>('Dinner');
  const [isPlanSaving, setIsPlanSaving] = useState(false);
  const [planSuccessToast, setPlanSuccessToast] = useState<string | null>(null);

  // Starter Recipes Banner State
  const [dismissedStarterBanner, setDismissedStarterBanner] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dismissed_starter_recipes_banner') === 'true';
    }
    return false;
  });

  const handleDismissStarterBanner = () => {
    setDismissedStarterBanner(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dismissed_starter_recipes_banner', 'true');
    }
  };
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isKitchenProfileOpen, setIsKitchenProfileOpen] = useState(false);
  const [kitchenProfileInitialTab, setKitchenProfileInitialTab] = useState<'dietary' | 'appliances' | 'dislikes' | 'servings'>('dietary');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);

  const openKitchenProfile = (tab: 'dietary' | 'appliances' | 'dislikes' | 'servings' = 'dietary') => {
    setKitchenProfileInitialTab(tab);
    setIsKitchenProfileOpen(true);
  };

  // Discovery, Starter Pack & Leftover Remix State
  const [isSurpriseMeOpen, setIsSurpriseMeOpen] = useState(false);
  const [isStarterPackModalOpen, setIsStarterPackModalOpen] = useState(false);
  const [isLeftoverRemixOpen, setIsLeftoverRemixOpen] = useState(false);
  const [remixInitialMealId, setRemixInitialMealId] = useState<string | undefined>(undefined);
  const [pastMeals, setPastMeals] = useState<PastMealItem[]>([]);

  // Recipe JSON Import/Export State
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteHouseholdConfirmOpen, setIsDeleteHouseholdConfirmOpen] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [recipeFormError, setRecipeFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        // Ensure user profile exists in background
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', u.uid), {
              displayName: u.displayName || 'Anonymous Chef',
              photoURL: u.photoURL || ''
            });
          }
        } catch (err) {
          console.warn("User profile sync notice:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Households
  useEffect(() => {
    if (!user) {
      setHouseholdsLoading(false);
      return;
    }
    setHouseholdsLoading(true);

    // Defensive fallback timeout so the UI is never stuck on infinite loader
    const safetyTimer = setTimeout(() => {
      setHouseholdsLoading(false);
    }, 2500);

    const q = query(collection(db, 'households'), where(`members.${user.uid}`, 'in', ['admin', 'member', 'viewer']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(safetyTimer);
      const h = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Household));
      setHouseholds(h);
      setHouseholdsLoading(false);
      if (h.length > 0) {
        setSelectedHousehold(prev => {
          if (!prev) return h[0];
          const updated = h.find(hh => hh.id === prev.id);
          return updated || h[0];
        });
      } else {
        setSelectedHousehold(null);
      }
    }, (error) => {
      clearTimeout(safetyTimer);
      console.warn('Household listener notice:', error);
      handleFirestoreError(error, OperationType.LIST, 'households');
      setHouseholdsLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user]);

  // Fetch Recipes
  useEffect(() => {
    if (!user || !selectedHousehold) {
      setRecipes([]);
      return;
    }
    const q = query(collection(db, 'recipes'), where('householdId', '==', selectedHousehold.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecipes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      fetchedRecipes.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now();
        const timeB = b.createdAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });
      setRecipes(fetchedRecipes);
    }, (error) => {
      console.warn('Recipe listener notice:', error);
      handleFirestoreError(error, OperationType.LIST, 'recipes');
    });
    return () => unsubscribe();
  }, [user, selectedHousehold]);

  // Fetch past cooked meals across all meal plans for Leftover Remix Engine
  useEffect(() => {
    if (!user || !selectedHousehold) {
      setPastMeals([]);
      return;
    }
    const q = query(
      collection(db, 'mealPlans'),
      where('householdId', '==', selectedHousehold.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PastMealItem[] = [];
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const todayKey = `${year}-${month}-${day}`;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.days) {
          Object.entries(data.days).forEach(([dateStr, slots]: [string, any]) => {
            if (Array.isArray(slots)) {
              // Only include meals from strictly past days (before today)
              if (dateStr < todayKey) {
                slots.forEach((slot: any) => {
                  const recipe = slot.recipeId ? recipes.find(r => r.id === slot.recipeId) : undefined;
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
            }
          });
        }
      });
      list.sort((a, b) => b.cookedDate.localeCompare(a.cookedDate));
      setPastMeals(list);
    }, (error) => {
      console.warn('Past meals listener notice:', error);
    });
    return () => unsubscribe();
  }, [user, selectedHousehold, recipes]);

  const handleSaveRemixRecipe = async (recipeData: {
    title: string;
    ingredients: string[];
    instructions: string[];
    category: Category;
    estimatedTime: number;
    imageUrl?: string;
  }) => {
    if (!user || !selectedHousehold) return;
    try {
      await addDoc(collection(db, 'recipes'), {
        ...recipeData,
        authorId: user.uid,
        householdId: selectedHousehold.id,
        createdAt: serverTimestamp(),
        rating: 0,
        isStaple: false,
      });
      setPlanSuccessToast(`Saved "${recipeData.title}" to your recipe book!`);
      setTimeout(() => setPlanSuccessToast(null), 3500);
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
    if (!selectedHousehold?.id || !user) return;
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

      const planDocId = `${selectedHousehold.id}_${targetWeekStartDateKey}`;
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
        householdId: selectedHousehold.id,
        weekStartDate: targetWeekStartDateKey,
        days: currentDays,
        authorId: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setPlanSuccessToast(`Scheduled "${title}" on your meal plan for ${dateStr}!`);
      setTimeout(() => setPlanSuccessToast(null), 3500);
    } catch (err) {
      console.error("Failed to schedule remix on meal plan:", err);
      throw err;
    }
  };

  const handleSurpriseAddToMealPlan = async (
    recipe: Recipe,
    dateStr: string,
    mealType: MealType
  ) => {
    if (!selectedHousehold?.id || !user) return;
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

      const planDocId = `${selectedHousehold.id}_${targetWeekStartDateKey}`;
      const planRef = doc(db, 'mealPlans', planDocId);
      const planSnap = await getDoc(planRef);

      let currentDays: { [dateStr: string]: MealSlot[] } = {};
      if (planSnap.exists()) {
        currentDays = planSnap.data().days || {};
      }

      const daySlots = currentDays[dateStr] ? [...currentDays[dateStr]] : [];
      daySlots.push({
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        recipeId: recipe.id,
        mealType,
        isDone: false,
      });
      currentDays[dateStr] = daySlots;

      await setDoc(planRef, {
        householdId: selectedHousehold.id,
        weekStartDate: targetWeekStartDateKey,
        days: currentDays,
        authorId: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setPlanSuccessToast(`Added "${recipe.title}" to meal plan for ${dateStr}!`);
      setTimeout(() => setPlanSuccessToast(null), 3500);
    } catch (err) {
      console.error("Failed to add surprise recipe to meal plan:", err);
      throw err;
    }
  };

  const handleCreateHousehold = async (name: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const newH = {
        name,
        ownerId: user.uid,
        members: { [user.uid]: 'admin' },
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'households'), newH);
      
      // Batch add stock recipes to the new household for blazing speed & reliability
      try {
        const batch = writeBatch(db);
        for (const recipe of STOCK_RECIPES) {
          const cleanedRecipe = {
            title: recipe.title?.trim() || "Untitled Recipe",
            category: (recipe.category as Category) || "Other",
            rating: recipe.rating || 5,
            estimatedTime: recipe.estimatedTime || 30,
            sourceUrl: recipe.sourceUrl || "",
            imageUrl: recipe.imageUrl || "",
            ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
            instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
            isStock: true,
            isStaple: !!recipe.isStaple,
            authorId: user.uid,
            householdId: docRef.id,
            createdAt: serverTimestamp(),
          };
          const rRef = doc(collection(db, 'recipes'));
          batch.set(rRef, cleanedRecipe);
        }
        await batch.commit();
      } catch (seedErr) {
        console.warn("Notice: Starter recipes auto-population fallback:", seedErr);
      }

      setSelectedHousehold({ id: docRef.id, ...newH } as Household);
      setIsHouseholdModalOpen(false);
      setPlanSuccessToast(`Family kitchen "${name}" created with 32 starter recipes!`);
      setTimeout(() => setPlanSuccessToast(null), 3500);
    } catch (error) {
      console.error("Error creating household:", error);
      alert("Failed to create household. Please check your internet connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedStockRecipes = async (): Promise<number> => {
    if (!user) {
      setPlanSuccessToast("Please sign in to load recipes.");
      setTimeout(() => setPlanSuccessToast(null), 3000);
      return 0;
    }

    let targetHousehold = selectedHousehold;
    if (!targetHousehold && households.length > 0) {
      targetHousehold = households[0];
      setSelectedHousehold(targetHousehold);
    }

    if (!targetHousehold?.id) {
      setIsHouseholdModalOpen(true);
      setPlanSuccessToast("Please create or select a household kitchen first.");
      setTimeout(() => setPlanSuccessToast(null), 3500);
      return 0;
    }

    setIsProcessing(true);
    try {
      const existingTitles = new Set(recipes.map(r => r.title.toLowerCase().trim()));
      const missingRecipes = STOCK_RECIPES.filter(
        sr => sr.title && !existingTitles.has(sr.title.toLowerCase().trim())
      );

      if (missingRecipes.length === 0) {
        setDismissedStarterBanner(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('dismissed_starter_recipes_banner', 'true');
        }
        setPlanSuccessToast(`All 32 starter recipes are already in ${targetHousehold.name}!`);
        setTimeout(() => setPlanSuccessToast(null), 3500);
        return 0;
      }

      // Write in a single atomic batch
      const batch = writeBatch(db);
      for (const recipe of missingRecipes) {
        const cleanedRecipe = {
          title: recipe.title?.trim() || "Untitled Recipe",
          category: (recipe.category as Category) || "Other",
          rating: recipe.rating || 5,
          estimatedTime: recipe.estimatedTime || 30,
          sourceUrl: recipe.sourceUrl || "",
          imageUrl: recipe.imageUrl || "",
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
          isStock: true,
          isStaple: !!recipe.isStaple,
          authorId: user.uid,
          householdId: targetHousehold.id,
          createdAt: serverTimestamp(),
        };

        const newDocRef = doc(collection(db, 'recipes'));
        batch.set(newDocRef, cleanedRecipe);
      }

      await batch.commit();

      setDismissedStarterBanner(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('dismissed_starter_recipes_banner', 'true');
      }

      setPlanSuccessToast(`Added ${missingRecipes.length} starter recipes to ${targetHousehold.name}!`);
      setTimeout(() => setPlanSuccessToast(null), 4000);
      return missingRecipes.length;
    } catch (error) {
      console.error("Error seeding stock recipes:", error);
      const errMsg = error instanceof Error ? error.message : "Network error";
      alert(`Failed to load starter recipes (${errMsg}). Please try again.`);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReloadStockRecipes = async (): Promise<number> => {
    if (!user) throw new Error("Please sign in.");
    const targetHousehold = selectedHousehold || households[0];
    if (!targetHousehold?.id) throw new Error("No household found.");

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      for (const recipe of STOCK_RECIPES) {
        const cleanedRecipe = {
          title: recipe.title?.trim() || "Untitled Recipe",
          category: (recipe.category as Category) || "Other",
          rating: recipe.rating || 5,
          estimatedTime: recipe.estimatedTime || 30,
          sourceUrl: recipe.sourceUrl || "",
          imageUrl: recipe.imageUrl || "",
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
          isStock: true,
          isStaple: !!recipe.isStaple,
          authorId: user.uid,
          householdId: targetHousehold.id,
          createdAt: serverTimestamp(),
        };
        const newDocRef = doc(collection(db, 'recipes'));
        batch.set(newDocRef, cleanedRecipe);
      }
      await batch.commit();
      setDismissedStarterBanner(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('dismissed_starter_recipes_banner', 'true');
      }
      setPlanSuccessToast(`All 32 starter recipes loaded into ${targetHousehold.name}!`);
      setTimeout(() => setPlanSuccessToast(null), 3500);
      return 32;
    } catch (err) {
      console.error("Error force reloading recipes:", err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedSingleStockRecipe = async (stockRecipe: Partial<Recipe>): Promise<void> => {
    if (!user) throw new Error("Please sign in.");
    const targetHousehold = selectedHousehold || households[0];
    if (!targetHousehold?.id) throw new Error("No household found.");

    const cleanedRecipe = {
      title: stockRecipe.title?.trim() || "Untitled Recipe",
      category: (stockRecipe.category as Category) || "Other",
      rating: stockRecipe.rating || 5,
      estimatedTime: stockRecipe.estimatedTime || 30,
      sourceUrl: stockRecipe.sourceUrl || "",
      imageUrl: stockRecipe.imageUrl || "",
      ingredients: Array.isArray(stockRecipe.ingredients) ? stockRecipe.ingredients : [],
      instructions: Array.isArray(stockRecipe.instructions) ? stockRecipe.instructions : [],
      isStock: true,
      isStaple: !!stockRecipe.isStaple,
      authorId: user.uid,
      householdId: targetHousehold.id,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'recipes'), cleanedRecipe);
  };

  const handleDeleteHousehold = async (householdId: string) => {
    if (!user) return;
    try {
      // 1. Delete all recipes in the household
      const rQuery = query(collection(db, 'recipes'), where('householdId', '==', householdId));
      const rSnapshot = await getDocs(rQuery);
      for (const rDoc of rSnapshot.docs) {
        await deleteDoc(doc(db, 'recipes', rDoc.id));
      }
      // 2. Delete the household
      await deleteDoc(doc(db, 'households', householdId));
      
      setIsDeleteHouseholdConfirmOpen(false);
      setIsHouseholdModalOpen(false);
    } catch (error) {
      console.error("Failed to delete household:", error);
      alert("Failed to delete household. Please try again.");
    }
  };

  const handleSaveKitchenProfile = async (profile: HouseholdKitchenProfile) => {
    if (!user || !selectedHousehold?.id) return;
    try {
      const docRef = doc(db, 'households', selectedHousehold.id);
      await setDoc(docRef, { kitchenProfile: profile }, { merge: true });
      setSelectedHousehold(prev => prev ? { ...prev, kitchenProfile: profile } : prev);
      setPlanSuccessToast("Kitchen Equipment & Dietary Preferences updated!");
      setTimeout(() => setPlanSuccessToast(null), 3500);
    } catch (error) {
      console.error("Failed to save kitchen profile:", error);
      alert("Failed to save kitchen profile. Please try again.");
      throw error;
    }
  };

  const handleSaveRecipe = async (recipeData: Partial<Recipe>) => {
    if (!user || !selectedHousehold) return;
    
    // Validation
    if (!recipeData.title?.trim()) {
      setRecipeFormError("Please enter a recipe title.");
      return;
    }
    if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
      setRecipeFormError("Please add at least one ingredient.");
      return;
    }
    if (!recipeData.instructions || recipeData.instructions.length === 0) {
      setRecipeFormError("Please add at least one instruction step.");
      return;
    }

    setRecipeFormError(null);

    // Remove undefined fields to prevent Firestore errors
    const cleanedData = Object.fromEntries(
      Object.entries(recipeData).filter(([_, v]) => v !== undefined)
    );

    try {
      if (editingRecipe?.id) {
        await updateDoc(doc(db, 'recipes', editingRecipe.id), {
          ...cleanedData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'recipes'), {
          ...cleanedData,
          authorId: user.uid,
          householdId: selectedHousehold.id,
          createdAt: serverTimestamp(),
          rating: cleanedData.rating || 0
        });
      }
      setIsAddModalOpen(false);
      setEditingRecipe(null);
    } catch (error) {
      console.error("Error saving recipe:", error);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipes', id));
      setViewingRecipe(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recipes/${id}`);
    }
  };

  const handleImport = async () => {
    if (!importUrl) return;
    setIsProcessing(true);
    setImportError(null);
    console.log("Starting import for URL:", importUrl);
    try {
      const extracted = await extractRecipeFromUrl(importUrl);
      console.log("Extracted recipe:", extracted);
      
      const imageUrl = await generateRecipeImage(extracted.title, extracted.category);
      
      // Close import modal first
      setIsImportModalOpen(false);
      
      // Set the editing recipe with temporary fields to satisfy the type
      setEditingRecipe({
        ...extracted,
        id: '', // Temporary ID to indicate it's new but has data
        sourceUrl: importUrl,
        imageUrl: imageUrl || '',
        category: extracted.category as Category || 'Other',
        authorId: user?.uid || '',
        householdId: selectedHousehold?.id || '',
        createdAt: Timestamp.now()
      } as Recipe);
      
      // Open the add modal
      setIsAddModalOpen(true);
      setImportUrl(''); // Clear the URL
    } catch (error) {
      console.error("Import failed:", error);
      setImportError(error instanceof Error ? error.message : "Failed to import recipe. Please check the URL and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMember = async (userId: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
    if (!selectedHousehold || !user || selectedHousehold.ownerId !== user.uid) return;
    try {
      const hRef = doc(db, 'households', selectedHousehold.id);
      await updateDoc(hRef, {
        [`members.${userId}`]: role
      });
    } catch (error) {
      console.error("Failed to add member:", error);
      alert("Failed to add member. Please check the User ID and try again.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedHousehold || !user || selectedHousehold.ownerId !== user.uid) return;
    if (userId === user.uid) {
      alert("You cannot remove yourself from your own household.");
      return;
    }
    try {
      const hRef = doc(db, 'households', selectedHousehold.id);
      await updateDoc(hRef, {
        [`members.${userId}`]: deleteField()
      });
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleCopyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddRecipeToMealPlan = async () => {
    if (!planningRecipe || !selectedHousehold?.id || !user) return;
    setIsPlanSaving(true);
    try {
      const selectedDate = new Date(targetPlanDate + 'T00:00:00');
      // Calculate Monday of the target week
      const day = selectedDate.getDay();
      const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(selectedDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      
      const year = monday.getFullYear();
      const month = String(monday.getMonth() + 1).padStart(2, '0');
      const d = String(monday.getDate()).padStart(2, '0');
      const weekStartDateKey = `${year}-${month}-${d}`;

      const planDocId = `${selectedHousehold.id}_${weekStartDateKey}`;
      const planRef = doc(db, 'mealPlans', planDocId);
      const planSnap = await getDoc(planRef);

      let currentDays: { [dateStr: string]: MealSlot[] } = {};
      if (planSnap.exists()) {
        currentDays = planSnap.data().days || {};
      }

      const daySlots = currentDays[targetPlanDate] ? [...currentDays[targetPlanDate]] : [];
      daySlots.push({
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        mealType: targetMealType,
        recipeId: planningRecipe.id,
        isDone: false
      });
      currentDays[targetPlanDate] = daySlots;

      await setDoc(planRef, {
        householdId: selectedHousehold.id,
        weekStartDate: weekStartDateKey,
        days: currentDays,
        authorId: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const recipeTitle = planningRecipe.title;
      setPlanningRecipe(null);
      setPlanSuccessToast(`Added "${recipeTitle}" to meal plan!`);
      setTimeout(() => setPlanSuccessToast(null), 3000);
    } catch (err) {
      console.error("Failed to add recipe to meal plan:", err);
      alert("Failed to add to meal plan. Please try again.");
    } finally {
      setIsPlanSaving(false);
    }
  };

  const handleToggleStaple = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!recipe.id) return;
    try {
      const nextStaple = !recipe.isStaple;
      await updateDoc(doc(db, 'recipes', recipe.id), {
        isStaple: nextStaple,
        updatedAt: serverTimestamp()
      });
      if (viewingRecipe && viewingRecipe.id === recipe.id) {
        setViewingRecipe({ ...viewingRecipe, isStaple: nextStaple });
      }
      setPlanSuccessToast(
        nextStaple 
          ? `⭐ Marked "${recipe.title}" as Household Staple` 
          : `Removed "${recipe.title}" from Household Staples`
      );
      setTimeout(() => setPlanSuccessToast(null), 3000);
    } catch (error) {
      console.error("Error toggling staple status:", error);
    }
  };

  const handleImportJsonRecipes = async (
    recipesToImport: Partial<Recipe>[],
    duplicateStrategy: 'skip' | 'overwrite' | 'add_as_new',
    importedKitchenProfile?: HouseholdKitchenProfile
  ) => {
    if (!user || !selectedHousehold?.id) {
      throw new Error("No active household selected");
    }

    let importedCount = 0;
    let overwrittenCount = 0;
    let skippedCount = 0;

    const existingMap = new Map<string, Recipe>();
    recipes.forEach(r => {
      existingMap.set((r.title || '').toLowerCase().trim(), r);
    });

    for (const recipeData of recipesToImport) {
      const titleKey = (recipeData.title || '').toLowerCase().trim();
      const existing = existingMap.get(titleKey);

      if (existing) {
        if (duplicateStrategy === 'skip') {
          skippedCount++;
          continue;
        } else if (duplicateStrategy === 'overwrite' && existing.id) {
          const cleanedData = Object.fromEntries(
            Object.entries(recipeData).filter(([_, v]) => v !== undefined && _ !== 'id')
          );
          await updateDoc(doc(db, 'recipes', existing.id), {
            ...cleanedData,
            updatedAt: serverTimestamp(),
          });
          overwrittenCount++;
          continue;
        }
      }

      // Add as new recipe
      const cleanedData = Object.fromEntries(
        Object.entries(recipeData).filter(([_, v]) => v !== undefined && _ !== 'id')
      );
      await addDoc(collection(db, 'recipes'), {
        ...cleanedData,
        authorId: user.uid,
        householdId: selectedHousehold.id,
        createdAt: serverTimestamp(),
        rating: cleanedData.rating || 0,
        isStaple: Boolean(cleanedData.isStaple),
      });
      importedCount++;
    }

    // If kitchen profile was imported and provided
    if (importedKitchenProfile && selectedHousehold.id) {
      await setDoc(doc(db, 'households', selectedHousehold.id), {
        kitchenProfile: importedKitchenProfile,
      }, { merge: true });
      setSelectedHousehold(prev => prev ? { ...prev, kitchenProfile: importedKitchenProfile } : prev);
    }

    setPlanSuccessToast(
      `JSON Import Complete: ${importedCount} added${overwrittenCount > 0 ? `, ${overwrittenCount} updated` : ''}${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}!`
    );
    setTimeout(() => setPlanSuccessToast(null), 4000);

    return { importedCount, overwrittenCount, skippedCount };
  };

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' 
      ? true 
      : selectedCategory === 'Staples' 
        ? !!r.isStaple 
        : r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading || (user && householdsLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="w-20 h-20 bg-stone-800 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
            <ChefHat className="w-10 h-10 text-stone-50" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-stone-900 tracking-tight">Kitch-ow!</h1>
            <p className="text-stone-500 text-lg">Your digital kitchen for family traditions.</p>
          </div>
          <Button onClick={signIn} className="w-full py-4 text-lg shadow-lg">
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="w-20 h-20 bg-stone-800 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
            <Users className="w-10 h-10 text-stone-50" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Create a Household</h1>
            <p className="text-stone-500 text-lg">You need a household to start saving recipes. A household is where you and your family share traditions.</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name') as string;
            handleCreateHousehold(name);
          }} className="space-y-4">
            <input 
              name="name" 
              required 
              placeholder="e.g. The Smith Family" 
              className="w-full px-6 py-4 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-stone-800/10 outline-none bg-white shadow-sm" 
              disabled={isProcessing} 
            />
            <Button type="submit" className="w-full py-4 text-lg shadow-lg" disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Household"}
            </Button>
          </form>

          <button onClick={logOut} className="text-stone-400 hover:text-stone-600 text-sm font-medium transition-colors">
            Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f5f5f0] dark:bg-stone-950 text-stone-800 dark:text-stone-200 font-sans pb-24 transition-colors duration-300">
      <div id="main-content">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f5f5f0]/80 dark:bg-stone-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-stone-200/50 dark:border-stone-800/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-800 dark:bg-stone-100 rounded-xl flex items-center justify-center shadow-lg -rotate-6">
              <ChefHat className="w-6 h-6 text-stone-50 dark:text-stone-900" />
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight hidden sm:block">Kitch-ow!</h1>
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-stone-200/70 dark:bg-stone-900 border border-stone-300/40 dark:border-stone-800">
            <button
              onClick={() => setCurrentTab('recipes')}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all",
                currentTab === 'recipes'
                  ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>Recipes</span>
              <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300">
                {recipes.length}
              </span>
            </button>
            <button
              onClick={() => setCurrentTab('mealPlan')}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all",
                currentTab === 'mealPlan'
                  ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              )}
            >
              <CalendarDays className="w-4 h-4 text-amber-500" />
              <span>Meal Plan</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setIsDarkMode(prev => !prev)}
            className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500 dark:text-stone-400 flex items-center justify-center"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative group flex items-center gap-2">
            <button 
              onClick={() => setIsHouseholdModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-all shadow-sm"
              title="Household settings, dietary profile, and member management"
            >
              <Users className="w-4 h-4 text-stone-400" />
              <span className="font-medium text-sm text-stone-700 dark:text-stone-200">{selectedHousehold?.name || 'Select Household'}</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 pl-4 border-l border-stone-200 dark:border-stone-800">
            <img src={user.photoURL || ''} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-800" alt="Profile" />
            <button onClick={logOut} className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
              <LogOut className="w-5 h-5 text-stone-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Toast Notification */}
        <AnimatePresence>
          {planSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-500 text-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center justify-between text-sm font-medium"
            >
              <span>{planSuccessToast}</span>
              <button onClick={() => setPlanSuccessToast(null)} className="p-1 hover:bg-amber-600 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {currentTab === 'mealPlan' ? (
          <WeeklyMealPlan 
            household={selectedHousehold}
            recipes={recipes}
            currentUserId={user.uid}
            onViewRecipe={(recipe) => setViewingRecipe(recipe)}
            onRequestAddRecipe={() => {
              setEditingRecipe(null);
              setIsAddModalOpen(true);
            }}
          />
        ) : (
          <>
            {/* Welcome & Stats */}
            <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-1">
                <h2 className="text-4xl font-serif font-bold text-stone-900 dark:text-stone-50">Welcome, {user.displayName?.split(' ')[0]}</h2>
                <p className="text-stone-500 dark:text-stone-400 italic">What's cooking today?</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="secondary" 
                  onClick={() => setIsSurpriseMeOpen(true)} 
                  className="dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100"
                  title="Randomly pick a recipe with category, staples, and quick filters"
                >
                  <Dices className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Surprise Me
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => { 
                    setRemixInitialMealId(undefined); 
                    setIsLeftoverRemixOpen(true); 
                  }} 
                  className="dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                  title="Transform fridge leftovers into 3 delicious new dishes"
                >
                  <Soup className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Leftover Remix
                  {pastMeals.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-bold">
                      {pastMeals.length}
                    </span>
                  )}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setIsStarterPackModalOpen(true)} 
                  className="bg-amber-100 hover:bg-amber-200/90 active:bg-amber-200 text-amber-950 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-100 border border-amber-300/80 dark:border-amber-700/80 transition-all font-semibold shadow-xs"
                  title="Browse and load 32 curated family favorite starter recipes"
                >
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Starter Pack</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 font-bold">
                    32
                  </span>
                </Button>
                <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700">
                  <LinkIcon className="w-4 h-4" /> Import URL
                </Button>
                <Button onClick={() => { setEditingRecipe(null); setIsAddModalOpen(true); }} className="dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200">
                  <Plus className="w-4 h-4" /> Add Recipe
                </Button>
              </div>
            </section>

            {/* One-Time Starter Recipes Info Banner */}
            <AnimatePresence>
              {!dismissedStarterBanner && selectedHousehold && STOCK_RECIPES.some(sr => !recipes.some(r => r.title?.toLowerCase().trim() === sr.title?.toLowerCase().trim())) && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-amber-500/10 dark:to-transparent border border-amber-300/60 dark:border-amber-700/50 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 pr-6 md:pr-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">
                          Curated Starter Recipes
                        </h4>
                        <span className="text-xs font-sans font-semibold px-2.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                          32 Curated Dishes
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 dark:text-stone-300 mt-0.5">
                        Kickstart {selectedHousehold.name} with 32 family favorites (kebabs, smash burgers, instant pot meals, desserts & more), or dismiss to start from scratch.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end flex-wrap">
                    <Button
                      variant="ghost"
                      onClick={() => setIsStarterPackModalOpen(true)}
                      className="text-amber-900 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 text-xs sm:text-sm font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                      Browse Pack (32)
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleDismissStarterBanner}
                      disabled={isProcessing}
                      className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 text-xs sm:text-sm font-medium"
                    >
                      Dismiss
                    </Button>
                    <Button
                      onClick={handleSeedStockRecipes}
                      disabled={isProcessing}
                      className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600 border-none shadow-sm text-xs sm:text-sm font-semibold"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1.5" />
                          1-Click Load All
                        </>
                      )}
                    </Button>
                  </div>

                  <button
                    onClick={handleDismissStarterBanner}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
                    title="Dismiss"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters & Search */}
            <section className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1 lg:min-w-[400px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input 
                  type="text" 
                  placeholder="Search recipes or ingredients..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 transition-all text-lg"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                {['All', 'Staples', 'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink'].map((cat) => {
                  const stapleCount = recipes.filter(r => r.isStaple).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat as any)}
                      className={cn(
                        "px-5 py-3.5 rounded-2xl whitespace-nowrap font-medium transition-all border flex items-center gap-1.5 text-sm",
                        selectedCategory === cat 
                          ? "bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 border-stone-800 dark:border-stone-100 shadow-md" 
                          : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600"
                      )}
                    >
                      {cat === 'Staples' && (
                        <Star className={cn("w-4 h-4", selectedCategory === 'Staples' ? "fill-amber-400 text-amber-400" : "text-amber-500 fill-amber-500")} />
                      )}
                      <span>{cat === 'Staples' ? `Staples (${stapleCount})` : cat}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recipe Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredRecipes.map((recipe) => (
                  <motion.div
                    key={recipe.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setViewingRecipe(recipe)}
                    className="group cursor-pointer"
                  >
                    <Card className="h-full flex flex-col gap-4 overflow-hidden p-0 border-stone-200 dark:border-stone-800">
                      <div className="aspect-[4/3] bg-stone-200 dark:bg-stone-800 relative overflow-hidden">
                        {recipe.imageUrl ? (
                          <img 
                            src={recipe.imageUrl} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                            alt={recipe.title} 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400 dark:text-stone-600">
                            <Utensils className="w-12 h-12 opacity-20" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100 shadow-sm">
                          {recipe.category}
                        </div>
                        {recipe.isStaple && (
                          <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> Staple
                          </div>
                        )}
                      </div>
                      <div className="p-6 pt-2 space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 line-clamp-1">{recipe.title}</h3>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-bold">{recipe.rating || 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-stone-400 dark:text-stone-500 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{recipe.estimatedTime ? `${recipe.estimatedTime}m` : `${recipe.instructions.length * 5}m`}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Soup className="w-4 h-4" />
                              <span>{recipe.ingredients.length} ingr.</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleStaple(recipe, e)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                recipe.isStaple 
                                  ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40" 
                                  : "text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                              )}
                              title={recipe.isStaple ? "Household Staple (Click to unmark)" : "Mark as Household Staple"}
                            >
                              <Star className={cn("w-4 h-4", recipe.isStaple && "fill-current")} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlanningRecipe(recipe);
                              }}
                              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-amber-600 dark:text-amber-400 transition-colors"
                              title="Plan this recipe"
                            >
                              <CalendarDays className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>

            {filteredRecipes.length === 0 && (
              <div className="text-center py-20 space-y-4">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-8 h-8 text-stone-300 dark:text-stone-600" />
                </div>
                <h3 className="text-xl font-serif font-medium text-stone-700 dark:text-stone-300">
                  {recipes.length === 0 ? "No recipes in this household yet" : "No recipes found"}
                </h3>
                <p className="text-stone-400 dark:text-stone-500 max-w-sm mx-auto">
                  {recipes.length === 0 
                    ? "Get started by adding your own family favorites or load our curated starter recipe collection!"
                    : "Try adjusting your search query or category filters."}
                </p>
                {recipes.length === 0 && (
                  <div className="pt-2">
                    <Button onClick={handleSeedStockRecipes} disabled={isProcessing} className="shadow-md">
                      <Sparkles className="w-4 h-4 text-amber-300 mr-2" /> Load Starter Recipes Collection
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      </div>

      {/* Modals */}
      
      {/* View Recipe Modal */}
      <Modal 
        isOpen={!!viewingRecipe} 
        onClose={() => { setViewingRecipe(null); setIsDeleteConfirmOpen(false); }} 
        title={viewingRecipe?.title}
      >
        <div className="space-y-8">
          <div className="flex items-center gap-4 text-stone-500 dark:text-stone-400">
            <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-bold uppercase">{viewingRecipe?.category}</span>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-bold">{viewingRecipe?.rating}</span>
            </div>
            {viewingRecipe?.sourceUrl && (
              <a href={viewingRecipe.sourceUrl} target="_blank" className="flex items-center gap-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100">
                <LinkIcon className="w-4 h-4" /> Source
              </a>
            )}
          </div>

          {viewingRecipe?.imageUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800">
              <img 
                src={viewingRecipe.imageUrl} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
                alt={viewingRecipe.title} 
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
              <h4 className="text-lg font-serif font-bold border-b border-stone-200 dark:border-stone-800 pb-2 text-stone-900 dark:text-stone-50">Ingredients</h4>
              <ul className="space-y-2">
                {viewingRecipe?.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-stone-600 dark:text-stone-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700 mt-2 flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2 space-y-4">
              <h4 className="text-lg font-serif font-bold border-b border-stone-200 dark:border-stone-800 pb-2 text-stone-900 dark:text-stone-50">Instructions</h4>
              <ol className="space-y-6">
                {viewingRecipe?.instructions.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-400 dark:text-stone-500 text-sm">{i + 1}</span>
                    <p className="text-stone-600 dark:text-stone-400 leading-relaxed pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-200 dark:border-stone-800 flex flex-wrap gap-2 justify-between items-center">
            {isDeleteConfirmOpen ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-red-600">Are you sure?</span>
                <Button variant="danger" onClick={() => viewingRecipe && handleDeleteRecipe(viewingRecipe.id!)}>
                  Yes, Delete
                </Button>
                <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button 
                variant={viewingRecipe?.isStaple ? "secondary" : "ghost"}
                onClick={() => viewingRecipe && handleToggleStaple(viewingRecipe)}
                className={cn(
                  "text-xs font-semibold gap-1.5",
                  viewingRecipe?.isStaple 
                    ? "border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" 
                    : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                )}
              >
                <Star className={cn("w-4 h-4", viewingRecipe?.isStaple ? "fill-amber-500 text-amber-500" : "text-stone-400")} />
                {viewingRecipe?.isStaple ? "Household Staple" : "Mark as Staple"}
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => {
                  if (viewingRecipe) {
                    setPlanningRecipe(viewingRecipe);
                  }
                }}
                className="dark:bg-stone-800 dark:text-stone-200"
              >
                <CalendarDays className="w-4 h-4 text-amber-500" /> Plan Meal
              </Button>
              <Button onClick={() => { setEditingRecipe(viewingRecipe); setViewingRecipe(null); setIsAddModalOpen(true); }}>
                <Edit2 className="w-4 h-4" /> Edit Recipe
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Recipe Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingRecipe(null); setRecipeFormError(null); }} 
        title={editingRecipe?.id ? "Edit Recipe" : "Add New Recipe"}
      >
        <form 
          key={editingRecipe ? (editingRecipe.id || 'imported-' + editingRecipe.title) : 'new'}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSaveRecipe({
              title: formData.get('title') as string,
              category: formData.get('category') as Category,
              rating: Number(formData.get('rating')),
              estimatedTime: formData.get('estimatedTime') ? Number(formData.get('estimatedTime')) : null,
              ingredients: (formData.get('ingredients') as string).split('\n').filter(i => i.trim()),
              instructions: (formData.get('instructions') as string).split('\n').filter(i => i.trim()),
              imageUrl: formData.get('imageUrl') as string,
              sourceUrl: formData.get('sourceUrl') as string,
              isStaple: formData.get('isStaple') === 'on',
            });
          }} 
          className="space-y-6"
        >
          {recipeFormError && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{recipeFormError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Title</label>
              <input name="title" required defaultValue={editingRecipe?.title} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Category</label>
              <select name="category" defaultValue={editingRecipe?.category || 'Dinner'} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none">
                {['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Rating (1-5)</label>
              <input name="rating" type="number" min="1" max="5" defaultValue={editingRecipe?.rating || 5} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Time (minutes)</label>
              <input name="estimatedTime" type="number" min="1" defaultValue={editingRecipe?.estimatedTime} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" placeholder="e.g. 30" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Ingredients (One per line)</label>
            <textarea name="ingredients" required rows={5} defaultValue={editingRecipe?.ingredients.join('\n')} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Instructions (One step per line)</label>
            <textarea name="instructions" required rows={5} defaultValue={editingRecipe?.instructions.join('\n')} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Image URL (Optional)</label>
              <input name="imageUrl" defaultValue={editingRecipe?.imageUrl} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Source URL (Optional)</label>
              <input name="sourceUrl" defaultValue={editingRecipe?.sourceUrl} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <input 
              type="checkbox" 
              name="isStaple" 
              defaultChecked={editingRecipe?.isStaple || false} 
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-stone-800 dark:text-stone-100">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Mark as Household Staple
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                A reliable family go-to meal made with regularly stocked ingredients, used for instant "Not Today" swaps in the weekly planner.
              </p>
            </div>
          </label>

          <Button type="submit" className="w-full py-4 text-lg">Save Recipe</Button>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportError(null); }} title="Import from Web">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Recipe URL</label>
            <input 
              type="url" 
              placeholder="https://example.com/best-cookies" 
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none" 
            />
          </div>
          {importError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}
          <Button className="w-full py-4" onClick={handleImport} disabled={isProcessing || !importUrl}>
            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : "Import Recipe"}
          </Button>
          <p className="text-sm text-stone-400 text-center italic">Gemini will intelligently gather only the essential recipe details and ingredients for you.</p>
        </div>
      </Modal>

      {/* Household Modal */}
      <Modal isOpen={isHouseholdModalOpen} onClose={() => setIsHouseholdModalOpen(false)} title="My Households">
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Switch Household</h3>
            <div className="grid grid-cols-1 gap-2">
              {households.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setSelectedHousehold(h); setIsHouseholdModalOpen(false); }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    selectedHousehold?.id === h.id 
                      ? "bg-stone-800 dark:bg-stone-100 border-stone-800 dark:border-stone-100 text-stone-50 dark:text-stone-900" 
                      : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 text-stone-900 dark:text-stone-100"
                  )}
                >
                  <span className="font-medium">{h.name}</span>
                  {selectedHousehold?.id === h.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Household Kitchen & Dietary Profile Section */}
          {selectedHousehold && (
            <div className="space-y-3 pt-6 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest">
                    Dietary & Appliance Profile
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHouseholdModalOpen(false);
                    openKitchenProfile('dietary');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Configure Profile</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-3">
                {(!selectedHousehold.kitchenProfile?.appliances?.length && 
                  !selectedHousehold.kitchenProfile?.dietaryRestrictions?.length && 
                  !selectedHousehold.kitchenProfile?.dislikedIngredients?.length &&
                  !selectedHousehold.kitchenProfile?.customAppliances &&
                  !selectedHousehold.kitchenProfile?.customDietaryRestrictions &&
                  !selectedHousehold.kitchenProfile?.customDislikedIngredients) ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      No dietary preferences or appliances configured yet. Customize this to guide AI recipe planning.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHouseholdModalOpen(false);
                        openKitchenProfile('dietary');
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      + Set Profile
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Dietary Restrictions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 mr-1">Diet:</span>
                      {(selectedHousehold.kitchenProfile?.dietaryRestrictions?.length ? (
                        selectedHousehold.kitchenProfile.dietaryRestrictions.map((diet, i) => (
                          <span key={'h_diet_' + i} className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium">
                            🌱 {diet}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">None specified</span>
                      ))}
                    </div>

                    {/* Kitchen Appliances */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 mr-1">Gear:</span>
                      {(selectedHousehold.kitchenProfile?.appliances?.length ? (
                        selectedHousehold.kitchenProfile.appliances.slice(0, 6).map((app, i) => (
                          <span key={'h_app_' + i} className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                            ⚡ {app}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-stone-400 italic">Standard stovetop & oven</span>
                      ))}
                    </div>

                    {/* Disliked Ingredients */}
                    {(selectedHousehold.kitchenProfile?.dislikedIngredients?.length || 0) > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 mr-1">Avoid:</span>
                        {selectedHousehold.kitchenProfile?.dislikedIngredients?.map((dis, i) => (
                          <span key={'h_dis_' + i} className="text-[11px] px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-medium">
                            🚫 No {dis}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Household Starter Recipes Collection */}
          {selectedHousehold && (
            <div className="space-y-3 pt-6 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest">
                    Curated Starter Recipes Collection
                  </h3>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      32 Curated Family Favorites
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                      {STOCK_RECIPES.filter(sr => recipes.some(r => r.title?.toLowerCase().trim() === sr.title?.toLowerCase().trim())).length} of 32 in Kitchen
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5">
                    Includes crowd favorites like smash burgers, chicken kebabs, pulled pork, stir-fries, and gourmet pasta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHouseholdModalOpen(false);
                    setIsStarterPackModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Browse & Load Starter Pack (32)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Household Data & JSON Backup (Unobtrusive) */}
          {selectedHousehold && (
            <div className="space-y-3 pt-6 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300 uppercase tracking-widest">
                    Recipe Backup & Data Portability
                  </h3>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Export or Import Recipes (JSON)
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Save a full offline backup of your {recipes.length} recipe{recipes.length === 1 ? '' : 's'} or import an existing collection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsHouseholdModalOpen(false);
                    setIsJsonModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700/80 hover:text-stone-900 dark:hover:text-stone-100 transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Backup & Import JSON</span>
                </button>
              </div>
            </div>
          )}

          {selectedHousehold && selectedHousehold.ownerId === user.uid && (
            <div className="space-y-4 pt-8 border-t border-stone-200">
              <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Invite Member</h3>
              <p className="text-xs text-stone-400 italic">Enter the User ID of the person you want to invite.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const uid = new FormData(e.currentTarget).get('uid') as string;
                handleAddMember(uid);
                e.currentTarget.reset();
              }} className="flex gap-2">
                <input name="uid" required placeholder="User UID" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 outline-none" />
                <Button type="submit">Invite</Button>
              </form>
              <div className="space-y-2">
                {Object.entries(selectedHousehold.members).map(([uid, role]) => (
                  <div key={uid} className="flex justify-between items-center text-sm p-2 bg-white rounded-lg border border-stone-100">
                    <span className="font-mono text-xs text-stone-400">{uid.slice(0, 8)}...</span>
                    <div className="flex items-center gap-2">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-bold">{role}</span>
                      {uid !== user.uid && (
                        <button 
                          onClick={() => handleRemoveMember(uid)}
                          className="text-stone-400 hover:text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-8 border-t border-stone-200 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">My User ID</h3>
            <div className="flex items-center justify-between p-3 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <code className="text-xs font-mono text-stone-600 dark:text-stone-300">{user.uid}</code>
              <button 
                onClick={handleCopyId}
                className="text-[10px] font-bold uppercase text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-8 border-t border-stone-200 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Create New Household</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get('name') as string;
              handleCreateHousehold(name);
            }} className="flex gap-2">
              <input name="name" required placeholder="e.g. The Smith Family" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 outline-none" disabled={isProcessing} />
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create"}
              </Button>
            </form>
          </div>

          {selectedHousehold && selectedHousehold.ownerId === user.uid && (
            <div className="pt-8 border-t border-stone-200 flex justify-end">
              {isDeleteHouseholdConfirmOpen ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">Are you sure?</span>
                  <Button variant="danger" onClick={() => handleDeleteHousehold(selectedHousehold.id)}>
                    Yes, Delete Household
                  </Button>
                  <Button variant="secondary" onClick={() => setIsDeleteHouseholdConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setIsDeleteHouseholdConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4" /> Delete Household
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Quick Add to Meal Plan Modal */}
      <Modal
        isOpen={!!planningRecipe}
        onClose={() => setPlanningRecipe(null)}
        title="Add to Weekly Meal Plan"
      >
        {planningRecipe && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 bg-stone-100 dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-700">
              {planningRecipe.imageUrl ? (
                <img 
                  src={planningRecipe.imageUrl} 
                  referrerPolicy="no-referrer" 
                  alt={planningRecipe.title} 
                  className="w-14 h-14 rounded-xl object-cover" 
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-stone-500">
                  <Utensils className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 truncate">{planningRecipe.title}</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{planningRecipe.category} • {planningRecipe.ingredients.length} ingredients</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={targetPlanDate}
                  onChange={(e) => setTargetPlanDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-amber-500/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
                  Meal Slot
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as MealType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTargetMealType(type)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5",
                        targetMealType === type
                          ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-sm"
                          : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-400"
                      )}
                    >
                      {type === 'Breakfast' ? '🌅' : type === 'Lunch' ? '☀️' : type === 'Dinner' ? '🌙' : '🍪'} {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPlanningRecipe(null)}>
                Cancel
              </Button>
              <Button onClick={handleAddRecipeToMealPlan} disabled={isPlanSaving}>
                {isPlanSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save to Meal Plan"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Surprise Me - Discovery Modal */}
      <SurpriseMeModal
        isOpen={isSurpriseMeOpen}
        onClose={() => setIsSurpriseMeOpen(false)}
        recipes={recipes}
        onViewRecipe={(recipe) => setViewingRecipe(recipe)}
        onAddToMealPlan={handleSurpriseAddToMealPlan}
        initialCategory={selectedCategory === 'Staples' ? 'All' : selectedCategory}
      />

      {/* Leftover Remix & Freshness Tracker Modal */}
      <LeftoverRemixModal
        isOpen={isLeftoverRemixOpen}
        onClose={() => {
          setIsLeftoverRemixOpen(false);
          setRemixInitialMealId(undefined);
        }}
        pastMeals={pastMeals}
        initialSelectedMealId={remixInitialMealId}
        onSaveAsRecipe={handleSaveRemixRecipe}
        onAddToMealPlan={handleAddRemixToMealPlan}
      />

      {/* Kitchen Equipment & Dietary Profile Modal */}
      <KitchenDietaryProfileModal
        isOpen={isKitchenProfileOpen}
        onClose={() => {
          setIsKitchenProfileOpen(false);
          setIsHouseholdModalOpen(true);
        }}
        household={selectedHousehold}
        onSaveProfile={async (profile) => {
          await handleSaveKitchenProfile(profile);
          setIsKitchenProfileOpen(false);
          setIsHouseholdModalOpen(true);
        }}
        initialTab={kitchenProfileInitialTab}
      />

      {/* Recipe JSON Import / Export Modal */}
      <RecipeJsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        household={selectedHousehold}
        recipes={recipes}
        onImportRecipes={handleImportJsonRecipes}
      />

      {/* Starter Recipe Pack Explorer Modal */}
      <StarterPackModal
        isOpen={isStarterPackModalOpen}
        onClose={() => setIsStarterPackModalOpen(false)}
        recipes={recipes}
        householdName={selectedHousehold?.name || 'Your Kitchen'}
        onLoadAllMissing={handleSeedStockRecipes}
        onForceReloadAll={handleForceReloadStockRecipes}
        onAddSingleRecipe={handleSeedSingleStockRecipe}
        onViewRecipe={(recipe) => setViewingRecipe(recipe)}
      />
    </div>
    </ErrorBoundary>
  );
}
