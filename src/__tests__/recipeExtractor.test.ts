import { describe, it, expect } from 'vitest';
import {
  extractRecipeFromJsonLd,
  extractRecipeFromHtml,
  normalizeRecipeUrl,
  parseIsoDurationToMinutes,
} from '../utils/recipeExtractor';

describe('Recipe Extractor & Parser', () => {
  describe('normalizeRecipeUrl', () => {
    it('prepends https:// if protocol is missing', () => {
      expect(normalizeRecipeUrl('allrecipes.com/recipe/123/cookies')).toBe('https://allrecipes.com/recipe/123/cookies');
      expect(normalizeRecipeUrl('www.epicurious.com/recipes/pasta')).toBe('https://www.epicurious.com/recipes/pasta');
    });

    it('preserves existing http or https protocol', () => {
      expect(normalizeRecipeUrl('https://cooking.nytimes.com/recipes/123')).toBe('https://cooking.nytimes.com/recipes/123');
      expect(normalizeRecipeUrl('http://myrecipes.com/soup')).toBe('http://myrecipes.com/soup');
    });

    it('trims whitespace and surrounding quotes', () => {
      expect(normalizeRecipeUrl('  https://tasty.co/recipe/pie  ')).toBe('https://tasty.co/recipe/pie');
      expect(normalizeRecipeUrl('"https://tasty.co/recipe/pie"')).toBe('https://tasty.co/recipe/pie');
    });

    it('throws error on empty or invalid input', () => {
      expect(() => normalizeRecipeUrl('')).toThrow('Please enter a valid recipe URL');
      expect(() => normalizeRecipeUrl('   ')).toThrow('Please enter a valid recipe URL');
    });
  });

  describe('parseIsoDurationToMinutes', () => {
    it('parses ISO 8601 duration strings', () => {
      expect(parseIsoDurationToMinutes('PT30M')).toBe(30);
      expect(parseIsoDurationToMinutes('PT1H')).toBe(60);
      expect(parseIsoDurationToMinutes('PT1H15M')).toBe(75);
      expect(parseIsoDurationToMinutes('PT2H30M')).toBe(150);
      expect(parseIsoDurationToMinutes('P0DT0H45M')).toBe(45);
    });

    it('parses natural language strings or numbers', () => {
      expect(parseIsoDurationToMinutes('45 minutes')).toBe(45);
      expect(parseIsoDurationToMinutes('1 hr 15 mins')).toBe(75);
      expect(parseIsoDurationToMinutes('2 hours')).toBe(120);
      expect(parseIsoDurationToMinutes(25)).toBe(25);
    });

    it('returns undefined for invalid or missing values', () => {
      expect(parseIsoDurationToMinutes('')).toBeUndefined();
      expect(parseIsoDurationToMinutes(undefined)).toBeUndefined();
      expect(parseIsoDurationToMinutes(null)).toBeUndefined();
    });
  });

  describe('extractRecipeFromJsonLd', () => {
    it('extracts recipe from a standard single-object Schema.org JSON-LD', () => {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Classic Chocolate Chip Cookies',
        recipeIngredient: [
          '2 1/4 cups all-purpose flour',
          '1 tsp baking soda',
          '1 cup butter, softened',
          '2 cups semi-sweet chocolate chips'
        ],
        recipeInstructions: [
          'Preheat oven to 375 degrees F.',
          'Combine flour and baking soda in small bowl.',
          'Beat butter and sugars in large mixer bowl until creamy.',
          'Bake for 9 to 11 minutes until golden brown.'
        ],
        recipeCategory: 'Dessert',
        prepTime: 'PT15M',
        cookTime: 'PT10M',
        totalTime: 'PT25M',
        image: 'https://example.com/cookies.jpg'
      };

      const extracted = extractRecipeFromJsonLd(jsonLd);
      expect(extracted).not.toBeNull();
      expect(extracted?.title).toBe('Classic Chocolate Chip Cookies');
      expect(extracted?.ingredients).toHaveLength(4);
      expect(extracted?.instructions).toHaveLength(4);
      expect(extracted?.category).toBe('Dessert');
      expect(extracted?.estimatedTime).toBe(25);
      expect(extracted?.imageUrl).toBe('https://example.com/cookies.jpg');
    });

    it('extracts recipe from a @graph collection in JSON-LD', () => {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: 'Food Blog'
          },
          {
            '@type': 'Recipe',
            headline: 'Sheet Pan Lemon Herb Salmon',
            recipeIngredient: [
              '4 salmon fillets',
              '2 tbsp olive oil',
              '1 lemon, sliced',
              '2 cloves garlic, minced'
            ],
            recipeInstructions: [
              {
                '@type': 'HowToStep',
                text: 'Preheat oven to 400°F and line baking sheet with foil.'
              },
              {
                '@type': 'HowToStep',
                text: 'Arrange salmon fillets and brush with olive oil and lemon.'
              },
              {
                '@type': 'HowToStep',
                text: 'Roast for 12-15 minutes until flaky.'
              }
            ],
            recipeCategory: ['Dinner', 'Main Course'],
            totalTime: 'PT20M'
          }
        ]
      };

      const extracted = extractRecipeFromJsonLd(jsonLd);
      expect(extracted).not.toBeNull();
      expect(extracted?.title).toBe('Sheet Pan Lemon Herb Salmon');
      expect(extracted?.ingredients).toHaveLength(4);
      expect(extracted?.instructions).toHaveLength(3);
      expect(extracted?.instructions[0]).toBe('Preheat oven to 400°F and line baking sheet with foil.');
      expect(extracted?.category).toBe('Dinner');
      expect(extracted?.estimatedTime).toBe(20);
    });

    it('handles HowToSection grouping in recipeInstructions', () => {
      const jsonLd = {
        '@type': 'Recipe',
        name: 'Homemade Pizza',
        recipeIngredient: ['Dough', 'Tomato Sauce', 'Mozzarella'],
        recipeInstructions: [
          {
            '@type': 'HowToSection',
            name: 'Prepare the dough',
            itemListElement: [
              { '@type': 'HowToStep', text: 'Roll out the dough onto pizza stone.' }
            ]
          },
          {
            '@type': 'HowToSection',
            name: 'Toppings & Bake',
            itemListElement: [
              { '@type': 'HowToStep', text: 'Spread sauce and cheese evenly.' },
              { '@type': 'HowToStep', text: 'Bake at 500°F for 10 minutes.' }
            ]
          }
        ]
      };

      const extracted = extractRecipeFromJsonLd(jsonLd);
      expect(extracted).not.toBeNull();
      expect(extracted?.instructions).toEqual([
        'Roll out the dough onto pizza stone.',
        'Spread sauce and cheese evenly.',
        'Bake at 500°F for 10 minutes.'
      ]);
    });
  });

  describe('extractRecipeFromHtml', () => {
    it('extracts recipe embedded in <script type="application/ld+json"> tag', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Best Homemade Pancakes</title>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Recipe",
                "name": "Fluffy Buttermilk Pancakes",
                "recipeIngredient": [
                  "2 cups flour",
                  "2 tsp baking powder",
                  "2 cups buttermilk",
                  "2 eggs"
                ],
                "recipeInstructions": [
                  "Whisk dry ingredients in bowl.",
                  "Whisk wet ingredients and fold into dry.",
                  "Cook on greased griddle for 2-3 minutes per side."
                ],
                "recipeCategory": "Breakfast",
                "totalTime": "PT20M"
              }
            </script>
          </head>
          <body>
            <h1>Fluffy Buttermilk Pancakes</h1>
          </body>
        </html>
      `;

      const result = extractRecipeFromHtml(html, 'https://example.com/pancakes');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Fluffy Buttermilk Pancakes');
      expect(result?.ingredients).toHaveLength(4);
      expect(result?.instructions).toHaveLength(3);
      expect(result?.category).toBe('Breakfast');
      expect(result?.estimatedTime).toBe(20);
    });

    it('falls back to HTML structure and OpenGraph when JSON-LD is missing', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Crispy Air Fryer Chicken Wings" />
            <meta property="og:image" content="https://example.com/wings.jpg" />
          </head>
          <body>
            <h1>Crispy Air Fryer Chicken Wings</h1>
            <h2>Ingredients</h2>
            <ul class="recipe-ingredients">
              <li>2 lbs chicken wings, patted dry</li>
              <li>1 tbsp baking powder</li>
              <li>1 tsp garlic powder</li>
              <li>1/2 cup buffalo sauce</li>
            </ul>
            <h2>Directions</h2>
            <ol class="recipe-steps">
              <li>Toss wings with baking powder and seasonings.</li>
              <li>Air fry at 380°F for 20 minutes, flipping halfway.</li>
              <li>Increase heat to 400°F for 5 minutes until crispy.</li>
              <li>Toss with buffalo sauce and serve immediately.</li>
            </ol>
          </body>
        </html>
      `;

      const result = extractRecipeFromHtml(html, 'https://example.com/wings');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Crispy Air Fryer Chicken Wings');
      expect(result?.ingredients).toHaveLength(4);
      expect(result?.instructions).toHaveLength(4);
      expect(result?.imageUrl).toBe('https://example.com/wings.jpg');
    });
  });
});
