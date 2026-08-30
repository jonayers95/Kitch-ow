import { Recipe, Category } from '../types';

export const STOCK_RECIPES: Partial<Recipe>[] = [
  {
    title: "Chicken Kofta Kebabs (Middle Eastern-Inspired)",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://minimalistbaker.com/chicken-kofta-kebabs/",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb lean ground chicken",
      "1/2 medium red onion, finely grated or minced",
      "3 cloves garlic, minced",
      "1/3 cup fresh flat-leaf parsley, finely chopped",
      "2 tbsp fresh mint or cilantro, chopped",
      "1 tsp ground cumin",
      "1 tsp ground coriander",
      "1/2 tsp smoked paprika",
      "1/4 tsp ground cinnamon",
      "1/4 tsp cayenne pepper (optional)",
      "1 tsp kosher salt",
      "1/2 tsp freshly cracked black pepper",
      "1 tbsp olive oil",
      "Wooden or metal skewers",
      "Warm pita bread, tzatziki, and sliced cucumbers for serving"
    ],
    instructions: [
      "If using wooden skewers, soak them in water for at least 20 minutes before grilling.",
      "In a large bowl, combine ground chicken, grated red onion, minced garlic, parsley, mint, cumin, coriander, smoked paprika, cinnamon, cayenne, salt, black pepper, and olive oil.",
      "Mix gently with clean hands until ingredients are evenly distributed, being careful not to overwork the meat.",
      "Chill the mixture in the refrigerator for 15-20 minutes to make shaping easier.",
      "Divide mixture into 8 portions and mold each portion along a skewer into an elongated sausage shape (kofta).",
      "Preheat a grill or cast-iron grill pan over medium-high heat and brush lightly with olive oil.",
      "Grill skewers for 8-10 minutes, turning every 2-3 minutes, until beautifully charred on all sides and internal temperature reaches 165°F (74°C).",
      "Serve warm alongside fluffy pita bread, crisp cucumbers, lemon wedges, and tzatziki sauce."
    ],
    isStock: true
  },
  {
    title: "Healthy Marry Me Chicken",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://healthylittlepeach.com/healthy-marry-me-chicken-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs chicken breasts (cut into cutlets)",
      "1 tbsp olive oil",
      "1 tbsp dairy-free butter or olive oil",
      "3 cloves garlic, minced",
      "1 medium shallot, finely diced",
      "3/4 cup chicken bone broth",
      "1/2 cup full-fat coconut milk (or lactose-free half-and-half)",
      "3/4 cup sun-dried tomatoes (in oil, drained and chopped)",
      "3 tbsp nutritional yeast (or grated parmesan)",
      "1 tsp dried oregano",
      "1/2 tsp red pepper flakes",
      "1/2 tsp sea salt and fresh cracked black pepper",
      "Fresh basil leaves for garnish"
    ],
    instructions: [
      "Pat the chicken cutlets dry with paper towels and season generously on both sides with salt, pepper, and dried oregano.",
      "Heat olive oil in a large skillet over medium-high heat. Sear chicken for 5-6 minutes per side until golden brown and cooked through (165°F). Transfer to a plate.",
      "Lower skillet heat to medium. Add butter, shallots, garlic, and red pepper flakes; sauté for 60 seconds until aromatic.",
      "Pour in chicken bone broth, coconut milk, chopped sun-dried tomatoes, and nutritional yeast. Simmer for 3-4 minutes until sauce slightly reduces.",
      "Return seared chicken cutlets to the skillet and spoon the creamy sauce over top.",
      "Simmer for 2 minutes to meld flavors, garnish with freshly torn basil, and serve over spaghetti squash, zucchini noodles, or gluten-free pasta."
    ],
    isStock: true
  },
  {
    title: "Crispy Smash Burgers",
    category: "Dinner",
    rating: 5,
    estimatedTime: 20,
    sourceUrl: "https://www.delish.com/cooking/recipe-ideas/a34493322/smash-burger-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb 80/20 ground beef, divided into 4 loose round balls",
      "4 potato burger buns or brioche buns, split",
      "4 slices sharp American or cheddar cheese",
      "2 tbsp unsalted butter, softened",
      "1/2 medium yellow onion, sliced paper thin",
      "1 tsp kosher salt and 1/2 tsp coarse black pepper",
      "Dill pickle chips",
      "Special sauce: 1/4 cup mayonnaise, 1 tbsp ketchup, 1 tsp relish, 1/2 tsp yellow mustard, 1/4 tsp garlic powder"
    ],
    instructions: [
      "Stir together mayonnaise, ketchup, relish, yellow mustard, and garlic powder in a small bowl for the special sauce.",
      "Spread softened butter on the cut sides of the buns and toast them in a hot cast-iron griddle until golden brown; set aside.",
      "Get the cast iron pan or flat-top smoking hot over high heat. Place beef balls on the dry hot pan with plenty of space.",
      "Immediately top each ball with paper-thin onions. Using a heavy flat burger press or sturdy spatula, smash each ball down firmly until wafer thin with lacy edges.",
      "Season generously with kosher salt and black pepper. Cook undisturbed for 2-3 minutes until the underside develops a dark crispy crust.",
      "Scrape under the patties firmly to retain the crust, flip, and immediately top each patty with a slice of cheese.",
      "Cook for 1 minute until cheese melts. Stack patties on toasted buns with dill pickles and a generous spoon of special sauce."
    ],
    isStock: true,
    isStaple: true
  },
  {
    title: "Spiced Yogurt Grilled Chicken",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://www.fodmapeveryday.com/recipes/spiced-yogurt-grilled-chicken/",
    imageUrl: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 lbs boneless skinless chicken thighs",
      "1/2 cup lactose-free Greek yogurt (or plain whole milk yogurt)",
      "1/4 cup garlic-infused olive oil",
      "3 tbsp fresh lime juice",
      "1-inch knob fresh ginger, peeled and finely grated",
      "1/4 cup scallion greens (green tops only), finely chopped",
      "1 tbsp ground coriander",
      "1 tbsp smoked paprika",
      "1.5 tsp ground cumin",
      "1.5 tsp garam masala",
      "1 tsp brown sugar",
      "1 tsp kosher salt",
      "1/2 tsp crushed red pepper flakes",
      "Fresh chopped cilantro and lime wedges for serving"
    ],
    instructions: [
      "In a blender or mixing bowl, combine yogurt, garlic oil, lime juice, grated ginger, scallion greens, coriander, smoked paprika, cumin, garam masala, brown sugar, salt, and pepper flakes. Blend until completely smooth.",
      "Place chicken thighs in a large resealable bag or shallow glass dish and pour the spiced yogurt marinade over the top. Massage well to coat.",
      "Refrigerate for at least 4 hours, preferably overnight (up to 24 hours).",
      "Preheat an outdoor grill or indoor ribbed grill pan to medium-high heat and brush grates with oil.",
      "Remove chicken from marinade, shaking off excess, and grill for 4-5 minutes per side until charred, caramelized, and internal temperature reaches 165°F.",
      "Rest chicken for 5 minutes, sprinkle with fresh cilantro, and serve with charred limes and fragrant basmati rice."
    ],
    isStock: true
  },
  {
    title: "Slow-Cooker Pulled Pork",
    category: "Dinner",
    rating: 5,
    estimatedTime: 480,
    sourceUrl: "https://www.delish.com/uk/cooking/recipes/a29185240/slow-cooker-pulled-pork-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "4-5 lbs boneless pork shoulder / pork butt",
      "1 medium yellow onion, sliced",
      "4 cloves garlic, minced",
      "1/2 cup apple cider vinegar",
      "1/2 cup chicken or vegetable broth",
      "1/4 cup brown sugar",
      "1 tbsp smoked paprika",
      "1 tbsp chili powder",
      "1 tsp garlic powder",
      "1 tsp onion powder",
      "1 tsp ground cumin",
      "1 tbsp kosher salt and 1 tsp black pepper",
      "1.5 cups your favorite barbecue sauce",
      "Brioche sandwich buns and coleslaw for serving"
    ],
    instructions: [
      "In a small bowl, mix together brown sugar, smoked paprika, chili powder, garlic powder, onion powder, cumin, salt, and black pepper for the spice rub.",
      "Pat the pork shoulder dry and rub the spice mixture all over the surface, pressing it into the meat.",
      "Place sliced onions and minced garlic in the bottom of a 6-quart slow cooker. Pour in apple cider vinegar and chicken broth.",
      "Place the seasoned pork shoulder on top of the onions. Cover with the lid and cook on LOW for 8 to 10 hours (or HIGH for 5 to 6 hours) until fork-tender and falling apart.",
      "Transfer pork to a large cutting board or roasting pan. Discard excess fat and shred meat with two forks.",
      "Skim fat from slow cooker juices, then return shredded pork to the pot and toss with 1.5 cups barbecue sauce and 1/2 cup of the cooking juices.",
      "Serve piled high on warm toasted brioche buns with creamy coleslaw."
    ],
    isStock: true
  },
  {
    title: "Healthy Curry Chicken Salad",
    category: "Lunch",
    rating: 5,
    estimatedTime: 15,
    sourceUrl: "https://www.bitesofberi.com/healthy-curry-chicken-salad/",
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs cooked chicken breast (poached or rotisserie), shredded or diced",
      "1 cup plain Greek yogurt",
      "1.5 tbsp freshly squeezed lemon juice",
      "2 tbsp yellow curry powder",
      "2 tsp honey or pure maple syrup",
      "1/3 cup roasted cashews or slivered almonds, roughly chopped",
      "1/3 cup seedless red grapes, halved (or dried cranberries)",
      "3 tbsp fresh chives or scallions, finely chopped",
      "1 stalk celery, finely diced for crunch",
      "1/2 tsp sea salt and freshly ground black pepper",
      "Bibb lettuce leaves, whole grain wraps, or sourdough bread for serving"
    ],
    instructions: [
      "In a large mixing bowl, whisk together the Greek yogurt, fresh lemon juice, curry powder, honey, sea salt, and black pepper until vibrant and creamy.",
      "Add the shredded cooked chicken breast, diced celery, chopped chives, roasted cashews, and halved grapes to the bowl.",
      "Fold gently with a spatula until every piece of chicken and fruit is well coated in the golden curry dressing.",
      "Taste and adjust seasoning with additional lemon juice, curry powder, or salt to your liking.",
      "Chill in the refrigerator for at least 30 minutes to allow flavors to meld.",
      "Serve spooned into crisp lettuce cups, rolled into whole-wheat tortilla wraps, or piled onto toasted sourdough bread."
    ],
    isStock: true
  },
  {
    title: "Beef Taco Grilled Cheese Casserole",
    category: "Dinner",
    rating: 4,
    estimatedTime: 35,
    sourceUrl: "https://www.thisisnotdietfood.com/beef-taco-grilled-cheese-casserole/",
    imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb lean ground beef",
      "1 packet (1 oz) taco seasoning mix",
      "1/2 medium yellow onion, diced",
      "1/2 cup chunky salsa",
      "1/4 cup sweet chili sauce or taco sauce",
      "1/4 cup chopped green onions",
      "12 slices white or sourdough sandwich bread",
      "3 tbsp butter, softened",
      "4 cups shredded Mexican blend or cheddar cheese, divided",
      "1/2 tsp garlic powder"
    ],
    instructions: [
      "Preheat oven to 400°F (200°C) and grease a 9x13-inch baking dish.",
      "In a large skillet over medium-high heat, brown ground beef and diced onion until meat is fully cooked; drain any excess grease.",
      "Stir in taco seasoning, salsa, chili sauce, garlic powder, and green onions. Simmer for 2-3 minutes until thick and saucy; remove from heat.",
      "Spread softened butter onto one side of each slice of bread.",
      "Place 6 slices of bread (buttered side facing down) across the bottom of the greased casserole dish.",
      "Sprinkle 2 cups of shredded cheese evenly over the bread layer.",
      "Spread the warm taco beef mixture evenly over the cheese, then top with the remaining 2 cups of cheese.",
      "Place remaining 6 bread slices on top with the buttered side facing UP.",
      "Bake uncovered for 20-24 minutes until the top bread is golden brown, toasted, and the cheese is bubbly."
    ],
    isStock: true
  },
  {
    title: "Cheesy Beef Empanadas",
    category: "Dinner",
    rating: 5,
    estimatedTime: 45,
    sourceUrl: "https://www.delish.com/cooking/recipe-ideas/a52606/beef-empanadas-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 package (10-12 discs) prepared empanada dough discs (or pie crust cut into rounds)",
      "1 lb lean ground beef",
      "1 small yellow onion, finely diced",
      "1/2 red bell pepper, finely diced",
      "3 cloves garlic, minced",
      "1.5 cups shredded Monterey Jack or Queso Oaxaca",
      "2 tbsp tomato paste",
      "1 tsp ground cumin",
      "1 tsp dried oregano",
      "1/2 tsp smoked paprika",
      "1/4 cup pimento-stuffed green olives, chopped",
      "1 egg beaten with 1 tbsp water (for egg wash)",
      "Salt and pepper to taste"
    ],
    instructions: [
      "Preheat oven to 400°F (200°C) and line two large baking sheets with parchment paper.",
      "In a skillet over medium heat, cook ground beef, onion, bell pepper, and garlic until beef is browned and vegetables are tender; drain grease.",
      "Stir in tomato paste, cumin, oregano, smoked paprika, chopped olives, salt, and pepper. Simmer for 3 minutes, then let cool slightly.",
      "Lay out dough discs on a clean surface. Place 2 tablespoons of beef filling and 1-2 tablespoons of shredded cheese in the center of each disc.",
      "Lightly moisten dough edges with water, fold over to form a half-moon, and crimp edges tightly with a fork or traditional repulgue braid.",
      "Place empanadas on prepared baking sheets and brush tops with the egg wash.",
      "Bake for 20-25 minutes until pastry is puffed, flaky, and golden brown. Serve warm with chimichurri or salsa."
    ],
    isStock: true
  },
  {
    title: "Creamy Cheeseburger Soup",
    category: "Dinner",
    rating: 5,
    estimatedTime: 35,
    sourceUrl: "https://www.dinneratthezoo.com/cheeseburger-soup/",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb lean ground beef",
      "3 tbsp unsalted butter",
      "3/4 cup diced yellow onion",
      "3/4 cup diced carrots",
      "3/4 cup diced celery",
      "3 cups peeled and diced russet potatoes",
      "4 cups low-sodium chicken or beef broth",
      "1/4 cup all-purpose flour",
      "2 cups shredded sharp cheddar cheese",
      "1.5 cups whole milk (or half-and-half)",
      "1 tsp dried basil and 1/2 tsp dried parsley",
      "1/2 tsp salt and 1/4 tsp black pepper",
      "Crispy crumbled bacon and chopped green onions for garnish"
    ],
    instructions: [
      "In a large Dutch oven or soup pot, brown ground beef over medium-high heat until fully cooked. Drain fat and set beef aside on a plate.",
      "In the same pot, melt 1 tbsp butter. Add diced onion, carrots, celery, dried basil, and parsley. Sauté for 5 minutes until veggies soften.",
      "Add diced potatoes and chicken broth. Bring soup to a boil, then reduce heat to medium-low, cover, and simmer for 10-12 minutes until potatoes are fork-tender.",
      "In a separate small saucepan, melt remaining 2 tbsp butter. Whisk in flour and cook for 1 minute, then slowly whisk in milk until smooth and thickened.",
      "Stir the thickened milk mixture and the browned ground beef into the soup pot. Simmer gently for 3-4 minutes.",
      "Reduce heat to low and stir in shredded cheddar cheese a handful at a time until completely melted and velvety.",
      "Season with salt and pepper to taste. Ladle into bowls and top with crispy bacon and green onions."
    ],
    isStock: true
  },
  {
    title: "Beef and Broccoli Ramen Stir Fry",
    category: "Dinner",
    rating: 5,
    estimatedTime: 20,
    sourceUrl: "https://bellyfull.net/beef-and-broccoli-ramen-stir-fry/",
    imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb sirloin steak, trimmed and sliced into thin 1/4-inch strips",
      "2 packs (3 oz each) ramen noodles (flavor packets discarded)",
      "3 cups fresh broccoli florets",
      "2 tbsp olive or avocado oil, divided",
      "1 tbsp toasted sesame oil",
      "Stir-fry sauce: 1/4 cup low-sodium soy sauce, 1/3 cup beef broth, 2 tbsp honey, 2 tbsp hoisin sauce, 1 tbsp rice vinegar, 1 tbsp cornstarch, 3 cloves garlic (minced), 1 tsp grated fresh ginger, 1/4 tsp red pepper flakes",
      "Toasted sesame seeds and sliced green onions for garnish"
    ],
    instructions: [
      "In a medium bowl, whisk together soy sauce, cornstarch, beef broth, honey, hoisin sauce, rice vinegar, sesame oil, minced garlic, ginger, and red pepper flakes until smooth.",
      "Bring a pot of water to boil. Cook ramen noodles for 2-3 minutes until just tender. Drain, rinse under cold water, and toss with a drop of sesame oil to prevent sticking.",
      "Heat 1 tbsp oil in a large wok or skillet over high heat. Add beef strips seasoned with salt and pepper; sear for 2 minutes per side until browned. Transfer beef to a plate.",
      "Add remaining 1 tbsp oil, broccoli florets, and 1/4 cup water to the hot skillet. Cover with lid and steam for 2 minutes until broccoli is vibrant green and crisp-tender.",
      "Return beef and cooked ramen noodles to the skillet. Pour the sauce over everything.",
      "Toss continuously over medium-high heat for 1-2 minutes until sauce boils, thickens, and glazes noodles and beef.",
      "Garnish with sesame seeds and green onions, then serve immediately."
    ],
    isStock: true
  },
  {
    title: "Cheesy Chicken & Pesto Caprese Bake",
    category: "Dinner",
    rating: 5,
    estimatedTime: 35,
    sourceUrl: "https://www.gousto.co.uk/cookbook/chicken-recipes/cheesy-chicken-pesto-caprese-bake",
    imageUrl: "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "4 boneless skinless chicken breasts",
      "1/2 cup basil pesto (store-bought or homemade)",
      "8 oz fresh mozzarella ball, drained and torn or sliced",
      "1.5 cups cherry or grape tomatoes, halved",
      "1 medium red onion, cut into wedges",
      "1 lb baby potatoes, halved",
      "2 tbsp olive oil",
      "1 tbsp balsamic glaze",
      "1 tsp Italian seasoning, sea salt, and freshly ground black pepper",
      "Fresh basil leaves for finishing"
    ],
    instructions: [
      "Preheat oven to 400°F (200°C).",
      "On a large rimmed baking sheet, toss baby potatoes, red onion wedges, and cherry tomatoes with olive oil, Italian seasoning, salt, and pepper. Roast for 15 minutes.",
      "Push roasted vegetables slightly to the sides of the baking sheet to make space in the center for chicken breasts.",
      "Season chicken breasts with salt and pepper, then place them in the middle of the sheet pan.",
      "Spread 2 tablespoons of basil pesto generously over each chicken breast, then top with slices of fresh mozzarella.",
      "Return sheet pan to oven and bake for 18-20 minutes until chicken is cooked through (165°F internal temperature) and cheese is bubbly and lightly golden.",
      "Drizzle balsamic glaze over the chicken and roasted vegetables, garnish with fresh basil, and serve hot."
    ],
    isStock: true
  },
  {
    title: "Easy Sheet Pan Chicken al Pastor",
    category: "Dinner",
    rating: 5,
    estimatedTime: 35,
    sourceUrl: "https://playswellwithbutter.com/chicken-al-pastor/",
    imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 lbs boneless skinless chicken thighs, cut into bite-sized chunks",
      "2 cups fresh pineapple, diced into 1/2-inch pieces",
      "1 medium red or yellow onion, thickly sliced",
      "Marinade: 2 tbsp achiote paste, 2 chipotle peppers in adobo sauce, 1/3 cup orange juice, 2 tbsp lime juice, 2 tbsp apple cider vinegar, 4 cloves garlic, 1 tsp cumin, 1 tsp dried oregano, 1 tsp kosher salt",
      "Warm corn tortillas",
      "Fresh cilantro, diced white onion, salsa verde, and lime wedges for serving"
    ],
    instructions: [
      "In a blender, combine achiote paste, chipotle peppers in adobo, orange juice, lime juice, apple cider vinegar, garlic, cumin, oregano, and salt. Blend until smooth and vibrant red.",
      "Place chicken thigh chunks in a bowl or zip-top bag, pour the al pastor marinade over top, and toss to coat. Marinate for at least 30 minutes (or overnight).",
      "Preheat oven to 425°F (220°C) and line an extra-large rimmed baking sheet with foil.",
      "Spread the marinated chicken, diced pineapple, and sliced onion across the sheet pan in a single even layer.",
      "Roast for 20-25 minutes until chicken is cooked through and pineapple is tender.",
      "Switch the oven to HIGH BROIL for 3-4 minutes to get delicious caramelized, charred crispy edges on the chicken and pineapple.",
      "Spoon into warm corn tortillas and top with fresh cilantro, diced white onions, salsa verde, and a squeeze of fresh lime juice."
    ],
    isStock: true
  },
  {
    title: "Chicken Parm Sliders",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://www.delish.com/cooking/recipe-ideas/recipes/a55577/chicken-parm-sliders-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 package (12 count) Hawaiian sweet rolls",
      "12 crispy chicken tenders (frozen pre-cooked or freshly air-fried)",
      "1.5 cups marinara sauce",
      "2 cups shredded mozzarella cheese",
      "1/2 cup grated parmesan cheese",
      "4 tbsp unsalted butter, melted",
      "2 cloves garlic, minced",
      "1 tbsp fresh parsley, finely chopped",
      "1/2 tsp Italian seasoning and garlic salt"
    ],
    instructions: [
      "Preheat oven to 375°F (190°C) and grease a 9x13-inch baking dish.",
      "Without separating individual rolls, slice the entire slab of Hawaiian rolls in half horizontally. Place the bottom slab into the prepared baking dish.",
      "Spread a thin layer of marinara sauce (about 1/2 cup) over the bottom bread.",
      "Arrange crispy chicken tenders evenly over the base, covering all 12 slider spots.",
      "Top chicken tenders with remaining marinara sauce, followed by mozzarella cheese and half of the grated parmesan cheese.",
      "Place the top slab of rolls over the cheese layer.",
      "In a small bowl, stir together melted butter, minced garlic, chopped parsley, Italian seasoning, garlic salt, and remaining parmesan cheese. Brush liberally over the top of the rolls.",
      "Cover loosely with foil and bake for 15 minutes. Remove foil and bake for another 5-8 minutes until tops are golden brown and cheese is bubbling.",
      "Slice into individual sliders and serve hot."
    ],
    isStock: true,
    isStaple: true
  },
  {
    title: "Mexican Street Corn Skillet (Elote Dip)",
    category: "Snack",
    rating: 5,
    estimatedTime: 20,
    sourceUrl: "https://www.spendwithpennies.com/mexican-street-corn-skillet/",
    imageUrl: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "4 cups sweet corn kernels (fresh off the cob, frozen, or drained canned)",
      "2 tbsp butter or oil",
      "3 tbsp mayonnaise",
      "3 tbsp sour cream or Mexican crema",
      "1/2 cup cotija cheese (or crumbled feta), divided",
      "1 jalapeño, seeded and finely minced",
      "2 cloves garlic, minced",
      "1/3 cup fresh cilantro, finely chopped",
      "1 tsp chili powder (or Tajín seasoning)",
      "1/2 tsp ground cumin",
      "Juice of 1 fresh lime",
      "Tortilla chips for serving"
    ],
    instructions: [
      "Melt butter in a large cast-iron skillet over high heat.",
      "Add corn kernels in an even layer. Let cook undisturbed for 2-3 minutes to get deep golden charred spots, then stir and char for another 3-4 minutes.",
      "Add minced jalapeño and garlic; cook for 1 minute until fragrant. Remove skillet from heat.",
      "In a small bowl, mix together mayonnaise, sour cream, lime juice, chili powder, and cumin.",
      "Fold the mayonnaise sauce, half the cotija cheese, and most of the chopped cilantro into the warm charred corn.",
      "Top with remaining cotija cheese, extra chili powder / Tajín, and fresh cilantro.",
      "Serve warm straight out of the skillet with crispy tortilla chips."
    ],
    isStock: true
  },
  {
    title: "Classic Meat Lover’s Calzones",
    category: "Dinner",
    rating: 5,
    estimatedTime: 45,
    sourceUrl: "https://tasty.co/recipe/classic-meat-lovers-calzones",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb pizza dough (store-bought or homemade), divided into 2 balls",
      "1/2 cup cooked Italian sausage crumbles",
      "1/2 cup diced pepperoni",
      "1/2 cup diced ham or cooked bacon crumbles",
      "1 cup whole milk ricotta cheese",
      "2 cups shredded mozzarella cheese",
      "1/4 cup grated parmesan cheese",
      "1 egg beaten with 1 tbsp water (egg wash)",
      "1 tsp Italian seasoning and garlic powder",
      "1.5 cups warm marinara sauce for dipping"
    ],
    instructions: [
      "Preheat oven to 425°F (220°C) and dust a large baking sheet with cornmeal or line with parchment paper.",
      "In a bowl, mix ricotta cheese, 1 cup mozzarella, parmesan, Italian seasoning, garlic powder, salt, and pepper.",
      "On a lightly floured surface, roll out each dough ball into a 10-12 inch circle.",
      "Spread half the ricotta mixture on one half of each circle, leaving a 1-inch border. Top with sausage, pepperoni, ham, and remaining mozzarella.",
      "Fold the empty half of dough over the filling to create a half-moon. Roll and crimp the edges tightly to seal.",
      "Transfer calzones to the baking sheet. Cut 3 small slits on top of each calzone to let steam escape, then brush tops with egg wash.",
      "Bake for 18-22 minutes until crust is deep golden brown and crisp.",
      "Let rest for 5 minutes, then serve with warm marinara sauce for dipping."
    ],
    isStock: true
  },
  {
    title: "Caprese Flatbread with Chicken",
    category: "Lunch",
    rating: 5,
    estimatedTime: 20,
    sourceUrl: "https://www.stetted.com/caprese-chicken-flatbread/",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 large flatbreads or naan breads",
      "1.5 cups cooked chicken breast, shredded or thinly sliced",
      "1/3 cup basil pesto",
      "1.5 cups fresh mozzarella pearls or sliced mozzarella",
      "1 cup cherry tomatoes, sliced",
      "2 tbsp balsamic glaze",
      "Fresh basil leaves, torn",
      "Flaky sea salt and crushed red pepper flakes"
    ],
    instructions: [
      "Preheat oven to 425°F (220°C). Place flatbreads directly onto a large baking sheet.",
      "Spread basil pesto evenly over each flatbread, leaving a small rim around the edges.",
      "Distribute shredded cooked chicken and sliced cherry tomatoes evenly over the pesto base.",
      "Top with fresh mozzarella pearls.",
      "Bake for 10-12 minutes until flatbread crust is crisp and mozzarella is bubbly and melted.",
      "Remove from oven and immediately drizzle with sweet balsamic glaze.",
      "Garnish with freshly torn basil leaves, flaky sea salt, and a pinch of red pepper flakes. Slice and enjoy!"
    ],
    isStock: true
  },
  {
    title: "BBQ Spiced Air Fryer Wings",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://www.spendwithpennies.com/air-fryer-chicken-wings/",
    imageUrl: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 lbs chicken wings and drumettes, patted thoroughly dry",
      "1 tbsp baking powder (aluminum-free, for extreme crispiness)",
      "1 tbsp smoked paprika",
      "1 tsp garlic powder",
      "1 tsp onion powder",
      "1/2 tsp brown sugar",
      "1/2 tsp kosher salt and freshly cracked black pepper",
      "1/2 cup your favorite barbecue sauce",
      "Ranch or blue cheese dressing and celery sticks for serving"
    ],
    instructions: [
      "Pat the chicken wings completely dry with paper towels (dry wings equal ultra-crispy skin).",
      "In a large bowl, whisk together baking powder, smoked paprika, garlic powder, onion powder, brown sugar, salt, and pepper.",
      "Toss the wings in the dry seasoning mix until evenly coated.",
      "Preheat air fryer to 380°F (190°C). Arrange wings in a single layer in the basket without overcrowding.",
      "Air fry at 380°F for 20 minutes, flipping halfway through.",
      "Increase air fryer temperature to 400°F (200°C) and cook for another 4-5 minutes until skin is crackling and extra crispy.",
      "Transfer wings to a clean bowl, toss with barbecue sauce until glazed, and serve immediately with cool ranch and celery."
    ],
    isStock: true
  },
  {
    title: "Gut-Friendly Crème Brûlée",
    category: "Dessert",
    rating: 5,
    estimatedTime: 50,
    sourceUrl: "https://mygutfeeling.eu/creme-brulee/",
    imageUrl: "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 cups lactose-free heavy cream (or full-fat culinary coconut cream)",
      "5 large egg yolks (at room temperature)",
      "1/3 cup granulated sugar (or pure maple sugar)",
      "1 whole vanilla bean (split and seeds scraped) or 2 tsp pure vanilla bean paste",
      "Pinch of fine sea salt",
      "4-6 tsp superfine turbinado or cane sugar for caramelizing"
    ],
    instructions: [
      "Preheat oven to 325°F (165°C). Place 4-6 ramekins in a large roasting pan.",
      "In a saucepan over medium-low heat, combine cream and the scraped vanilla bean seeds and pod. Heat until gently steaming (do not boil), then remove from heat and let steep for 10 minutes. Discard pod.",
      "In a bowl, gently whisk egg yolks, sugar, and salt together until smooth and pale (avoid creating excess foam).",
      "Slowly stream 1/3 of the warm cream into the egg mixture while whisking constantly to temper the eggs.",
      "Whisk in the remaining cream, then pour the mixture through a fine-mesh strainer into a pourable measuring cup.",
      "Divide custard evenly among ramekins. Pour hot boiling water into the roasting pan around the ramekins until it reaches halfway up their sides.",
      "Bake for 35-40 minutes until edges are set but centers still have a gentle wobble.",
      "Remove from water bath, cool to room temperature, then chill in the refrigerator for at least 3 hours.",
      "Before serving, sprinkle 1 teaspoon of sugar evenly over each custard and caramelize with a kitchen blowtorch until a glass-like golden crust forms. Let sit for 2 minutes to harden."
    ],
    isStock: true
  },
  {
    title: "Italian Pot Roast & Parmesan Risotto",
    category: "Dinner",
    rating: 5,
    estimatedTime: 210,
    sourceUrl: "https://www.plaincenter.com/italian-pot-roast-parmesan-risotto/",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "3.5 lbs beef chuck roast, tied with butcher twine",
      "2 tbsp olive oil",
      "1 large onion, diced & 2 carrots, chopped & 2 celery ribs, sliced",
      "4 cloves garlic, minced",
      "1 cup dry Italian red wine (Chianti or Cabernet)",
      "1 can (28 oz) San Marzano crushed tomatoes",
      "2 cups beef bone broth",
      "2 sprigs fresh rosemary & 3 sprigs fresh thyme & 2 bay leaves",
      "Kosher salt and black pepper",
      "Parmesan Risotto: 1.5 cups Arborio rice, 1 cup dry white wine, 5 cups warm chicken stock, 1 shallot minced, 3 tbsp butter, 1 cup freshly grated Parmigiano-Reggiano"
    ],
    instructions: [
      "Preheat oven to 325°F (165°C). Season chuck roast generously on all sides with salt and pepper.",
      "In a large Dutch oven over medium-high heat, heat olive oil and sear roast until deeply browned on all sides (4 mins per side). Remove roast to a platter.",
      "Add onion, carrots, celery, and garlic to the pot; sauté for 5 minutes until fragrant.",
      "Pour in red wine to deglaze, scraping up all flavorful browned bits from the bottom. Simmer for 3 minutes until reduced by half.",
      "Stir in crushed San Marzano tomatoes, beef broth, rosemary, thyme, and bay leaves. Return roast and accumulated juices to the pot.",
      "Cover tightly with lid and braise in the oven for 3 to 3.5 hours until fork-tender and meltingly succulent.",
      "For Risotto: Sauté shallot in 1 tbsp butter, stir in Arborio rice for 2 minutes until toasted. Add white wine until absorbed. Gradually ladle warm stock 1/2 cup at a time, stirring continuously for 20 minutes until creamy and al dente. Fold in remaining butter and parmesan.",
      "Shred pot roast into large rustic chunks, spoon rich tomato reduction over top, and serve alongside velvety Parmesan risotto."
    ],
    isStock: true
  },
  {
    title: "Instant Pot General Tso's Chicken",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://thegirlonbloor.com/instant-pot-general-tsos-chicken/",
    imageUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs boneless skinless chicken thighs or breasts, cut into 1-inch chunks",
      "1 tbsp sesame oil",
      "3 cloves garlic, minced & 1 tbsp fresh ginger, grated",
      "Sauce: 1/3 cup low-sodium soy sauce, 1/4 cup hoisin sauce, 3 tbsp brown sugar, 2 tbsp rice vinegar, 2 tbsp sweet chili sauce, 1/2 cup chicken broth, 1/2 tsp crushed red pepper flakes",
      "Slurry: 2 tbsp cornstarch mixed with 2 tbsp cold water",
      "Cooked jasmine rice, steamed broccoli, toasted sesame seeds, and sliced green onions for serving"
    ],
    instructions: [
      "In a medium bowl, whisk together soy sauce, hoisin sauce, brown sugar, rice vinegar, sweet chili sauce, chicken broth, and red pepper flakes.",
      "Turn Instant Pot to SAUTÉ mode. Add sesame oil, garlic, and ginger; sauté for 30 seconds until fragrant.",
      "Add diced chicken chunks and pour the prepared sauce over top. Stir to combine.",
      "Secure the Instant Pot lid, turn the valve to SEALING, and pressure cook on HIGH for 5 minutes.",
      "When timer ends, allow a 5-minute natural pressure release, then perform a quick release for remaining steam.",
      "Carefully remove the lid and turn Instant Pot back to SAUTÉ mode. Stir in the cornstarch slurry.",
      "Simmer for 2-3 minutes until sauce bubbles and thickens into a glossy, sticky glaze clinging to the chicken.",
      "Serve over fluffy jasmine rice with steamed broccoli, garnished with sesame seeds and green onions."
    ],
    isStock: true
  },
  {
    title: "Instant Pot Crack Chicken",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://www.plainchicken.com/instant-pot-crack-chicken/",
    imageUrl: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 lbs boneless skinless chicken breasts",
      "1/2 cup chicken broth or water",
      "1 block (8 oz) cream cheese, cut into cubes",
      "1 packet (1 oz) Ranch seasoning dressing mix",
      "1.5 cups shredded sharp cheddar cheese",
      "8 slices bacon, cooked and crumbled",
      "1/4 cup green onions, sliced",
      "Brioche hamburger buns or baked potatoes for serving"
    ],
    instructions: [
      "Pour chicken broth into the bottom of the Instant Pot inner pot.",
      "Place chicken breasts in the pot. Sprinkle the ranch seasoning packet evenly over the chicken.",
      "Scatter cubes of cream cheese on top of the seasoned chicken.",
      "Lock the lid in place, set valve to SEALING, and cook on HIGH PRESSURE for 12 minutes.",
      "Allow 10 minutes of natural pressure release, then quick release any remaining steam.",
      "Using two forks or a hand mixer, shred the chicken directly in the pot, blending it smoothly with the melted cream cheese and savory juices.",
      "Stir in shredded cheddar cheese, crumbled bacon, and sliced green onions until cheese is fully melted and velvety.",
      "Serve warm on toasted buns, inside baked sweet potatoes, or as a decadent keto dip."
    ],
    isStock: true
  },
  {
    title: "Instant Pot Butter Chicken (Murgh Makhani)",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://twosleevers.com/instant-pot-butter-chicken/",
    imageUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs boneless skinless chicken thighs, cut into bite-sized pieces",
      "1 can (14 oz) diced or crushed San Marzano tomatoes",
      "5 cloves garlic, minced & 1 tbsp fresh ginger, grated",
      "1 tsp ground turmeric",
      "1 tsp ground cumin",
      "1 tsp garam masala",
      "1 tsp ground coriander",
      "1 tsp chili powder (or Kashmiri mirch)",
      "1 tsp kosher salt",
      "4 tbsp unsalted butter, cut into pieces",
      "1/2 cup heavy cream (or full-fat coconut milk)",
      "Fresh cilantro and warm garlic naan for serving"
    ],
    instructions: [
      "Add canned tomatoes, minced garlic, grated ginger, turmeric, cumin, garam masala, coriander, chili powder, and salt directly into the Instant Pot. Stir well.",
      "Place chicken thigh chunks into the tomato sauce, coating the pieces.",
      "Place the butter pieces on top of the chicken (do not add extra water).",
      "Lock the lid and pressure cook on HIGH for 10 minutes.",
      "Allow 10 minutes natural pressure release, then release remaining pressure and open the lid.",
      "Remove chicken pieces temporarily to a bowl. Using an immersion blender, blend the tomato curry in the pot until silky smooth.",
      "Stir in heavy cream and return the chicken to the pot. Simmer on SAUTÉ mode for 2 minutes.",
      "Garnish with chopped cilantro and serve with warm garlic naan and basmati rice."
    ],
    isStock: true
  },
  {
    title: "Instant Pot Chicken & Rice",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://www.delish.com/cooking/recipe-ideas/a19677130/instant-pot-chicken-and-rice-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs chicken breasts or thighs, cut into 1-inch pieces",
      "1.5 cups long-grain white rice, rinsed thoroughly",
      "2 cups low-sodium chicken broth",
      "1 medium yellow onion, diced",
      "2 carrots, diced & 2 stalks celery, diced",
      "3 cloves garlic, minced",
      "2 tbsp olive oil or butter",
      "1 tsp Italian seasoning, 1/2 tsp garlic powder, salt and pepper",
      "1 cup frozen peas",
      "1/2 cup grated parmesan cheese"
    ],
    instructions: [
      "Turn Instant Pot to SAUTÉ. Heat olive oil, then sauté onion, carrots, and celery for 3-4 minutes until softened. Stir in garlic for 1 minute.",
      "Add diced chicken, Italian seasoning, garlic powder, salt, and pepper; sauté for 2 minutes.",
      "Pour in 1/2 cup chicken broth to deglaze the bottom of the pot, scraping up any browned bits with a wooden spoon (vital to prevent burn notice).",
      "Add rinsed white rice on top of the chicken and vegetables in an even layer. Pour remaining 1.5 cups chicken broth over the rice (do NOT stir).",
      "Lock lid, set valve to SEALING, and pressure cook on HIGH for 6 minutes.",
      "When done, let naturally release for 10 minutes, then quick release remaining steam.",
      "Remove lid, fold in frozen peas and parmesan cheese. Cover with lid for 2 minutes to let peas warm through, then fluff with a fork and serve."
    ],
    isStock: true
  },
  {
    title: "Garlic Parmesan Chicken & Potatoes",
    category: "Dinner",
    rating: 5,
    estimatedTime: 40,
    sourceUrl: "https://fitslowcookerqueen.com/slow-cooker-instant-pot-garlic-parmesan-chicken-potatoes/",
    imageUrl: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 lbs boneless skinless chicken breasts or thighs",
      "1.5 lbs baby red or gold potatoes, cut into bite-sized cubes",
      "3 tbsp olive oil, divided",
      "6 cloves garlic, finely minced",
      "1/2 cup grated parmesan cheese",
      "1 tbsp Italian seasoning",
      "1 tsp onion powder & 1 tsp paprika",
      "1 tsp kosher salt and 1/2 tsp black pepper",
      "2 tbsp fresh parsley, chopped"
    ],
    instructions: [
      "Preheat oven to 400°F (200°C) and line a large baking sheet with parchment paper.",
      "In a large bowl, toss potato cubes with 1.5 tbsp olive oil, half the minced garlic, half the Italian seasoning, salt, and pepper.",
      "Spread potatoes across one side of the baking sheet and roast for 15 minutes.",
      "Meanwhile, toss chicken with remaining olive oil, remaining garlic, paprika, Italian seasoning, salt, and pepper.",
      "Place chicken on the other side of the baking sheet next to the partially roasted potatoes.",
      "Sprinkle parmesan cheese generously over both the chicken and potatoes.",
      "Bake for another 20-25 minutes until chicken is cooked through (165°F) and potatoes are fork-tender with crisp golden edges.",
      "Garnish with chopped fresh parsley and serve immediately."
    ],
    isStock: true
  },
  {
    title: "Blackstone Mexican Street Corn",
    category: "Snack",
    rating: 5,
    estimatedTime: 15,
    sourceUrl: "https://grillnationbbq.com/2022/07/21/blackstone-mexican-street-corn/",
    imageUrl: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "6 ears fresh sweet corn (kernels cut off cob) or 4 cups frozen corn",
      "3 tbsp unsalted butter",
      "1/4 cup mayonnaise",
      "1/4 cup Mexican crema or sour cream",
      "1/2 cup cotija cheese, crumbled",
      "1 jalapeño, finely diced",
      "1/3 cup fresh cilantro, chopped",
      "1 tbsp Tajín Clásico seasoning",
      "1 tsp garlic powder",
      "Juice of 1 lime"
    ],
    instructions: [
      "Preheat the Blackstone flat-top griddle (or large outdoor griddle) to medium-high heat.",
      "Melt butter directly on the griddle surface and spread sweet corn kernels in a flat, even layer.",
      "Let the corn sear without stirring for 3-4 minutes until deep golden roasted spots appear.",
      "Toss with diced jalapeño and continue searing for 3 minutes until charred to perfection.",
      "Using griddle spatulas, scoop hot corn into a large serving bowl.",
      "Fold in mayonnaise, Mexican crema, lime juice, garlic powder, and half the cotija cheese.",
      "Top with remaining cotija cheese, heavy sprinkle of Tajín, and fresh cilantro. Serve hot with tortilla chips or as a steak side."
    ],
    isStock: true
  },
  {
    title: "Creamy Chicken Tikka Masala",
    category: "Dinner",
    rating: 5,
    estimatedTime: 35,
    sourceUrl: "https://cafedelites.com/chicken-tikka-masala/",
    imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs chicken thighs, cut into bite-sized pieces",
      "Marinade: 1/2 cup plain yogurt, 1 tbsp minced garlic, 1 tbsp grated ginger, 1 tsp garam masala, 1 tsp cumin, 1 tsp turmeric, 1 tsp chili powder, 1 tsp salt",
      "Sauce: 2 tbsp butter, 1 large onion finely chopped, 3 cloves garlic, 1 tbsp ginger, 2 tsp garam masala, 2 tsp ground cumin, 1 tsp coriander, 1 can (14 oz) tomato puree, 1 cup heavy cream",
      "Fresh cilantro and basmati rice for serving"
    ],
    instructions: [
      "In a bowl, combine chicken thighs with yogurt and marinade spices. Marinate for at least 20 minutes.",
      "Heat 1 tbsp oil in a large skillet over high heat. Sear chicken pieces in batches for 3-4 minutes per side until charred on edges; set aside.",
      "Melt butter in the same skillet over medium heat. Sauté onion until translucent, then add garlic, ginger, and spices; cook for 1 minute.",
      "Pour in tomato puree and simmer for 10 minutes until sauce thickens and turns deep red.",
      "Stir in heavy cream and add the seared chicken along with its juices. Simmer for 8-10 minutes until chicken is cooked through.",
      "Garnish with fresh cilantro and serve with warm garlic naan and steamed basmati rice."
    ],
    isStock: true
  },
  {
    title: "Slow Cooker Chicken Taco Soup",
    category: "Dinner",
    rating: 5,
    estimatedTime: 360,
    sourceUrl: "https://www.theseasonedmom.com/slow-cooker-chicken-taco-soup/",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "2 boneless skinless chicken breasts (about 1.5 lbs)",
      "1 can (15 oz) black beans, rinsed and drained",
      "1 can (15 oz) pinto beans or kidney beans, rinsed and drained",
      "1 can (15 oz) sweet corn, drained",
      "1 can (14.5 oz) diced tomatoes with green chilies (Rotel)",
      "1 can (8 oz) tomato sauce",
      "2 cups low-sodium chicken broth",
      "1 packet (1 oz) taco seasoning mix & 1/2 tsp cumin",
      "Toppings: Tortilla chips, shredded cheese, sour cream, avocado, cilantro"
    ],
    instructions: [
      "Place raw chicken breasts in the bottom of a 6-quart slow cooker.",
      "Add black beans, pinto beans, sweet corn, diced tomatoes with green chilies, tomato sauce, chicken broth, taco seasoning, and cumin on top.",
      "Cover and cook on LOW for 6 to 8 hours (or HIGH for 3 to 4 hours).",
      "Remove chicken breasts to a cutting board, shred with two forks, and return shredded chicken to the slow cooker.",
      "Stir well and let simmer for another 10 minutes on LOW.",
      "Ladle into bowls and top with crispy tortilla chips, shredded cheddar, diced avocado, sour cream, and fresh cilantro."
    ],
    isStock: true
  },
  {
    title: "Perfect Classic Chicken Alfredo",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://www.delish.com/cooking/recipe-ideas/a55312/best-chicken-alfredo-recipe/",
    imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "12 oz fettuccine pasta",
      "2 large chicken breasts, sliced horizontally into cutlets",
      "4 tbsp unsalted butter",
      "4 cloves garlic, minced",
      "1.5 cups heavy cream",
      "1.5 cups freshly grated Parmigiano-Reggiano cheese",
      "1/4 tsp ground nutmeg",
      "Kosher salt and freshly ground black pepper",
      "2 tbsp fresh Italian parsley, chopped"
    ],
    instructions: [
      "Bring a large pot of salted water to boil. Cook fettuccine until al dente according to package instructions. Reserve 1/2 cup pasta water, then drain.",
      "Season chicken cutlets with salt, pepper, and Italian herbs. Heat 1 tbsp olive oil in a large skillet over medium-high heat and sear chicken for 4-5 minutes per side until golden brown; transfer to a board and slice.",
      "Lower skillet heat to medium. Melt butter and add minced garlic; cook for 1 minute until fragrant.",
      "Pour in heavy cream and bring to a gentle simmer for 3 minutes.",
      "Remove skillet from heat and gradually whisk in grated Parmesan cheese until sauce is silky and smooth. Season with a pinch of nutmeg, salt, and pepper.",
      "Add drained fettuccine to the Alfredo sauce, tossing to coat (add splashes of reserved pasta water if needed to loosen).",
      "Top pasta with sliced chicken, chopped fresh parsley, and extra cracked black pepper."
    ],
    isStock: true,
    isStaple: true
  },
  {
    title: "Japanese Teriyaki Chicken Bowl",
    category: "Dinner",
    rating: 5,
    estimatedTime: 25,
    sourceUrl: "https://www.budgetbytes.com/easy-teriyaki-chicken/",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1.5 lbs boneless skinless chicken thighs, cut into bite-sized pieces",
      "Teriyaki Sauce: 1/3 cup low-sodium soy sauce, 1/4 cup water, 3 tbsp brown sugar, 2 tbsp honey, 2 tbsp mirin (or rice vinegar), 2 cloves minced garlic, 1 tsp grated ginger, 1 tbsp cornstarch",
      "1 tbsp cooking oil",
      "Cooked short-grain sushi rice or jasmine rice",
      "Steamed broccoli florets, sliced cucumbers, and edamame",
      "Toasted sesame seeds and sliced green onions for garnish"
    ],
    instructions: [
      "In a bowl, whisk together soy sauce, water, brown sugar, honey, mirin, minced garlic, ginger, and cornstarch until sugar dissolves.",
      "Heat cooking oil in a large skillet or wok over medium-high heat. Add chicken pieces and sear for 5-6 minutes until browned on all sides.",
      "Pour the teriyaki sauce over the seared chicken in the pan.",
      "Simmer for 2-3 minutes, stirring constantly as the sauce thickens into a glossy, dark amber glaze coating the chicken.",
      "Assemble bowls: scoop fluffy rice into bowls, top with glazed teriyaki chicken, steamed broccoli, cucumber slices, and edamame.",
      "Drizzle extra pan sauce over top and garnish with toasted sesame seeds and green onions."
    ],
    isStock: true,
    isStaple: true
  },
  {
    title: "One-Pot Tuscan Chicken Mac and Cheese",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://cafedelites.com/tuscan-chicken-mac-and-cheese/",
    imageUrl: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "1 lb chicken breast, diced into bite-sized pieces",
      "8 oz elbow macaroni or cavatappi pasta (uncooked)",
      "2 tbsp olive oil or butter",
      "3 cloves garlic, minced",
      "1/2 cup sun-dried tomatoes (in oil, drained and chopped)",
      "2 cups fresh baby spinach",
      "2 cups chicken broth",
      "1.5 cups whole milk (or half-and-half)",
      "1.5 cups shredded sharp white cheddar cheese",
      "1/2 cup grated parmesan cheese",
      "1 tsp Italian seasoning, salt, and pepper"
    ],
    instructions: [
      "Heat 1 tbsp oil in a large deep skillet or Dutch oven over medium-high heat. Season chicken with salt, pepper, and Italian seasoning; sear for 5 minutes until browned. Transfer chicken to a plate.",
      "In the same skillet, add remaining oil, minced garlic, and sun-dried tomatoes; cook for 1 minute.",
      "Pour in chicken broth, milk, and uncooked elbow macaroni. Stir well and bring to a gentle boil.",
      "Cover with lid, reduce heat to medium-low, and simmer for 9-10 minutes, stirring occasionally, until pasta is al dente and liquid is mostly absorbed.",
      "Remove lid, stir in baby spinach, cheddar cheese, parmesan, and the cooked chicken. Stir continuously until cheese melts into a creamy sauce and spinach wilts.",
      "Season with extra black pepper and serve hot straight from the pot."
    ],
    isStock: true
  },
  {
    title: "Simple Homemade Chicken Ramen",
    category: "Dinner",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://forkknifeswoon.com/simple-homemade-chicken-ramen/",
    imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "4 packs ramen noodles (seasoning packets discarded)",
      "6 cups rich chicken bone broth",
      "2 boneless chicken breasts, seasoned and roasted/seared",
      "2 tbsp toasted sesame oil",
      "4 cloves garlic, minced & 1 tbsp fresh ginger, minced",
      "3 tbsp low-sodium soy sauce & 1 tbsp mirin",
      "1 tbsp white miso paste (optional for richness)",
      "4 soft-boiled eggs (marinated or seasoned), halved",
      "1 cup shiitake mushrooms, sliced",
      "2 cups baby bok choy or spinach",
      "Sliced green onions, nori sheets, and chili crisp oil"
    ],
    instructions: [
      "In a large soup pot, heat sesame oil over medium heat. Sauté minced garlic, ginger, and sliced mushrooms for 2-3 minutes until fragrant.",
      "Pour in chicken bone broth, soy sauce, and mirin. Bring to a simmer for 10 minutes to infuse aromatics. Whisk in miso paste until dissolved.",
      "In a separate pot of boiling water, cook ramen noodles for 2-3 minutes until just tender. Drain and divide among 4 deep ramen bowls.",
      "Add baby bok choy to the hot broth during the last 2 minutes of simmering until vibrant green.",
      "Ladle the piping-hot aromatic broth and vegetables over the noodles in each bowl.",
      "Top each bowl with sliced seared chicken breast, two soft-boiled egg halves, green onions, a square of nori, and a drizzle of spicy chili crisp."
    ],
    isStock: true,
    isStaple: true
  },
  {
    title: "Gourmet Grilled Cheese & Roasted Tomato Soup",
    category: "Lunch",
    rating: 5,
    estimatedTime: 30,
    sourceUrl: "https://www.modernhoney.com/creamy-roasted-tomato-basil-soup-with-parmesan-crusted-grilled-cheese/",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1000",
    ingredients: [
      "Tomato Soup: 1 can (28 oz) whole peeled San Marzano tomatoes, 1 cup vegetable or chicken broth, 1/2 medium yellow onion (diced), 3 cloves garlic (minced), 2 tbsp butter, 1/4 cup heavy cream, 1/4 cup fresh basil leaves, 1 tsp sugar, salt and pepper",
      "Grilled Cheese: 4 thick slices artisan sourdough bread, 4 slices sharp cheddar, 4 slices Gruyère or fontina cheese, 3 tbsp softened butter, 2 tbsp grated parmesan cheese for crust"
    ],
    instructions: [
      "For Soup: Melt butter in a medium pot over medium heat. Sauté onion and garlic for 4-5 minutes until soft.",
      "Add whole San Marzano tomatoes, broth, sugar, salt, and pepper. Simmer for 15 minutes.",
      "Stir in fresh basil leaves and heavy cream. Use an immersion blender to puree until silky smooth; keep warm on low heat.",
      "For Grilled Cheese: Butter the outer sides of the sourdough bread slices and press lightly into grated parmesan cheese for a crisp parmesan crust.",
      "Layer sharp cheddar and Gruyère cheese between bread slices.",
      "Cook in a hot cast-iron skillet over medium-low heat for 3-4 minutes per side until the bread is crunchy golden-brown and cheese is melted.",
      "Cut sandwiches diagonally and serve immediately for dipping into the creamy roasted tomato basil soup."
    ],
    isStock: true,
    isStaple: true
  }
];
