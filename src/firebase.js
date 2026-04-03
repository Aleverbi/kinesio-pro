import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9zZxlt7r9vOtV-9MAiH0qaSDZnMo1l6E",
  authDomain: "kinesio-pro.firebaseapp.com",
  projectId: "kinesio-pro",
  storageBucket: "kinesio-pro.firebasestorage.app",
  messagingSenderId: "628591007106",
  appId: "1:628591007106:web:322edbe554299a9dddeb9b",
  measurementId: "G-RNNL83GRLS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Storage abstraction (same interface as before, backed by Firestore) ---
const DOC_ID = "kinesio-main";
const COLLECTION = "kinesio-data";

export async function loadData(defaultData) {
  try {
    const docRef = doc(db, COLLECTION, DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data();
      return {
        ...defaultData,
        ...parsed,
        config: { ...defaultData.config, ...(parsed.config || {}) },
      };
    }
  } catch (e) {
    console.error("Error loading data from Firebase:", e);
  }
  return defaultData;
}

export async function saveData(data) {
  try {
    const docRef = doc(db, COLLECTION, DOC_ID);
    await setDoc(docRef, JSON.parse(JSON.stringify(data)));
  } catch (e) {
    console.error("Error saving to Firebase:", e);
  }
}

export { db };
