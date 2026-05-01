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
const editUsernameInput = document.getElementById('editUsernameInput');
const editBioInput = document.getElementById('editBioInput');
const cancelEditProfile = document.getElementById('cancelEditProfile');
const saveEditProfile = document.getElementById('saveEditProfile');

// PWA Install
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const installCloseBtn = document.getElementById('installCloseBtn');

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
let chatHistory = {};
let currentPhotoData = null;
let editPhotoData = null;
let deferredPrompt = null;

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
//            PWA INSTALL
// ============================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installPrompt) installPrompt.style.display = 'flex';
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('User response:', outcome);
        deferredPrompt = null;
        if (installPrompt) installPrompt.style.display = 'none';
    });
}

if (installCloseBtn) {
    installCloseBtn.addEventListener('click', () => {
        if (installPrompt) installPrompt.style.display = 'none';
    });
}

// Deteksi jika sudah di-install (standalone mode)
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('App running in standalone mode');
    if (installPrompt) installPrompt.style.display = 'none';
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker failed:', err));
}

// ============================================
//            AUTH
// ============================================
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const em = emailInput?.value?.trim();
        const pw = passwordInput?.value;
        if (!em || !pw) return showToast('Email dan password harus diisi!');
        
        try {
            await signInWithEmailAndPassword(auth, em, pw);
            showToast('Login berhasil! 🎉');
        } catch (e) {
            console.error('Login error:', e);
            showToast('Login gagal: ' + e.message);
        }
    });
}

if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const em = emailInput?.value?.trim();
        const pw = passwordInput?.value;
        if (!em || !pw) return showToast('Email dan password harus diisi!');
        if (pw.length < 6) return showToast('Password minimal 6 karakter!');
        
        try {
            await createUserWithEmailAndPassword(auth, em, pw);
            showToast('Akun berhasil dibuat! 🎉');
        } catch (e) {
            console.error('Register error:', e);
            showToast('Register gagal: ' + e.message);
        }
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
                showToast('Berhasil logout! 👋');
            } catch (e) {
                console.error('Logout error:', e);
            }
        });
    });
}

// ============================================
//            AUTH STATE LISTENER (FIXED)
// ============================================
onAuthStateChanged(auth, async (u) => {
    console.log('Auth state changed:', u?.uid || 'null');
    
    if (!u) {
        // User is signed out
        me = null;
        currentChat = 'global';
        usersCache = {};
        chatHistory = {};
        currentPhotoData = null;
        editPhotoData = null;
        
        // Sembunyikan semua, tampilkan login
        if (authPage) authPage.style.display = 'flex';
        if (profileSetup) profileSetup.style.display = 'none';
        if (app) app.style.display = 'none';
        
        // Clear input
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        
        if (sidebarOpen) toggleSidebar();
        return;
    }
    
    // User is signed in
    me = u;
    console.log('User logged in:', me.uid);
    
    // Sembunyikan login page
    if (authPage) authPage.style.display = 'none';
    
    try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        
        if (!snap.exists()) {
            // Belum setup profile
            console.log('Profile not found, showing setup');
            if (profileSetup) profileSetup.style.display = 'flex';
            if (app) app.style.display = 'none';
        } else {
            // Sudah ada profile
            console.log('Profile found, showing app');
            if (profileSetup) profileSetup.style.display = 'none';
            if (app) app.style.display = 'flex';
            
            setTimeout(() => { 
                if (msgInput) msgInput.focus();
            }, 800);
            
            await init();
            showToast('Selamat datang! 👋');
        }
    } catch (e) {
        console.error('Error checking profile:', e);
        showToast('Error: ' + e.message);
    }
});

// ============================================
//            SETUP PROFILE (FIRST TIME)
// ============================================
if (setupPhotoInput) {
    setupPhotoInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (file) {
            try {
                currentPhotoData = await fileToBase64(file);
                if (setupPreviewImg) setupPreviewImg.src = currentPhotoData;
            } catch (e) {
                console.error('Error reading photo:', e);
            }
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
            
            console.log('Profile saved successfully');
            showToast('Profile berhasil dibuat! 🎉');
            
            // Pindah ke app
            if (profileSetup) profileSetup.style.display = 'none';
            if (app) app.style.display = 'flex';
            
            setTimeout(() => { 
                if (msgInput) msgInput.focus();
            }, 500);
            
            await init();
        } catch (e) {
            console.error('Save profile error:', e);
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
        
        try {
            const snap = await getDoc(doc(db, 'users', me.uid));
            const d = snap.data();
            
            if (editUsernameInput) editUsernameInput.value = d.username || '';
            if (editBioInput) editBioInput.value = d.bio || '';
            if (editPreviewImg) editPreviewImg.src = d.photo || 'https://i.imgur.com/HeIi0wU.png';
            
            editPhotoData = null;
            if (editPhotoInput) editPhotoInput.value = '';
            
            if (editProfileOverlay) editProfileOverlay.classList.add('show');
        } catch (e) {
            console.error('Error opening edit profile:', e);
            showToast('Error: ' + e.message);
        }
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
            try {
                editPhotoData = await fileToBase64(file);
                if (editPreviewImg) editPreviewImg.src = editPhotoData;
            } catch (e) {
                console.error('Error reading photo:', e);
            }
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
            console.log('Profile updated successfully');
            
            if (editProfileOverlay) editProfileOverlay.classList.remove('show');
            showToast('Profil berhasil diperbarui! ✨');
            
            await loadUsers();
            if (sidebarOpen) renderSidebarContent();
        } catch (e) {
            console.error('Update profile error:', e);
            showToast('Gagal update profil: ' + e.message);
        }
    });
}

// ============================================
//            INIT
// ============================================
async function init() {
    console.log('Initializing app...');
    await loadMyRatings();
    await loadUsers();
    await loadChatHistory();
    loadMsgs();
    setOnlineStatus(true);
    renderSidebarContent();
    setTimeout(() => { 
        if (msgInput) msgInput.focus();
    }, 1000);
}

async function loadMyRatings() {
    if (!me) return;
    try {
        const snap = await getDoc(doc(db, 'ratings', me.uid));
        if (snap.exists()) myRatings = snap.data();
    } catch (e) {
        console.error('Error loading ratings:', e);
    }
}

// ============================================
//            CHAT HISTORY
// ============================================
async function loadChatHistory() {
    if (!me) return;
    try {
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
    } catch (e) {
        console.error('Error loading chat history:', e);
    }
}

async function clearUnread(uid) {
    if (!me) return;
    if (chatHistory[uid]) chatHistory[uid].unread = 0;
    try {
        const ref = doc(db, 'unread', me.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        data[uid] = 0;
        await setDoc(ref, data);
        if (sidebarOpen) renderSidebarContent();
    } catch (e) {
        console.error('Error clearing unread:', e);
    }
}

async function incrementUnread(fromUid, toUid) {
    if (fromUid === toUid) return;
    try {
        const ref = doc(db, 'unread', toUid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        data[fromUid] = (data[fromUid] || 0) + 1;
        await setDoc(ref, data);
        
        if (chatHistory[fromUid]) {
            chatHistory[fromUid].unread = (chatHistory[fromUid].unread || 0) + 1;
        }
    } catch (e) {
        console.error('Error incrementing unread:', e);
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
        <div class="chat-card-avatar" style="background: linear-gradient(135deg, #667eea, #764ba2); display:flex; align-items:center; justify-content:center; font-size:18px;">🌍</div>
        <div class="chat-card-info">
            <div class="chat-card-name">Global Chat</div>
            <div class="chat-card-status"><span class="status-dot online"></span>Public</div>
        </div>
    </div>`;

    // Private chats
    const sortedChats = Object.entries(chatHistory).sort((a, b) => b[1].lastTime - a[1].lastTime);
    
    if (sortedChats.length === 0) {
        html += '<p style="text-align:center;color:#666;margin-top:20px;">Belum ada riwayat chat</p>';
    } else {
        sortedChats.forEach(([uid, data]) => {
            const user = usersCache[uid];
            if (!user) return;
            const unread = data.unread || 0;
            const lastMsg = data.lastMsg || '';
            
            html += `
            <div class="chat-card" data-uid="${uid}">
                <img class="chat-card-avatar" src="${user.photo || 'https://i.imgur.com/HeIi0wU.png'}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">
                <div class="chat-card-info">
                    <div class="chat-card-name">${escapeHtml(user.username)}</div>
                    <div class="chat-card-lastmsg">${escapeHtml(lastMsg.substring(0, 30))}${lastMsg.length > 30 ? '...' : ''}</div>
                </div>
                ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
            </div>`;
        });
    }
    
    sidebarContent.innerHTML = html;
    
    // Event listeners
    sidebarContent.querySelectorAll('.chat-card').forEach(card => {
        card.addEventListener('click', () => {
            const uid = card.dataset.uid;
            if (uid === 'global') {
                currentChat = 'global';
                if (chatTitle) chatTitle.textContent = '🌍 Global Chat';
                if (chatBadge) {
                    chatBadge.textContent = 'Global';
                    chatBadge.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                }
            } else {
                openChat(uid);
            }
            loadMsgs();
            toggleSidebar();
            if (uid !== 'global') clearUnread(uid);
            setTimeout(() => { if (msgInput) msgInput.focus(); }, 400);
        });
    });
}

function renderUsersTab() {
    let html = `
    <div class="search-bar">
        <input id="searchInput" placeholder="🔍 Cari...">
        <button id="btnSearch">Cari</button>
    </div>
    <div id="usersList"></div>`;
    
    sidebarContent.innerHTML = html;
    
    const searchInputEl = document.getElementById('searchInput');
    const btnSearchEl = document.getElementById('btnSearch');
    const usersListEl = document.getElementById('usersList');
    
    function renderUsers(searchTerm = '') {
        let users = Object.entries(usersCache).filter(([id]) => id !== me?.uid);
        if (searchTerm) {
            users = users.filter(([id, u]) => u.username.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        users.sort((a, b) => {
            if (a[1].online && !b[1].online) return -1;
            if (!a[1].online && b[1].online) return 1;
            return (b[1].rating || 0) - (a[1].rating || 0);
        });
        
        let cardsHtml = '';
        users.forEach(([uid, u]) => {
            let statusClass = 'offline', statusText = 'Offline';
            if (u.online) {
                if (u.typing && u.typingTo === me?.uid) { statusClass = 'typing'; statusText = 'Mengetik...'; }
                else { statusClass = 'online'; statusText = 'Online'; }
            }
            cardsHtml += `
            <div class="user-card" data-uid="${uid}">
                <img class="user-card-avatar" src="${u.photo || 'https://i.imgur.com/HeIi0wU.png'}" onerror="this.src='https://i.imgur.com/HeIi0wU.png'">
                <div class="user-card-info">
                    <div class="user-card-name">${escapeHtml(u.username)}</div>
                    <div class="user-card-status"><span class="status-dot ${statusClass}"></span>${statusText}</div>
                </div>
                <div class="user-card-rating">⭐${(u.rating || 0).toFixed(1)}</div>
            </div>`;
        });
        if (usersListEl) usersListEl.innerHTML = cardsHtml || '<p style="text-align:center;color:#666;margin-top:20px;">Tidak ada pengguna</p>';
        
        if (usersListEl) {
            usersListEl.querySelectorAll('.user-card').forEach(card => {
                card.addEventListener('click', () => openChat(card.dataset.uid));
            });
        }
    }
    
    if (searchInputEl) searchInputEl.addEventListener('input', () => renderUsers(searchInputEl.value.trim()));
    if (btnSearchEl) btnSearchEl.addEventListener('click', () => renderUsers(searchInputEl?.value?.trim() || ''));
    
    renderUsers();
}

// ============================================
//            LOAD USERS
// ============================================
async function loadUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        usersCache = {};
        snap.forEach(d => {
            const data = d.data();
            usersCache[d.id] = data;
        });
        if (sidebarOpen) renderSidebarContent();
    } catch (e) {
        console.error('Error loading users:', e);
    }
}

// ============================================
//            OPEN CHAT
// ============================================
function openChat(id) {
    currentChat = id;
    const user = usersCache[id];
    if (user) {
        if (chatTitle) chatTitle.textContent = '💬 ' + user.username;
        if (chatBadge) {
            chatBadge.textContent = 'Private';
            chatBadge.style.background = 'linear-gradient(135deg, #00c853, #69f0ae)';
        }
    }
    clearUnread(id);
    loadMsgs();
    toggleSidebar();
    setTimeout(() => { if (msgInput) msgInput.focus(); }, 400);
}

if (chatHeaderInfo) {
    chatHeaderInfo.addEventListener('click', () => {
        currentChat = 'global';
        if (chatTitle) chatTitle.textContent = '🌍 Global Chat';
        if (chatBadge) {
            chatBadge.textContent = 'Global';
            chatBadge.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        }
        loadMsgs();
    });
}

// ============================================
//            SEND MESSAGE
// ============================================
async function sendMsg() {
    if (!msgInput || !me) return;
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
    if (!me || currentChat === 'global') return;
    try {
        await updateDoc(doc(db, 'users', me.uid), { typing: true, typingTo: currentChat });
        clearTimeout(typingTimers[currentChat]);
        typingTimers[currentChat] = setTimeout(async () => {
            await updateDoc(doc(db, 'users', me.uid), { typing: false, typingTo: '' });
        }, 2000);
    } catch (e) {
        console.error('Typing error:', e);
    }
}

// ============================================
//            LOAD MESSAGES
// ============================================
function loadMsgs() {
    if (messagesUnsub) messagesUnsub();
    if (usersUnsub) usersUnsub();

    messagesUnsub = onSnapshot(collection(db, 'messages'), (snap) => {
        if (!messagesDiv) return;
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => a.time - b.time);
        let html = '';
        
        let newMessagesFrom = {};
        
        arr.forEach(m => {
            if (!usersCache[m.uid]) return;
            if (currentChat === 'global' && m.to !== 'global') return;
            if (currentChat !== 'global' && !(
                (m.uid === me?.uid && m.to === currentChat) ||
                (m.uid === currentChat && m.to === me?.uid)
            )) return;

            const isMe = m.uid === me?.uid;
            const user = usersCache[m.uid];
            const photo = user?.photo || "https://i.imgur.com/HeIi0wU.png";

            // Notifikasi
            if (!isMe && m.time > lastMsgTime) {
                if (document.hidden && user) {
                    try { 
                        new Notification(user.username, { 
                            body: m.text, 
                            icon: photo,
                            badge: photo
                        }); 
                    } catch (e) {}
                }
                if (currentChat !== m.uid && user) {
                    if (!newMessagesFrom[m.uid]) newMessagesFrom[m.uid] = { user, count: 0 };
                    newMessagesFrom[m.uid].count++;
                }
                if (currentChat !== m.uid && m.to === me?.uid) {
                    incrementUnread(m.uid, me.uid);
                }
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
        
        // Tampilkan toast untuk pesan baru
        Object.entries(newMessagesFrom).forEach(([uid, data]) => {
            if (data.count > 0) {
                showToast(`💬 Mendapat ${data.count} pesan dari ${data.user.username}`, 3000);
            }
        });
        
        // Update sidebar
        if (sidebarOpen) {
            loadChatHistory().then(() => renderSidebarContent());
        }
    }, (error) => {
        console.error('Messages listener error:', error);
    });

    usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
        let typingUser = null;
        snap.forEach(d => {
            const data = d.data();
            usersCache[d.id] = data;
            if (d.id === currentChat && data.typing && data.typingTo === me?.uid) {
                typingUser = data.username;
            }
        });
        if (typingArea && typingText) {
            if (typingUser) {
                typingArea.style.display = 'flex';
                typingText.textContent = typingUser + ' sedang mengetik...';
            } else {
                typingArea.style.display = 'none';
            }
        }
        if (sidebarOpen) renderSidebarContent();
    }, (error) => {
        console.error('Users listener error:', error);
    });
}

function attachMessageListeners() {
    if (!messagesDiv) return;
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
        try {
            const ref = doc(db, 'users', uid);
            const snap = await getDoc(ref);
            const d = snap.data();
            const total = (d.totalRate || 0) + 1;
            const rating = (((d.rating || 0) * (d.totalRate || 0)) + star) / total;
            await updateDoc(ref, { rating, totalRate: total });
            myRatings[uid] = star;
            await setDoc(doc(db, 'ratings', me.uid), myRatings);
            const user = usersCache[uid];
            showToast(`⭐ ${user?.username || 'Seseorang'} mendapat rating ${star} bintang!`, 3000);
            loadMsgs();
            if (sidebarOpen) renderSidebarContent();
        } catch (e) {
            console.error('Rate error:', e);
            showToast('Gagal memberi rating');
        }
    });
}

async function delMsg(id) {
    showModal('Hapus pesan ini?', true, async (yes) => {
        if (yes) {
            try {
                await updateDoc(doc(db, 'messages', id), { text: '[pesan dihapus]' });
            } catch (e) {
                console.error('Delete error:', e);
            }
        }
    });
}

// ============================================
//            PROFILE POPUP
// ============================================
function showProfile(id) {
    const u = usersCache[id];
    if (!u) return;
    if (pName) pName.innerText = u.username;
    if (pBio) pBio.innerText = u.bio || 'Tidak ada bio';
    if (pImg) {
        pImg.src = u.photo || "https://i.imgur.com/HeIi0wU.png";
        pImg.onerror = function() { this.src = 'https://i.imgur.com/HeIi0wU.png'; };
    }
    if (pRating) pRating.innerText = `Rating: ⭐ ${(u.rating || 0).toFixed(1)} (${u.totalRate || 0} votes)`;
    if (profilePopup) profilePopup.style.display = 'block';
    if (popupOverlay) popupOverlay.style.display = 'block';
}

function closeProfilePopup() {
    if (profilePopup) profilePopup.style.display = 'none';
    if (popupOverlay) popupOverlay.style.display = 'none';
}

if (btnCloseProfile) btnCloseProfile.addEventListener('click', closeProfilePopup);
if (popupOverlay) popupOverlay.addEventListener('click', closeProfilePopup);

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
    } catch (e) { 
        console.error('Status error:', e); 
    }
}

window.addEventListener('beforeunload', () => setOnlineStatus(false));
window.addEventListener('focus', () => { if (me) setOnlineStatus(true); });
window.addEventListener('blur', () => { if (me) setOnlineStatus(false); });

// ============================================
//            NOTIFICATIONS
// ============================================
if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
    });
}

// ============================================
//            KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarOpen) toggleSidebar();
    if (e.key === 'Escape' && profilePopup && profilePopup.style.display === 'block') {
        closeProfilePopup();
    }
});

// ============================================
//            INITIAL STATE
// ============================================
console.log('✅ AxChat siap!');
console.log('💡 Fitur: Login, Register, Chat History, Unread Badge, Toast, Ganti Foto, PWA');
console.log('📲 Bisa di-install ke homescreen!');
