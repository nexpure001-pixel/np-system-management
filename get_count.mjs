import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCount() {
  const { count, error } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true });
    
  if (error) console.error(error);
  else console.log("Total Payments Count:", count);
}
checkCount();
