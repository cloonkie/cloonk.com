/* Supabase shared sync config.

   The anon key is intended to be used in browser apps, but your database row
   level security policies decide what visitors can actually read and write.
   Leave these placeholders until your Supabase project is ready.
*/
const doorTrackerDefaultSupabaseConfig={
  url:'https://sctbyczqtqiblajwatlp.supabase.co',
  anonKey:'sb_publishable_EwmkuUNv2LciHWQqJQ_uzg_7xlcTA7Q',
  stateTable:'door_tracker_state',
  restoreTable:'door_tracker_restore_points'
};

const configuredDoorTrackerSupabase=window.DOOR_TRACKER_SUPABASE || {};
const hasUsableLocalConfig=
  configuredDoorTrackerSupabase.url &&
  configuredDoorTrackerSupabase.anonKey &&
  !String(configuredDoorTrackerSupabase.url).includes('YOUR-') &&
  !String(configuredDoorTrackerSupabase.anonKey).includes('YOUR-');

if(!hasUsableLocalConfig){
  window.DOOR_TRACKER_SUPABASE=doorTrackerDefaultSupabaseConfig;
}
