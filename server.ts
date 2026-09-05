import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { extractRecipeFromHtml, normalizeRecipeUrl } from "./src/utils/recipeExtractor";

dotenv.config();

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Resilient generation with automatic model fallback & exponential retry on 503/429 high demand
async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  },
  models: string[] = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]
) {
  let lastError: any = null;

  for (const model of models) {
    // Try each model with a quick timeout to prevent hanging requests
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model "${model}" (attempt ${attempt + 1})...`);
        
        // Timeout promise of 12 seconds per attempt
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Model "${model}" call timed out`)), 12000)
        );

        const apiPromise = ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        const response = (await Promise.race([apiPromise, timeoutPromise])) as any;
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || "").toLowerCase();
        const statusCode = err?.status || err?.code || 0;

        console.warn(`[Gemini] Model "${model}" failed (attempt ${attempt + 1}):`, err?.message || err);

        // If model is not found (404) or quota exhausted on this specific model (429), immediately try next model
        if (statusCode === 404 || errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("no longer available")) {
          break;
        }

        const isTransient =
          statusCode === 503 ||
          statusCode === 429 ||
          errMsg.includes("503") ||
          errMsg.includes("429") ||
          errMsg.includes("timed out") ||
          errMsg.includes("timeout") ||
          errMsg.includes("high demand") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("resource_exhausted") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("try again later");

        if (isTransient && attempt === 0) {
          const backoffMs = 300;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("All AI model attempts were unsuccessful.");
}

// Algorithmic smart fallback when AI services are completely unavailable due to peak demand
function generateSmartFallbackMealPlan(
  recipes: any[],
  weekStartDate: string,
  selectedMealTypes: string[],
  season: string,
  monthName: string,
  varietyLevel: number = 3,
  calendarContext?: any,
  calendarOptions?: any
) {
  let startDate = weekStartDate ? new Date(weekStartDate + "T00:00:00") : new Date();
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const daysMap: { [dateStr: string]: { mealType: string; recipeId: string; recipeTitle: string; reason?: string; isDiningOut?: boolean; diningOutPlace?: string }[] } = {};

  const categorized: { [key: string]: any[] } = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snack: [],
    Dessert: [],
    Other: [],
  };

  recipes.forEach((r) => {
    const cat = r.category || "Dinner";
    if (categorized[cat]) {
      categorized[cat].push(r);
    } else {
      categorized.Other.push(r);
    }
  });

  const usedRecipeIds = new Set<string>();
  const lastUsedProtein: { [mealType: string]: string } = {};
  const batchPicksByMealType: { [mealType: string]: any[] } = {};

  function getProteinGroup(r: any): string {
    const text = ((r?.title || "") + " " + (Array.isArray(r?.ingredients) ? r.ingredients.join(" ") : "")).toLowerCase();
    if (text.includes("chicken") || text.includes("turkey") || text.includes("poultry")) return "poultry";
    if (text.includes("beef") || text.includes("steak") || text.includes("burger") || text.includes("meatball") || text.includes("brisket")) return "beef";
    if (text.includes("pork") || text.includes("bacon") || text.includes("sausage") || text.includes("ribs") || text.includes("ham")) return "pork";
    if (text.includes("salmon") || text.includes("shrimp") || text.includes("fish") || text.includes("tuna") || text.includes("seafood") || text.includes("crab")) return "seafood";
    if (text.includes("tofu") || text.includes("tempeh") || text.includes("lentil") || text.includes("bean") || text.includes("chickpea") || text.includes("falafel")) return "vegetarian";
    if (text.includes("pasta") || text.includes("noodle") || text.includes("spaghetti") || text.includes("lasagna") || text.includes("gnocchi")) return "pasta";
    return "other";
  }

  selectedMealTypes.forEach((mealType) => {
    const pool = categorized[mealType]?.length ? categorized[mealType] : recipes;
    if (varietyLevel === 1) {
      batchPicksByMealType[mealType] = pool.slice(0, 2);
    } else if (varietyLevel === 2) {
      batchPicksByMealType[mealType] = pool.slice(0, 3);
    }
  });

  for (let i = 0; i < 7; i++) {
    const cur = new Date(startDate);
    cur.setDate(startDate.getDate() + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const dayName = dayNames[i];
    const isWeekend = i >= 4; // Fri, Sat, Sun

    const dayCalendar = calendarContext?.[dateStr];
    const hasDiningOutEvent = !!dayCalendar?.hasDiningOut;
    const isBusyEvening = !!dayCalendar?.isBusyEvening;

    const dayMeals: { mealType: string; recipeId: string; recipeTitle: string; reason?: string; isDiningOut?: boolean; diningOutPlace?: string }[] = [];

    selectedMealTypes.forEach((mealType) => {
      // Auto-omit dinner if Google Calendar event is detected and option enabled
      if (mealType === "Dinner" && hasDiningOutEvent && calendarOptions?.autoOmitDiningOut !== false) {
        const diningName = dayCalendar?.diningEvents?.[0] || dayCalendar?.diningOutEvents?.[0]?.summary || "Restaurant Dining Out";
        dayMeals.push({
          mealType: "Dinner",
          recipeId: "dining_out",
          recipeTitle: `Dining Out (${diningName})`,
          isDiningOut: true,
          diningOutPlace: diningName,
          reason: `Auto-reserved for Google Calendar scheduled event: "${diningName}"`,
        });
        return;
      }

      // Auto-suggest dining out / takeout on busy evenings if setting is enabled
      const shouldSuggestEatOutOnBusy = calendarOptions?.suggestEatOutOnPacked || 
        calendarOptions?.diningOutBalance === 'busy_nights' || 
        calendarOptions?.diningOutBalance === 'balanced' || 
        calendarOptions?.diningOutBalance === 'frequent';

      if (mealType === "Dinner" && isBusyEvening && shouldSuggestEatOutOnBusy) {
        const busySummary = dayCalendar?.busyEvents?.[0] || dayCalendar?.busyEveningEvents?.[0]?.summary || "Packed schedule";
        dayMeals.push({
          mealType: "Dinner",
          recipeId: "dining_out",
          recipeTitle: "Dining Out / Takeout (Busy Night)",
          isDiningOut: true,
          diningOutPlace: "Takeout / Local Favorite",
          reason: `Take the night off cooking! Automated dinner relief for packed evening (${busySummary}).`,
        });
        return;
      }

      let pick: any;
      let reason = "";

      if (varietyLevel === 1 && batchPicksByMealType[mealType]?.length) {
        const batchList = batchPicksByMealType[mealType];
        const pickIndex = (i < 3 || i === 6) ? 0 : (batchList.length > 1 ? 1 : 0);
        pick = batchList[pickIndex] || batchList[0];
        reason = i === 0 || i === 3
          ? `Batch-cooked ${season} staple to save weekday time & effort`
          : `Planned repeat / batch portion of ${pick.title || "batch dish"}`;
      } else if (varietyLevel === 2 && batchPicksByMealType[mealType]?.length) {
        const batchList = batchPicksByMealType[mealType];
        const pickIndex = i % batchList.length;
        pick = batchList[pickIndex] || batchList[0];
        reason = `Familiar staple (${dayName} routine) paired with ${season} flavors`;
      } else {
        let candidates = categorized[mealType] || [];
        if (candidates.length === 0) {
          candidates = recipes;
        }

        // If evening is busy and quick option enabled, favor quickest recipes (<= 25m)
        if (mealType === "Dinner" && isBusyEvening && calendarOptions?.prioritizeQuickOnBusy !== false) {
          const quickPool = candidates.filter((r) => (r.estimatedTime || 30) <= 25 && !usedRecipeIds.has(r.id));
          if (quickPool.length > 0) {
            pick = quickPool[Math.floor(Math.random() * quickPool.length)];
            reason = `Fast prep (~${pick.estimatedTime || 20}m) calibrated for busy evening schedule (${dayCalendar?.busyEvents?.[0] || "calendar events"})`;
          }
        }

        if (!pick) {
          // When variety is high (Level 4/5), actively rotate away from previously used protein group
          if (varietyLevel >= 4) {
            const prevProtein = lastUsedProtein[mealType];
            const unusedPool = candidates.filter((r) => !usedRecipeIds.has(r.id));
            const diffProteinPool = unusedPool.filter((r) => getProteinGroup(r) !== prevProtein);
            
            if (diffProteinPool.length > 0) {
              pick = diffProteinPool[Math.floor(Math.random() * diffProteinPool.length)];
            } else if (unusedPool.length > 0) {
              pick = unusedPool[Math.floor(Math.random() * unusedPool.length)];
            } else {
              pick = candidates[Math.floor(Math.random() * candidates.length)];
            }
          } else {
            pick = candidates.find((r) => !usedRecipeIds.has(r.id));
            if (!pick) {
              pick = candidates[Math.floor(Math.random() * candidates.length)];
            }
          }
        }

        if (pick && pick.id) {
          usedRecipeIds.add(pick.id);
          lastUsedProtein[mealType] = getProteinGroup(pick);
        }

        if (!reason) {
          if (varietyLevel >= 4) {
            const prot = getProteinGroup(pick);
            const protLabel = prot !== "other" ? `${prot.charAt(0).toUpperCase() + prot.slice(1)} rotation` : "Distinct flavor profile";
            reason = isWeekend
              ? `Culinary exploration: ${protLabel} celebration matching ${season} produce`
              : `${protLabel} (~${pick?.estimatedTime || 30}m) for balanced weekly variety`;
          } else {
            reason = isWeekend
              ? `Cozy weekend favorite matching ${season} flavor profiles`
              : `Quick weekday prep (~${pick?.estimatedTime || 30} mins) for smooth ${dayName} pacing`;
          }
        }
      }

      if (pick) {
        dayMeals.push({
          mealType,
          recipeId: pick.id || `rec_${Math.random().toString(36).substring(2, 7)}`,
          recipeTitle: pick.title || "Wholesome Seasonal Dish",
          reason,
        });
      }
    });

    daysMap[dateStr] = dayMeals;
  }

  const varietyLabels: { [k: number]: string } = {
    1: "Batch-Cooked & High Consistency",
    2: "Familiar Routine & Staples",
    3: "Balanced Curation",
    4: "Broad Flavor Diversity",
    5: "Maximum Culinary Exploration"
  };

  return {
    seasonalTheme: `${season} ${varietyLabels[varietyLevel] || "Curated"} Plan (${monthName})`,
    trendHighlights: varietyLevel <= 2 
      ? `Streamlined for ease and consistency with planned batch recipes and reliable staples, calibrated for ${monthName}.`
      : `Carefully balanced for ${monthName} with vibrant variety, distinct daily flavor profiles, and smart pacing.`,
    days: daysMap,
  };
}

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
    category: { type: Type.STRING, description: "One of: Breakfast, Lunch, Dinner, Dessert, Snack, Drink, Other" },
    estimatedTime: { type: Type.NUMBER, description: "The estimated total time to make this recipe in minutes" },
  },
  required: ["title", "ingredients", "instructions", "category"],
};

const leftoverRemixSchema = {
  type: Type.OBJECT,
  properties: {
    remixes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          remixStyle: { type: Type.STRING },
          description: { type: Type.STRING },
          estimatedTime: { type: Type.NUMBER },
          category: { type: Type.STRING },
          leftoversUtilized: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          pantryItemsNeeded: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          instructions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          proTips: { type: Type.STRING },
        },
        required: [
          "id",
          "title",
          "remixStyle",
          "description",
          "estimatedTime",
          "category",
          "leftoversUtilized",
          "pantryItemsNeeded",
          "ingredients",
          "instructions",
        ],
      },
    },
  },
  required: ["remixes"],
};

// Smart fallback recipe generator when AI services are overloaded
function generateSmartFallbackRecipe(category: string = "Dinner", details: string = ""): any {
  const cat = category || "Dinner";
  const detailStr = details.trim();
  const title = detailStr 
    ? (detailStr.length < 35 ? `Chef's Artisanal ${detailStr.charAt(0).toUpperCase() + detailStr.slice(1)}` : `Chef's Special ${cat}`)
    : `Artisanal Fresh ${cat}`;

  if (cat === "Breakfast") {
    return {
      title: detailStr ? `Sunrise ${detailStr}` : "Sun-Dried Tomato & Herb Whipped Scramble",
      ingredients: [
        "4 large organic eggs",
        "2 tbsp whole milk or cream",
        "1 tbsp salted butter",
        "2 tbsp sun-dried tomatoes (chopped)",
        "1 tbsp fresh chives or basil",
        "Salt and cracked black pepper to taste",
        "Toasted sourdough or brioche slices"
      ],
      instructions: [
        "In a bowl, whisk eggs with milk, a pinch of salt, and freshly cracked black pepper until airy.",
        "Melt butter in a non-stick skillet over gentle medium-low heat.",
        "Pour in eggs and let set slightly for 20 seconds, then fold gently with a silicone spatula to create velvety ribbons.",
        "Fold in sun-dried tomatoes and fresh herbs just before taking off heat.",
        "Serve immediately warm over toasted sourdough."
      ],
      category: "Breakfast",
      estimatedTime: 12
    };
  }

  if (cat === "Dessert") {
    return {
      title: detailStr ? `Rustic ${detailStr}` : "Warm Brown Butter & Cinnamon Berry Crisp",
      ingredients: [
        "3 cups mixed berries (fresh or frozen)",
        "1/3 cup rolled oats",
        "1/3 cup all-purpose flour or almond flour",
        "3 tbsp brown sugar or maple syrup",
        "3 tbsp unsalted butter (melted until golden brown)",
        "1/2 tsp ground cinnamon",
        "Pinch of sea salt",
        "Vanilla bean ice cream for serving"
      ],
      instructions: [
        "Preheat oven to 375°F (190°C).",
        "Toss berries in a baking dish with 1 tablespoon of sugar and a squeeze of fresh lemon juice.",
        "In a small bowl, mix oats, flour, remaining brown sugar, cinnamon, salt, and browned melted butter until crumbly.",
        "Scatter the golden crumble topping evenly over the berries.",
        "Bake for 22–25 minutes until the fruit is bubbling and the oat crust is deep golden.",
        "Serve warm with a scoop of vanilla ice cream."
      ],
      category: "Dessert",
      estimatedTime: 25
    };
  }

  return {
    title: title,
    ingredients: [
      "1 lb main protein or wholesome vegetables (chopped)",
      "2 tbsp extra virgin olive oil",
      "3 cloves garlic (minced)",
      "1 medium shallot or yellow onion (finely diced)",
      "1 cup seasonal greens or crisp veggies",
      "1/2 cup vegetable or chicken broth",
      "1 tbsp fresh herbs (rosemary, thyme, or basil)",
      "1/2 fresh lemon (juiced)",
      "Flaky sea salt and freshly ground black pepper"
    ],
    instructions: [
      "Heat olive oil in a heavy stainless or cast-iron skillet over medium-high heat.",
      "Add garlic and shallots, sautéing for 1–2 minutes until golden and fragrant.",
      "Add the main ingredients, seasoning well with salt, pepper, and herbs. Sear undisturbed for 4 minutes to achieve caramelization.",
      "Deglaze the pan with broth and fresh lemon juice, scraping up the flavorful browned bits.",
      "Toss in the seasonal greens and simmer gently for 3–5 minutes until tender and glossy.",
      "Garnish with fresh herbs and serve hot alongside your favorite grain or crusty bread."
    ],
    category: cat,
    estimatedTime: 25
  };
}
function generateSmartFallbackRemixes(
  leftoverItems: Array<{ name: string; notes?: string }>,
  customIngredients?: string
) {
  const allLeftoverNames = [
    ...leftoverItems.map((item) => item.name),
    ...(customIngredients ? customIngredients.split(",").map((s) => s.trim()).filter(Boolean) : []),
  ];

  const primaryLeftover = allLeftoverNames[0] || "Available Leftovers";
  const secondaryLeftover = allLeftoverNames[1] || "Pantry Staples";

  return {
    remixes: [
      {
        id: "fallback-remix-1",
        title: `Crispy Skillet Remix: ${primaryLeftover} Hash`,
        remixStyle: "15-Min Sizzling Skillet",
        description: `Breathes instant life into ${primaryLeftover} by searing it in a hot skillet with pantry aromatics and a crispy fried egg crown.`,
        estimatedTime: 15,
        category: "Dinner",
        leftoversUtilized: allLeftoverNames.slice(0, 3),
        pantryItemsNeeded: ["Olive Oil or Butter", "2 Large Eggs", "Salt & Black Pepper", "Garlic Powder", "Hot Sauce or Salsa"],
        ingredients: [
          `2 cups leftover ${primaryLeftover}`,
          ...(secondaryLeftover !== "Pantry Staples" ? [`1 cup ${secondaryLeftover}`] : []),
          "2 large eggs",
          "1 tbsp butter or olive oil",
          "1/2 tsp garlic powder & smoked paprika",
          "Fresh herbs, hot sauce, or sliced scallions for serving"
        ],
        instructions: [
          "Heat a heavy skillet (cast iron preferred) over medium-high heat with 1 tbsp butter or oil.",
          `Add ${primaryLeftover}${secondaryLeftover !== "Pantry Staples" ? ` and ${secondaryLeftover}` : ""}, pressing down firmly with a spatula to form a golden crispy crust for 3-4 minutes.`,
          "Make two small wells in the center of the skillet and crack in the eggs.",
          "Cover with a lid for 2 minutes until egg whites are set and yolks remain jammy.",
          "Season with salt, black pepper, and smoked paprika. Drizzle with hot sauce and serve straight from the skillet."
        ],
        proTips: "Don't stir constantly—letting the leftovers sit undisturbed on high heat creates caramelized, crispy golden edges!"
      },
      {
        id: "fallback-remix-2",
        title: `Cozy ${primaryLeftover} Flatbread Melt`,
        remixStyle: "Crispy Melt / Flatbread",
        description: `Layers ${primaryLeftover} with melted cheese between toasted tortillas or flatbreads for an ultra-fast, comforting meal.`,
        estimatedTime: 12,
        category: "Lunch",
        leftoversUtilized: allLeftoverNames.slice(0, 2),
        pantryItemsNeeded: ["Flour Tortillas or Pita", "Shredded Cheese (Cheddar or Mozzarella)", "Butter", "Sour Cream or Dip"],
        ingredients: [
          `1.5 cups shredded or chopped ${primaryLeftover}`,
          "2 large flour tortillas or flatbreads",
          "1 cup shredded cheese of choice",
          "1 tbsp butter or cooking spray",
          "Salsa, sour cream, or guacamole for dipping"
        ],
        instructions: [
          "Warm a non-stick skillet over medium heat.",
          `Place one tortilla flat, layer half the cheese, distribute ${primaryLeftover} evenly, and top with remaining cheese and the second tortilla.`,
          "Cook for 3-4 minutes until the bottom tortilla is deep golden and crisp.",
          "Carefully flip and cook the other side for another 2-3 minutes until cheese is fully melted and bubbling.",
          "Slice into wedges and serve with salsa and cool sour cream."
        ],
        proTips: "Cheese on both bottom and top acts as culinary glue to keep your quesadilla tightly sealed."
      },
      {
        id: "fallback-remix-3",
        title: `Vibrant ${primaryLeftover} Grain & Herb Power Bowl`,
        remixStyle: "Warm Grain Bowl",
        description: `A nourishing bowl combining warm ${primaryLeftover} with crisp greens, pantry seeds, and a zesty lemon-olive oil dressing.`,
        estimatedTime: 10,
        category: "Lunch",
        leftoversUtilized: allLeftoverNames.slice(0, 3),
        pantryItemsNeeded: ["Olive Oil", "Lemon Juice or Vinegar", "Dijon Mustard", "Pantry Nuts or Seeds", "Mixed Greens"],
        ingredients: [
          `1 to 2 cups leftover ${primaryLeftover}`,
          "2 large handfuls salad greens or shredded cabbage",
          "2 tbsp extra virgin olive oil",
          "1 tbsp fresh lemon juice or cider vinegar",
          "1 tsp honey or maple syrup",
          "2 tbsp toasted seeds, nuts, or crumbled feta"
        ],
        instructions: [
          `Gently warm the ${primaryLeftover} in a skillet or microwave for 60 seconds until fragrant.`,
          "In a small bowl or jar, whisk together olive oil, lemon juice, honey, salt, and pepper.",
          "Toss the fresh greens with half the vinaigrette in a serving bowl.",
          `Top with the warmed ${primaryLeftover}, sprinkle with toasted seeds or nuts, and drizzle remaining vinaigrette over the top.`
        ],
        proTips: "Contrast in temperatures (warm protein over cool crisp greens) makes leftover bowls feel gourmet."
      }
    ]
  };
}

const aiMealPlanSchema = {
  type: Type.OBJECT,
  properties: {
    seasonalTheme: {
      type: Type.STRING,
      description: "A short 1-sentence captivating theme describing the seasonal and culinary direction of this week's plan.",
    },
    trendHighlights: {
      type: Type.STRING,
      description: "2-3 sentences explaining how this plan incorporates in-season ingredients and modern food trends.",
    },
    plan: {
      type: Type.ARRAY,
      description: "The 7-day meal plan assignments.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM-DD format date" },
          dayName: { type: Type.STRING, description: "Monday, Tuesday, etc." },
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mealType: { type: Type.STRING, description: "Breakfast, Lunch, Dinner, Snack, or Dessert" },
                recipeId: { type: Type.STRING, description: "The EXACT recipe ID chosen from the user's available recipes, or 'dining_out' if dining out" },
                recipeTitle: { type: Type.STRING, description: "The title of the chosen recipe or dining out placeholder" },
                reason: { type: Type.STRING, description: "Short explanation of why this recipe fits this day/slot" },
                isDiningOut: { type: Type.BOOLEAN, description: "True if this meal slot is reserved for scheduled dining out or restaurant meal" },
                diningOutPlace: { type: Type.STRING, description: "Restaurant or social event name if dining out" },
              },
              required: ["mealType", "recipeId", "recipeTitle"],
            },
          },
        },
        required: ["date", "dayName", "meals"],
      },
    },
  },
  required: ["seasonalTheme", "trendHighlights", "plan"],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth client ID endpoint
  app.get("/api/auth/google/client-id", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "465204536443-e0to8keafksl66fs2vahbe8cqi6la6bd.apps.googleusercontent.com";
    res.json({ clientId });
  });

  // Extract Recipe from URL
  app.post("/api/gemini/extract-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Please enter a valid recipe URL." });
      }

      let normalizedUrl = "";
      try {
        normalizedUrl = normalizeRecipeUrl(url);
      } catch (err: any) {
        return res.status(400).json({ error: err?.message || "Please enter a valid URL starting with http:// or https://" });
      }

      console.log(`[Extract URL] Processing URL: ${normalizedUrl}`);

      // 1. Direct Web Fetch & Schema.org JSON-LD Extraction (Fast, reliable, and preserves Gemini API quota)
      let html = "";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const fetchRes = await fetch(normalizedUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        clearTimeout(timeoutId);
        if (fetchRes.ok) {
          html = await fetchRes.text();
        } else {
          console.warn(`[Extract URL] Direct fetch returned status ${fetchRes.status}`);
        }
      } catch (fetchErr: any) {
        console.warn(`[Extract URL] Direct fetch notice: ${fetchErr?.message || fetchErr}`);
      }

      // If HTML was retrieved, parse Schema.org JSON-LD & structured markup
      if (html) {
        const directRecipe = extractRecipeFromHtml(html, normalizedUrl);
        if (directRecipe && directRecipe.ingredients.length > 0 && directRecipe.instructions.length > 0) {
          console.log(`[Extract URL] Successfully extracted recipe "${directRecipe.title}" directly from JSON-LD/HTML!`);
          return res.json(directRecipe);
        }
      }

      // 2. If direct extraction didn't yield a complete recipe or fetch was blocked, try Gemini
      const cleanedHtmlText = html
        ? html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 10000)
        : "";

      const contents = [
        { text: `Extract the full recipe from this URL: ${normalizedUrl}${cleanedHtmlText ? `\n\nPage text excerpt:\n${cleanedHtmlText}` : ""}` },
        {
          text: `Extract the following recipe fields in valid JSON:
- title: The name of the recipe
- ingredients: An array of strings, each being one ingredient with measurement
- instructions: An array of strings, each being one sequential instruction step
- category: One of [Breakfast, Lunch, Dinner, Dessert, Snack, Drink, Other]
- estimatedTime: Estimated total preparation/cooking time in minutes (number)

Extract only real recipe information. Ignore ads, social links, and author notes.`,
        },
      ];

      try {
        const ai = getGenAI();
        const config: any = {
          responseMimeType: "application/json",
          responseSchema: recipeSchema,
        };
        // Use googleSearch tool if direct HTML could not be fetched
        if (!cleanedHtmlText) {
          config.tools = [{ googleSearch: {} }];
        }

        const response = await generateContentWithFallback(ai, {
          contents,
          config,
        }, ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]);

        const text = response.text;
        if (text && text.trim() !== "{}" && text.trim() !== "[]") {
          const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed.title) {
            return res.json({ ...parsed, sourceUrl: normalizedUrl });
          }
        }
      } catch (aiErr: any) {
        console.warn("[Extract URL] AI extraction attempt failed:", aiErr?.message || aiErr);
      }

      // 3. Fallback: If AI call failed (e.g. quota limit), check if we have any partial recipe from HTML
      if (html) {
        const partialRecipe = extractRecipeFromHtml(html, normalizedUrl);
        if (partialRecipe && (partialRecipe.title || partialRecipe.ingredients.length > 0)) {
          console.log(`[Extract URL] Returning partial recipe from HTML metadata: "${partialRecipe.title}"`);
          return res.json(partialRecipe);
        }
      }

      return res.status(422).json({
        error: "Could not extract recipe details from this webpage. Please check the URL or add the recipe details manually.",
      });
    } catch (error: any) {
      console.error("Error in extract-url endpoint:", error);
      const isUnavailable = error?.status === 503 || (error?.message && error.message.includes("503"));
      const isQuota = error?.status === 429 || (error?.message && (error.message.includes("429") || error.message.includes("RESOURCE_EXHAUSTED")));
      
      let message = error.message || "Failed to extract recipe from URL.";
      let statusCode = 500;
      if (isQuota) {
        statusCode = 429;
        message = "Recipe AI extraction quota is temporarily reached. You can add this recipe manually, or try again shortly.";
      } else if (isUnavailable) {
        statusCode = 503;
        message = "The service is temporarily busy. Please wait a moment and retry.";
      }

      return res.status(statusCode).json({ error: message });
    }
  });

  // Generate recipe by category and details
  app.post("/api/gemini/generate-recipe", async (req, res) => {
    try {
      const { category, details } = req.body;
      const prompt = `Act as a professional chef. Generate a high-quality, delicious recipe for a ${category || "Dinner"}. 
${details ? `The user has requested the following specific details or ingredients: ${details}` : ""}
Please provide a creative title, a list of ingredients with measurements, estimated preparation time, and step-by-step instructions.`;

      const ai = getGenAI();
      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: recipeSchema,
        },
      });

      const text = response.text;
      if (!text) {
        return res.json(generateSmartFallbackRecipe(category, details));
      }
      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
      return res.json(JSON.parse(jsonStr));
    } catch (error: any) {
      console.warn("AI recipe generation failed; using chef-curated fallback:", error?.message || error);
      const fallbackRecipe = generateSmartFallbackRecipe(req.body?.category, req.body?.details);
      return res.json(fallbackRecipe);
    }
  });

  // Generate Weekly AI Meal Plan
  app.post("/api/gemini/generate-meal-plan", async (req, res) => {
    let season = "Summer";
    let monthName = "August";
    let startDate: Date;
    let selectedMealTypes: string[] = ["Dinner"];
    let recipesList: any[] = [];
    let weekStartDateStr = "";
    let calendarContext: any = null;
    let calendarOptions: any = null;

    let varietyLevel = 3;
    try {
      const { recipes, weekStartDate, selectedMealTypes: mealTypes, preferences, householdProfile, calendarContext: calCtx, calendarOptions: calOpts } = req.body;
      recipesList = recipes || [];
      selectedMealTypes = mealTypes || ["Dinner"];
      weekStartDateStr = weekStartDate;
      calendarContext = calCtx || null;
      calendarOptions = calOpts || null;
      varietyLevel = typeof preferences?.varietyLevel === "number" ? Math.min(Math.max(preferences.varietyLevel, 1), 5) : 3;

      if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
        return res.status(400).json({ error: "No recipes provided." });
      }
      if (!selectedMealTypes || !Array.isArray(selectedMealTypes) || selectedMealTypes.length === 0) {
        return res.status(400).json({ error: "No meal types selected." });
      }

      startDate = weekStartDate ? new Date(weekStartDate + "T00:00:00") : new Date();
      if (isNaN(startDate.getTime())) {
        startDate = new Date();
      }
      const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const weekDates: { dateStr: string; dayName: string; isWeekend: boolean }[] = [];

      for (let i = 0; i < 7; i++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + i);
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;
        const dayOfWeek = cur.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayName = dayNames[i];
        weekDates.push({ dateStr, dayName, isWeekend });
      }

      monthName = startDate.toLocaleString("en-US", { month: "long" });
      const year = startDate.getFullYear();
      const monthNum = startDate.getMonth();

      let seasonalProduce = "heirloom tomatoes, corn, fresh basil, zucchini, berries, peaches, peppers, grilling";
      if (monthNum >= 2 && monthNum <= 4) {
        season = "Spring";
        seasonalProduce = "asparagus, peas, radishes, artichokes, fresh herbs, strawberries, tender greens, lemon";
      } else if (monthNum >= 5 && monthNum <= 7) {
        season = "Summer";
        seasonalProduce = "tomatoes, sweet corn, zucchini, eggplant, bell peppers, stone fruits, berries, cucumbers, watermelon";
      } else if (monthNum >= 8 && monthNum <= 10) {
        season = "Autumn / Fall";
        seasonalProduce = "butternut squash, pumpkin, apples, pears, sweet potatoes, wild mushrooms, Brussels sprouts, sage, rosemary";
      } else {
        season = "Winter";
        seasonalProduce = "citrus (blood orange, grapefruits), root vegetables, kale, cabbage, braised dishes, warm warming spices";
      }

      // Variety vs Consistency specific prompt instructions
      let varietyInstructions = "";
      if (varietyLevel === 1) {
        varietyInstructions = `
VARIETY VS CONSISTENCY STRATEGY: MAXIMUM CONSISTENCY & BATCH PREP (Level 1 / 5)
- The user has explicitly selected MAXIMUM CONSISTENCY & BATCH COOKING.
- Select only 2 to 3 core recipes for the entire week and repeat them intentionally across multiple days (e.g. Batch cook on Monday & eat Mon/Tue/Wed; batch cook on Thursday & eat Thu/Fri/Sat).
- This minimizes kitchen time, simplifies grocery shopping, and reuses staples.
- In each meal reason, mention batch cooking or planned leftovers.`;
      } else if (varietyLevel === 2) {
        varietyInstructions = `
VARIETY VS CONSISTENCY STRATEGY: FAMILIAR ROUTINE & LIGHT REPEATS (Level 2 / 5)
- The user prefers a comforting, predictable routine.
- Select 3 to 4 recipes for the 7 days, allowing 1-2 intentional repeats or crossover lunches to keep cooking streamlined.`;
      } else if (varietyLevel === 3) {
        varietyInstructions = `
VARIETY VS CONSISTENCY STRATEGY: BALANCED MIX (Level 3 / 5 - Golden Balance)
- Provide a balanced mix of familiar staples and fresh weekly variety.
- Avoid repeating the exact same dinner recipe on consecutive days.`;
      } else if (varietyLevel === 4) {
        varietyInstructions = `
VARIETY VS CONSISTENCY STRATEGY: BROAD VARIETY & DIVERSE FLAVORS (Level 4 / 5)
- Maximize culinary diversity. Avoid repeats across the week.
- PROTEIN & CUISINE DIVERSITY: Strictly rotate across different primary protein types (e.g., alternate poultry, beef/pork, seafood/fish, vegetarian/plant-based, pasta/grains) across the 7 days. Do NOT pick the same primary protein (e.g., multiple chicken dinners) on consecutive days.
- Rotate through distinct cuisine styles (e.g., Mediterranean, Asian, Mexican, Italian, American).`;
      } else {
        varietyInstructions = `
VARIETY VS CONSISTENCY STRATEGY: MAXIMUM EXPLORATION & 100% UNIQUE MEALS (Level 5 / 5)
- STRICT REQUIREMENT: Every single day and meal slot MUST have a completely UNIQUE recipe with ZERO repetition across the entire week.
- MANDATORY PROTEIN DIVERSITY: Do NOT populate the week with the same primary protein (e.g., NEVER return all chicken, all pasta, or all beef recipes). You MUST actively diversify and alternate between different main protein groups across the 7 days (e.g., 1-2 poultry, 1-2 seafood/fish, 1-2 beef/pork, 1-2 vegetarian/beans/tofu, grain bowls) unless the user's catalog strictly lacks those options.
- MANDATORY CUISINE VARIETY: Explore completely different culinary styles, preparation techniques, and flavor profiles (e.g. grilled, stir-fry, braised, roasted, fresh salads).`;
      }

      // Compile household profile guidance
      let profileGuidelines = "";
      if (householdProfile) {
        const allAppliances = [
          ...(householdProfile.appliances || []),
          ...(householdProfile.customAppliances ? householdProfile.customAppliances.split(",").map((s: string) => s.trim()).filter(Boolean) : [])
        ];
        const allDietary = [
          ...(householdProfile.dietaryRestrictions || []),
          ...(householdProfile.customDietaryRestrictions ? householdProfile.customDietaryRestrictions.split(",").map((s: string) => s.trim()).filter(Boolean) : [])
        ];
        const allDislikes = [
          ...(householdProfile.dislikedIngredients || []),
          ...(householdProfile.customDislikedIngredients ? householdProfile.customDislikedIngredients.split(",").map((s: string) => s.trim()).filter(Boolean) : [])
        ];

        const diningBalance = householdProfile.diningOutBalance || (householdProfile.suggestDiningOutOnBusy ? "busy_nights" : "always_cook");
        let diningGuidelines = "";
        if (diningBalance === "busy_nights" || householdProfile.suggestDiningOutOnBusy || calendarOptions?.suggestEatOutOnPacked) {
          diningGuidelines = `- Dining Out & Takeout Balancing Mode: "Auto-Relief on Busy Evenings" (ACTIVE). Whenever an evening has busy calendar events or schedule pressure, do NOT assign a home-cooked dinner. Instead, suggest takeout or eating out: set isDiningOut=true, recipeId="dining_out", recipeTitle="Takeout / Dining Out (Busy Night)", diningOutPlace="${householdProfile.diningOutCustomNotes || "Takeout / Favorite Restaurant"}", reason="Auto-suggested for busy schedule to save cooking effort."`;
        } else if (diningBalance === "balanced") {
          const prefDays = householdProfile.preferredDiningOutDays?.length ? householdProfile.preferredDiningOutDays.join(", ") : "Friday / Weekend";
          diningGuidelines = `- Dining Out & Takeout Balancing Mode: "Weekly Balanced Rhythm" (ACTIVE). Balance 1-2 meals across the week with dining out or takeout (especially on busy evenings or preferred days: ${prefDays}). Mark those slots with isDiningOut=true, recipeId="dining_out", recipeTitle="Takeout / Dining Out Night", diningOutPlace="${householdProfile.diningOutCustomNotes || "Takeout / Local Favorite"}".`;
        } else if (diningBalance === "frequent") {
          const prefDays = householdProfile.preferredDiningOutDays?.length ? householdProfile.preferredDiningOutDays.join(", ") : "Friday, Saturday, or busy nights";
          diningGuidelines = `- Dining Out & Takeout Balancing Mode: "Frequent Takeout / Low Effort" (ACTIVE). Incorporate 2-3 dining out or takeout meals per week (targeting ${prefDays}). Mark those slots with isDiningOut=true, recipeId="dining_out".`;
        }

        profileGuidelines = `
HOUSEHOLD KITCHEN & DIETARY PROFILE (MANDATORY HOUSEHOLD CONSTRAINTS):
${allAppliances.length > 0 ? `- Kitchen Equipment Available: ${allAppliances.join(", ")} (favor cooking techniques matching this gear)` : ""}
${allDietary.length > 0 ? `- Dietary Restrictions: ${allDietary.join(", ")} (CRITICAL: Every selected recipe must comply)` : ""}
${allDislikes.length > 0 ? `- Disliked Ingredients: ${allDislikes.join(", ")} (CRITICAL: Avoid recipes containing these ingredients)` : ""}
${householdProfile.defaultServings ? `- Household Servings: ${householdProfile.defaultServings} people` : ""}
${householdProfile.notes ? `- Household Kitchen Notes: "${householdProfile.notes}"` : ""}
${diningGuidelines}
`;
      }

      // Compile Google Calendar insights & constraints
      let calendarGuidelines = "";
      if (calendarContext) {
        const calNotes: string[] = [];
        Object.entries(calendarContext).forEach(([dateKey, info]: [string, any]) => {
          if (info.hasDiningOut) {
            const diningTitle = info.diningEvents?.[0] || info.diningOutEvents?.[0]?.summary || "Social dining out";
            calNotes.push(`- ${info.dayName || dateKey} (${dateKey}): SCHEDULED DINING OUT ("${diningTitle}"). ${calendarOptions?.autoOmitDiningOut !== false ? `CRITICAL: Do NOT schedule a home-cooked dinner recipe. Mark as isDiningOut=true, recipeId="dining_out", recipeTitle="Dining Out (${diningTitle})", reason="Auto-reserved for calendar event: ${diningTitle}".` : `User has dining out planned.`}`);
          }
          if (info.isBusyEvening) {
            const busySummary = info.busyEvents?.slice(0, 2).join(", ") || info.busyEveningEvents?.map((e: any) => e.summary).slice(0, 2).join(", ") || "Busy evening activities";
            calNotes.push(`- ${info.dayName || dateKey} (${dateKey}): BUSY EVENING (${busySummary}). ${calendarOptions?.prioritizeQuickOnBusy !== false ? `Prioritize a fast 15-20 min quick recipe or effortless meal for Dinner.` : `Keep prep time reasonable.`}`);
          }
        });

        if (calNotes.length > 0) {
          calendarGuidelines = `
GOOGLE CALENDAR INTEGRATION & REAL-TIME SCHEDULE CONSTRAINTS:
${calNotes.join("\n")}
`;
        }
      }

      const recipeCatalog = recipes.map((r: any) => ({
        id: r.id || "",
        title: r.title,
        category: r.category,
        estimatedTime: r.estimatedTime || (r.instructions?.length ? r.instructions.length * 5 : 30),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients.slice(0, 12).join(", ") : "",
      }));

      const prompt = `You are a culinary curator and expert meal planner.
Your goal is to construct a balanced, 7-day meal plan for the week of ${weekStartDate} (${monthName} ${year}).

TARGET WEEK DATES:
${weekDates.map((w) => `- ${w.dayName} (${w.dateStr}) ${w.isWeekend ? "[Weekend]" : "[Weekday]"}`).join("\n")}

MEAL TYPES TO POPULATE FOR EACH DAY:
${selectedMealTypes.join(", ")}

SEASON & TREND CONTEXT:
- Current Season: ${season} (${monthName})
- In-Season Produce & Culinary Vibes: ${seasonalProduce}
- Current Culinary Trends: Focus on vibrant produce, balanced nutrition, Mediterranean/wholesome inspiration, high-satisfaction proteins, seasonal produce highlights, and smart pacing (quicker ~20-30 min meals on busy Monday-Thursday weekdays, cozy/entertaining meals on Friday-Sunday).
${varietyInstructions}
${profileGuidelines}
${calendarGuidelines}
${preferences?.customNote ? `- User Custom Note / Preference: "${preferences.customNote}"` : ""}

USER'S AVAILABLE RECIPES (You MUST ONLY pick from this catalog and return exact recipe IDs):
${JSON.stringify(recipeCatalog, null, 2)}

PLANNING INSTRUCTIONS:
1. For every day (${weekDates.map((w) => w.dateStr).join(", ")}), assign an appropriate recipe for each requested meal type (${selectedMealTypes.join(", ")}).
2. Prioritize recipes whose ingredients or styles naturally match the ${season} season and current culinary trends.
3. Strictly respect any dietary restrictions or disliked ingredients specified in the household profile.
4. Honor Google Calendar scheduling constraints (e.g. mark dining out on dates with restaurant plans, choose quick meals on busy evenings).
5. Match meal types logically.
6. Strictly adhere to the VARIETY VS CONSISTENCY STRATEGY specified above.
7. Provide a brief, inspiring reason for each meal assignment.
8. Provide an overarching 'seasonalTheme' and 2-3 sentences of 'trendHighlights'.`;

      const ai = getGenAI();
      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: aiMealPlanSchema,
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI model.");
      }

      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      const daysMap: { [dateStr: string]: { mealType: string; recipeId: string; recipeTitle: string; reason?: string; isDiningOut?: boolean; diningOutPlace?: string }[] } = {};
      if (Array.isArray(parsed.plan)) {
        parsed.plan.forEach((dayObj: any) => {
          if (dayObj.date && Array.isArray(dayObj.meals)) {
            daysMap[dayObj.date] = dayObj.meals.map((m: any) => ({
              mealType: m.mealType,
              recipeId: m.recipeId,
              recipeTitle: m.recipeTitle,
              reason: m.reason,
              isDiningOut: !!m.isDiningOut,
              diningOutPlace: m.diningOutPlace || (m.isDiningOut ? m.recipeTitle : undefined),
            }));
          }
        });
      }

      return res.json({
        seasonalTheme: parsed.seasonalTheme || `${season} Curated Meal Plan`,
        trendHighlights: parsed.trendHighlights || `Seasonal favorites and trending culinary highlights tailored for ${monthName}.`,
        days: daysMap,
      });
    } catch (error: any) {
      console.warn("AI generation failed or model high demand; falling back to smart seasonal optimizer:", error?.message || error);
      
      // If AI models are experiencing 503 high demand or temporary errors, seamlessly produce a smart recipe-balanced plan
      if (recipesList.length > 0) {
        const fallbackPlan = generateSmartFallbackMealPlan(
          recipesList,
          weekStartDateStr,
          selectedMealTypes,
          season,
          monthName,
          varietyLevel,
          calendarContext,
          calendarOptions
        );
        return res.json(fallbackPlan);
      }

      return res.status(500).json({ error: error?.message || "Failed to generate meal plan." });
    }
  });

  // Leftover Remix Engine endpoint
  app.post("/api/gemini/remix-leftovers", async (req, res) => {
    let leftoverItems: Array<{ name: string; cookedDate?: string; notes?: string }> = [];
    let customIngredients = "";

    try {
      const {
        leftoverItems: items = [],
        customIngredients: extra = "",
        preferences = {},
      } = req.body;

      leftoverItems = items;
      customIngredients = extra;

      if ((!leftoverItems || leftoverItems.length === 0) && !customIngredients.trim()) {
        return res.status(400).json({ error: "Please select or enter at least one leftover ingredient." });
      }

      const leftoversDesc = [
        ...leftoverItems.map((item) => `- ${item.name}${item.cookedDate ? ` (Cooked ${item.cookedDate})` : ""}${item.notes ? `: ${item.notes}` : ""}`),
        ...(customIngredients ? [`- Extra ingredients: ${customIngredients}`] : []),
      ].join("\n");

      const prompt = `You are an inventive, creative professional chef specializing in zero-food-waste kitchen remixing.
Transform the following available leftover ingredients and fridge items into 3 DISTINCT, mouthwatering, restaurant-quality meal remix recipes:

AVAILABLE LEFTOVERS & EXTRAS:
${leftoversDesc}

PANTRY ASSUMPTION:
Assume the home cook has standard pantry goods on hand:
- Cooking oils (olive oil, sesame oil, vegetable oil, butter)
- Seasonings (salt, black pepper, garlic powder, onion powder, smoked paprika, chili flakes, cumin, dried herbs)
- Aromatics (garlic, yellow onion, ginger, fresh lemons/limes)
- Staples (eggs, flour, soy sauce, hot sauce, mustard, honey/maple syrup, mayonnaise, vinegar, broth/water, basic tortillas or rice/pasta, shredded cheese)

PREFERENCES / CONSTRAINTS:
${preferences.quickOnly ? "- Focus on ultra-quick meals taking 20 minutes or less (skillets, melts, grain bowls)." : "- Provide a diverse mix of styles (e.g. 1 quick skillet/stir-fry, 1 cozy melt/quesadilla/flatbread, 1 hearty bowl or soup)."}
${preferences.style ? `- Preferred style / vibe: ${preferences.style}` : ""}

GUIDELINES:
1. Deliver exactly 3 distinct, creative remix proposals.
2. Give each a captivating title that sounds like a delicious menu item (NOT just "Leftover Chicken").
3. Assign a distinct 'remixStyle' (e.g. "15-Min Sizzling Skillet", "Crispy Melt & Dip", "Zesty Grain Bowl", "Cozy Rustic Soup").
4. Keep active cook time practical (10 to 30 mins).
5. Provide clear, step-by-step instructions and a practical "proTips" advice for making leftovers taste fresh and gourmet.
6. Clearly list which leftovers are utilized, and what pantry items are needed.`;

      const ai = getGenAI();
      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: leftoverRemixSchema,
          temperature: 0.4,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI model.");
      }

      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.remixes || !Array.isArray(parsed.remixes) || parsed.remixes.length === 0) {
        throw new Error("Invalid remix schema output.");
      }

      return res.json(parsed);
    } catch (error: any) {
      console.warn("AI Leftover Remix failed or experienced high load; using smart culinary fallback:", error?.message || error);
      
      const fallbackResult = generateSmartFallbackRemixes(leftoverItems, customIngredients);
      return res.json(fallbackResult);
    }
  });

  // Explicit 404 handler for unmatched /api requests so they never fall through to Vite HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // Global JSON error handler for API
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error("[Server Error]", err);
    res.status(err.status || 500).json({
      error: err?.message || "An internal server error occurred.",
    });
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
