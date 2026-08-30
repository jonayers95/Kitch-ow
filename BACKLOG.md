# Kitch-ow! Project Backlog & Implementation Roadmap

This backlog tracks planned features, enhancements, and architectural initiatives prioritized into an optimal implementation sequence based on user impact, kitchen workflow friction, and technical dependencies.

---

### 🌟 Priority 1: Staple Recipes & "Not Today" Fallback (Completed)
*Why First*: Delivers immediate day-to-day resilience to the weekly meal planner by eliminating decision fatigue on busy nights with 1-click fallback to family-favorite staples.
- [x] **Data Architecture**: Add `isStaple?: boolean` to Recipe model.
- [x] **Designate "Staple" Recipes**: Toggle/badge to mark recipes as household staples (family favorites made with regularly stocked pantry/fridge items) in recipe card, view modal, and edit forms.
- [x] **Staples Filter**: Quick filter chip in the recipe book to view all household staples at a glance.
- [x] **"Not Today" Quick-Swap in Weekly Planner**:
  - Add a "Not Today" action on any scheduled meal slot.
  - Interactive swap drawer/modal showing all household staples with quick cook times.
  - "🎲 Surprise Me with a Random Staple" low-decision-fatigue button.
  - Instant 1-click swap with real-time Firestore sync and toast confirmation.

---

### 🛒 Priority 2: Smart & Grouped On-Demand Grocery List (Completed)
*Why Second*: Completes the meal planning lifecycle by transforming scheduled recipes into actionable, clean shopping lists.
- [x] **One-Time Commitment Prompt**:
  - **Primary Ingredients** (Produce, Meats, Dairy, Bakery, recipe-specific goods) **default to 'included'**.
  - **Secondary Ingredients** (Spices, seasonings, cooking oils, vinegars, flours, baking basics) **default to 'excluded'**.
  - Review and selectively toggle items with quick bulk buttons ("Select All Primary", "Include All Pantry", "Deselect All").
  - Prominent **"Commit to Grocery List"** action to officially create and persist the week's shopping list.
- [x] **Official In-Store Shopping Experience & Real-Time Checklist**:
  - Aisles & category grouping (Produce & Herbs, Meat & Seafood, Dairy, Bakery, Pantry, Spices, Oils & Condiments).
  - Streamlined, space-optimized ingredient list layout maximizing vertical screen space.
  - Progress bar tracking items in cart with percentage completion.
  - "Edit Items" action allows reopening the commitment prompt if meal plans change.
  - Compact household custom extras quick-add form.
  - Persistent shopping state in local storage per week so progress is saved across sessions.
- [x] **Export, Print & Sharing**: Clean copy-to-clipboard formatted text (ready for messaging/notes) and high-contrast printable view.

---

### 🍲 Priority 3: Discovery & Leftover Remixing (Completed)
*Why Third*: Reduces household food waste and provides inspiration when meal plans have leftovers.
- [x] **"Surprise Me / Random" Recipe Picker**: A random recipe selector on the recipe page with meal time (Breakfast/Lunch/Dinner/Snack), staples, and quick under-30-min filters before surfacing a matching dish.
- [x] **"Leftover Remix" Engine**:
  - Select past meals from the previous weeks or type in available leftovers/ingredients.
  - AI suggests 3 creative meal remixes assuming standard pantry staples (with offline fallback engine).
  - Save directly to recipe book or schedule straight to weekly meal planner.
- [x] **Estimated Spoilage / Freshness Tracker**: In the Leftover Remix flow and weekly meal planner slots, calculate USDA-aligned shelf-life and freshness statuses (Peak, Eat Soon, Expiring, Past Recommended) based on dish ingredients and cooked dates.

---

### 🍳 Priority 4: Household Context & AI Generation Controls (Completed)
*Why Fourth*: Deepens AI meal suggestions by factoring in available kitchen equipment and household dietary preferences.
- [x] **Household Context Profile**: Capture kitchen appliances (air fryer, slow cooker, Instant Pot, grill) and dietary preferences/allergies to guide AI recipe proposals.
- [x] **Protein/Ingredient Consistency vs. Variety Slider**: A configuration slider when generating meal plans:
  - **Max Consistency**: Batch-friendly planning (e.g., batch-prepped chicken across multiple dinners).
  - **Max Variety**: Diverse protein and flavor rotations without repeating main proteins across the week (beef, poultry, seafood, pork, vegetarian).

---

### 📅 Priority 5: Scheduling & Data Portability (Completed)
*Why Fifth*: Provides flexibility when plans shift and gives users complete data ownership.
- [x] **"Bump" Missed Meals**: Automatically reschedule/bump an unmade meal from earlier in the week to a suitable future open slot.
- [x] **Recipe Data Export (JSON)**: Export the complete recipe collection and metadata into portable JSON format with re-import capabilities.

---

### 🗓️ Priority 6: Google Calendar Integration (In Progress)
*Why Sixth*: High-value convenience feature that requires user OAuth consent for external calendar access.
- [ ] **Dining Out Detection**: Inspect Google Calendar events for scheduled dining out/social meal events during weekly planning, auto-omitting dinners on those dates.
- [ ] **Activity-Aware "Eat Out" Proposals**: Analyze busy calendar days and suggest dining out rather than cooking on demanding or high-activity evenings.

---

### 🛠️ Tech Debt & Anomalies (Low Priority)
- [ ] **Grocery List Print Action**: Investigate print button in `SmartGroceryListModal` (browser/iframe compatibility with `window.print`).
- [ ] **Grocery List Reset Cart Action**: Investigate "Reset Cart" button in `SmartGroceryListModal` to verify instant local storage clear and checkbox state sync.
