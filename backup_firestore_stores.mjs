import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyABWG1k0mwsdMXnC7O9nuOKmAbEx_zaSEU",
  authDomain: "npsystem-a06d2.firebaseapp.com",
  projectId: "npsystem-a06d2",
  storageBucket: "npsystem-a06d2.firebasestorage.app",
  messagingSenderId: "973651565323",
  appId: "1:973651565323:web:3371c73179d68e6eafa00e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function backup() {
  console.log('📦 Firestore [stores] のバックアップを開始します...');
  const querySnapshot = await getDocs(collection(db, 'stores'));
  const data = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync('stores_backup_before_refresh.json', JSON.stringify(data, null, 2));
  console.log(`✅ ${data.length} 件のデータを stores_backup_before_refresh.json に保存しました。`);
}

backup().catch(console.error);
