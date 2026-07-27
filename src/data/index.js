import { USE_SUPABASE } from '../lib/config'
import { localProvider } from './localProvider'
import { supabaseProvider } from './supabaseProvider'

// One import for the whole app. Automatically picks the right backend.
export const db = USE_SUPABASE ? supabaseProvider : localProvider
