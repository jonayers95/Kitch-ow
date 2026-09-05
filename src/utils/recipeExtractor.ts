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

const VALID_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Other'] as const;

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

export function cleanText(str: string): string {
  if (!str) return '';
  return decodeHtmlEntities(str).replace(/\s+/g, ' ').trim();
}

export function normalizeRecipeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please enter a valid recipe URL');
  }

  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) {
    throw new Error('Please enter a valid recipe URL');
  }

  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      throw new Error('Invalid URL format');
    }
    return parsed.toString();
  } catch {
    throw new Error('Please enter a valid recipe URL');
  }
}

export function parseIsoDurationToMinutes(duration: any): number | undefined {
  if (duration === undefined || duration === null) return undefined;
  if (typeof duration === 'number') {
    return duration > 0 ? Math.round(duration) : undefined;
  }

  const str = String(duration).trim();
  if (!str) return undefined;

  // Try ISO 8601 duration: P[n]Y[n]M[n]DT[n]H[n]M[n]S or PT1H30M
  const isoRegex = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i;
  const match = str.match(isoRegex);
  if (match) {
    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const totalMinutes = days * 24 * 60 + hours * 60 + minutes;
    return totalMinutes > 0 ? totalMinutes : undefined;
  }

  // Try natural language: e.g. "1 hr 15 mins", "45 minutes", "2 hours", "30 mins"
  let minutes = 0;
  let hasMatch = false;

  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|hrs|hours)/i);
  if (hrMatch) {
    minutes += Math.round(parseFloat(hrMatch[1]) * 60);
    hasMatch = true;
  }

  const minMatch = str.match(/(\d+)\s*(?:minute|min|mins|minutes)/i);
  if (minMatch) {
    minutes += parseInt(minMatch[1], 10);
    hasMatch = true;
  }

  if (hasMatch && minutes > 0) {
    return minutes;
  }

  // Plain number in string
  const plainNum = parseInt(str, 10);
  if (!isNaN(plainNum) && plainNum > 0 && plainNum < 1440) {
    return plainNum;
  }

  return undefined;
}

export function normalizeCategory(categoryStr?: any): string {
  if (!categoryStr) return 'Dinner';

  const raw = Array.isArray(categoryStr) ? categoryStr.join(' ') : String(categoryStr);
  const lower = raw.toLowerCase();

  if (lower.includes('breakfast') || lower.includes('brunch') || lower.includes('pancake') || lower.includes('waffle') || lower.includes('omelet') || lower.includes('cereal')) {
    return 'Breakfast';
  }
  if (lower.includes('dessert') || lower.includes('cookie') || lower.includes('cake') || lower.includes('sweet') || lower.includes('pie') || lower.includes('chocolate') || lower.includes('brownie')) {
    return 'Dessert';
  }
  if (lower.includes('drink') || lower.includes('beverage') || lower.includes('cocktail') || lower.includes('smoothie') || lower.includes('coffee') || lower.includes('tea')) {
    return 'Drink';
  }
  if (lower.includes('snack') || lower.includes('appetizer') || lower.includes('dip') || lower.includes('finger food')) {
    return 'Snack';
  }
  if (lower.includes('lunch') || lower.includes('sandwich') || lower.includes('salad') || lower.includes('wrap')) {
    return 'Lunch';
  }
  if (lower.includes('dinner') || lower.includes('main course') || lower.includes('entree') || lower.includes('main') || lower.includes('pasta') || lower.includes('stew') || lower.includes('roast')) {
    return 'Dinner';
  }

  return 'Dinner';
}

function extractImage(imageField: any): string | undefined {
  if (!imageField) return undefined;
  if (typeof imageField === 'string' && imageField.startsWith('http')) {
    return imageField;
  }
  if (Array.isArray(imageField)) {
    for (const item of imageField) {
      const url = extractImage(item);
      if (url) return url;
    }
  }
  if (typeof imageField === 'object' && imageField !== null) {
    if (typeof imageField.url === 'string') return imageField.url;
    if (typeof imageField.contentUrl === 'string') return imageField.contentUrl;
  }
  return undefined;
}

function extractInstructions(instructionsField: any): string[] {
  if (!instructionsField) return [];

  const results: string[] = [];

  const traverse = (item: any) => {
    if (!item) return;
    if (typeof item === 'string') {
      const text = cleanText(item);
      if (text.length > 3) {
        results.push(text);
      }
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(traverse);
      return;
    }

    if (typeof item === 'object') {
      // Check for HowToStep
      if (typeof item.text === 'string') {
        const text = cleanText(item.text);
        if (text.length > 3) results.push(text);
        return;
      }
      // Check for HowToSection or itemListElement
      if (Array.isArray(item.itemListElement)) {
        item.itemListElement.forEach(traverse);
        return;
      }
      // Or instructions property
      if (item.itemList) {
        traverse(item.itemList);
        return;
      }
    }
  };

  traverse(instructionsField);

  // If instruction steps came in as one big multi-line string or numbered list
  if (results.length === 1 && results[0].includes('\n')) {
    return results[0]
      .split('\n')
      .map(s => cleanText(s.replace(/^\d+[\.\)]\s*/, '')))
      .filter(s => s.length > 3);
  }

  return results.map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s.length > 3);
}

function extractIngredients(ingredientsField: any): string[] {
  if (!ingredientsField) return [];
  if (Array.isArray(ingredientsField)) {
    return ingredientsField
      .map(i => (typeof i === 'string' ? cleanText(i) : cleanText(i?.text || i?.name || '')))
      .filter(i => i.length > 1);
  }
  if (typeof ingredientsField === 'string') {
    return ingredientsField
      .split('\n')
      .map(cleanText)
      .filter(i => i.length > 1);
  }
  return [];
}

/**
 * Searches a parsed JSON-LD object or tree for a schema.org Recipe
 */
export function extractRecipeFromJsonLd(data: any): ExtractedRecipe | null {
  if (!data) return null;

  let candidateRecipe: any = null;

  const findRecipe = (node: any) => {
    if (!node || candidateRecipe) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        findRecipe(item);
        if (candidateRecipe) return;
      }
      return;
    }

    if (typeof node === 'object') {
      const type = node['@type'];
      const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
      if (isRecipe) {
        candidateRecipe = node;
        return;
      }

      // Check graph
      if (node['@graph']) {
        findRecipe(node['@graph']);
        if (candidateRecipe) return;
      }

      // Traverse children
      for (const key of Object.keys(node)) {
        if (typeof node[key] === 'object' && node[key] !== null) {
          findRecipe(node[key]);
          if (candidateRecipe) return;
        }
      }
    }
  };

  findRecipe(data);

  if (!candidateRecipe) return null;

  const title = cleanText(candidateRecipe.name || candidateRecipe.headline || '');
  const ingredients = extractIngredients(candidateRecipe.recipeIngredient || candidateRecipe.ingredients);
  const instructions = extractInstructions(candidateRecipe.recipeInstructions || candidateRecipe.instructions || candidateRecipe.step);

  if (!title && ingredients.length === 0 && instructions.length === 0) {
    return null;
  }

  const category = normalizeCategory(candidateRecipe.recipeCategory || candidateRecipe.category);
  const estimatedTime =
    parseIsoDurationToMinutes(candidateRecipe.totalTime) ||
    parseIsoDurationToMinutes(candidateRecipe.cookTime) ||
    parseIsoDurationToMinutes(candidateRecipe.prepTime);
  const imageUrl = extractImage(candidateRecipe.image);
  const description = cleanText(candidateRecipe.description || '');
  const recipeYield = candidateRecipe.recipeYield ? String(candidateRecipe.recipeYield) : undefined;

  return {
    title: title || 'Untitled Recipe',
    ingredients: ingredients.length > 0 ? ingredients : ['Ingredients not specified in recipe header'],
    instructions: instructions.length > 0 ? instructions : ['Follow directions on source webpage.'],
    category,
    estimatedTime: estimatedTime || 30,
    imageUrl,
    description,
    yield: recipeYield,
  };
}

/**
 * Extracts recipe metadata and content from raw HTML markup
 */
export function extractRecipeFromHtml(html: string, sourceUrl?: string): ExtractedRecipe | null {
  if (!html || typeof html !== 'string') return null;

  // 1. First priority: look for <script type="application/ld+json"> tags
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    const rawContent = match[1].trim();
    if (!rawContent) continue;
    try {
      const parsed = JSON.parse(rawContent);
      const recipe = extractRecipeFromJsonLd(parsed);
      if (recipe && (recipe.ingredients.length > 0 || recipe.instructions.length > 0)) {
        if (sourceUrl) recipe.sourceUrl = sourceUrl;
        return recipe;
      }
    } catch {
      // In case of slightly malformed JSON, try loose sanitization
      try {
        const sanitized = rawContent.replace(/[\u0000-\u001F]+/g, ' ');
        const parsed = JSON.parse(sanitized);
        const recipe = extractRecipeFromJsonLd(parsed);
        if (recipe) {
          if (sourceUrl) recipe.sourceUrl = sourceUrl;
          return recipe;
        }
      } catch {
        // Skip unparseable block
      }
    }
  }

  // 2. Fallback: Parse OpenGraph / Meta tags & semantic HTML elements
  let title = '';
  const ogTitleMatch = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    title = cleanText(ogTitleMatch[1]);
  }

  if (!title) {
    const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      title = cleanText(h1Match[1].replace(/<[^>]+>/g, ''));
    }
  }

  if (!title) {
    const titleTagMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch) {
      title = cleanText(titleTagMatch[1].split(/[|\-–]/)[0]);
    }
  }

  let imageUrl: string | undefined;
  const ogImageMatch = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImageMatch) {
    imageUrl = ogImageMatch[1].trim();
  }

  // Extract ingredients from HTML list items
  const ingredients: string[] = [];
  const ingSectionMatch = html.match(/(?:ingredients|what you['']ll need)[\s\S]{0,300}?(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
  if (ingSectionMatch) {
    const listHtml = ingSectionMatch[1];
    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(listHtml)) !== null) {
      const text = cleanText(liMatch[1].replace(/<[^>]+>/g, ''));
      if (text.length > 2 && !text.toLowerCase().includes('advertisement')) {
        ingredients.push(text);
      }
    }
  }

  // Extract instructions from HTML steps
  const instructions: string[] = [];
  const stepSectionMatch = html.match(/(?:instructions|directions|method|preparation)[\s\S]{0,300}?(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
  if (stepSectionMatch) {
    const listHtml = stepSectionMatch[1];
    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(listHtml)) !== null) {
      const text = cleanText(liMatch[1].replace(/<[^>]+>/g, ''));
      if (text.length > 3 && !text.toLowerCase().includes('advertisement')) {
        instructions.push(text);
      }
    }
  }

  if (!title && ingredients.length === 0 && instructions.length === 0) {
    return null;
  }

  return {
    title: title || 'Imported Recipe',
    ingredients: ingredients.length > 0 ? ingredients : ['Review recipe on source webpage'],
    instructions: instructions.length > 0 ? instructions : ['See instructions on original webpage'],
    category: normalizeCategory(title),
    estimatedTime: 30,
    imageUrl,
    sourceUrl,
  };
}
