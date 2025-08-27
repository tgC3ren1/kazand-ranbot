// Fill these with your project values (Project Settings -> API)
window.SUPABASE_URL = window.SUPABASE_URL || "https://YOUR-PROJECT.supabase.co";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "YOUR-ANON-KEY";

const supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Helper to get current session user
async function getUser() {
  const { data: { user } } = await supa.auth.getUser();
  return user;
}

window.supa = supa;
window.getUser = getUser;
