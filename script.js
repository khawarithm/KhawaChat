// ============================================
//            IMPORTS & CONFIG
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc, getDocs, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

// Setup Profile
const setupPreviewImg = document.getElementById('setupPreviewImg');
const setupPhotoInput = document.getElementById('setupPhotoInput');
const setupPhotoLabel = document.getElementById('setupPhotoLabel');
const setupUsername = document.getElementById('setupUsername');
const setupBio = document.getElementById('setupBio');
const btnSaveSetupProfile = document.getElementById('btnSaveSetupProfile');

// Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const btnMenuToggle = document.getElementById('btnMenuToggle');
const sidebarContent = document.getElementById('sidebarContent');
const btnEditProfile = document.getElementById('btnEditProfile');
const btnLogout = document.getElementById('btnLogout');
const sidebarTabs = document.querySelectorAll('.sidebar-tab');

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

// Custom Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalCancel = document.getElementById('modalCancel');
const modalOk = document.getElementById('modalOk');

// Toast
const toast = document.getElementById('toast');

// Edit Profile Modal
const editProfileOverlay = document.getElementById('editProfileOverlay');
const editPreviewImg = document.getElementById('editPreviewImg');
const editPhotoInput = document.getElementById('editPhotoInput');
const editPhotoLabel = document.getElementById('editPhotoLabel');
const editUsernameInput = document.getElementById('editUsernameInput');
const editBioInput = document.getElementById('editBioInput');
const cancelEditProfile = document.getElementById('cancelEditProfile');
const saveEditProfile = document.getElementById('saveEditProfile');

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
let activeSidebarTab = 'chats';
let chatHistory = {}; // { uid: { lastMsg: "teks", lastTime: timestamp, unread: 0 } }
let currentPhotoData = null; // Foto dari setup
let editPhotoData = null;   // Foto dari edit

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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Toast
function showToast(msg, duration = 2500) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// Custom Modal
function showModal(message, isConfirm = false, callback = null) {
    if (!modalOverlay || !modalMessage || !modalCancel || !modalOk) return;
    modalMessage.textContent = message;
    modalOverlay.classList.add('show');
    modalCancel.style.display = isConfirm ? 'inline-block' : 'none';
    modalOk.textContent = isConfirm ? 'Ya' : 'OK';
    modalCallback = callback;
}

function hideModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('show');
    modalCallback = null;
}

if (modalOk) {
    modalOk.addEventListener('click', () => {
        hideModal();
        if (modalCallback) modalCallback(true);
    });
}
if (modalCancel) {
    modalCancel.addEventListener('click', () => {
        hideModal();
        if (modalCallback) modalCallback(false);
    });
}
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });
}

// ============================================
//            SCROLL
// ============================================
function checkIfNearBottom() {
    if (!messagesDiv) return;
    const threshold = 80;
    const scrollBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    isUserNearBottom = scrollBottom < threshold;
    if (scrollBottomBtn) {
        scrollBottomBtn.classList.toggle('show', !isUserNearBottom && messagesDiv.scrollHeight > messagesDiv.clientHeight + 100);
    }
}

function scrollToBottom() {
    if (!messagesDiv) return;
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    if (scrollBottomBtn) scrollBottomBtn.classList.remove('show');
    isUserNearBottom = true;
}

if (messagesDiv) messagesDiv.addEventListener('scroll', checkIfNearBottom);
if (scrollBottomBtn) scrollBottomBtn.addEventListener('click', scrollToBottom);

// ============================================
//            TEXTAREA & SEND
// ============================================
if (msgInput) {
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
}
if (btnSend) btnSend.addEventListener('click', sendMsg);

// Fokus input saat klik area chat kosong
const chatContainer = document.getElementById('chatContainer');
if (chatContainer) {
    chatContainer.addEventListener('click', function(e) {
        if (!e.target.closest('.messages') &&
            !e.target.closest('.chat-header') &&
            !e.target.closest('.send-btn') &&
            !e.target.closest('.scroll-bottom-btn') &&
            !e.target.closest('.chat-input-area') &&
            !e.target.closest('.chat-input-container')) {
            if (msgInput) msgInput.focus();
        }
    });
}

// ============================================
//            AUTH
// ============================================
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const em = emailInput?.value?.trim();
        const pw = passwordInput?.value;
        if (!em || !pw) return showToast('Email dan password harus diisi!');
        signInWithEmailAndPassword(auth, em, pw).catch(e => showToast('Login gagal: ' + e.message));
    });
}
if (btnRegister) {
    btnRegister.addEventListener('click', () => {
        const em = emailInput?.value?.trim();
        const pw = passwordInput?.value;
        if (!em || !pw) return showToast('Email dan password harus diisi!');
        if (pw.length < 6) return showToast('Password minimal 6 karakter!');
        createUserWithEmailAndPassword(auth, em, pw).catch(e => showToast('Register gagal: ' + e.message));
    });
}
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        showModal('Yakin ingin logout?', true, async (yes) => {
            if (!yes) return;
            try {
                await setOnlineStatus(false);
                if (messagesUnsub) messagesUnsub();
                if (usersUnsub) usersUnsub();
                await signOut(auth);
            } catch (e) {
                console.error('Logout error:', e);
            }
            // Reset state
            currentChat = 'global';
            usersCache = {};
            chatHistory = {};
            currentPhotoData = null;
            editPhotoData = null;
            // Hide all, show login
            if (app) app.style.display = 'none';
            if (profileSetup) profileSetup.style.display = 'none';
            if (authPage) authPage.style.display = 'flex';
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (sidebarOpen) toggleSidebar();
            showToast('Berhasil logout!');
        });
    });
}

// ============================================
//            AUTH STATE LISTENER
// ============================================
onAuthStateChanged(auth, async (u) => {
    if (!u) {
        me = null;
        return;
    }
    me = u;
    if (authPage) authPage.style.display = 'none';

    const snap = await getDoc(doc(db, 'users', u.uid));
    if (!snap.exists()) {
        if (profileSetup) profileSetup.style.display = 'flex';
        if (app) app.style.display = 'none';
    } else {
        if (profileSetup) profileSetup.style.display = 'none';
        if (app) app.style.display = 'flex';
        setTimeout(() => { if (msgInput) msgInput.focus(); }, 800);
        await init();
    }
});

// ============================================
//            SETUP PROFILE (FIRST TIME)
// ============================================
if (setupPhotoInput) {
    setupPhotoInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (file) {
            currentPhotoData = await fileToBase64(file);
            if (setupPreviewImg) setupPreviewImg.src = currentPhotoData;
            if (setupPhotoLabel) setupPhotoLabel.childNodes[0].textContent = file.name;
        }
    });
}

if (btnSaveSetupProfile) {
    btnSaveSetupProfile.addEventListener('click', async () => {
        const name = setupUsername?.value?.trim();
        if (!name) return showToast('Username wajib diisi!');
        if (!me) return showToast('Error: User tidak ditemukan!');

        const photo = currentPhotoData || '';
        try {
            await setDoc(doc(db, 'users', me.uid), {
                username: name,
                bio: setupBio?.value?.trim() || '',
                photo: photo,
                rating: 0,
                totalRate: 0,
                online: true,
                typing: false,
                typingTo: ''
            });
            if (profileSetup) profileSetup.style.display = 'none';
            if (app) app.style.display = 'flex';
            setTimeout(() => { if (msgInput) msgInput.focus(); }, 500);
            await init();
            showToast('Profile berhasil dibuat! 🎉');
        } catch (e) {
            showToast('Gagal menyimpan profile: ' + e.message);
        }
    });
}

// ============================================
//            EDIT PROFILE MODAL
// ============================================
if (btnEditProfile) {
    btnEditProfile.addEventListener('click', async () => {
        if (!me) return;
        const snap = await getDoc(doc(db, 'users', me.uid));
        const d = snap.data();
        if (editUsernameInput) editUsernameInput.value = d.username || '';
        if (editBioInput) editBioInput.value = d.bio || '';
        if (editPreviewImg) editPreviewImg.src = d.photo || 'https://i.imgur.com/HeIi0wU.png';
        editPhotoData = null;
        if (editPhotoInput) editPhotoInput.value = '';
        if (editPhotoLabel) editPhotoLabel.childNodes[0].textContent = '📸 Ganti Foto';
        if (editProfileOverlay) editProfileOverlay.classList.add('show');
    });
}

if (cancelEditProfile) {
    cancelEditProfile.addEventListener('click', () => {
        if (editProfileOverlay) editProfileOverlay.classList.remove('show');
    });
}

if (editProfileOverlay) {
    editProfileOverlay.addEventListener('click', (e) => {
        if (e.target === editProfileOverlay) editProfileOverlay.classList.remove('show');
    });
}

if (editPhotoInput) {
    editPhotoInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (file) {
            editPhotoData = await fileToBase64(file);
            if (editPreviewImg) editPreviewImg.src = editPhotoData;
            if (editPhotoLabel) editPhotoLabel.childNodes[0].textContent = file.name;
        }
    });
}

if (saveEditProfile) {
    saveEditProfile.addEventListener('click', async () => {
        if (!me) return;
        const name = editUsernameInput?.value?.trim();
        if (!name) return showToast('Username wajib diisi!');

        const updateData = {
            username: name,
            bio: editBioInput?.value?.trim() || ''
        };
        if (editPhotoData) updateData.photo = editPhotoData;

        try {
            await updateDoc(doc(db, 'users', me.uid), updateData);
            if (editProfileOverlay) editProfileOverlay.classList.remove('show');
            showToast('Profil berhasil diperbarui! ✨');
            await loadUsers();
            if (sidebarOpen) renderSidebarContent();
        } catch (e) {
            showToast('Gagal update profil: ' + e.message);
        }
    });
}

// ============================================
//            INIT
// ============================================
async function init() {
    await loadMyRatings();
    await loadUsers();
    await loadChatHistory();
    loadMsgs();
    setOnlineStatus(true);
    renderSidebarContent();
    setTimeout(() => { if (msgInput) msgInput.focus(); }, 1000);
}

async function loadMyRatings() {
    if (!me) return;
    const snap = await getDoc(doc(db, 'ratings', me.uid));
    if (snap.exists()) myRatings = snap.data();
}

// ============================================
//            CHAT HISTORY
// ============================================
async function loadChatHistory() {
    if (!me) return;
    // Ambil semua pesan yang melibatkan user ini
    const q = query(collection(db, 'messages'), orderBy('time', 'desc'), limit(500));
    const snap = await getDocs(q);
    
    chatHistory = {};
    snap.forEach(d => {
        const m = d.data();
        if (m.uid === me.uid || m.to === me.uid) {
            const otherUid = m.uid === me.uid ? m.to : m.uid;
            if (otherUid === 'global') return;
            if (!chatHistory[otherUid]) {
                chatHistory[otherUid] = { lastMsg: m.text, lastTime: m.time, unread: 0 };
            } else if (m.time > chatHistory[otherUid].lastTime) {
                chatHistory[otherUid].lastMsg = m.text;
                chatHistory[otherUid].lastTime = m.time;
            }
        }
    });

    // Load unread counts
    const unreadSnap = await getDoc(doc(db, 'unread', me.uid));
    if (unreadSnap.exists()) {
        const unreadData = unreadSnap.data();
        Object.keys(unreadData).forEach(uid => {
            if (chatHistory[uid]) {
                chatHistory[uid].unread = unreadData[uid] || 0;
            } else {
                chatHistory[uid] = { lastMsg: '', lastTime: 0, unread: unreadData[uid] };
            }
        });
    }
}

async function clearUnread(uid) {
    if (!me) return;
    if (chatHistory[uid]) chatHistory[uid].unread = 0;
    // Update di Firestore
    const ref = doc(db, 'unread', me.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    data[uid] = 0;
    await setDoc(ref, data);
    // Re-render sidebar
    if (sidebarOpen) renderSidebarContent();
}

async function incrementUnread(fromUid, toUid) {
    if (fromUid === toUid) return;
    const ref = doc(db, 'unread', toUid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    data[fromUid] = (data[fromUid] || 0) + 1;
    await setDoc(ref, data);
    
    // Update local
    if (chatHistory[fromUid]) {
        chatHistory[fromUid].unread = (chatHistory[fromUid].unread || 0) + 1;
    }
}

// ============================================
//            SIDEBAR
// ============================================
function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    if (sidebar) sidebar.classList.toggle('open', sidebarOpen);
    if (sidebarOverlay) sidebarOverlay.classList.toggle('show', sidebarOpen);
    if (!sidebarOpen) {
        setTimeout(() => { if (msgInput) msgInput.focus(); }, 300);
    } else {
        renderSidebarContent();
    }
}

if (btnMenuToggle) btnMenuToggle.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

// Tab switching
if (sidebarTabs.length > 0) {
    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sidebarTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeSidebarTab = tab.dataset.tab;
            renderSidebarContent();
        });
    });
}

function getTotalUnread() {
    let total = 0;
    Object.values(chatHistory).forEach(h => { total += (h.unread || 0); });
    return total;
}

function renderSidebarContent() {
    if (!sidebarContent) return;
    
    // Update tab badge
    const chatsTab = document.querySelector('.sidebar-tab[data-tab="chats"]');
    if (chatsTab) {
        const totalUnread = getTotalUnread();
        let badge = chatsTab.querySelector('.tab-badge');
        if (totalUnread > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tab-badge';
                chatsTab.appendChild(badge);
            }
            badge.textContent = totalUnread;
        } else if (badge) {
            badge.remove();
        }
    }

    if (activeSidebarTab === 'chats') {
        renderChatsTab();
    } else {
        renderUsersTab();
    }
}

function renderChatsTab() {
    let html = '';
    
    // Global chat selalu di atas
    html += `
    <div class="chat-card" data-uid="global" style="border-left: 3px solid #667eea;">
        <div class="chat-card-avatar" style="
