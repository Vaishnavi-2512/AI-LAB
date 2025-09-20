// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";


const firebaseConfig = {
apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
appId: import.meta.env.VITE_FIREBASE_APP_ID,
messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);


// Hint for UX: provider can include the hosted domain hint (not a hard security gate)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: "sastra.ac.in" });
