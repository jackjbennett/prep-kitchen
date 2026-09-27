# Prep Kitchen

A meal-prep planner: pantry inventory, recipes with automatic nutrition, a prep calendar, fridge portions, meal check-ins and grocery lists.

**Use it:** https://jackjbennett.github.io/prep-kitchen/

Anyone can create a free account. Each person's kitchen is private to their account.

## How it's built

- `index.html` is the whole app (plain HTML, CSS and JavaScript, no build step).
- Accounts and data live in [Supabase](https://supabase.com). Every saved thing is a row in the `items` table, and row-level security (`supabase/schema.sql`) limits each person to their own rows.
- `config.js` holds the Supabase project URL and publishable key. Both are public by design.
- `manifest.webmanifest`, `sw.js` and `icons/` make it installable as an app on desktop and phone. The service worker always fetches the newest version first, so updates show up on the next open.
- Hosted on GitHub Pages from the `main` branch.
