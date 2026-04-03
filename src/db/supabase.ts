// src/db/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for server-side writes (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
