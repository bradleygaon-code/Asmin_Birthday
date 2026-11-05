/* ============================================================
   Birthday Site — Main Script
   ============================================================ */

'use strict';

/* ══════════════════════════════════════
   SECTION NAVIGATION
   ══════════════════════════════════════ */
const storySections = [
    document.getElementById('welcomeSection'),
    document.getElementById('timelineSection'),
    document.getElementById('reasonsSection'),
    document.getElementById('photosSection'),
    document.getElementById('letterSection')
];
const previousSection = document.getElementById('previousSection');
const nextSection     = document.getElementById('nextSection');
const progressDots    = document.querySelectorAll('.progress-dot');
let currentSection    = 0;

function showSection(index) {
    if (index !== 0) {
        stopCamera();
        // Stop song if navigating away from welcome section
        if (bdaySong && index !== 0) {
            bdaySong.pause();
            bdaySong.currentTime = 0;
        }
    }

    currentSection = index;
    storySections.forEach((section, i) => {
        section.hidden = i !== currentSection;
    });
    previousSection.disabled = currentSection === 0;
    updateProgressDots();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If navigating to photos section, replay animations
    if (index === 3) {
        setTimeout(refreshCollageAnimations, 80);
    }
}

function updateProgressDots() {
    progressDots.forEach((dot, i) => dot.classList.toggle('active', i === currentSection));
}

previousSection.addEventListener('click', () => {
    if (currentSection > 0) showSection(currentSection - 1);
});

nextSection.addEventListener('click', () => {
    showSection(currentSection === storySections.length - 1 ? 0 : currentSection + 1);
});

progressDots.forEach(dot => {
    dot.addEventListener('click', () => showSection(parseInt(dot.dataset.index, 10)));
});


/* ══════════════════════════════════════
   CAMERA / CANDLE LOGIC
   ══════════════════════════════════════ */
const welcomeSection     = document.getElementById('welcomeSection');
const cameraPreview      = document.getElementById('cameraPreview');
const birthdayCamera     = document.getElementById('birthdayCamera');
const candleStatus       = document.getElementById('candleStatus');
const startBlowDetection = document.getElementById('startBlowDetection');
const manualExtinguish   = document.getElementById('manualExtinguish');
const stopCameraButton   = document.getElementById('stopCamera');
const bdaySong           = document.getElementById('bdaySong');

let cameraStream       = null;
let audioContext       = null;
let blowAnimationFrame = null;
let blowStartedAt      = 0;

function stopCamera() {
    if (blowAnimationFrame !== null) {
        cancelAnimationFrame(blowAnimationFrame);
        blowAnimationFrame = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    birthdayCamera.srcObject = null;
    cameraPreview.hidden     = true;
    stopCameraButton.hidden  = true;
    if (audioContext) {
        const ctx = audioContext;
        audioContext = null;
        ctx.close().catch(console.error);
    }
    blowStartedAt = 0;
}

function extinguishCandle(message) {
    if (welcomeSection.classList.contains('candle-out')) return;
    welcomeSection.classList.add('candle-out');
    stopCamera();
    startBlowDetection.disabled    = true;
    startBlowDetection.textContent = 'Candle is out';
    manualExtinguish.textContent   = 'Relight candle';
    candleStatus.textContent       = message;
    launchCelebration();

    // Play birthday song
    if (bdaySong) {
        bdaySong.currentTime = 0;
        bdaySong.play().catch(() => {
            // Autoplay blocked — browser requires a prior user gesture,
            // which blowing/clicking the button already satisfies.
        });
    }
}

function relightCandle() {
    welcomeSection.classList.remove('candle-out');
    startBlowDetection.disabled    = false;
    startBlowDetection.textContent = 'Turn on camera';
    manualExtinguish.textContent   = 'Blow out candle';
    candleStatus.textContent       = 'The candle is lit again!';
    stopCelebration();

    // Stop birthday song
    if (bdaySong) {
        bdaySong.pause();
        bdaySong.currentTime = 0;
    }
}

function listenForBlow(stream) {
    if (!stream.getAudioTracks()[0]) {
        candleStatus.textContent = 'No microphone found. Use the button to blow out the candle.';
        return;
    }
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const source   = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const samples = new Float32Array(analyser.fftSize);
    source.connect(analyser);

    const startListening = () => {
        if (welcomeSection.classList.contains('candle-out') || !cameraStream) return;
        candleStatus.textContent = 'Listening… blow toward the microphone.';

        const detect = (ts) => {
            if (!cameraStream || welcomeSection.classList.contains('candle-out')) return;
            analyser.getFloatTimeDomainData(samples);
            let ss = 0;
            for (const s of samples) ss += s * s;
            const vol  = Math.sqrt(ss / samples.length);
            const bars = Math.min(20, Math.round(vol * 400));
            candleStatus.textContent = `Volume: [${'█'.repeat(bars)}${'░'.repeat(20 - bars)}] — keep blowing!`;
            if (vol > 0.055) {
                if (blowStartedAt === 0) blowStartedAt = ts;
                else if (ts - blowStartedAt >= 1200) {
                    extinguishCandle('Happy Birthday Love!');
                    return;
                }
            } else {
                blowStartedAt = 0;
            }
            blowAnimationFrame = requestAnimationFrame(detect);
        };
        blowAnimationFrame = requestAnimationFrame(detect);
    };

    audioContext.state === 'suspended'
        ? audioContext.resume().then(startListening).catch(e => {
            candleStatus.textContent = `Could not start mic: ${e.message}. Use the button instead.`;
          })
        : startListening();
}

startBlowDetection.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        candleStatus.textContent = 'Camera unavailable. Use the button to blow out the candle.';
        return;
    }
    startBlowDetection.disabled    = true;
    candleStatus.textContent       = 'Requesting access…';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            video: { facingMode: 'user' }
        });
        if (currentSection !== 0 || welcomeSection.classList.contains('candle-out')) {
            stream.getTracks().forEach(t => t.stop());
            startBlowDetection.disabled = false;
            return;
        }
        cameraStream                   = stream;
        birthdayCamera.srcObject       = stream;
        cameraPreview.hidden           = false;
        stopCameraButton.hidden        = false;
        startBlowDetection.textContent = 'Listening…';
        listenForBlow(stream);
    } catch (err) {
        stopCamera();
        startBlowDetection.disabled    = false;
        startBlowDetection.textContent = 'Try again';
        candleStatus.textContent =
            err.name === 'NotAllowedError'  ? 'Access denied. Use the button to blow out the candle.' :
            err.name === 'NotFoundError'    ? 'No camera/mic found. Use the button instead.' :
            `Error: ${err.message}. Use the button instead.`;
        console.error(err);
    }
});

manualExtinguish.addEventListener('click', () => {
    welcomeSection.classList.contains('candle-out')
        ? relightCandle()
        : extinguishCandle('Happy Birthday Love!');
});

stopCameraButton.addEventListener('click', () => {
    stopCamera();
    if (!welcomeSection.classList.contains('candle-out')) {
        startBlowDetection.disabled    = false;
        startBlowDetection.textContent = 'Turn on camera';
        candleStatus.textContent       = 'Camera off.';
    }
});

window.addEventListener('pagehide', stopCamera);


/* ══════════════════════════════════════
   CELEBRATION ANIMATION (candle blown)
   ══════════════════════════════════════ */
let celebCanvas    = null;
let celebFrame     = null;
let celebPieces    = [];
let celebStart     = null;
const CELEB_DUR    = 6500;

const CELEB_COLORS = [
    '#f5a0b4','#e86080','#ffd6e0',
    '#ffb347','#ffe066','#c9a87c',
    '#ddc4a3','#ff9ebc','#ffffff','#ffcce0'
];

function mkConfetti(W, H, side) {
    const x  = side === 0 ? W * 0.2 : W * 0.8;
    const vy = -(14 + Math.random() * 12);
    const vx = (side === 0 ? 1 : -1) * (1.5 + Math.random() * 7);
    return {
        kind: 'confetti', x, y: H * 0.55,
        vx, vy,
        w: 6 + Math.random() * 10, h: 3 + Math.random() * 7,
        angle: Math.random() * Math.PI * 2,
        spin:  (Math.random() - 0.5) * 0.25,
        color: CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)],
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        alpha: 1
    };
}

function mkHeart(W, H) {
    return {
        kind: 'heart',
        x: W * (0.05 + Math.random() * 0.9),
        y: H + 30,
        vy: -(1.2 + Math.random() * 2.8),
        vx: (Math.random() - 0.5) * 1.2,
        size: 10 + Math.random() * 28,
        color: CELEB_COLORS[Math.floor(Math.random() * 5)],
        alpha: 0,
        delay: Math.random() * 1800
    };
}

function mkStar(W, H) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 12;
    return {
        kind: 'star',
        x: W / 2, y: H * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r: 2.5 + Math.random() * 5,
        color: ['#ffe066','#ffb347','#fff','#f5a0b4','#c9a87c'][Math.floor(Math.random() * 5)],
        trail: [], alpha: 1
    };
}

function mkRing(W, H) {
    /* expanding glow ring at center */
    return { kind: 'ring', x: W/2, y: H * 0.4, r: 0, maxR: Math.min(W, H) * 0.55, alpha: 0.6 };
}

function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s*.5, y, x - s*.5, y + s*.3);
    ctx.bezierCurveTo(x - s*.5, y + s*.65, x, y + s*.95, x, y + s);
    ctx.bezierCurveTo(x, y + s*.95, x + s*.5, y + s*.65, x + s*.5, y + s*.3);
    ctx.bezierCurveTo(x + s*.5, y, x, y, x, y + s*.3);
    ctx.closePath();
}

function launchCelebration() {
    stopCelebration();

    celebCanvas = document.createElement('canvas');
    Object.assign(celebCanvas.style, {
        position: 'fixed', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '9999'
    });
    document.body.appendChild(celebCanvas);

    const resize = () => {
        celebCanvas.width  = window.innerWidth;
        celebCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    celebCanvas._resize = resize;

    const W = () => celebCanvas.width;
    const H = () => celebCanvas.height;

    /* spawn pieces */
    for (let i = 0; i < 120; i++) celebPieces.push(mkConfetti(W(), H(), 0));
    for (let i = 0; i < 120; i++) celebPieces.push(mkConfetti(W(), H(), 1));
    for (let i = 0;  i < 50; i++) celebPieces.push(mkStar(W(), H()));
    for (let i = 0;  i < 40; i++) celebPieces.push(mkHeart(W(), H()));
    celebPieces.push(mkRing(W(), H()));

    const ctx      = celebCanvas.getContext('2d');
    celebStart     = null;

    /* Second wave at 1.2s */
    setTimeout(() => {
        for (let i = 0; i < 60; i++) celebPieces.push(mkConfetti(W(), H(), 0));
        for (let i = 0; i < 60; i++) celebPieces.push(mkConfetti(W(), H(), 1));
        for (let i = 0; i < 20; i++) celebPieces.push(mkHeart(W(), H()));
    }, 1200);

    const tick = (now) => {
        if (!celebStart) celebStart = now;
        const elapsed = now - celebStart;
        const fadeOut = Math.max(0, 1 - (elapsed - (CELEB_DUR - 1200)) / 1200);

        ctx.clearRect(0, 0, W(), H());

        /* ── pieces ── */
        celebPieces.forEach(p => {
            if (p.kind === 'ring') {
                p.r    += (p.maxR - p.r) * 0.055;
                p.alpha = Math.max(0, p.alpha - 0.012);
                if (p.alpha <= 0) return;
                ctx.save();
                ctx.globalAlpha = p.alpha * fadeOut;
                ctx.strokeStyle = '#f5a0b4';
                ctx.lineWidth   = 3;
                ctx.shadowColor = '#e86080';
                ctx.shadowBlur  = 18;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                return;
            }

            if (p.kind === 'confetti') {
                p.x += p.vx; p.y += p.vy;
                p.vy += 0.35; p.vx *= 0.990;
                p.angle += p.spin;
                p.alpha  = fadeOut;

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = p.color;
                if (p.shape === 'rect') {
                    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
                } else {
                    ctx.beginPath(); ctx.arc(0, 0, p.w/2, 0, Math.PI*2); ctx.fill();
                }
                ctx.restore();
                return;
            }

            if (p.kind === 'star') {
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 9) p.trail.shift();
                p.x += p.vx; p.y += p.vy;
                p.vy += 0.22; p.vx *= 0.979;
                p.alpha = fadeOut;

                p.trail.forEach((tp, ti) => {
                    ctx.globalAlpha = (ti / p.trail.length) * 0.5 * p.alpha;
                    ctx.fillStyle   = p.color;
                    ctx.beginPath(); ctx.arc(tp.x, tp.y, p.r * ti/p.trail.length, 0, Math.PI*2); ctx.fill();
                });
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle   = p.color;
                ctx.shadowColor = p.color; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
                ctx.restore();
                return;
            }

            if (p.kind === 'heart') {
                if (elapsed < p.delay) return;
                const age = elapsed - p.delay;
                p.y += p.vy; p.x += p.vx;
                p.alpha = Math.min(1, age / 350) * fadeOut;
                ctx.save();
                ctx.globalAlpha = p.alpha * 0.85;
                ctx.fillStyle   = p.color;
                heartPath(ctx, p.x - p.size/2, p.y - p.size/2, p.size);
                ctx.fill();
                ctx.restore();
            }
        });

        if (elapsed < CELEB_DUR) {
            celebFrame = requestAnimationFrame(tick);
        } else {
            stopCelebration();
        }
    };

    celebFrame = requestAnimationFrame(tick);
}

function stopCelebration() {
    if (celebFrame) { cancelAnimationFrame(celebFrame); celebFrame = null; }
    if (celebCanvas) {
        window.removeEventListener('resize', celebCanvas._resize);
        celebCanvas.remove();
        celebCanvas = null;
    }
    celebPieces = [];
    celebStart  = null;
}


/* ══════════════════════════════════════
   PASSWORD GATE — LETTER SECTION
   ══════════════════════════════════════ */
const letterGate    = document.getElementById('letterGate');
const gateInput     = document.getElementById('gateInput');
const gateSubmit    = document.getElementById('gateSubmit');
const gateError     = document.getElementById('gateError');
const letterContent = document.getElementById('letterContent');
const CORRECT_DATE  = '01/01/2021';

/* Auto-format as MM/DD/YYYY while typing */
gateInput.addEventListener('input', () => {
    let v = gateInput.value.replace(/\D/g, '');
    if (v.length > 2)  v = v.slice(0,2) + '/' + v.slice(2);
    if (v.length > 5)  v = v.slice(0,5) + '/' + v.slice(5);
    if (v.length > 10) v = v.slice(0,10);
    gateInput.value = v;
    gateError.textContent = '';
    gateInput.classList.remove('shake');
});

gateInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
});
gateSubmit.addEventListener('click', tryUnlock);

function tryUnlock() {
    const val = gateInput.value.trim();
    if (val === CORRECT_DATE) {
        /* ── correct ── */
        gateError.textContent = '';
        letterGate.classList.add('unlocking');

        /* small heart burst over the input */
        launchHeartBurst();

        setTimeout(() => {
            letterGate.hidden        = true;
            letterContent.hidden     = false;
            letterContent.classList.add('letter-reveal');
        }, 560);
    } else {
        /* ── wrong ── */
        gateError.textContent = 'Engkkk Mali HAHAHAHA';
        gateInput.classList.remove('shake');
        void gateInput.offsetWidth; /* force reflow */
        gateInput.classList.add('shake');
        gateInput.select();
    }
}

/* Small heart burst on unlock */
function launchHeartBurst() {
    const burst = document.createElement('canvas');
    Object.assign(burst.style, {
        position: 'fixed', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '9998'
    });
    document.body.appendChild(burst);
    burst.width  = window.innerWidth;
    burst.height = window.innerHeight;

    const cx = burst.width  / 2;
    const cy = burst.height / 2;
    const BURST_COLORS = ['#f5a0b4','#e86080','#ffd6e0','#c9a87c','#fff','#ffe066'];
    const pts = Array.from({ length: 30 }, () => {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 9;
        return {
            x: cx, y: cy,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
            size: 10 + Math.random() * 20,
            color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
            alpha: 1
        };
    });

    let start = null;
    const ctx = burst.getContext('2d');

    const bTick = (now) => {
        if (!start) start = now;
        const t = (now - start) / 800;
        ctx.clearRect(0, 0, burst.width, burst.height);
        pts.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.alpha = Math.max(0, 1 - t);
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle   = p.color;
            heartPath(ctx, p.x - p.size/2, p.y - p.size/2, p.size);
            ctx.fill();
            ctx.restore();
        });
        if (t < 1) requestAnimationFrame(bTick);
        else burst.remove();
    };
    requestAnimationFrame(bTick);
}


/* ══════════════════════════════════════
   PHOTOS LIGHTBOX
   ══════════════════════════════════════ */
const lightbox     = document.getElementById('lightbox');
const lightboxImg  = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const photoCards   = document.querySelectorAll('.polaroid');
let   lbIndex      = 0;
const lbImages     = [];

/* collect image srcs */
photoCards.forEach((card, i) => {
    const img = card.querySelector('img');
    lbImages.push({ src: img.src, alt: img.alt });

    card.addEventListener('click', () => openLightbox(i));
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
    });
});

function openLightbox(index) {
    lbIndex            = index;
    lightboxImg.src    = lbImages[lbIndex].src;
    lightboxImg.alt    = lbImages[lbIndex].alt;
    lightbox.hidden    = false;
    lightboxClose.focus();
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.hidden              = true;
    document.body.style.overflow = '';
}

function lbGo(dir) {
    lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
    lightboxImg.style.animation = 'none';
    void lightboxImg.offsetWidth;
    lightboxImg.style.animation = '';
    lightboxImg.src = lbImages[lbIndex].src;
    lightboxImg.alt = lbImages[lbIndex].alt;
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click',  () => lbGo(-1));
lightboxNext.addEventListener('click',  () => lbGo(1));

lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', e => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lbGo(-1);
    if (e.key === 'ArrowRight') lbGo(1);
});


/* ══════════════════════════════════════
   FLOATING HEARTS BACKGROUND
   ══════════════════════════════════════ */
function createFloatingHearts() {
    const container = document.querySelector('.hearts');
    if (!container) return;

    const symbols = ['\u2665', '\u2661', '\u2726', '\u2727'];
    const colors  = ['#e8a0b0','#c2607a','#ddc4a3','#f7dfe4','#f5a0b4'];

    function spawn() {
        const el = document.createElement('span');
        el.className    = 'heart';
        el.textContent  = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.left   = (Math.random() * 100) + 'vw';
        el.style.fontSize = (8 + Math.random() * 18) + 'px';
        el.style.color  = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (7 + Math.random() * 8) + 's';
        container.appendChild(el);
        setTimeout(() => el.remove(), 16000);
    }

    setInterval(spawn, 1100);
    for (let i = 0; i < 5; i++) setTimeout(spawn, i * 250);
}

window.addEventListener('load', createFloatingHearts);

/* ── Init AOS ── */
if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, easing: 'ease-out-cubic', offset: 60 });
}

/* ── Re-trigger AOS + Animate.css when photos section shown ── */
function refreshCollageAnimations() {
    // Re-init AOS so hidden-section elements get triggered
    if (typeof AOS !== 'undefined') {
        AOS.refreshHard();
    }
    // Replay Animate.css classes on the collage header
    const header = document.querySelector('.collage-header');
    if (!header) return;
    const animated = header.querySelectorAll('.animate__animated');
    animated.forEach(el => {
        el.style.animationPlayState = 'running';
        const cls = [...el.classList].find(c => c.startsWith('animate__') && c !== 'animate__animated');
        if (cls) {
            el.classList.remove(cls);
            void el.offsetWidth;
            el.classList.add(cls);
        }
    });
}
