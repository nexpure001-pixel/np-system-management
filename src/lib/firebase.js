import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyABWG1k0mwsdMXnC7O9nuOKmAbEx_zaSEU",
  authDomain: "npsystem-a06d2.firebaseapp.com",
  projectId: "npsystem-a06d2",
  storageBucket: "npsystem-a06d2.firebasestorage.app",
  messagingSenderId: "973651565323",
  appId: "1:973651565323:web:3371c73179d68e6eafa00e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
