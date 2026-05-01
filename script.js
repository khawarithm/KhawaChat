// ============================================
//            IMPORTS & CONFIG
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
const authPage = document.getElementById('authPage');
const profileSetup = document.getElementById('profileSetup');
const app = document.getElementById('app');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const usernameInput = document.getElementById('username');
const bioInput = document.getElementById('bio');
const photoFile = document.getElementById('photoFile');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const btnMenuToggle = document.getElementById('btnMenuToggle');
const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const usersDiv = document.getElementById('users');
const btnEditProfile = document.getElementById('btnEditProfile');
const btnLogout = document.getElementById('btnLogout');
const chatTitle = document.getElementById('chatTitle');
const chatBadge = document.getElementById('chatBadge');
const chatHeaderInfo = document.getElementById('chatHeaderInfo');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const btnSend = document.getElementById('btnSend');
const typingArea = document.getElementById('typingArea');
const typingText = document.getElementById('typingText');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const profilePopup = document.getElementById('profilePopup');
const popupOverlay = document.getElementById('popupOverlay');
const pImg = document.getElementById('pImg');
const pName = document.getElementById('pName');
const pBio = document.getElementById('pBio');
const pRating = document.getElementById('pRating');
const btnCloseProfile = document.getElementById('btnCloseProfile');
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalCancel = document.getElementById('modalCancel');
const modalOk = document.getElementById('modalOk');
const toast = document.getElementById('toast');
const editProfileModal = document.getElementById('editProfileModal');
const editUsername = document.getElementById('editUsername');
const editBio = document.getElementById('editBio');
const editPhotoFile = document.getElementById('editPhotoFile');
const cancelEditProfile = document.getElementById('cancelEditProfile');
const saveEditProfile = document.getElementById('saveEditProfile');
const editFileLabel = document.getElementById('editFileLabel');

// ============================================
//            STATE
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
let modalCallback = null;

// ============================================
//            UTILITIES
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

// Toast
function showToast(msg, duration = 2500) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// Custom Modal
function showModal(message, isConfirm = false, callback = null) {
    modalMessage.textContent = message;
    modalOverlay.classList.add('show');
    modalCancel.style.display = isConfirm ? 'inline-block' : 'none';
    modalOk.textContent = isConfirm ? 'Ya' : 'OK';
    modalCallback = callback;
}
function hideModal() {
    modalOverlay.classList.remove('show');
    modalCallback = null;
}
modalOk.addEventListener('click', () => {
    hideModal();
    if (modalCallback) modalCallback(true);
});
modalCancel.addEventListener('click', () => {
    hideModal();
    if (modalCallback) modalCallback(false);
});
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
});

// ============================================
//            SCROLL
// ============================================
function checkIfNearBottom() {
    const threshold = 80;
    const scrollBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    isUserNearBottom = scrollBottom < threshold;
    scrollBottomBtn.classList.toggle('show', !isUserNearBottom && messagesDiv.scrollHeight > messagesDiv.clientHeight + 100);
}
function scrollToBottom() {
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    scrollBottomBtn.classList.remove('show');
    isUserNearBottom = true;
}
messagesDiv.addEventListener('scroll', checkIfNearBottom);
scrollBottomBtn.addEventListener('click', scrollToBottom);

// ============================================
//            TEXTAREA & SEND
// ============================================
msgInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    handleTyping();
});
msgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
    }
});
btnSend.addEventListener('click', sendMsg);

// Fokus input saat klik area chat kosong
document.getElementById('chatContainer').addEventListener('click', function(e) {
    if (!e.target.closest('.messages') &&
        !e.target.closest('.chat-header') &&
        !e.target.closest('.send-btn') &&
        !e.target.closest('.scroll-bottom-btn') &&
        !e.target.closest('.chat-input-area')) {
        msgInput.focus();
    }
});

// ============================================
//            AUTH
// ============================================
btnLogin.addEventListener('click', () => {
    const em = emailInput.value.trim();
    const pw = passwordInput.value;
    if (!em || !pw) return showToast('Email dan password harus diisi!');
    signInWithEmailAndPassword(auth, em, pw).catch(e => showToast('Login gagal: ' + e.message));
});
btnRegister.addEventListener('click', () => {
    const em = emailInput.value.trim();
    const pw = passwordInput.value;
    if (!em || !pw) return showToast('Email dan password harus diisi!');
    if (pw.length < 6) return showToast('Password minimal 6 karakter!');
    createUserWithEmailAndPassword(auth, em, pw).catch(e => showToast('Register gagal: ' + e.message));
});
btnLogout.addEventListener('click', () => {
    showModal('Yakin ingin logout?', true, async (yes) => {
        if (!yes) return;
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
});

onAuthStateChanged(auth, async (u) => {
    if (!u) { me = null; return; }
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
//            PROFILE SETUP
// ============================================
btnSaveProfile.addEventListener('click', async () => {
    const name = usernameInput.value.trim();
    if (!name) return showToast('Username wajib diisi!');
    let file = photoFile.files[0];
    let photo = file ? await fileToBase64(file) : "";
    await setDoc(doc(db, 'users', me.uid), {
        username: name,
        bio: bioInput.value.trim(),
        photo,
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

// Edit Profile Modal
btnEditProfile.addEventListener('click', async () => {
    const snap = await getDoc(doc(db, 'users', me.uid));
    const d = snap.data();
    editUsername.value = d.username || '';
    editBio.value = d.bio || '';
    editFileLabel.childNodes[0].textContent = '📸 Ganti Foto Profile';
    editPhotoFile.value = '';
    editProfileModal.classList.add('show');
});
cancelEditProfile.addEventListener('click', () => editProfileModal.classList.remove('show'));
editProfileModal.addEventListener('click', (e) => {
    if (e.target === editProfileModal) editProfileModal.classList.remove('show');
});
editPhotoFile.addEventListener('change', function() {
    editFileLabel.childNodes[0].textContent = this.files[0]?.name || '📸 Ganti Foto Profile';
});
saveEditProfile.addEventListener('click', async () => {
    const name = editUsername.value.trim();
    if (!name) return showToast('Username wajib diisi!');
    let file = editPhotoFile.files[0];
    let photo = null;
    if (file) photo = await fileToBase64(file);
    const updateData = { username: name, bio: editBio.value.trim() };
    if (photo) updateData.photo = photo;
    await updateDoc(doc(db, 'users', me.uid), updateData);
    editProfileModal.classList.remove('show');
    showToast('Profil berhasil diperbarui!');
    loadUsers();
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
    if (!sidebarOpen) setTimeout(() => msgInput.focus(), 300);
}
btnMenuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
btnSearch.addEventListener('click', () => loadUsers(searchInput.value.trim()));
searchInput.addEventListener('input', () => loadUsers(searchInput.value.trim()));

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
    users.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return (b.rating || 0) - (a.rating || 0);
    });
    let html = '';
    users.forEach(u => {
        let statusClass = 'offline',
            statusText = 'Offline';
        if (u.online) {
            if (u.typing && u.typingTo === me.uid) {
                statusClass = 'typing';
                statusText = 'Mengetik...';
            } else {
                statusClass = 'online';
                statusText = 'Online';
            }
        }
        html += `<div class="user-card" data-uid="${u.id}">
            <img class="user-card-avatar" src="${u.photo || 'https://i.imgur.com/HeIi0wU.png'}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">
            <div class="user-card-info">
                <div class="user-card-name">${escapeHtml(u.username)}</div>
                <div class="user-card-status"><span class="status-dot ${statusClass}"></span>${statusText}</div>
            </div>
            <div class="user-card-rating">⭐${(u.rating || 0).toFixed(1)}</div>
        </div>`;
    });
    usersDiv.innerHTML = html || '<p style="text-align:center;color:#666;margin-top:20px">Tidak ada pengguna</p>';
    usersDiv.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', () => openChat(card.dataset.uid));
    });
}

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
        return showToast('⏳ Cooldown 12 detik');
    }
    lastSend = now;
    try {
        await addDoc(collection(db, 'messages'), {
            text,
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
        showToast('Gagal mengirim: ' + e.message);
    }
}

async function handleTyping() {
    if (currentChat === 'global') return;
    await updateDoc(doc(db, 'users', me.uid), { typing: true, typingTo: currentChat });
    clearTimeout(typingTimers[currentChat]);
    typingTimers[currentChat] = setTimeout(async () => {
        await updateDoc(doc(db, 'users', me.uid), { typing: false, typingTo: '' });
    }, 2000);
}

// ============================================
//            LOAD MESSAGES
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
                try { new Notification(user.username, { body: m.text, icon: photo }); } catch (e) {}
            }
            lastMsgTime = m.time;
            html += `<div class="msgRow ${isMe ? 'me' : 'other'}">
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
        if (isUserNearBottom) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        checkIfNearBottom();
        attachMessageListeners();
    });

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

function attachMessageListeners() {
    messagesDiv.querySelectorAll('.avatar').forEach(av => {
        av.addEventListener('click', () => showProfile(av.dataset.uid));
    });
    messagesDiv.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => delMsg(btn.dataset.msgid));
    });
    messagesDiv.querySelectorAll('.rate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.disabled) return;
            rateUser(this.dataset.uid, parseInt(this.dataset.star));
        });
    });
}

function ratingUI(uid) {
    const rated = myRatings[uid] || 0;
    let stars = '';
    for (let s = 1; s <= 5; s++) {
        stars += `<button class="rate-btn ${rated >= s ? 'rated' : ''}" data-uid="${uid}" data-star="${s}" ${rated > 0 ? 'disabled' : ''}>⭐</button>`;
    }
    if (rated > 0) stars += '<span class="rated-label">Done</span>';
    return `<div class="rate-container">${stars}</div>`;
}

async function rateUser(uid, star) {
    if (myRatings[uid]) return showToast('⚠️ Kamu sudah memberikan rating!');
    showModal(`Beri rating ${star}⭐ ke pengguna ini?`, true, async (yes) => {
        if (!yes) return;
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        const d = snap.data();
        const total = (d.totalRate || 0) + 1;
        const rating = (((d.rating || 0) * (d.totalRate || 0)) + star) / total;
        await updateDoc(ref, { rating, totalRate: total });
        myRatings[uid] = star;
        await setDoc(doc(db, 'ratings', me.uid), myRatings);
        showToast('✅ Rating berhasil!');
        loadMsgs();
    });
}

async function delMsg(id) {
    showModal('Hapus pesan ini?', true, async (yes) => {
        if (yes) await updateDoc(doc(db, 'messages', id), { text: '[pesan dihapus]' });
    });
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
btnCloseProfile.addEventListener('click', () => {
    profilePopup.style.display = 'none';
    popupOverlay.style.display = 'none';
});
popupOverlay.addEventListener('click', () => {
    profilePopup.style.display = 'none';
    popupOverlay.style.display = 'none';
});

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
    } catch (e) {}
}
window.addEventListener('beforeunload', () => setOnlineStatus(false));
window.addEventListener('focus', () => { if (me) setOnlineStatus(true); });
window.addEventListener('blur', () => { if (me) setOnlineStatus(false); });

Notification.requestPermission();

// Escape shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarOpen) toggleSidebar();
    if (e.key === 'Escape' && profilePopup.style.display === 'block') {
        profilePopup.style.display = 'none';
        popupOverlay.style.display = 'none';
    }
});

console.log('✅ AxChat siap! Input chat PASTI ada di bawah.');
   
