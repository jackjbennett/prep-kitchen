# Prep Kitchen

A meal-prep planner: pantry inventory, recipes with automatic nutrition, a prep calendar, fridge portions, meal check-ins and grocery lists.

**Use it:** https://jackjbennett.github.io/prep-kitchen/

Anyone can create a free account. Each person's kitchen is private to their account, and people who live together can share one: Settings → Shared kitchen.

## Shared kitchens (households)

- Someone starts a household and gets an invite code (like `K7QH-2MXP-9C`) and a link (`…/prep-kitchen/?join=K7QH-2MXP-9C`). Anyone with it can join, so share it only with the people you live with. **New code** makes the old one stop working, and any member can remove someone.
- **Starting a household** moves your kitchen (pantry, fridge, recipes, preps, calendar, grocery list, saved foods) into it, so everyone you invite sees and edits it.
- **Joining** keeps your own kitchen exactly as it was, set aside while you're in the household. You can also copy your recipes into the shared recipe book.
- **Leaving** brings your own kitchen back, and you can keep a copy of the shared one. When the last person leaves, the household and its shared kitchen are deleted.
- Appearance settings and nutrition goals always stay personal.

## How it's built

- `index.html` is the whole app (plain HTML, CSS and JavaScript, no build step).
- Accounts and data live in [Supabase](https://supabase.com). Every saved thing is a row in the `items` table, stored in a space: a person's own (private) or a household's (shared). Row-level security (`supabase/schema.sql`) lets each person reach only their own space and their household's. `supabase/test-households.sql` checks those rules with throwaway accounts and saves nothing.
- `config.js` holds the Supabase project URL and publishable key. Both are public by design.
- `manifest.webmanifest`, `sw.js` and `icons/` make it installable as an app on desktop and phone. The service worker always fetches the newest version first, so updates show up on the next open.
- Hosted on GitHub Pages from the `main` branch.
