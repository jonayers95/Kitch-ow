export type SpoilageCategory =
  | 'seafood'
  | 'poultry'
  | 'meat'
  | 'soup'
  | 'grains'
  | 'vegetables'
  | 'dairy_cheese'
  | 'baked'
  | 'other';

export type FreshnessStatus = 'fresh' | 'eat_soon' | 'expiring' | 'past_recommended';

export interface SpoilageEvaluation {
  daysElapsed: number;
  maxSafeDays: number;
  recommendedRemixDays: number;
  status: FreshnessStatus;
  statusLabel: string;
  statusHeadline: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  percentElapsed: number;
  isSafeToEat: boolean;
  actionRecommendation: string;
  reheatGuideline: string;
  categoryLabel: string;
}

export function detectSpoilageCategory(title: string, ingredients: string[] = []): SpoilageCategory {
  const text = `${title} ${ingredients.join(' ')}`.toLowerCase();

  if (
    text.includes('salmon') ||
    text.includes('shrimp') ||
    text.includes('tuna') ||
    text.includes('fish') ||
    text.includes('cod') ||
    text.includes('halibut') ||
    text.includes('crab') ||
    text.includes('lobster') ||
    text.includes('seafood') ||
    text.includes('scallop') ||
    text.includes('clam') ||
    text.includes('mussel') ||
    text.includes('tilapia')
  ) {
    return 'seafood';
  }

  if (
    text.includes('chicken') ||
    text.includes('turkey') ||
    text.includes('poultry') ||
    text.includes('wings') ||
    text.includes('thigh') ||
    text.includes('breast') ||
    text.includes('duck')
  ) {
    return 'poultry';
  }

  if (
    text.includes('beef') ||
    text.includes('steak') ||
    text.includes('pork') ||
    text.includes('bacon') ||
    text.includes('sausage') ||
    text.includes('lamb') ||
    text.includes('ribs') ||
    text.includes('meatball') ||
    text.includes('ground beef') ||
    text.includes('burger') ||
    text.includes('ham')
  ) {
    return 'meat';
  }

  if (
    text.includes('soup') ||
    text.includes('stew') ||
    text.includes('chili') ||
    text.includes('chowder') ||
    text.includes('curry') ||
    text.includes('casserole') ||
    text.includes('lasagna') ||
    text.includes('pot pie')
  ) {
    return 'soup';
  }

  if (
    text.includes('rice') ||
    text.includes('pasta') ||
    text.includes('noodle') ||
    text.includes('quinoa') ||
    text.includes('grain') ||
    text.includes('couscous') ||
    text.includes('barley') ||
    text.includes('risotto') ||
    text.includes('ramen')
  ) {
    return 'grains';
  }

  if (
    text.includes('salad') ||
    text.includes('tofu') ||
    text.includes('veggie') ||
    text.includes('vegetable') ||
    text.includes('broccoli') ||
    text.includes('spinach') ||
    text.includes('cauliflower') ||
    text.includes('zucchini') ||
    text.includes('mushroom')
  ) {
    return 'vegetables';
  }

  if (
    text.includes('bread') ||
    text.includes('cake') ||
    text.includes('cookie') ||
    text.includes('pie') ||
    text.includes('muffin') ||
    text.includes('pancake') ||
    text.includes('waffle')
  ) {
    return 'baked';
  }

  return 'other';
}

const CATEGORY_LIFESPAN: Record<
  SpoilageCategory,
  { maxDays: number; remixDays: number; label: string }
> = {
  seafood: { maxDays: 3, remixDays: 2, label: 'Cooked Seafood' },
  poultry: { maxDays: 4, remixDays: 3, label: 'Cooked Poultry' },
  meat: { maxDays: 4, remixDays: 3, label: 'Cooked Meat / Pork / Beef' },
  soup: { maxDays: 4, remixDays: 3, label: 'Soups, Stews & Casseroles' },
  grains: { maxDays: 5, remixDays: 4, label: 'Cooked Grains / Rice / Pasta' },
  vegetables: { maxDays: 5, remixDays: 4, label: 'Cooked Vegetables / Tofu' },
  dairy_cheese: { maxDays: 7, remixDays: 5, label: 'Dairy / Cheeses' },
  baked: { maxDays: 5, remixDays: 4, label: 'Baked Goods' },
  other: { maxDays: 4, remixDays: 3, label: 'Prepared Meal' },
};

export function evaluateFoodFreshness(
  cookedDateStr: string,
  title: string,
  ingredients: string[] = []
): SpoilageEvaluation {
  const category = detectSpoilageCategory(title, ingredients);
  const lifespan = CATEGORY_LIFESPAN[category];

  // Parse cooked date (e.g. "2026-08-20")
  const cookedDate = new Date(cookedDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = Math.max(0, today.getTime() - cookedDate.getTime());
  const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const maxSafeDays = lifespan.maxDays;
  const recommendedRemixDays = lifespan.remixDays;
  const percentElapsed = Math.min(100, Math.round((daysElapsed / maxSafeDays) * 100));

  let status: FreshnessStatus;
  let statusLabel: string;
  let statusHeadline: string;
  let badgeBg: string;
  let badgeText: string;
  let badgeBorder: string;
  let dotColor: string;
  let isSafeToEat = true;
  let actionRecommendation: string;

  if (daysElapsed <= 1) {
    status = 'fresh';
    statusLabel = 'Peak Freshness';
    statusHeadline = daysElapsed === 0 ? 'Cooked Today' : '1 Day Old';
    badgeBg = 'bg-emerald-50 dark:bg-emerald-950/40';
    badgeText = 'text-emerald-700 dark:text-emerald-300';
    badgeBorder = 'border-emerald-200 dark:border-emerald-800';
    dotColor = 'bg-emerald-500';
    actionRecommendation = 'Ideal flavor and moisture. Great for regular leftovers or remixing.';
  } else if (daysElapsed <= recommendedRemixDays) {
    status = 'eat_soon';
    statusLabel = 'Eat Soon';
    statusHeadline = `${daysElapsed} Days Old`;
    badgeBg = 'bg-amber-50 dark:bg-amber-950/40';
    badgeText = 'text-amber-700 dark:text-amber-300';
    badgeBorder = 'border-amber-200 dark:border-amber-800';
    dotColor = 'bg-amber-500';
    actionRecommendation = `Prime window for a creative Remix (skillet, wrap, or bowl) today or tomorrow.`;
  } else if (daysElapsed <= maxSafeDays) {
    status = 'expiring';
    statusLabel = 'Expiring Soon';
    statusHeadline = `${daysElapsed} Days Old (Final Day)`;
    badgeBg = 'bg-orange-50 dark:bg-orange-950/40';
    badgeText = 'text-orange-700 dark:text-orange-300';
    badgeBorder = 'border-orange-200 dark:border-orange-800';
    dotColor = 'bg-orange-500';
    actionRecommendation = 'Remix or freeze today before quality and USDA shelf-life decline.';
  } else {
    status = 'past_recommended';
    statusLabel = 'Past Shelf-Life';
    statusHeadline = `${daysElapsed} Days Old (Past Safe Range)`;
    badgeBg = 'bg-red-50 dark:bg-red-950/40';
    badgeText = 'text-red-700 dark:text-red-300';
    badgeBorder = 'border-red-200 dark:border-red-800';
    dotColor = 'bg-red-500';
    isSafeToEat = false;
    actionRecommendation = `Exceeds USDA refrigerator guideline of ${maxSafeDays} days. Inspect carefully or discard.`;
  }

  const reheatGuideline =
    category === 'poultry' || category === 'meat' || category === 'soup'
      ? 'Reheat leftovers until steaming hot (internal 165°F / 74°C).'
      : 'Reheat thoroughly throughout before serving.';

  return {
    daysElapsed,
    maxSafeDays,
    recommendedRemixDays,
    status,
    statusLabel,
    statusHeadline,
    badgeBg,
    badgeText,
    badgeBorder,
    dotColor,
    percentElapsed,
    isSafeToEat,
    actionRecommendation,
    reheatGuideline,
    categoryLabel: lifespan.label,
  };
}
