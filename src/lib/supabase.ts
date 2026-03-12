import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjmodlwqyhjalmydgwdd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqbW9kbHdxeWhqYWxteWRnd2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg4MzQsImV4cCI6MjA4ODgyNDgzNH0.lwVRZIMTZmPorXGCKGudOZ62-coumJKqwEbPDPp-6nc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
