import { createClient } from '@supabase/supabase-js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';

// --- Configuration ---
const supabaseUrl = 'https://aosrdhlxfewpqhgjfmjb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3JkaGx4ZmV3cHFoZ2pmbWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTQ0NDgsImV4cCI6MjA4NDQzMDQ0OH0.OY1lZAfzjq0FOExufZjJ2pwqmF83ge8XSeQ5_mxB3hs';

const firebaseConfig = {
  apiKey: "AIzaSyABWG1k0mwsdMXnC7O9nuOKmAbEx_zaSEU",
  authDomain: "npsystem-a06d2.firebaseapp.com",
  projectId: "npsystem-a06d2",
  storageBucket: "npsystem-a06d2.firebasestorage.app",
  messagingSenderId: "973651565323",
  appId: "1:973651565323:web:3371c73179d68e6eafa00e"
};

// --- Initialization ---
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const TABLES_TO_MIGRATE = [
  'stores',
  'payments',
  'cooling_off_records',
  'work_members',
  'work_requests',
  'users',
  'leave_grants',
  'leave_requests',
  'leave_consumptions',
  'manuals'
];

async function migrate() {
  console.log('🚀 Starting migration check...');

  for (const table of TABLES_TO_MIGRATE) {
    console.log(`\n📦 Migrating table: ${table}...`);
    
    // Fetch from Supabase
    const { data: records, error } = await supabase.from(table).select('*');
    
    if (error) {
      console.error(`❌ Error fetching from ${table}:`, error.message);
      continue;
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No records found in ${table}. Skipping.`);
      continue;
    }

    console.log(`✅ Found ${records.length} records. Writing to Firestore...`);

    // Writing to Firestore (Chunking to avoid batch limits if necessary)
    const BATCH_SIZE = 400;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = records.slice(i, i + BATCH_SIZE);
      
      for (const record of chunk) {
        // Use 'id' or other unique key as document ID to maintain relations
        const docId = String(record.id || record.store_id || record.np_seller_id || Math.random().toString(36).substring(2));
        const docRef = doc(collection(db, table), docId);
        batch.set(docRef, record);
      }
      
      await batch.commit();
      console.log(`   - Progress: ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }

  console.log('\n✨ Migration completed successfully!');
}

migrate().catch(err => {
  console.error('🔥 Critical Migration Error:', err);
});
