// Fill these with your project values (Project Settings -> API)
window.SUPABASE_URL = "https://yscynbqgjfjdcdhplszw.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY3luYnFnamZqZGNkaHBsc3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTM4ODIsImV4cCI6MjA3MTg2OTg4Mn0.l9ypK28D5kBJIXInQOd6zCYdjiKIH-fvcVNdLYe_UzM";

const supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// Helper to get current session user
async function getUser() {
  const { data: { user } } = await supa.auth.getUser();
  return user;
}

window.supa = supa;
window.getUser = getUser;
