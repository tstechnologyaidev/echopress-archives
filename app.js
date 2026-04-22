/**
 * Archives EchoPress
 * Main Application Logic
 */

// --- Load configuration from backend ---
let SUPABASE_URL, SUPABASE_KEY, BUCKET_NAME, TABLE_NAME;
let PASS_MEMBER, PASS_OWNER;
let supabase; // will be initialised after config loads

async function loadConfig() {
  const resp = await fetch('/config');
  if (!resp.ok) throw new Error('Failed to load config');
  const cfg = await resp.json();

  SUPABASE_URL   = cfg.SUPABASE_URL;
  SUPABASE_KEY   = cfg.SUPABASE_ANON_KEY;
  BUCKET_NAME    = cfg.BUCKET_NAME;
  TABLE_NAME     = cfg.TABLE_NAME;
  PASS_MEMBER    = cfg.PASS_MEMBER;
  PASS_OWNER     = cfg.PASS_OWNER;

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Configuration will be loaded when the DOM is ready.

let currentRole = null; // 'member' or 'owner'
let currentCategory = 'Militaire';
let imagesData = [];

// DOM Elements
const bodyRoot = document.getElementById('body-root');
const securityOverlay = document.getElementById('security-overlay');
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app');

const pwInput = document.getElementById('access-password');
const togglePwBtn = document.getElementById('toggle-pw-btn');
const pwError = document.getElementById('pw-error');
const btnLogin = document.getElementById('btn-login');

const roleBadge = document.getElementById('role-badge');
const btnLogout = document.getElementById('btn-logout');

const catButtons = document.querySelectorAll('.cat-btn');
const uploadBar = document.getElementById('upload-bar');
const uploadCatLabel = document.getElementById('upload-cat-label');
const fileInput = document.getElementById('file-input');
const imgDescription = document.getElementById('img-description');
const btnUploadTrigger = document.getElementById('btn-upload-trigger');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

const galleryTitle = document.getElementById('gallery-title');
const galleryCount = document.getElementById('gallery-count');
const galleryGrid = document.getElementById('gallery-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');
const lbDesc = document.getElementById('lb-desc');
const btnDownload = document.getElementById('btn-download');
const btnDeleteLb = document.getElementById('btn-delete-lb');

let currentLightboxIndex = 0;
let currentLightboxImages = [];

// --- SECURITY & ANTI-TAMPERING ---

// Disable Right Click
document.addEventListener('contextmenu', event => {
    event.preventDefault();
    showToast("Le clic droit est désactivé sur cette application.", "error");
});

// Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
document.addEventListener('keydown', event => {
    if (
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i' || event.key === 'J' || event.key === 'j' || event.key === 'C' || event.key === 'c')) ||
        (event.ctrlKey && (event.key === 'U' || event.key === 'u'))
    ) {
        event.preventDefault();
        showToast("L'inspection du code est désactivée.", "error");
    }
});

// Basic check to redirect if trying to access subpages (not really applicable for SPA, but good practice)
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('echopress-archives/index.html')) {
    window.location.href = 'index.html';
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();
    try {
        await loadConfig();
        checkAuth();
        setupEventListeners();
    } catch (err) {
        console.error("Critical error: Could not load configuration. Ensure you are running the app via 'npm start' on localhost or Render.", err);
        // Show an error message if the UI fails to load due to config
        const pwError = document.getElementById('pw-error');
        if (pwError) pwError.textContent = "Erreur Serveur: Lancez l'application avec 'npm start'.";
    }
});

function setupEventListeners() {
    // Login
    btnLogin.addEventListener('click', handleLogin);
    pwInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    togglePwBtn.addEventListener('click', () => {
        const type = pwInput.getAttribute('type') === 'password' ? 'text' : 'password';
        pwInput.setAttribute('type', type);
    });

    // Logout
    btnLogout.addEventListener('click', handleLogout);

    // Categories
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.getAttribute('data-cat');
            uploadCatLabel.textContent = currentCategory;
            galleryTitle.textContent = currentCategory;
            loadImages();
        });
    });

    // Upload
    btnUploadTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleUpload);

    // Lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', () => navigateLightbox(-1));
    lbNext.addEventListener('click', () => navigateLightbox(1));
    btnDownload.addEventListener('click', downloadCurrentLightboxImage);
    btnDeleteLb.addEventListener('click', deleteCurrentLightboxImage);

    // Close lightbox on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
            closeLightbox();
        } else if (e.key === 'ArrowLeft' && !lightbox.classList.contains('hidden')) {
            navigateLightbox(-1);
        } else if (e.key === 'ArrowRight' && !lightbox.classList.contains('hidden')) {
            navigateLightbox(1);
        }
    });
}

// --- AUTHENTICATION ---

function checkAuth() {
    const savedRole = sessionStorage.getItem('ep_archive_role');
    if (savedRole === 'member' || savedRole === 'owner') {
        grantAccess(savedRole, false);
    } else {
        // Show login
        securityOverlay.classList.remove('active');
    }
}

function handleLogin() {
    const pw = pwInput.value.trim();
    if (!pw) {
        showError("Veuillez entrer un mot de passe.");
        return;
    }

    btnLogin.classList.add('loading');

    // Simulate slight delay for effect
    setTimeout(() => {
        if (pw === PASS_MEMBER) {
            grantAccess('member', true);
        } else if (pw === PASS_OWNER) {
            grantAccess('owner', true);
        } else {
            showError("Mot de passe invalide.");
            btnLogin.classList.remove('loading');
        }
    }, 600);
}

function grantAccess(role, showAnimation) {
    currentRole = role;
    sessionStorage.setItem('ep_archive_role', role);

    if (role === 'owner') {
        roleBadge.textContent = 'Propriétaire';
        roleBadge.classList.add('owner');
        uploadBar.classList.remove('hidden');
    } else {
        roleBadge.textContent = 'Membre';
        roleBadge.classList.remove('owner');
        uploadBar.classList.add('hidden');
    }

    if (showAnimation) {
        loginScreen.classList.add('fade-out');
        setTimeout(() => {
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            securityOverlay.classList.remove('active');
            loadImages();
            showToast("Connexion réussie. Bienvenue aux Archives.", "success");
        }, 500);
    } else {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        securityOverlay.classList.remove('active');
        loadImages();
    }
}

function handleLogout() {
    sessionStorage.removeItem('ep_archive_role');
    currentRole = null;
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden', 'fade-out');
    pwInput.value = '';
    pwError.textContent = '';
    btnLogin.classList.remove('loading');
    showToast("Déconnexion réussie.", "info");
}

function showError(msg) {
    pwInput.classList.add('error');
    pwError.textContent = msg;
    setTimeout(() => {
        pwInput.classList.remove('error');
        pwError.textContent = '';
    }, 3000);
}

// --- DATABASE & STORAGE OPERATIONS ---

async function loadImages() {
    galleryGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    galleryCount.textContent = 'Chargement...';

    try {
        // Fetch from Supabase
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('category', currentCategory)
            .order('created_at', { ascending: false });

        if (error) throw error;

        imagesData = data || [];
        renderGallery();

    } catch (err) {
        console.error("Error loading images:", err);
        // Fallback or show error
        loadingState.classList.add('hidden');
        showToast("Erreur lors du chargement des images. Veuillez vérifier votre base de données.", "error");

        // For demonstration without DB, show empty state
        galleryCount.textContent = '0 photo(s)';
        emptyState.classList.remove('hidden');
    }
}

function renderGallery() {
    loadingState.classList.add('hidden');
    galleryCount.textContent = `${imagesData.length} photo(s)`;

    if (imagesData.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    currentLightboxImages = imagesData;

    imagesData.forEach((imgObj, index) => {
        const card = document.createElement('div');
        card.className = 'img-card';
        card.onclick = () => openLightbox(index);

        const img = document.createElement('img');
        img.src = imgObj.url;
        img.alt = imgObj.description || 'Image Archive';
        img.loading = 'lazy';

        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';

        if (imgObj.description) {
            const desc = document.createElement('p');
            desc.className = 'card-desc';
            desc.textContent = imgObj.description.length > 60 ? imgObj.description.substring(0, 60) + '...' : imgObj.description;
            overlay.appendChild(desc);
        }

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const btnDl = document.createElement('button');
        btnDl.className = 'card-btn dl';
        btnDl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
        btnDl.title = "Télécharger";
        btnDl.onclick = (e) => { e.stopPropagation(); downloadImage(imgObj.url, `EchoPress_Archive_${imgObj.id}.jpg`); };
        actions.appendChild(btnDl);

        if (currentRole === 'owner') {
            const btnDel = document.createElement('button');
            btnDel.className = 'card-btn del';
            btnDel.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
            btnDel.title = "Supprimer";
            btnDel.onclick = (e) => { e.stopPropagation(); deleteImage(imgObj); };
            actions.appendChild(btnDel);
        }

        overlay.appendChild(actions);
        card.appendChild(img);
        card.appendChild(overlay);
        galleryGrid.appendChild(card);
    });
}

async function handleUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const description = imgDescription.value.trim();

    uploadProgress.classList.remove('hidden');
    btnUploadTrigger.disabled = true;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${currentCategory}/${fileName}`;

        progressLabel.textContent = `Envoi de ${file.name} (${i + 1}/${files.length})...`;
        progressFill.style.width = `${((i) / files.length) * 100}%`;

        try {
            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);

            if (uploadError) {
                // If bucket doesn't exist or RLS fails, we'll simulate success for UI demonstration if needed, 
                // but realistically we should throw.
                console.error("Storage upload error:", uploadError);
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            const publicUrl = publicUrlData.publicUrl;

            // 3. Save to Database
            const { error: dbError } = await supabase
                .from(TABLE_NAME)
                .insert([
                    {
                        url: publicUrl,
                        category: currentCategory,
                        description: description,
                        storage_path: filePath
                    }
                ]);

            if (dbError) throw dbError;

            successCount++;
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
            showToast(`Échec de l'envoi pour ${file.name}`, "error");
        }
    }

    progressFill.style.width = '100%';
    progressLabel.textContent = 'Terminé!';

    setTimeout(() => {
        uploadProgress.classList.add('hidden');
        progressFill.style.width = '0%';
        fileInput.value = '';
        imgDescription.value = '';
        btnUploadTrigger.disabled = false;

        if (successCount > 0) {
            showToast(`${successCount} image(s) ajoutée(s) avec succès.`, "success");
            loadImages();
        }
    }, 1000);
}

async function deleteImage(imgObj) {
    if (!confirm("Voulez-vous vraiment supprimer cette image de l'archive ? Cette action est définitive.")) return;

    try {
        // 1. Delete from Database
        const { error: dbError } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', imgObj.id);

        if (dbError) throw dbError;

        // 2. Delete from Storage (if storage_path exists)
        if (imgObj.storage_path) {
            await supabase.storage
                .from(BUCKET_NAME)
                .remove([imgObj.storage_path]);
        }

        showToast("Image supprimée.", "success");
        loadImages();
        closeLightbox();

    } catch (err) {
        console.error("Error deleting image:", err);
        showToast("Erreur lors de la suppression.", "error");
    }
}

// --- LIGHTBOX ---

function openLightbox(index) {
    currentLightboxIndex = index;
    updateLightboxContent();
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
}

function updateLightboxContent() {
    if (currentLightboxImages.length === 0) return;

    const imgObj = currentLightboxImages[currentLightboxIndex];
    lightboxImg.src = imgObj.url;
    lbDesc.textContent = imgObj.description || 'Aucune description.';

    lbPrev.disabled = currentLightboxIndex === 0;
    lbNext.disabled = currentLightboxIndex === currentLightboxImages.length - 1;

    if (currentRole === 'owner') {
        btnDeleteLb.classList.remove('hidden');
    } else {
        btnDeleteLb.classList.add('hidden');
    }
}

function navigateLightbox(dir) {
    const newIndex = currentLightboxIndex + dir;
    if (newIndex >= 0 && newIndex < currentLightboxImages.length) {
        currentLightboxIndex = newIndex;
        updateLightboxContent();
    }
}

function downloadCurrentLightboxImage() {
    const imgObj = currentLightboxImages[currentLightboxIndex];
    if (imgObj) {
        downloadImage(imgObj.url, `EchoPress_Archive_${imgObj.id}.jpg`);
    }
}

function deleteCurrentLightboxImage() {
    const imgObj = currentLightboxImages[currentLightboxIndex];
    if (imgObj) {
        deleteImage(imgObj);
    }
}

async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        showToast("Téléchargement lancé.", "success");
    } catch (err) {
        console.error("Download error:", err);
        // Fallback for cross-origin issues
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// --- UTILS ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    else if (type === 'error') icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    else icon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- PARTICLE BACKGROUND ---

function initCanvas() {
    const canvas = document.getElementById('login-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, particles;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > width) this.x = 0;
            if (this.x < 0) this.x = width;
            if (this.y > height) this.y = 0;
            if (this.y < 0) this.y = height;
        }
        draw() {
            ctx.fillStyle = `rgba(201, 168, 76, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function init() {
        resize();
        particles = [];
        for (let i = 0; i < 70; i++) particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', init);
    init();
    animate();
}
