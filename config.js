// Supabase connection for Prep Kitchen.
// Both values are public by design: they ship with every Supabase website.
// Each person's data is protected by the row-level security rules in supabase/schema.sql.
// Never put the service_role (secret) key or the database password here.
window.PREP_KITCHEN_CONFIG = {
  supabaseUrl: 'https://nnkneiohvdafbetimtwg.supabase.co',
  supabaseKey: 'sb_publishable_XHt74gAyg0X7ZcHX9bgA_A_1Q7pJSul',
  // Free USDA FoodData Central key for food and brand search (https://fdc.nal.usda.gov/api-key-signup).
  // Public by design; it only allows reading USDA's public food data. Empty = USDA's shared demo key.
  fdcKey: 'ygtQ1ElYnE5waV36INFy7n3PtGdzRxmvA1lbNNNF'
};
