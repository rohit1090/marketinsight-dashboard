
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDizCBHPz2if4FHifjO1GEYvNdVvmgH0oI",
  authDomain: "marketinsight-dashboard-9c064.firebaseapp.com",
  projectId: "marketinsight-dashboard-9c064",
  storageBucket: "marketinsight-dashboard-9c064.appspot.com",
  messagingSenderId: "247128416647",
  appId: "1:247128416647:web:ef811120c7d7744bd0b322"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

console.log('🔐 Firebase initialized');

// Enable persistence so user stays logged in across page refreshes
// This should be called before any auth operations
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Auth persistence enabled');
  })
  .catch((error) => {
    console.error('❌ Failed to set auth persistence:', error.code, error.message);
  });

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
