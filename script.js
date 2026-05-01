// ============================================
//            IMPORTS & CONFIG
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Firebase config
const appFirebase = initializeApp({
    apiKey: "AIzaSyDxfd_zWhV70QL97ea7a6W4W_BlySxtKLw",
    authDomain: "crowdedparty.firebaseapp.com",
    projectId: "crowdedparty"
});

const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

// ============================================
//            DOM ELEMENTS
// ============================================
// Pages
const authPage = document.getElementById('authPage');
const profileSetup = document.getElementById('profileSetup');
const app = document.getElementById('app');

// Auth
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

// Profile Setup
const usernameInput = document.getElementById('username');
const bioInput = document.getElementById('bio');
const photoFile = document.getElementById('photoFile');
const btnSaveProfile = document.getElementById('btnSaveProfile');

// Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const btnMenuToggle = document.getElementById('btnMenuToggle');
const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const usersDiv = document.getElementById('users');
const btnEditProfile = document.getElementById('btnEditProfile');
const btnLogout = document.getElementById('btnLogout');

// Chat
const chatTitle = document.getElementById('chatTitle');
const chatBadge = document.getElementById('chatBadge');
const chatHeaderInfo = document.getElementById('chatHeaderInfo');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const btnSend = document.getElementById('btnSend');
const typingArea = document.getElementById('typingArea');
const typingText = document.getElementById('typingText');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');

// Profile Popup
const profilePopup = document.getElementById('profilePopup');
const popupOverlay = document.getElementById('popupOverlay');
const pImg = document.getElementById('pImg');
const pName = document.getElementById('pName');
const pBio = document.getElementById('pBio');
const pRating = document.getElementById('pRating');
const btnCloseProfile = document.getElementById('btnCloseProfile');

// ============================================
//            STATE VARIABLES
// ============================================
let me = null;
let currentChat = 'global';
let usersCache = {};
let lastSend = 0;
let lastMsgTime = 0;
let typingTimers = {};
let myRatings = {};
let sidebarOpen = false;
let messagesUnsub = null;
let usersUnsub = null;
let isUserNearBottom = true;

// ============================================
//            UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function fileToBase64(f) {
    return new Promise(r => {
        const rd = new FileReader();
        rd.onload = () => r(rd.result);
        rd.readAsDataURL(f);
    });
}

// ============================================
//            SCROLL HANDLING
// ============================================
function checkIfNearBottom() {
    const threshold = 80;
    const scrollBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    isUserNearBottom = scrollBottom < threshold;

    if (!isUserNearBottom && messagesDiv.scrollHeight > messagesDiv.clientHeight + 100) {
        scrollBottomBtn.classList.add('show');
    } else {
        scrollBottomBtn.classList.remove('show');
    }
}

function scrollToBottom() {
    messagesDiv.scrollTo({
        top: messagesDiv.scrollHeight,
        behavior: 'smooth'
    });
    scrollBottomBtn.classList.remove('show');
    isUserNearBottom = true;
}

messagesDiv.addEventListener('scroll', checkIfNearBottom);
scrollBottomBtn.addEventListener('click', scrollToBottom);

// ============================================
//            TEXTAREA AUTO-RESIZE
// ============================================
msgInput.addEventListener('input', function() {
    // Reset height
    this.style.height = 'auto';
    // Set new height
    const newHeight = Math.min(this.scrollHeight, 120);
    this.style.height = newHeight + 'px';
    
    // Handle typing indicator
    handleTyping();
});

// Enter = new line, Shift+Enter = send
msgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
    }
});

// ============================================
//            AUTH FUNCTIONS
// ============================================
btnLogin.addEventListener('click', () => {
    const emailVal = emailInput.value.trim();
    const passVal = passwordInput.value;
    if (!emailVal || !passVal) return alert('Email dan password harus diisi!');
    signInWithEmailAndPassword(auth, emailVal, passVal)
        .catch(e => alert('Login gagal: ' + e.message));
});

btnRegister.addEventListener('click', () => {
    const emailVal = emailInput.value.trim();
    const passVal = passwordInput.value;
    if (!emailVal || !passVal) return alert('Email dan password harus diisi!');
    if (passVal.length < 6) return alert('Password minimal 6 karakter!');
    createUserWithEmailAndPassword(auth, emailVal, passVal)
        .catch(e => alert('Register gagal: ' + e.message));
});

btnLogout.addEventListener('click', async () => {
    if (!confirm('Yakin ingin logout?')) return;
    await setOnlineStatus(false);
    if (messagesUnsub) messagesUnsub();
    if (usersUnsub) usersUnsub();
    await signOut(auth);
    currentChat = 'global';
    usersCache = {};
    app.style.display = 'none';
    profileSetup.style.display = 'none';
    authPage.style.display = 'flex';
    emailInput.value = '';
    passwordInput.value = '';
    if (sidebarOpen) toggleSidebar();
});

// ============================================
//            AUTH STATE LISTENER
// ============================================
onAuthStateChanged(auth, async (u) => {
    if (!u) {
        me = null;
        return;
    }
    me = u;
    authPage.style.display = 'none';

    const snap = await getDoc(doc(db, 'users', u.uid));
    if (!snap.exists()) {
        profileSetup.style.display = 'flex';
        app.style.display = 'none';
    } else {
        profileSetup.style.display = 'none';
        app.style.display = 'flex';
        setTimeout(() => msgInput.focus(), 800);
        init();
    }
});

// ============================================
//            PROFILE FUNCTIONS
// ============================================
btnSaveProfile.addEventListener('click', async () => {
    const usernameVal = usernameInput.value.trim();
    if (!usernameVal) return alert('Username wajib diisi!');
    let file = photoFile.files[0];
    let photo = file ? await fileToBase64(file) : "";
    await setDoc(doc(db, 'users', me.uid), {
        username: usernameVal,
        bio: bioInput.value.trim(),
        photo: photo,
        rating: 0,
        totalRate: 0,
        online: true,
        typing: false,
        typingTo: ''
    });
    profileSetup.style.display = 'none';
    app.style.display = 'flex';
    setTimeout(() => msgInput.focus(), 500);
    init();
});

btnEditProfile.addEventListener('click', async () => {
    const snap = await getDoc(doc(db, 'users', me.uid));
    const d = snap.data();
    const name = prompt('Username baru:', d.username);
    if (!name || !name.trim()) return;
    const bioo = prompt('Bio baru:', d.bio);
    if (bioo === null) return;
    await updateDoc(doc(db, 'users', me.uid), { 
        username: name.trim(), 
        bio: bioo.trim() 
    });
    await loadUsers();
});

// ============================================
//            INIT
// ============================================
async function init() {
    await loadMyRatings();
    await loadUsers();
    loadMsgs();
    setOnlineStatus(true);
    setTimeout(() => msgInput.focus(), 1000);
}

async function loadMyRatings() {
    const snap = await getDoc(doc(db, 'ratings', me.uid));
    if (snap.exists()) myRatings = snap.data();
}

// ============================================
//            SIDEBAR
// ============================================
function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
    sidebarOverlay.classList.toggle('show', sidebarOpen);
    if (!sidebarOpen) {
        setTimeout(() => msgInput.focus(), 300);
    }
}

btnMenuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

btnSearch.addEventListener('click', () => {
    loadUsers(searchInput.value.trim());
});

searchInput.addEventListener('input', () => {
    loadUsers(searchInput.value.trim());
});

// ============================================
//            LOAD USERS
// ============================================
async function loadUsers(searchTerm = '') {
    const snap = await getDocs(collection(db, 'users'));
    let users = [];
    usersCache = {};

    snap.forEach(d => {
        const data = d.data();
        usersCache[d.id] = data;
        users.push({ id: d.id, ...data });
    });

    users = users.filter(u => u.id !== me.uid);

    if (searchTerm) {
        users = users.filter(u =>
            u.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort: online first, then by rating
    users.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return (b.rating || 0) - (a.rating || 0);
    });

    let html = '';
    users.forEach(u => {
        let statusClass = 'offline';
        let statusText = 'Offline';
        if (u.online) {
            if (u.typing && u.typingTo === me.uid) {
                statusClass = 'typing';
                statusText = 'Mengetik...';
            } else {
                statusClass = 'online';
                statusText = 'Online';
            }
        }
        html += `
        <div class="user-card" data-uid="${u.id}">
            <img class="user-card-avatar" src="${u.photo || 'https://i.imgur.com/HeIi0wU.png'}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">
            <div class="user-card-info">
                <div class="user-card-name">${escapeHtml(u.username)}</div>
                <div class="user-card-status">
                    <span class="status-dot ${statusClass}"></span>${statusText}
                </div>
            </div>
            <div class="user-card-rating">⭐${(u.rating || 0).toFixed(1)}</div>
        </div>`;
    });

    usersDiv.innerHTML = html || '<p style="text-align:center;color:#666;margin-top:20px">Tidak ada pengguna</p>';

    // Add click listeners
    usersDiv.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', () => {
            openChat(card.dataset.uid);
        });
    });
}

// ============================================
//            OPEN CHAT
// ============================================
function openChat(id) {
    currentChat = id;
    const user = usersCache[id];
    if (user) {
        chatTitle.textContent = '💬 ' + user.username;
        chatBadge.textContent = 'Private';
        chatBadge.style.background = 'linear-gradient(135deg, #00c853, #69f0ae)';
    }
    loadMsgs();
    toggleSidebar();
    setTimeout(() => msgInput.focus(), 400);
}

chatHeaderInfo.addEventListener('click', () => {
    currentChat = 'global';
    chatTitle.textContent = '🌍 Global Chat';
    chatBadge.textContent = 'Global';
    chatBadge.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    loadMsgs();
});

// ============================================
//            SEND MESSAGE
// ============================================
async function sendMsg() {
    const text = msgInput.value.trim();
    if (!text) return;

    const now = Date.now();
    if (currentChat === 'global' && now - lastSend < 12000) {
        alert('⏳ Cooldown 12 detik untuk global chat');
        return;
    }
    lastSend = now;

    try {
        await addDoc(collection(db, 'messages'), {
            text: text,
            uid: me.uid,
            to: currentChat,
            time: now
        });
        msgInput.value = '';
        msgInput.style.height = 'auto';
        msgInput.focus();
        isUserNearBottom = true;
        await updateDoc(doc(db, 'users', me.uid), { typing: false, typingTo: '' });
    } catch (e) {
        alert('Gagal mengirim pesan: ' + e.message);
    }
}

btnSend.addEventListener('click', sendMsg);

// ============================================
//            TYPING INDICATOR
// ============================================
async function handleTyping() {
    if (currentChat === 'global') return;
    await updateDoc(doc(db, 'users', me.uid), { typing: true, typingTo: currentChat });
    clearTimeout(typingTimers[currentChat]);
    typingTimers[currentChat] = setTimeout(async () => {
        await updateDoc(doc(db, 'users', me.uid), { typing: false, typingTo: '' });
    }, 2000);
}

// ============================================
//            LOAD MESSAGES (SMART SCROLL)
// ============================================
function loadMsgs() {
    if (messagesUnsub) messagesUnsub();
    if (usersUnsub) usersUnsub();

    messagesUnsub = onSnapshot(collection(db, 'messages'), (snap) => {
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => a.time - b.time);

        let html = '';
        arr.forEach(m => {
            if (!usersCache[m.uid]) return;
            if (currentChat === 'global' && m.to !== 'global') return;
            if (currentChat !== 'global' && !(
                (m.uid === me.uid && m.to === currentChat) ||
                (m.uid === currentChat && m.to === me.uid)
            )) return;

            const isMe = m.uid === me.uid;
            const user = usersCache[m.uid];
            const photo = user.photo || "https://i.imgur.com/HeIi0wU.png";

            if (!isMe && m.time > lastMsgTime && document.hidden) {
                try {
                    new Notification(user.username, { body: m.text, icon: photo });
                } catch (e) { }
            }
            lastMsgTime = m.time;

            html += `
            <div class="msgRow ${isMe ? 'me' : 'other'}">
                ${!isMe ? `<img src="${photo}" class="avatar" data-uid="${m.uid}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">` : ''}
                <div class="msg-content-wrapper">
                    <div class="msg">${escapeHtml(m.text)}</div>
                    <div class="msg-time">${formatTime(m.time)}</div>
                    <div class="msg-actions">
                        ${isMe ? `<button class="delete-btn" data-msgid="${m.id}">🗑</button>` : ''}
                        ${!isMe ? ratingUI(m.uid) : ''}
                    </div>
                </div>
                ${isMe ? `<img src="${photo}" class="avatar" data-uid="${m.uid}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">` : ''}
            </div>`;
        });

        messagesDiv.innerHTML = html;

        // Smart scroll
        if (isUserNearBottom) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        checkIfNearBottom();

        // Add event listeners
        attachMessageListeners();
    });

    // Listen for typing & online status
    usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
        let typingUser = null;
        snap.forEach(d => {
            const data = d.data();
            usersCache[d.id] = data;
            if (d.id === currentChat && data.typing && data.typingTo === me.uid) {
                typingUser = data.username;
            }
        });

        if (typingUser) {
            typingArea.style.display = 'flex';
            typingText.textContent = typingUser + ' sedang mengetik...';
        } else {
            typingArea.style.display = 'none';
        }

        if (sidebarOpen) loadUsers(searchInput.value || '');
    });
}

// ============================================
//            MESSAGE EVENT LISTENERS
// ============================================
function attachMessageListeners() {
    // Avatar click -> show profile
    messagesDiv.querySelectorAll('.avatar').forEach(avatar => {
        avatar.addEventListener('click', () => {
            showProfile(avatar.dataset.uid);
        });
    });

    // Delete button
    messagesDiv.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            delMsg(btn.dataset.msgid);
        });
    });

    // Rate buttons
    messagesDiv.querySelectorAll('.rate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.disabled) return;
            rateUser(this.dataset.uid, parseInt(this.dataset.star));
        });
    });
}

// ============================================
//            RATING SYSTEM
// ============================================
function ratingUI(uid) {
    const rated = myRatings[uid] || 0;
    let stars = '';
    for (let s = 1; s <= 5; s++) {
        stars += `<button class="rate-btn ${rated >= s ? 'rated' : ''}" 
            data-uid="${uid}" 
            data-star="${s}" 
            ${rated > 0 ? 'disabled' : ''}>⭐</button>`;
    }
    if (rated > 0) stars += `<span class="rated-label">Done</span>`;
    return `<div class="rate-container">${stars}</div>`;
}

async function rateUser(uid, star) {
    if (myRatings[uid]) return alert('⚠️ Kamu sudah memberikan rating!');
    if (!confirm(`Beri rating ${star}⭐?`)) return;

    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const d = snap.data();
    const total = (d.totalRate || 0) + 1;
    const rating = (((d.rating || 0) * (d.totalRate || 0)) + star) / total;

    await updateDoc(ref, { rating, totalRate: total });
    myRatings[uid] = star;
    await setDoc(doc(db, 'ratings', me.uid), myRatings);
    alert('✅ Rating berhasil!');
    loadMsgs();
}

// ============================================
//            DELETE MESSAGE
// ============================================
async function delMsg(id) {
    if (!confirm('Hapus pesan?')) return;
    await updateDoc(doc(db, 'messages', id), { text: '[pesan dihapus]' });
}

// ============================================
//            PROFILE POPUP
// ============================================
function showProfile(id) {
    const u = usersCache[id];
    if (!u) return;
    pName.innerText = u.username;
    pBio.innerText = u.bio || 'Tidak ada bio';
    pImg.src = u.photo || "https://i.imgur.com/HeIi0wU.png";
    pImg.onerror = function() { this.src = 'https://i.imgur.com/HeIi0wU.png'; };
    pRating.innerText = `Rating: ⭐ ${(u.rating || 0).toFixed(1)} (${u.totalRate || 0} votes)`;
    profilePopup.style.display = 'block';
    popupOverlay.style.display = 'block';
}

function closeProfile() {
    profilePopup.style.display = 'none';
    popupOverlay.style.display = 'none';
}

btnCloseProfile.addEventListener('click', closeProfile);
popupOverlay.addEventListener('click', closeProfile);

// ============================================
//            ONLINE STATUS
// ============================================
async function setOnlineStatus(status) {
    if (!me) return;
    try {
        await updateDoc(doc(db, 'users', me.uid), {
            online: status,
            typing: false,
            typingTo: ''
        });
    } catch (e) { }
}

window.addEventListener('beforeunload', () => setOnlineStatus(false));
window.addEventListener('focus', () => { if (me) setOnlineStatus(true); });
window.addEventListener('blur', () => { if (me) setOnlineStatus(false); });

// ============================================
//            NOTIFICATION PERMISSION
// ============================================
Notification.requestPermission();

// ============================================
//            KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    // Escape to close sidebar
    if (e.key === 'Escape' && sidebarOpen) {
        toggleSidebar();
    }
    // Escape to close profile popup
    if (e.key === 'Escape' && profilePopup.style.display === 'block') {
        closeProfile();
    }
});

console.log('✅ AxChat siap digunakan!');
console.log('💡 Tips: Enter = kirim pesan, Shift+Enter = baris baru');
