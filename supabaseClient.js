// ======================================================
// MR AWAY FIX — SUPABASE CONNECTION
// ======================================================

import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';


// ======================================================
// SUPABASE PROJECT
// ======================================================

const SUPABASE_URL =
  'https://mdougoeinwwzndybbmza.supabase.co';


// ======================================================
// SUPABASE PUBLISHABLE KEY
// ======================================================

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable__XlQCLrTsoifeCaFBzBI3Q_Pw2-Bchu';


// ======================================================
// CREATE SUPABASE CLIENT
// ======================================================

export const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );