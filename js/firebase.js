/* ===================================================
   MUSICALA  firebase.js
   Inicializacin Firebase + helpers Firestore
   =================================================== */

'use strict';

//  Config 

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCMP-QsrDh-nrWHFBMASbmOQqoqhsrnPmg",
  authDomain:        "juego-de-cartas-musicala.firebaseapp.com",
  projectId:         "juego-de-cartas-musicala",
  storageBucket:     "juego-de-cartas-musicala.firebasestorage.app",
  messagingSenderId: "795406768027",
  appId:             "1:795406768027:web:7f4c1628c082517b8ff33e"
};

//  Firebase SDK (via CDN ESM) 
// Cargamos dinmicamente para no bloquear el juego offline/local

let _db   = null;
let _auth = null;
let _fbReady = false;
let _fbReadyCallbacks = [];

function onFirebaseReady(cb) {
  if (_fbReady) { cb(); return; }
  _fbReadyCallbacks.push(cb);
}

async function loadFirebase() {
  if (_fbReady) return;
  try {
    const { initializeApp }           = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, deleteDoc }
                                       = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged }
                                       = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');

    const app = initializeApp(FIREBASE_CONFIG);
    _db   = getFirestore(app);
    _auth = getAuth(app);

    // Exponer funciones Firestore/Auth globalmente para el resto del cdigo
    window.FB = {
      db: _db, auth: _auth,
      doc, getDoc, setDoc, updateDoc, onSnapshot,
      collection, addDoc, serverTimestamp, deleteDoc,
      signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
    };

    _fbReady = true;
    _fbReadyCallbacks.forEach(cb => cb());
    _fbReadyCallbacks = [];

    console.log('[Firebase] Listo ');
  } catch (e) {
    console.error('[Firebase] Error al cargar:', e);
    showToast('Error al conectar con Firebase. Modo online no disponible.');
  }
}

//  Sala helpers 

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createRoom(hostName) {
  const { db, doc, setDoc, serverTimestamp } = window.FB;
  let code, tries = 0;
  do {
    code = genRoomCode();
    tries++;
  } while (tries < 10);

  const roomRef = doc(db, 'rooms', code);
  await setDoc(roomRef, {
    code,
    status:    'waiting',      // waiting | playing | ended
    hostUid:   _auth.currentUser.uid,
    hostName,
    players: [{
      uid:    _auth.currentUser.uid,
      name:   hostName,
      ready:  false,
    }],
    gameState: null,
    createdAt: serverTimestamp(),
  });
  return code;
}

async function joinRoom(code, playerName) {
  const { db, doc, getDoc, updateDoc } = window.FB;
  const roomRef  = doc(db, 'rooms', code.toUpperCase());
  const snap     = await getDoc(roomRef);
  if (!snap.exists())       throw new Error('Sala no encontrada.');
  const room = snap.data();
  if (room.status !== 'waiting') throw new Error('La partida ya comenz.');
  if (room.players.length >= 8)  throw new Error('La sala est llena (mx. 8).');

  const alreadyIn = room.players.find(p => p.uid === _auth.currentUser.uid);
  if (!alreadyIn) {
    await updateDoc(roomRef, {
      players: [...room.players, {
        uid:   _auth.currentUser.uid,
        name:  playerName,
        ready: false,
      }]
    });
  }
  return room;
}

async function leaveRoom(code) {
  const { db, doc, getDoc, updateDoc, deleteDoc } = window.FB;
  const roomRef = doc(db, 'rooms', code);
  const snap    = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room   = snap.data();
  const myUid  = _auth.currentUser?.uid;
  const updated = room.players.filter(p => p.uid !== myUid);
  if (updated.length === 0) {
    await deleteDoc(roomRef);
  } else {
    const newHost = updated[0].uid;
    await updateDoc(roomRef, { players: updated, hostUid: newHost });
  }
}

async function startOnlineGame(code) {
  const { db, doc, getDoc, updateDoc } = window.FB;
  const roomRef = doc(db, 'rooms', code);
  const snap    = await getDoc(roomRef);
  const room    = snap.data();

  // Construir estado inicial del juego (igual que initGame pero sin CPU)
  const deck = buildDeck();
  const n    = room.players.length;
  const hands = room.players.map(() => deck.splice(0, 7));

  let startIdx = deck.findIndex(c => c.type === 'note');
  if (startIdx === -1) startIdx = 0;
  const [startCard] = deck.splice(startIdx, 1);

  // Guardamos manos privadas por separado (seguridad: cada jugador solo ve la suya)
  const playersState = room.players.map((p, i) => ({
    uid:               p.uid,
    name:              p.name,
    handCount:         7,       // pblico  cuntas cartas tiene
    musicalaAnnounced: false,
  }));

  const gameState = {
    deck,
    discard:       [startCard],
    currentNote:   startCard.note,
    currentPlayer: 0,           // ndice en players[]
    direction:     1,
    skipNext:      false,
    forcedDir:     null,
    selectedCards: [],
    log:           [`La secuencia comienza en ${startCard.note}. Que empiece el juego!`],
    noteHistory:   [startCard.note],
    winner:        null,
    phase:         'play',
    turnCount:     0,
    players:       playersState,
  };

  // Guardar cada mano privada en sub-documentos
  const batch = [];
  room.players.forEach((p, i) => {
    batch.push(
      updateDoc(doc(window.FB.db, 'rooms', code, 'hands', p.uid), { hand: hands[i] })
        .catch(async () => {
          const { setDoc } = window.FB;
          await setDoc(doc(window.FB.db, 'rooms', code, 'hands', p.uid), { hand: hands[i] });
        })
    );
  });
  await Promise.all(batch);

  await updateDoc(roomRef, { status: 'playing', gameState });
}

async function writeGameState(code, newState) {
  const { db, doc, updateDoc } = window.FB;
  await updateDoc(doc(db, 'rooms', code), { gameState: newState });
}

async function writeMyHand(code, uid, hand) {
  const { db, doc, setDoc } = window.FB;
  await setDoc(doc(db, 'rooms', code, 'hands', uid), { hand });
}

async function readMyHand(code, uid) {
  const { db, doc, getDoc } = window.FB;
  const snap = await getDoc(doc(db, 'rooms', code, 'hands', uid));
  return snap.exists() ? snap.data().hand : [];
}

