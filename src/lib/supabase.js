import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } from './config'

// Only create a real client when keys exist; otherwise null (local demo mode).
export const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
