export interface GroceryItem {
  id: string;
  name: string;
  originalText: string;
  tier: 'primary' | 'pantry';
  category: GroceryCategory;
  recipeTitles: string[];
  isChecked: boolean;
  isCustom?: boolean;
}

export type GroceryCategory =
  | 'Produce & Herbs'
  | 'Meat & Seafood'
  | 'Dairy & Refrigerated'
  | 'Bakery & Bread'
  | 'Pantry & Canned Goods'
  | 'Spices & Seasonings'
  | 'Oils, Vinegars & Condiments'
  | 'Baking & Grains'
  | 'Beverages & Other';

const PANTRY_KEYWORDS = [
  // Spices & Seasonings
  'salt', 'black pepper', 'kosher salt', 'sea salt', 'pepper', 'paprika', 'smoked paprika',
  'cumin', 'ground cumin', 'oregano', 'dried oregano', 'garlic powder', 'onion powder',
  'red pepper flakes', 'chili flakes', 'chili powder', 'cinnamon', 'ground cinnamon',
  'nutmeg', 'ground nutmeg', 'turmeric', 'thyme', 'dried thyme', 'rosemary', 'dried rosemary',
  'bay leaf', 'bay leaves', 'cardamom', 'curry powder', 'coriander', 'ground coriander',
  'cayenne', 'cayenne pepper', 'allspice', 'cloves', 'ginger powder', 'mustard powder',
  'seasoning', 'italian seasoning', 'taco seasoning', 'garam masala', 'vanilla', 'vanilla extract',
  
  // Oils & Vinegars
  'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil', 'sesame oil',
  'toasted sesame oil', 'coconut oil', 'avocado oil', 'cooking spray',
  'balsamic vinegar', 'apple cider vinegar', 'red wine vinegar', 'white vinegar',
  'rice vinegar', 'white wine vinegar',
  
  // Sauces & Condiments
  'soy sauce', 'tamari', 'fish sauce', 'sriracha', 'hot sauce', 'dijon mustard',
  'yellow mustard', 'wholegrain mustard', 'mayonnaise', 'ketchup', 'honey',
  'maple syrup', 'worcestershire sauce', 'hoisin sauce', 'oyster sauce', 'bbq sauce',
  
  // Baking & Essentials
  'flour', 'all-purpose flour', 'sugar', 'granulated sugar', 'brown sugar',
  'baking powder', 'baking soda', 'cornstarch', 'cocoa powder', 'yeast',
  'bouillon', 'bouillon cube', 'chicken bouillon'
];

const PRODUCE_KEYWORDS = [
  'onion', 'garlic', 'tomato', 'tomatoes', 'potato', 'potatoes', 'carrot', 'carrots',
  'celery', 'bell pepper', 'pepper', 'spinach', 'kale', 'lettuce', 'arugula',
  'lemon', 'lime', 'avocado', 'cilantro', 'parsley', 'basil', 'fresh basil',
  'ginger', 'fresh ginger', 'scallion', 'scallions', 'green onion', 'mushroom',
  'mushrooms', 'zucchini', 'cucumber', 'broccoli', 'cauliflower', 'asparagus',
  'apple', 'apples', 'banana', 'orange', 'strawberry', 'berries', 'shallot',
  'shallots', 'jalapeno', 'cabbage', 'sweet potato', 'squash', 'corn'
];

const MEAT_KEYWORDS = [
  'chicken', 'chicken breast', 'chicken thighs', 'beef', 'ground beef', 'steak',
  'pork', 'pork chop', 'bacon', 'sausage', 'salmon', 'shrimp', 'fish', 'turkey',
  'ground turkey', 'tuna', 'cod', 'halibut', 'lamb', 'prosciutto', 'pancetta',
  'tofu', 'tempeh'
];

const DAIRY_KEYWORDS = [
  'butter', 'unsalted butter', 'salted butter', 'milk', 'heavy cream', 'cream',
  'sour cream', 'greek yogurt', 'yogurt', 'cheddar', 'parmesan', 'parmigiano',
  'mozzarella', 'feta', 'ricotta', 'cream cheese', 'eggs', 'egg', 'pecorino',
  'swiss cheese', 'goat cheese'
];

const BAKERY_KEYWORDS = [
  'bread', 'sourdough', 'baguette', 'buns', 'burger buns', 'tortilla', 'tortillas',
  'pita', 'naan', 'croissant', 'english muffin', 'wraps'
];

export function categorizeIngredient(ingredientText: string): { tier: 'primary' | 'pantry'; category: GroceryCategory } {
  const lower = ingredientText.toLowerCase().trim();

  // 1. Check Bakery & Bread (e.g. corn tortillas, burger buns)
  if (BAKERY_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
    return { tier: 'primary', category: 'Bakery & Bread' };
  }

  // 2. Check Meat & Seafood
  if (MEAT_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
    return { tier: 'primary', category: 'Meat & Seafood' };
  }

  // 3. Check Dairy & Refrigerated
  if (DAIRY_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
    return { tier: 'primary', category: 'Dairy & Refrigerated' };
  }

  // 4. Check if it is explicitly a fresh produce item (like fresh garlic, onion, bell pepper) before generic spice matching
  const isFreshProduce = PRODUCE_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower)) &&
    !lower.includes('powder') && !lower.includes('dried') && !lower.includes('ground') && !lower.includes('flake');

  if (isFreshProduce) {
    return { tier: 'primary', category: 'Produce & Herbs' };
  }

  // 5. Check if it's a known pantry staple
  const isPantry = PANTRY_KEYWORDS.some(k => {
    // If checking 'cloves', make sure it's not 'cloves of garlic' or 'garlic cloves'
    if (k === 'cloves' || k === 'clove') {
      if (lower.includes('garlic')) return false;
    }
    // If checking 'pepper', make sure it's not bell pepper unless black pepper or cayenne
    if (k === 'pepper' && (lower.includes('bell pepper') || lower.includes('sweet pepper') || lower.includes('chili pepper') || lower.includes('jalapeno'))) {
      return false;
    }
    const regex = new RegExp(`\\b${k}\\b`, 'i');
    return regex.test(lower);
  });

  if (isPantry) {
    if (lower.includes('oil') || lower.includes('vinegar') || lower.includes('sauce') || lower.includes('mustard') || lower.includes('ketchup') || lower.includes('syrup') || lower.includes('honey')) {
      return { tier: 'pantry', category: 'Oils, Vinegars & Condiments' };
    }
    if (lower.includes('flour') || lower.includes('sugar') || lower.includes('baking') || lower.includes('cornstarch') || lower.includes('yeast') || lower.includes('cocoa')) {
      return { tier: 'pantry', category: 'Baking & Grains' };
    }
    return { tier: 'pantry', category: 'Spices & Seasonings' };
  }

  // 6. Check Canned Goods / Pasta / Grains
  if (lower.includes('pasta') || lower.includes('rice') || lower.includes('noodle') || lower.includes('quinoa') || lower.includes('couscous') || lower.includes('beans') || lower.includes('lentil') || lower.includes('can of') || lower.includes('canned')) {
    return { tier: 'primary', category: 'Pantry & Canned Goods' };
  }

  // 7. General Produce fallback
  if (PRODUCE_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
    return { tier: 'primary', category: 'Produce & Herbs' };
  }

  return { tier: 'primary', category: 'Produce & Herbs' };
}

export function cleanIngredientName(raw: string): string {
  // Cleans leading bullets, quantities like "2 tbsp ", "1/2 cup ", etc. if needed, but keeps meaningful context
  return raw.replace(/^[-*•]\s*/, '').trim();
}
