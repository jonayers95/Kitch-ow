import { Recipe, MealType, HouseholdKitchenProfile } from "../types";
import { normalizeRecipeUrl } from "../utils/recipeExtractor";

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  category: string;
  estimatedTime?: number;
  imageUrl?: string;
  sourceUrl?: string;
  yield?: string;
  description?: string;
}

// Helper to safely extract a human-readable message from API responses or serverless platform errors
export function parseApiErrorMessage(data: any, status?: number, defaultErrorMessage = "Failed to process request."): string {
  // First, extract any specific custom error message from the response payload
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed && trimmed !== "[object Object]") return trimmed;
  }

  if (data && typeof data === "object") {
    const candidate =
      (typeof data.error === "string" ? data.error : null) ||
      (typeof data.error?.message === "string" ? data.error.message : null) ||
      (typeof data.error?.details === "string" ? data.error.details : null) ||
      (typeof data.message === "string" ? data.message : null) ||
      (typeof data.detail === "string" ? data.detail : null);

    if (candidate) {
      const trimmed = candidate.trim();
      if (trimmed && trimmed !== "[object Object]" && trimmed !== "An internal server error occurred.") {
        return trimmed;
      }
    }
  }

  // Next, map HTTP status codes to clear, actionable instructions
  if (status === 404) {
    return "The requested service endpoint was not found (404). Please ensure backend API routes are configured.";
  }
  if (status === 429) {
    return "AI generation quota is temporarily reached. Please try again shortly or use instant chef recipes.";
  }
  if (status === 502 || status === 504) {
    return "The service timed out while processing your request (504). Please check your connection and retry, or use instant chef recipes.";
  }
  if (status === 500) {
    return "The service encountered a server error (500). Please retry or use instant chef remixes.";
  }

  return defaultErrorMessage;
}

// Helper to safely perform fetch requests and handle non-JSON / HTML responses gracefully
async function safeFetchJson<T>(url: string, bodyData: any, defaultErrorMessage: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(bodyData),
    });
  } catch (netErr: any) {
    throw new Error(netErr?.message || "Unable to reach the server. Please check your connection.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text().catch(() => "");
    console.warn(`[API] Received non-JSON response from ${url} (status ${response.status}):`, rawText.slice(0, 200));
    if (response.status === 404) {
      throw new Error("The recipe extraction service endpoint was not found (404). Please ensure backend API routes are deployed or add the recipe manually.");
    }
    if (response.status === 504 || response.status === 502) {
      throw new Error("The AI planning service timed out while assembling the plan. Please retry.");
    }
    throw new Error(defaultErrorMessage);
  }

  const data = await response.json().catch(() => {
    throw new Error(defaultErrorMessage);
  });

  if (!response.ok) {
    const errorMsg = parseApiErrorMessage(data, response.status, defaultErrorMessage);
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function extractRecipeFromUrl(url: string): Promise<ExtractedRecipe> {
  const normalized = normalizeRecipeUrl(url);
  return safeFetchJson<ExtractedRecipe>("/api/gemini/extract-url", { url: normalized }, "Failed to extract recipe from URL.");
}

export async function generateRecipe(category: string, details: string): Promise<ExtractedRecipe> {
  return safeFetchJson<ExtractedRecipe>(
    "/api/gemini/generate-recipe",
    { category, details },
    "Failed to generate recipe."
  );
}

async function compressImage(base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

const CURATED_FOOD_IMAGES = [
  { id: 'photo-1482049016688-2d3e1b311543', tags: 'eggs, breakfast, toast, avocado, brunch' },
  { id: 'photo-1504674900247-0877df9cc836', tags: 'steak, meat, dinner, gourmet, beef' },
  { id: 'photo-1512621776951-a57141f2eefd', tags: 'salad, healthy, lunch, vegetables, green' },
  { id: 'photo-1563729784474-d77dbb933a9e', tags: 'cake, dessert, sweet, baking, chocolate' },
  { id: 'photo-1546069901-ba9599a7e63c', tags: 'bowl, healthy, lunch, quinoa, buddha bowl' },
  { id: 'photo-1565299624946-b28f40a0ae38', tags: 'pizza, italian, dinner, cheese, pepperoni' },
  { id: 'photo-1473093226795-af9932fe5856', tags: 'pasta, italian, dinner, tomato, spaghetti' },
  { id: 'photo-1528207776546-365bb710ee93', tags: 'pancakes, breakfast, syrup, sweet, stack' },
  { id: 'photo-1555939594-58d7cb561ad1', tags: 'bbq, meat, grill, dinner, skewers' },
  { id: 'photo-1540189549336-e6e99c3679fe', tags: 'salad, healthy, lunch, gourmet, salmon' },
  { id: 'photo-1565958011703-44f9829ba187', tags: 'dessert, cheesecake, sweet, berries, fruit' },
  { id: 'photo-1484723091739-30a097e8f929', tags: 'toast, breakfast, fruit, healthy, french toast' },
  { id: 'photo-1476224489421-aba8c155111a', tags: 'dinner, gourmet, plated, professional, seafood' },
  { id: 'photo-1517701550927-30cf4ba1dba5', tags: 'coffee, drink, breakfast, cafe, latte' },
  { id: 'photo-1544145945-f904253d0c7b', tags: 'cocktail, drink, bar, party, mojito' },
  { id: 'photo-1551024506-0bccd828d307', tags: 'donuts, dessert, sweet, snack, glazed' },
  { id: 'photo-1543339308-43e59d6b73a6', tags: 'snack, healthy, fruit, nuts, platter' },
  { id: 'photo-1562967914-608f82629710', tags: 'chicken, dinner, roasted, meat, poultry' },
  { id: 'photo-1493770348161-369560ae357d', tags: 'breakfast, healthy, fruit, bowl, smoothie' },
  { id: 'photo-1543353071-873f17a7a088', tags: 'soup, lunch, dinner, warm, bowl' },
  { id: 'photo-1511690656952-34342bb7c2f2', tags: 'food, table, spread, variety, feast' },
  { id: 'photo-1504113888839-1c8eb50233d3', tags: 'japanese, sushi, dinner, fish, rolls' },
  { id: 'photo-1551183053-bf91a1d81141', tags: 'pie, dessert, baking, fruit, crust' },
  { id: 'photo-1541014741259-de529411b96a', tags: 'burger, fast food, lunch, dinner, fries' },
  { id: 'photo-1513104890138-7c749659a591', tags: 'pizza, italian, cheese, dinner, fast food' },
  { id: 'photo-1432139555190-58524dae6a55', tags: 'meat, steak, dinner, gourmet, beef' },
  { id: 'photo-1467003909585-2f8a72700288', tags: 'salmon, fish, dinner, healthy, seafood' },
  { id: 'photo-1470333738027-550397360af1', tags: 'cocktail, drink, bar, party, alcohol' },
  { id: 'photo-1490645935967-10de6ba17061', tags: 'salad, healthy, lunch, vegetables, vegan' },
  { id: 'photo-1506084868730-342b1f852e0d', tags: 'breakfast, healthy, bowl, fruit, granola' },
  { id: 'photo-1504674900247-0877df9cc836', tags: 'steak, dinner, meat, gourmet, beef' },
  { id: 'photo-1512621776951-a57141f2eefd', tags: 'salad, healthy, lunch, vegetables, green' },
  { id: 'photo-1513104890138-7c749659a591', tags: 'pizza, italian, cheese, dinner, fast food' },
  { id: 'photo-1514327605112-b887c0e61c0a', tags: 'soup, lunch, dinner, warm, bowl' },
  { id: 'photo-1515003197210-e0cd71810b5f', tags: 'burger, lunch, dinner, fast food, fries' },
  { id: 'photo-1519708227418-c8fd9a32b7a2', tags: 'salmon, fish, dinner, healthy, seafood' },
  { id: 'photo-1529042410759-befb1284b791', tags: 'meatballs, dinner, italian, pasta, tomato' },
  { id: 'photo-1534422298391-e4f8c172dddb', tags: 'dumplings, asian, lunch, dinner, chinese' },
  { id: 'photo-1540189549336-e6e99c3679fe', tags: 'salad, healthy, lunch, gourmet, salmon' },
  { id: 'photo-1543353071-873f17a7a088', tags: 'soup, lunch, dinner, warm, bowl' },
  { id: 'photo-1544025162-d76694265947', tags: 'ribs, bbq, meat, dinner, grill' },
  { id: 'photo-1546069901-ba9599a7e63c', tags: 'bowl, healthy, lunch, quinoa, buddha bowl' },
  { id: 'photo-1546793665-c74683c3f43d', tags: 'sandwich, lunch, healthy, bread, snack' },
  { id: 'photo-1551024601-bec78aea704b', tags: 'dessert, cake, sweet, baking, chocolate' },
  { id: 'photo-1551183053-bf91a1d81141', tags: 'pie, dessert, baking, fruit, crust' },
  { id: 'photo-1555939594-58d7cb561ad1', tags: 'bbq, meat, grill, dinner, skewers' },
  { id: 'photo-1559339352-11d035aa65de', tags: 'tacos, mexican, dinner, lunch, spicy' },
  { id: 'photo-1560684848-51c893eca19c', tags: 'pasta, italian, dinner, tomato, spaghetti' },
  { id: 'photo-1562967914-608f82629710', tags: 'chicken, dinner, roasted, meat, poultry' },
  { id: 'photo-1563379091339-03b21ef4a4f8', tags: 'pasta, italian, dinner, cheese, creamy' },
  { id: 'photo-1563729784474-d77dbb933a9e', tags: 'cake, dessert, sweet, baking, chocolate' },
  { id: 'photo-1565299507177-b0ac66763828', tags: 'burger, lunch, dinner, fast food, cheese' },
  { id: 'photo-1565299624946-b28f40a0ae38', tags: 'pizza, italian, dinner, cheese, pepperoni' },
  { id: 'photo-1565958011703-44f9829ba187', tags: 'dessert, cheesecake, sweet, berries, fruit' },
  { id: 'photo-1565299543923-37dd39e06736', tags: 'pancakes, breakfast, syrup, sweet, stack' },
  { id: 'photo-1554520735-0ad66a96f34b', tags: 'pancakes, breakfast, syrup, sweet, stack' },
  { id: 'photo-1568901346375-23c9450c58cd', tags: 'burger, lunch, dinner, fast food, cheese' },
  { id: 'photo-1569718212165-3a8278d5f624', tags: 'ramen, noodles, asian, dinner, soup' },
  { id: 'photo-1574484284002-952d92456975', tags: 'curry, indian, dinner, spicy, rice' },
  { id: 'photo-1574894709920-11b28e7367e3', tags: 'pasta, italian, dinner, tomato, spaghetti' },
  { id: 'photo-1585032226651-759b368d7246', tags: 'noodles, asian, lunch, dinner, spicy' },
  { id: 'photo-1589302168068-964664d93dc0', tags: 'biryani, indian, dinner, rice, spicy' },
  { id: 'photo-1593504049359-74330189a345', tags: 'pizza, italian, dinner, cheese, fast food' },
  { id: 'photo-1594000199163-24b94cee129f', tags: 'pizza, italian, dinner, cheese, fast food' },
  { id: 'photo-1598103442097-8b74394b95c6', tags: 'chicken, dinner, roasted, meat, poultry' },
  { id: 'photo-1598515214211-89d3c73ae83b', tags: 'chicken, dinner, roasted, meat, poultry' },
  { id: 'photo-1600891964599-f61ba0e24092', tags: 'steak, dinner, meat, gourmet, beef' },
  { id: 'photo-1603360946369-dc9bb6258143', tags: 'pasta, italian, dinner, tomato, spaghetti' },
  { id: 'photo-1604382354936-07c5d9983bd3', tags: 'pizza, italian, dinner, cheese, fast food' },
  { id: 'photo-1604908176997-125f25cc6f3d', tags: 'chicken, dinner, roasted, meat, poultry' },
  { id: 'photo-1606787366850-de6330128bfc', tags: 'food, table, spread, variety, feast' },
  { id: 'photo-1607532941433-304659e8198a', tags: 'salad, healthy, lunch, vegetables, green' },
  { id: 'photo-1621996346565-e3dbc646d9a9', tags: 'pasta, italian, dinner, tomato, spaghetti' },
  { id: 'photo-1627308595229-7830a5c91f9f', tags: 'salad, healthy, lunch, vegetables, green' },
  { id: 'photo-1633337444204-60a301a3240d', tags: 'burger, lunch, dinner, fast food, cheese' },
  { id: 'photo-1481931098730-318b6f776db0', tags: 'fruit, healthy, snack, sweet, colorful' },
  { id: 'photo-1490818387583-1baba5e638af', tags: 'fruit, healthy, snack, sweet, colorful' },
  { id: 'photo-1494390248081-4e521a5940db', tags: 'breakfast, healthy, bowl, fruit, granola' },
  { id: 'photo-1502819126416-d387f86d47a1', tags: 'dessert, cake, sweet, baking, chocolate' },
  { id: 'photo-1505253716362-afaea1d3d1af', tags: 'sandwich, lunch, healthy, bread, snack' },
  { id: 'photo-1505576399279-565b52d4ac71', tags: 'smoothie, drink, healthy, fruit, breakfast' },
  { id: 'photo-1505935428862-770b6f24f629', tags: 'dessert, cake, sweet, baking, chocolate' },
  { id: 'photo-1506354666786-959d6d497f1a', tags: 'pizza, italian, dinner, cheese, fast food' },
  { id: 'photo-1511690656952-34342bb7c2f2', tags: 'food, table, spread, variety, feast' },
  { id: 'photo-1512152272829-e3139592d56f', tags: 'fast food, burger, fries, lunch, dinner' },
  { id: 'photo-1513104890138-7c749659a591', tags: 'pizza, italian, dinner, cheese, fast food' },
  { id: 'photo-1513442542250-854d436a73f2', tags: 'breakfast, healthy, egg, toast, coffee' },
  { id: 'photo-1515003197210-e0cd71810b5f', tags: 'burger, lunch, dinner, fast food, cheese' },
  { id: 'photo-1519708227418-c8fd9a32b7a2', tags: 'salmon, fish, dinner, healthy, seafood' },
  { id: 'photo-1525351484163-7529414344d8', tags: 'breakfast, healthy, bowl, fruit, granola' },
  { id: 'photo-1529042410759-befb1284b791', tags: 'meatballs, dinner, italian, pasta, tomato' },
  { id: 'photo-1532980400857-e8d9d275d858', tags: 'pancakes, breakfast, syrup, sweet, stack' },
  { id: 'photo-1533089860892-a7c6f0a88666', tags: 'breakfast, healthy, bowl, fruit, granola' },
  { id: 'photo-1534422298391-e4f8c172dddb', tags: 'dumplings, asian, lunch, dinner, chinese' },
  { id: 'photo-1540189549336-e6e99c3679fe', tags: 'salad, healthy, lunch, gourmet, salmon' },
  { id: 'photo-1541014741259-de529411b96a', tags: 'burger, lunch, dinner, fast food, cheese' },
  { id: 'photo-1543353071-873f17a7a088', tags: 'soup, lunch, dinner, warm, bowl' },
  { id: 'photo-1544025162-d76694265947', tags: 'ribs, bbq, meat, dinner, grill' },
  { id: 'photo-1546069901-ba9599a7e63c', tags: 'bowl, healthy, lunch, quinoa, buddha bowl' },
  { id: 'photo-1546793665-c74683c3f43d', tags: 'sandwich, lunch, healthy, bread, snack' }
];


export interface AiMealPlanRequest {
  recipes: Recipe[];
  weekStartDate: string; // "YYYY-MM-DD"
  selectedMealTypes: MealType[];
  householdProfile?: HouseholdKitchenProfile;
  calendarContext?: any;
  calendarOptions?: {
    autoOmitDiningOut?: boolean;
    prioritizeQuickOnBusy?: boolean;
    suggestEatOutOnPacked?: boolean;
  };
  preferences?: {
    seasonalFocus?: boolean;
    trendFocus?: boolean;
    quickWeekdays?: boolean;
    varietyLevel?: number; // 1 (High Consistency / Batch) to 5 (Maximum Variety / Exploration)
    customNote?: string;
  };
}

export interface AiMealPlanResponse {
  seasonalTheme: string;
  trendHighlights: string;
  days: {
    [dateStr: string]: {
      mealType: MealType;
      recipeId: string;
      recipeTitle: string;
      reason?: string;
      isDiningOut?: boolean;
      diningOutPlace?: string;
    }[];
  };
}

export async function generateAiMealPlan(req: AiMealPlanRequest): Promise<AiMealPlanResponse> {
  const { recipes, selectedMealTypes } = req;

  if (!recipes || recipes.length === 0) {
    throw new Error("No recipes available. Please add some recipes to your collection first.");
  }

  if (!selectedMealTypes || selectedMealTypes.length === 0) {
    throw new Error("Please select at least one meal time (e.g., Breakfast, Lunch, or Dinner).");
  }

  return safeFetchJson<AiMealPlanResponse>(
    "/api/gemini/generate-meal-plan",
    req,
    "Failed to generate AI meal plan. Please try again."
  );
}

export interface RemixProposal {
  id: string;
  title: string;
  remixStyle: string;
  description: string;
  estimatedTime: number;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Dessert' | 'Snack' | 'Other';
  leftoversUtilized: string[];
  pantryItemsNeeded: string[];
  ingredients: string[];
  instructions: string[];
  proTips?: string;
}

export interface LeftoverRemixRequest {
  leftoverItems: Array<{
    name: string;
    cookedDate?: string;
    notes?: string;
  }>;
  customIngredients?: string;
  preferences?: {
    quickOnly?: boolean;
    style?: string;
  };
}

export interface LeftoverRemixResponse {
  remixes: RemixProposal[];
}

export async function remixLeftovers(req: LeftoverRemixRequest): Promise<LeftoverRemixResponse> {
  return safeFetchJson<LeftoverRemixResponse>(
    "/api/gemini/remix-leftovers",
    req,
    "Failed to generate leftover remixes. Please try again."
  );
}

export function generateClientFallbackRemixes(
  leftoverItems: any = [],
  customIngredients?: any
): LeftoverRemixResponse {
  const safeLeftoverItems = Array.isArray(leftoverItems) ? leftoverItems : [];
  const itemNames: string[] = [];
  for (const item of safeLeftoverItems) {
    if (typeof item === "string" && item.trim()) {
      itemNames.push(item.trim());
    } else if (item && typeof item === "object") {
      const name = item.name || item.title || item.recipeTitle || "";
      if (typeof name === "string" && name.trim()) {
        itemNames.push(name.trim());
      }
    }
  }

  const extraNames: string[] = [];
  if (typeof customIngredients === "string" && customIngredients.trim()) {
    extraNames.push(...customIngredients.split(",").map((s) => s.trim()).filter(Boolean));
  } else if (Array.isArray(customIngredients)) {
    for (const extra of customIngredients) {
      if (typeof extra === "string" && extra.trim()) {
        extraNames.push(extra.trim());
      }
    }
  }

  const allNames = [...itemNames, ...extraNames];
  const primary = allNames[0] || "Available Leftovers";
  const secondary = allNames[1] || "Pantry Staples";

  return {
    remixes: [
      {
        id: "client-remix-1",
        title: `Crispy Skillet Remix: ${primary} Hash`,
        remixStyle: "15-Min Sizzling Skillet",
        description: `Breathes instant life into ${primary} by searing it in a sizzling hot skillet with aromatics, crisp golden edges, and a fried egg crown.`,
        estimatedTime: 15,
        category: "Dinner",
        leftoversUtilized: allNames.slice(0, 3),
        pantryItemsNeeded: ["Olive Oil or Butter", "2 Large Eggs", "Salt & Black Pepper", "Garlic Powder", "Hot Sauce or Salsa"],
        ingredients: [
          `2 cups leftover ${primary}`,
          ...(secondary !== "Pantry Staples" ? [`1 cup ${secondary}`] : []),
          "2 large eggs",
          "1 tbsp butter or olive oil",
          "1/2 tsp garlic powder & smoked paprika",
          "Fresh herbs, hot sauce, or scallions for serving",
        ],
        instructions: [
          "Heat a heavy skillet (cast iron preferred) over medium-high heat with 1 tbsp butter or cooking oil.",
          `Add ${primary}${secondary !== "Pantry Staples" ? ` and ${secondary}` : ""}, pressing down firmly with a spatula to form a golden crispy crust for 3-4 minutes.`,
          "Make two small wells in the center of the skillet and crack in the eggs.",
          "Cover with a lid for 2 minutes until egg whites are set and yolks remain jammy.",
          "Season with salt, black pepper, and smoked paprika. Drizzle with hot sauce and serve straight from the skillet.",
        ],
        proTips: "Don't stir constantly—letting the leftovers sit undisturbed on high heat creates caramelized, crispy golden edges!",
      },
      {
        id: "client-remix-2",
        title: `Cozy ${primary} Flatbread Melt`,
        remixStyle: "Crispy Golden Melt",
        description: `Layers ${primary} with melted cheese between toasted tortillas or flatbreads for an ultra-fast, comforting meal.`,
        estimatedTime: 12,
        category: "Lunch",
        leftoversUtilized: allNames.slice(0, 2),
        pantryItemsNeeded: ["Flour Tortillas or Flatbread", "Shredded Cheese", "Butter", "Sour Cream or Salsa"],
        ingredients: [
          `1.5 cups shredded or chopped ${primary}`,
          "2 large flour tortillas or flatbreads",
          "1 cup shredded cheese of choice",
          "1 tbsp butter",
          "Salsa, sour cream, or guacamole for dipping",
        ],
        instructions: [
          "Warm a non-stick skillet over medium heat.",
          `Place one tortilla flat, layer half the cheese, distribute ${primary} evenly, and top with remaining cheese and the second tortilla.`,
          "Cook for 3-4 minutes until the bottom tortilla is deep golden and crisp.",
          "Carefully flip and cook the other side for another 2-3 minutes until cheese is fully melted.",
          "Slice into wedges and serve warm with dipping sauces.",
        ],
        proTips: "Cheese on both top and bottom acts as culinary glue to keep your quesadilla tightly sealed.",
      },
      {
        id: "client-remix-3",
        title: `Vibrant ${primary} Grain & Herb Power Bowl`,
        remixStyle: "Warm Grain Bowl",
        description: `A nourishing bowl combining warm ${primary} with crisp greens, pantry seeds, and a zesty lemon-olive oil dressing.`,
        estimatedTime: 10,
        category: "Lunch",
        leftoversUtilized: allNames.slice(0, 3),
        pantryItemsNeeded: ["Olive Oil", "Lemon Juice or Vinegar", "Dijon Mustard", "Pantry Nuts or Seeds", "Mixed Greens"],
        ingredients: [
          `1 to 2 cups leftover ${primary}`,
          "2 large handfuls salad greens or shredded cabbage",
          "2 tbsp extra virgin olive oil",
          "1 tbsp fresh lemon juice or cider vinegar",
          "1 tsp honey or maple syrup",
          "2 tbsp toasted seeds or nuts",
        ],
        instructions: [
          `Gently warm the ${primary} in a skillet or microwave for 60 seconds until fragrant.`,
          "In a small bowl or jar, whisk together olive oil, lemon juice, honey, salt, and pepper.",
          "Toss the fresh greens with half the vinaigrette in a serving bowl.",
          `Top with the warmed ${primary}, sprinkle with toasted seeds or nuts, and drizzle remaining vinaigrette over the top.`,
        ],
        proTips: "Contrast in temperatures (warm protein over cool crisp greens) makes leftover bowls feel gourmet.",
      },
    ],
  };
}

export async function generateRecipeImage(title: string, category?: string): Promise<string | null> {
  try {
    const categoryMatch = CURATED_FOOD_IMAGES.find(img => img.tags.includes((category || '').toLowerCase()));
    const fallbackId = categoryMatch ? categoryMatch.id : CURATED_FOOD_IMAGES[Math.floor(Math.random() * 20)].id;
    return `https://images.unsplash.com/${fallbackId}?auto=format&fit=crop&q=80&w=1000`;
  } catch (error) {
    console.error("Failed to select image:", error);
    return `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000`;
  }
}
