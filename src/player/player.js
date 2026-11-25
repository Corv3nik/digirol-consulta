// ==========================================
// DIGIROL LINK - VISTA DE JUGADOR
// ==========================================
(function () {
  'use strict';

  // Debe coincidir con la interfaz del Master (digimons-db.js + character-creator.js).
  const EMBLEM_COLORS = {
    'Valor': '#f97316', 'Amistad': '#3b82f6', 'Amor': '#ef4444', 'Conocimiento': '#8b5cf6',
    'Pureza': '#22c55e', 'Sinceridad': '#c0c0c0', 'Esperanza': '#ffd700', 'Luz': '#ec4899',
    'Inspiración': '#dc2626', 'Inspiracion': '#dc2626',
    'Armonía': '#16a34a', 'Armonia': '#16a34a',
    'Determinación': '#1d4ed8', 'Determinacion': '#1d4ed8',
    'Tenacidad': '#b87333',
  };
  const EMBLEM_ICONS = {
    'Valor': '🔥', 'Amistad': '💧', 'Amor': '❤️', 'Conocimiento': '🧠',
    'Pureza': '🌿', 'Sinceridad': '❄️', 'Esperanza': '🌟', 'Luz': '✨',
    'Inspiración': '💡', 'Inspiracion': '💡',
    'Armonía': '🎶', 'Armonia': '🎶',
    'Determinación': '🎯', 'Determinacion': '🎯',
    'Tenacidad': '🛡️',
  };
  // Imagen de portada del héroe por emblema. Las variantes sin tilde apuntan
  // al mismo archivo con nombre oficial acentuado.
  const EMBLEM_IMAGES = {
    'Valor': 'Valor.jpg', 'Amistad': 'Amistad.jpg', 'Amor': 'Amor.jpg',
    'Conocimiento': 'Conocimiento.jpg', 'Pureza': 'Pureza.jpg',
    'Sinceridad': 'Sinceridad.jpg', 'Esperanza': 'Esperanza.jpg', 'Luz': 'Luz.jpg',
    'Inspiración': 'Inspiración.jpg', 'Inspiracion': 'Inspiración.jpg',
    'Armonía': 'Armonía.jpg', 'Armonia': 'Armonía.jpg',
    'Determinación': 'Determinación.jpg', 'Determinacion': 'Determinación.jpg',
    'Tenacidad': 'Tenacidad.jpg',
  };
  function emblemImageUrl(name) {
    const file = EMBLEM_IMAGES[name];
    return file ? `Image/${encodeURIComponent(file)}` : '';
  }
  const TYPE_ICONS = {
    'Datos': '💾', 'Data': '💾',
    'Vacuna': '💉', 'Vaccine': '💉',
    'Virus': '🦠',
    'Menor': '🔹', 'Minor': '🔹',
    'Libre': '⚪', 'Free': '⚪',
  };
  const PHASE_CLASSES = {
    'Entrenamiento I': 'phase-training-1',
    'Entrenamiento 1': 'phase-training-1',
    'Entrenamiento II': 'phase-training-2',
    'Entrenamiento 2': 'phase-training-2',
    'Novato': 'phase-rookie',
    'Campeón': 'phase-champion',
    'Campeon': 'phase-champion',
    'Final': 'phase-final',
    'Perfecto': 'phase-final',
    'Ultra': 'phase-final',
    'Mega': 'phase-mega',
    'Ultimate': 'phase-mega',
  };

  const CARD_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  let cardAlbumSortMode = 'rarity';
  let cardAlbumSortDir = 1;
  let currentCardAlbumCards = [];

  const $ = (id) => document.getElementById(id);

  function getToken() {
    const match = location.pathname.match(/\/p\/([a-f0-9]{16,64})\/?$/i);
    if (match) return match[1];
    return new URLSearchParams(location.search).get('token') || '';
  }

  const token = getToken();
  // GitHub Pages sirve el HTML sin servidor: solo lectura desde un JSON congelado.
  const params = new URLSearchParams(location.search);
  const STATIC_MODE = params.get('static') === '1' || /(^|\.)github\.io$/i.test(location.hostname);
  let current = null;
  let eventSource = null;
  let booted = false;
  let notesDirty = false;
  let notesTimer = null;
  let notesSaving = false;
  let lastNotesFromServer = '';
  let lastStateAt = 0;
  let retryTimer = null;
  let inventoryFilter = 'Todos';
  const NATIVE_RESIDENTS_KEY = 'digirol_player_native_residents_collapsed';

  function readStoredFlag(key) {
    try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
  }

  function writeStoredFlag(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) {}
  }

  let shellmonNewsCollapsed = false;
  let nativeResidentsCollapsed = readStoredFlag(NATIVE_RESIDENTS_KEY);
  let evoAnimating = false;
  let pendingRenderData = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // ---------- Arranque / errores ----------
  function showError(title, message) {
    $('bootScreen').hidden = true;
    $('app').hidden = true;
    $('errorScreen').hidden = false;
    $('errorTitle').textContent = title;
    $('errorMessage').textContent = message;
  }

  function hideBoot() {
    if ($('bootScreen').hidden) return;
    $('bootScreen').hidden = true;
  }

  function setLive(online) {
    const pill = $('livePill');
    if (!pill) return;
    if (STATIC_MODE) {
      pill.classList.add('offline');
      pill.innerHTML = '<span class="live-dot"></span> Solo lectura';
      return;
    }
    pill.classList.toggle('offline', !online);
    pill.innerHTML = online
      ? '<span class="live-dot"></span> En Línea'
      : '<span class="live-dot"></span> Reconectando';
  }

  function closeStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function scheduleRetry() {
    if (STATIC_MODE) return;
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      loadOnce();
    }, 6000);
  }

  // ---------- Imagenes ----------
  let failedPortraitSrc = '';

  // ---------- Tabs ----------
  function setupTabs() {
    const nav = $('bottomNav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-btn');
      if (!btn) return;
      const tab = btn.dataset.tab;
      nav.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function setupInventoryFilters() {
    const box = $('inventoryFilters');
    if (!box) return;
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-inv-filter]');
      if (!btn) return;
      inventoryFilter = btn.dataset.invFilter || 'Todos';
      if (current && current.character) renderInventory(current.character);
    });
  }

  function applyShellmonNewsCollapse() {
    const list = $('shellmonNewsList');
    const item = document.querySelector('.prosperity-item.shellmon');
    if (list) list.hidden = shellmonNewsCollapsed;
    if (item) {
      item.classList.toggle('is-collapsed', shellmonNewsCollapsed);
      item.setAttribute('aria-expanded', String(!shellmonNewsCollapsed));
    }
  }

  function setupShellmonToggle() {
    const list = $('prosperityList');
    if (!list) return;
    const toggle = () => {
      shellmonNewsCollapsed = !shellmonNewsCollapsed;
      applyShellmonNewsCollapse();
    };
    list.addEventListener('click', (e) => {
      if (!e.target.closest('[data-shellmon-toggle]')) return;
      if (e.target.closest('img') || e.target.closest('.prosperity-card-market')) return;
      toggle();
    });
    list.addEventListener('keydown', (e) => {
      if (!e.target.closest('[data-shellmon-toggle]')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  }

  function applyNativeResidentsCollapse() {
    const list = $('nativeResidentsList');
    const btn = $('nativeResidentsToggle');
    if (list) list.hidden = nativeResidentsCollapsed;
    if (btn) {
      btn.textContent = nativeResidentsCollapsed ? 'Mostrar ▼' : 'Contraer ▲';
      btn.setAttribute('aria-expanded', String(!nativeResidentsCollapsed));
    }
  }

  function setupNativeResidentsToggle() {
    const btn = $('nativeResidentsToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      nativeResidentsCollapsed = !nativeResidentsCollapsed;
      writeStoredFlag(NATIVE_RESIDENTS_KEY, nativeResidentsCollapsed);
      applyNativeResidentsCollapse();
    });
  }

  // ---------- Imagen ampliada ----------
  function openImageLightbox(src, alt) {
    if (!src) return;
    const box = $('imageLightbox');
    const img = $('imageLightboxImg');
    if (!box || !img) return;
    img.src = src;
    img.alt = alt || '';
    const caption = $('imageLightboxCaption');
    if (caption) caption.textContent = alt || '';
    box.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeImageLightbox() {
    const box = $('imageLightbox');
    const img = $('imageLightboxImg');
    if (box) box.hidden = true;
    if (img) img.removeAttribute('src');
    const album = $('cardAlbumModal');
    const evo = $('evolutionsModal');
    if ((!album || album.hidden) && (!evo || evo.hidden)) {
      document.body.classList.remove('modal-open');
    }
  }

  function setupImageLightbox() {
    const zoomSelector = '.digimon-portrait img, .prosperity-avatar img, .evo-card img, .map-frame img, .inv-icon img, .prosperity-card-market-thumb img';
    document.addEventListener('click', (e) => {
      if (e.target.closest('.inv-item.is-album')) {
        e.preventDefault();
        openCardAlbumModal();
        return;
      }
      const invCard = e.target.closest('.inv-item');
      const img = (invCard && invCard.querySelector('.inv-icon img')) || e.target.closest('img');
      if (!img || !img.closest(zoomSelector)) return;
      if (img.hidden || img.style.display === 'none') return;
      const src = img.currentSrc || img.getAttribute('src');
      if (!src) return;
      e.preventDefault();
      openImageLightbox(src, img.alt || '');
    });

    const closeBtn = $('imageLightboxClose');
    if (closeBtn) closeBtn.addEventListener('click', closeImageLightbox);

    const box = $('imageLightbox');
    if (box) {
      box.addEventListener('click', (e) => {
        if (e.target === box || e.target.id === 'imageLightboxImg') closeImageLightbox();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box && !box.hidden) closeImageLightbox();
    });
  }

  function renderMap(data) {
    const img = $('mapImage');
    const empty = $('mapEmpty');
    const frame = $('mapFrame');
    if (!img || !empty) return;
    const url = data && data.mapImage ? String(data.mapImage) : '';
    if (url) {
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      img.hidden = false;
      empty.hidden = true;
      if (frame) frame.classList.add('has-map');
      img.onerror = () => {
        img.hidden = true;
        empty.hidden = false;
        if (frame) frame.classList.remove('has-map');
      };
    } else {
      img.hidden = true;
      img.removeAttribute('src');
      img.onerror = null;
      empty.hidden = false;
      if (frame) frame.classList.remove('has-map');
    }

    // Leyendas ligadas a la prosperidad: solo aparecen con su Digimon activo.
    const legend = $('mapLegend');
    if (legend) {
      const active = new Set(
        (Array.isArray(data && data.prosperityDigimons) ? data.prosperityDigimons : [])
          .map((entry) => (entry && entry.name ? String(entry.name) : ''))
          .filter(Boolean)
      );
      legend.querySelectorAll('[data-legend-digimon]').forEach((item) => {
        item.hidden = !active.has(item.dataset.legendDigimon);
      });
    }
  }

  // ---------- Render ----------
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clearMosaicField() {
    const tiles = $('evoFlashPixels');
    if (tiles) tiles.innerHTML = '';
  }

  // La pantalla completa se arma con mosaicos que se desprenden en cascada y
  // caen como lluvia, desvaneciéndose sin ruido ni capas extra.
  function buildMosaicField() {
    const tiles = $('evoFlashPixels');
    if (!tiles) return;
    const width = Math.max(320, window.innerWidth);
    const height = Math.max(420, window.innerHeight);
    const targetTiles = 200;
    const aspect = width / height;
    const cols = Math.max(10, Math.min(26, Math.round(Math.sqrt(targetTiles * aspect))));
    const rows = Math.max(12, Math.min(30, Math.ceil(targetTiles / cols) + 2));
    const cellW = width / cols;
    const cellH = height / rows;
    const fragment = document.createDocumentFragment();

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = document.createElement('span');
        const rotation = Math.round(-18 + Math.random() * 36);
        tile.className = 'mosaic-tile';
        tile.style.left = `${(((col + 0.5) / cols) * 100).toFixed(2)}%`;
        tile.style.top = `${(((row + 0.5) / rows) * 100).toFixed(2)}%`;
        tile.style.setProperty('--tile-w', `${Math.max(12, cellW - 3).toFixed(1)}px`);
        tile.style.setProperty('--tile-h', `${Math.max(12, cellH - 3).toFixed(1)}px`);
        tile.style.setProperty('--tile-radius', `${Math.round(Math.random() * 3)}px`);
        tile.style.setProperty('--tile-detach-x', `${(-10 + Math.random() * 20).toFixed(1)}px`);
        tile.style.setProperty('--tile-rotate-small', `${Math.round(rotation / 3)}deg`);
        tile.style.setProperty('--tile-mid-x', `${(-26 + Math.random() * 52).toFixed(1)}px`);
        tile.style.setProperty('--tile-mid-y', `${(14 + row * 2 + Math.random() * 10).toFixed(0)}vh`);
        tile.style.setProperty('--tile-fall-x', `${(-14 + Math.random() * 28).toFixed(1)}vw`);
        tile.style.setProperty('--tile-fall-y', `${(72 + row * 3 + Math.random() * 22).toFixed(0)}vh`);
        tile.style.setProperty('--tile-rotate', `${rotation}deg`);
        tile.style.setProperty('--tile-delay', `${Math.round(row * 70 + col * 8 + Math.random() * 200)}ms`);
        tile.style.setProperty('--tile-duration', `${2200 + row * 50 + Math.round(Math.random() * 400)}ms`);
        fragment.appendChild(tile);
      }
    }
    tiles.innerHTML = '';
    tiles.appendChild(fragment);
  }

  function resetEvoFlashChrome(overlay) {
    if (!overlay) return;
    overlay.classList.remove('is-regression');
    const icon = overlay.querySelector('.evo-flash-icon');
    const title = overlay.querySelector('.evo-flash-title');
    if (icon) icon.textContent = '🧬';
    if (title) title.textContent = 'DIGIEVOLUCIÓN';
    clearMosaicField();
  }

  // Brillo progresivo para evoluciones; desarme en lluvia de mosaicos para regresiones.
  // En ambos casos el cambio de datos se aplica en el pico y luego se revela.
  function runPhaseTransitionAnimation(previousChar, newChar, applyState, regression) {
    evoAnimating = true;
    const overlay = $('evoFlash');
    const app = $('app');
    const nameBox = $('evoFlashName');
    const from = previousChar && previousChar.digimon ? previousChar.digimon : '';
    const to = newChar && newChar.digimon ? newChar.digimon : '';
    if (nameBox) {
      if (regression && previousChar && newChar) {
        nameBox.textContent = `${from} → ${to}`;
      } else {
        nameBox.textContent = from && to ? `${from} → ${to}` : to;
      }
    }
    if (overlay) {
      resetEvoFlashChrome(overlay);
      overlay.classList.toggle('is-regression', !!regression);
      if (regression) {
        const icon = overlay.querySelector('.evo-flash-icon');
        const title = overlay.querySelector('.evo-flash-title');
        if (icon) icon.textContent = '💠';
        if (title) title.textContent = 'REGRESIÓN DIGITAL';
        buildMosaicField();
      }
    }
    const appClass = regression ? 'evo-regression-dim' : 'evo-bright';
    if (app) app.classList.add(appClass);
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('is-releasing', 'is-charging');
      void overlay.offsetWidth;
      overlay.classList.add('is-charging');
    }

    const chargeMs = regression ? 1600 : 1050;
    const releaseMs = regression ? 1500 : 1250;
    setTimeout(() => {
      applyState();
      setTimeout(() => {
        if (overlay) {
          overlay.classList.remove('is-charging');
          overlay.classList.add('is-releasing');
        }
        if (app) app.classList.remove(appClass);
        setTimeout(() => {
          if (overlay) {
            overlay.hidden = true;
            overlay.classList.remove('is-releasing', 'is-charging');
            resetEvoFlashChrome(overlay);
          }
          evoAnimating = false;
          if (pendingRenderData) {
            const next = pendingRenderData;
            pendingRenderData = null;
            render(next, true);
          }
        }, releaseMs);
      }, regression ? 520 : 340);
    }, chargeMs);
  }

  function playEvolutionAnimation(previousChar, newChar, applyState) {
    runPhaseTransitionAnimation(previousChar, newChar, applyState, false);
  }

  function playRegressionAnimation(previousChar, newChar, applyState) {
    runPhaseTransitionAnimation(previousChar, newChar, applyState, true);
  }

  function render(data, skipEvolutionAnimation) {
    if (!data || !data.ok || !data.character) {
      const reason = data && data.error ? String(data.error) : '';
      if (STATIC_MODE) {
        showError('Consulta no disponible', reason || 'No se pudo abrir la instantánea de esta planilla.');
        return;
      }
      if (!booted) {
        showError('Enlace no valido', 'Este enlace no pertenece a ningun jugador. Pide uno nuevo al Master.');
      } else {
        closeStream();
        setLive(false);
        showError(
          'Sesion pausada',
          reason === 'Sin partida activa'
            ? 'El Master esta cambiando de partida. Esperando a que vuelva tu mesa...'
            : 'Tu personaje ya no esta en la partida activa. Pide un enlace nuevo al Master.'
        );
      }
      scheduleRetry();
      return;
    }

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    $('errorScreen').hidden = true;

    const char = data.character;
    const previousChar = current && current.character ? current.character : null;
    const evolved = !skipEvolutionAnimation && !evoAnimating && booted && previousChar
      && previousChar.digimon && char.digimon
      && previousChar.digimon !== char.digimon;
    const phaseRank = (fase) => (typeof getUnifiedPhaseRank === 'function' ? getUnifiedPhaseRank(fase) : -1);
    const fromRank = phaseRank(previousChar && previousChar.fase);
    const toRank = phaseRank(char.fase);
    const isPhaseRegression = fromRank >= 0 && toRank >= 0 && toRank < fromRank;
    if (evolved && !prefersReducedMotion()) {
      if (isPhaseRegression) {
        playRegressionAnimation(previousChar, char, () => render(data, true));
      } else {
        playEvolutionAnimation(previousChar, char, () => render(data, true));
      }
      return;
    }
    if (evoAnimating && !skipEvolutionAnimation) {
      pendingRenderData = data;
      return;
    }

    const wasBooted = booted;
    booted = true;
    current = data;
    lastStateAt = Date.now();

    hideBoot();
    $('app').hidden = false;
    setLive(true);

    const color = EMBLEM_COLORS[char.emblema] || '#f5c542';
    document.documentElement.style.setProperty('--emblem-color', color);
    document.documentElement.style.setProperty('--emblem-glow', hexToRgba(color, 0.4));
    const emblemImage = emblemImageUrl(char.emblema);
    document.documentElement.style.setProperty('--emblem-bg', emblemImage ? `url("${emblemImage}")` : 'none');
    $('heroGlow').style.setProperty('--emblem-glow', hexToRgba(color, 0.5));

    const dayNumber = Math.max(0, Math.trunc(num(data.day)));
    const isNight = data.isDayTime === false;
    const dayPill = $('dayPill');
    if (dayPill) {
      dayPill.textContent = `Día ${dayNumber}`;
      dayPill.title = `Día ${dayNumber} de la partida`;
    }
    const dayPhasePill = $('dayPhasePill');
    if (dayPhasePill) {
      dayPhasePill.textContent = isNight ? '🌙 Noche' : '☀️ Día';
      dayPhasePill.classList.toggle('night', isNight);
      dayPhasePill.title = isNight ? 'El Master marcó el momento: Noche' : 'El Master marcó el momento: Día';
    }
    $('playerName').textContent = `👤 ${char.jugador || 'Jugador'}`;
    const charAge = String(char.edad == null ? '' : char.edad).trim();
    $('charName').textContent = `${char.nombre || 'Personaje'}${charAge ? ` (${charAge})` : ''}`;
    $('charName').title = charAge ? `Edad: ${charAge}` : '';
    $('digimonName').textContent = char.digimon || '';
    const phaseBadge = $('phaseBadge');
    if (phaseBadge) {
      phaseBadge.textContent = char.fase || 'Digimon';
      phaseBadge.style.display = char.fase ? '' : 'none';
      Object.keys(PHASE_CLASSES).forEach((phase) => phaseBadge.classList.remove(PHASE_CLASSES[phase]));
      if (typeof getUnifiedPhaseClass === 'function') {
        Object.keys(UNIFIED_PHASE_THEMES).forEach((key) => phaseBadge.classList.remove('phase--' + key));
        phaseBadge.classList.add('phase-color');
        phaseBadge.classList.add(getUnifiedPhaseClass(char.fase));
      } else {
        const phaseClass = PHASE_CLASSES[char.fase];
        if (phaseClass) phaseBadge.classList.add(phaseClass);
      }
    }

    const typeBadge = $('typeBadge');
    if (typeBadge) {
      const typeIcon = TYPE_ICONS[char.tipo];
      if (typeIcon) {
        typeBadge.textContent = `${typeIcon} ${char.tipo}`;
        typeBadge.hidden = false;
      } else {
        typeBadge.hidden = true;
      }
    }

    const emblemIcon = EMBLEM_ICONS[char.emblema] || '✦';
    const emblemText = char.emblema
      ? `${emblemIcon} ${char.emblema}`
      : 'Sin emblema';
    $('emblemLine').textContent = emblemText;
    const datacoreEmblem = $('datacoreEmblem');
    if (datacoreEmblem) datacoreEmblem.textContent = emblemText;

    // Retrato
    const portrait = $('digimonPortrait');
    const img = $('digimonImage');
    const initial = (char.digimon || '?').charAt(0);
    portrait.classList.remove('no-image');
    img.style.display = '';
    $('digimonInitial').textContent = initial;
    if (char.image && failedPortraitSrc !== char.image) {
      if (img.getAttribute('src') !== char.image) {
        img.setAttribute('src', char.image);
        img.setAttribute('alt', char.digimon || '');
      }
      img.onerror = () => {
        img.onerror = null;
        failedPortraitSrc = char.image;
        img.style.display = 'none';
        portrait.classList.add('no-image');
        $('digimonInitial').textContent = initial;
      };
    } else {
      portrait.classList.add('no-image');
      if (char.image) img.style.display = 'none';
    }

    // Corazones
    const hearts = Math.max(0, Math.min(num(char.maxHearts), num(char.hearts)));
    const maxHearts = Math.max(0, num(char.maxHearts));
    let heartsHtml = '';
    for (let i = 0; i < maxHearts; i++) {
      heartsHtml += `<span class="heart${i >= hearts ? ' empty' : ''}">${i < hearts ? '❤️' : '💔'}</span>`;
    }
    $('heartsRow').innerHTML = heartsHtml || '<span class="hearts-empty">Sin corazones registrados</span>';
    $('heartsCount').textContent = `${hearts}/${maxHearts}`;

    const deaths = Math.max(0, Math.trunc(num(char.muertes)));
    const deathCounter = $('deathCounter');
    if (deathCounter) {
      deathCounter.hidden = deaths <= 0;
      deathCounter.textContent = `☠️ ${deaths}`;
      deathCounter.title = `${deaths} muerte${deaths === 1 ? '' : 's'} acumulada${deaths === 1 ? '' : 's'}`;
    }

    // Contadores
    $('bitsValue').textContent = num(char.bits).toLocaleString('es');
    $('bankValue').textContent = num(char.bitsBanco).toLocaleString('es');
    $('foodValue').textContent = num(char.comida).toLocaleString('es');
    $('discsValue').textContent = num(char.discos).toLocaleString('es');
    $('bankCard').classList.toggle('locked', !char.bankActive);
    $('bankCard').title = char.bankActive ? 'Banco activo (Agumon en prosperidad)' : 'Banco bloqueado: requiere Agumon en prosperidad';

    // Salud junto a los corazones
    $('healthValue').textContent = num(char.stats.salud).toLocaleString('es');

    // DataCore (ESP) y estadisticas
    const datacore = Math.max(0, Math.min(100, num(char.stats.espiritu)));
    $('datacoreFill').style.width = `${datacore}%`;
    $('datacorePct').textContent = `${datacore}%`;
    const bonus = char.statsBonus || {};
    const bonusParts = char.statsBonusParts || {};
    setStat('statFuerza', char.stats.fuerza, bonusParts.fuerza || (bonus.fuerza ? [bonus.fuerza] : []));
    setStat('statDefensa', char.stats.defensa, bonusParts.defensa || (bonus.defensa ? [bonus.defensa] : []));
    setStat('statVelocidad', char.stats.velocidad, bonusParts.velocidad || (bonus.velocidad ? [bonus.velocidad] : []));
    setStat('statInteligencia', char.stats.inteligencia, bonusParts.inteligencia || (bonus.inteligencia ? [bonus.inteligencia] : []));

    // Estados alterados: solo el emoji del elemento; el color de la etiqueta
    // indica si es BUFF o DEBUFF (los caracteres 🢁/🢃 no renderizan en móvil).
    const statusChips = (char.status || []).map((s) =>
      `<span class="chip ${s.kind === 'buff' ? 'buff' : (s.kind === 'debuff' ? 'debuff' : 'status')}">${esc(s.icon)} ${esc(s.label)}${s.detail ? ` <small>${esc(s.detail)}</small>` : ''}</span>`
    ).join('');
    $('statusChips').innerHTML = statusChips || '<span class="chips-empty">Sin estados alterados</span>';

    // Necesidades: lo que el Master ya sacio, baño/descanso activos y entrenamiento.
    const needs = char.needs || {};
    const foodNeed = needs.food || { satiated: 0, required: 0 };
    const foodSatiated = num(foodNeed.satiated);
    const foodRequired = num(foodNeed.required);
    const hungerDone = foodRequired > 0 && foodSatiated >= foodRequired;
    $('hungerChip').innerHTML = `
      <span class="chip need-chip hunger${hungerDone ? ' done' : ''}" title="Comida de la fase">
        🍖 <strong>${foodSatiated}/${foodRequired}</strong>
      </span>`;

    // Baño y Descanso: solo iconos. Parpadean hasta que el GM los activa.
    let needChips = '';
    needChips += `<span class="chip need-chip${needs.caca ? ' done' : ''}" title="Baño">💩</span>`;
    needChips += `<span class="chip need-chip${needs.sueno ? ' done' : ''}" title="Descanso">💤</span>`;
    $('needChips').innerHTML = needChips;

    const training = needs.training || {};
    const trainingDefs = [
      { key: 'guante', label: 'Guante', icon: '🥊' },
      { key: 'escudo', label: 'Escudo', icon: '🛡️' },
      { key: 'espadas', label: 'Combate', icon: '⚔️' },
    ];
    $('trainingChips').innerHTML = trainingDefs.map((item) =>
      `<span class="chip training-chip ${training[item.key] ? 'active' : 'off'}" title="${esc(item.label)}">${item.icon}</span>`
    ).join('');

    renderEvolutions(char, data);
    renderInventory(char);
    renderProsperity(data);
    renderMap(data);

    // Notas (no pisar lo que el jugador esta escribiendo)
    const area = $('notesInput');
    const incomingNotes = char.playerNotes || '';
    lastNotesFromServer = incomingNotes;
    if (!notesDirty && document.activeElement !== area && area.value !== incomingNotes) {
      area.value = incomingNotes;
      setNotesState('saved', STATIC_MODE ? 'Solo lectura · instantánea' : 'Guardado');
    }
    updateNotesCounter();

    if (!wasBooted) {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  }

  function setStat(id, base, contributions) {
    const el = $(id);
    if (!el) return;
    const parts = [num(base)].concat(Array.isArray(contributions) ? contributions.map(num) : []);
    const total = Math.max(0, parts.reduce((sum, value) => sum + value, 0));
    el.textContent = total.toLocaleString('es');

    const box = el.closest('.stat-box') || el.parentElement;
    if (!box) return;
    let breakdown = box.querySelector('.stat-breakdown');
    const extras = parts.slice(1);

    if (!extras.length) {
      if (breakdown) breakdown.remove();
      return;
    }

    if (!breakdown) {
      breakdown = document.createElement('div');
      breakdown.className = 'stat-breakdown';
      box.appendChild(breakdown);
    }

    breakdown.innerHTML = parts.map((value, index) => {
      const cls = index === 0 ? 'base' : value >= 0 ? 'pos' : 'neg';
      const sign = index === 0 || value < 0 ? '' : '+';
      return `<span class="${cls}">${sign}${value}</span>`;
    }).join('');
  }

  function renderEvolutions(char, data) {
    const btn = $('evoOpenBtn');
    const grid = $('evolutionsGrid');
    const itemGrid = $('itemEvolutionsGrid');
    const itemSection = $('itemEvolutionsSection');
    const divider = $('evoKindDivider');
    const note = $('evoRequestNote');
    const evos = Array.isArray(char.evolutions) ? char.evolutions : [];
    // Las rutas de objeto son un sello permanente: van siempre arriba y en su
    // propio contenedor, aunque hoy haya bloqueo de evoluciones normales.
    const itemEvos = evos.filter((evo) => evo.unlockedByItem === true);
    const generalEvos = evos.filter((evo) => evo.unlockedByItem !== true);
    const pending = char.evolutionRequest && (char.evolutionRequest.target || char.evolutionRequest.key)
      ? char.evolutionRequest
      : null;
    const dayLock = char && Number.isFinite(Number(char.evolutionLockedDay)) && Number(char.evolutionLockedDay) >= 0
      && String(char.evolutionLockedDay) === String((data || current || {}).day);
    const wasEvoBtnHidden = btn ? btn.hidden : true;
    if (btn) btn.hidden = !evos.length || (dayLock && itemEvos.length === 0);
    if (btn && !btn.hidden && wasEvoBtnHidden && !prefersReducedMotion()) {
      btn.classList.remove('evo-btn-reveal');
      void btn.offsetWidth;
      btn.classList.add('evo-btn-reveal');
      const clearReveal = () => btn.classList.remove('evo-btn-reveal');
      btn.addEventListener('animationend', clearReveal, { once: true });
    }
    if (!grid) return;

    const clearGrids = () => {
      grid.innerHTML = '';
      if (itemGrid) itemGrid.innerHTML = '';
      if (itemSection) itemSection.hidden = true;
      if (divider) divider.hidden = true;
    };

    if (dayLock && itemEvos.length === 0) {
      clearGrids();
      const count = $('evolutionsCount');
      if (count) count.textContent = '';
      if (note) {
        note.hidden = false;
        note.textContent = 'El Master actualizó tu Digimon hoy. Las digievoluciones volverán mañana.';
      }
      const modal = $('evolutionsModal');
      if (modal) modal.hidden = true;
      return;
    }

    if (note) {
      note.classList.remove('error');
      if (dayLock && itemEvos.length) {
        note.hidden = false;
        note.textContent = 'El Master actualizó tu Digimon hoy. Tus rutas de objeto siguen disponibles; las demás vuelven mañana.';
      } else if (pending) {
        note.hidden = false;
        note.textContent = `Solicitud enviada al Master: ${pending.target || '???'}. Espera su respuesta.`;
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    }

    if (!evos.length) {
      clearGrids();
      $('evolutionsCount').textContent = '';
      if (note) {
        note.hidden = true;
        note.textContent = '';
        note.classList.remove('error');
      }
      const modal = $('evolutionsModal');
      if (modal) modal.hidden = true;
      return;
    }

    const cardMarkup = (evo, isItem) => {
      if (evo.state === 'unknown') {
        const busy = !!pending;
        const label = pending
          ? (pending.key && pending.key === evo.key ? 'Solicitud enviada' : 'Solicitud pendiente')
          : 'Solicitar al Master';
        return `
          <div class="evo-card unknown">
            <div class="evo-fallback">❔</div>
            <div class="evo-name">???</div>
            <div class="evo-tag">Desconocida</div>
            ${STATIC_MODE
              ? '<button type="button" class="evo-request-btn" disabled>Solo lectura</button>'
              : `<button type="button" class="evo-request-btn" data-evo-request-key="${esc(evo.key || '')}" ${busy ? 'disabled' : ''}>${label}</button>`}
          </div>`;
      }

      const initial = (evo.name || '?').charAt(0);
      const busy = !!pending;
      const isPending = !!pending && (pending.target === evo.name || (pending.key && pending.key === evo.key));
      const ready = evo.canRequest !== false;
      const label = isPending
        ? 'Solicitud enviada'
        : (pending ? 'Solicitud pendiente' : (ready ? 'Solicitar al Master' : 'No disponible'));
      const tagLabel = ready ? 'Disponible' : 'No disponible';
      return `
        <div class="evo-card${isItem ? ' evo-card-item' : ''}${ready ? '' : ' evo-card-locked'}">
          ${evo.image
            ? `<img src="${esc(evo.image)}" alt="${esc(evo.name)}" data-fallback="${esc(initial)}" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex'; if(this.closest('.evo-card')) this.closest('.evo-card').classList.add('no-image');">`
            : ''}
          <div class="evo-fallback" style="${evo.image ? 'display:none;' : ''}">${esc(initial)}</div>
          <div class="evo-name">${esc(evo.name)}</div>
          <div class="evo-tag">${tagLabel}</div>
          ${isItem ? '<div class="evo-route-tag" title="Ruta fijada permanentemente con un objeto de evolución">🔓 Objeto</div>' : ''}
          ${evo.fase ? `<div class="muted">${phaseColorSpan(evo.fase, esc(evo.fase))}</div>` : ''}
          ${evo.tipo ? `<span class="evo-tipo">${esc(TYPE_ICONS[evo.tipo] || '🧬')} ${esc(evo.tipo)}</span>` : ''}
          ${STATIC_MODE
            ? '<button type="button" class="evo-request-btn" disabled>Solo lectura</button>'
            : `<button type="button" class="evo-request-btn" data-evo-request="${esc(evo.name)}" ${busy || !ready ? 'disabled' : ''} title="${ready ? 'Solicitar evolución' : 'No disponible hasta alcanzar los stats necesarios'}">${label}</button>`}
        </div>`;
    };

    if (itemGrid) itemGrid.innerHTML = itemEvos.map((evo) => cardMarkup(evo, true)).join('');
    if (itemSection) itemSection.hidden = itemEvos.length === 0;
    const visibleEvos = dayLock ? itemEvos : evos;
    if (divider) divider.hidden = dayLock || !(itemEvos.length > 0 && generalEvos.length > 0);
    grid.innerHTML = dayLock ? '' : generalEvos.map((evo) => cardMarkup(evo, false)).join('');

    $('evolutionsCount').textContent = `${visibleEvos.length} ruta${visibleEvos.length === 1 ? '' : 's'}`;
  }

  function openEvolutionsModal() {
    if (!current || !current.character) return;
    const evos = Array.isArray(current.character.evolutions) ? current.character.evolutions : [];
    if (!evos.length) return;
    renderEvolutions(current.character, current);
    $('evolutionsModal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeEvolutionsModal() {
    const modal = $('evolutionsModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function requestEvolution(payload, button) {
    if (STATIC_MODE) {
      alert('📄 Esta es una consulta de solo lectura. Las solicitudes se hacen desde la partida en LAN.');
      return;
    }
    if (!token || !current || !current.character || !payload) return;
    if (!payload.target && !payload.key) return;
    if (current.character.evolutionRequest) return;

    const note = $('evoRequestNote');
    const original = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando...';
    }

    try {
      const res = await fetch(`/api/player/${token}/evolve-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar la solicitud');

      current.character.evolutionRequest = data.request || {
        target: payload.target || null,
        key: payload.key || null,
        hidden: !!payload.key,
        requestedAt: Date.now(),
      };
      renderEvolutions(current.character, current);
    } catch (err) {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
      if (note) {
        note.hidden = false;
        note.classList.add('error');
        note.textContent = err.message || 'No se pudo enviar la solicitud.';
      }
    }
  }

  function setupEvolutionModal() {
    const btn = $('evoOpenBtn');
    const modal = $('evolutionsModal');
    const close = $('evoCloseBtn');
    const grids = [$('evolutionsGrid'), $('itemEvolutionsGrid')].filter(Boolean);
    if (btn) btn.addEventListener('click', openEvolutionsModal);
    if (close) close.addEventListener('click', closeEvolutionsModal);
    grids.forEach((grid) => {
      grid.addEventListener('click', (e) => {
        const requestBtn = e.target.closest('[data-evo-request], [data-evo-request-key]');
        if (!requestBtn || requestBtn.disabled) return;
        const key = requestBtn.dataset.evoRequestKey;
        const target = requestBtn.dataset.evoRequest;
        if (key) requestEvolution({ key }, requestBtn);
        else if (target) requestEvolution({ target }, requestBtn);
      });
    });
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEvolutionsModal();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeEvolutionsModal();
    });
  }

  function renderInventoryFilters(items) {
    const box = $('inventoryFilters');
    if (!box) return;

    const types = [];
    items.forEach((item) => {
      const type = item && item.tipo ? String(item.tipo) : 'Otros';
      if (!types.includes(type)) types.push(type);
    });
    types.sort((a, b) => a.localeCompare(b, 'es'));

    if (inventoryFilter !== 'Todos' && !types.includes(inventoryFilter)) {
      inventoryFilter = 'Todos';
    }

    box.innerHTML = ['Todos', ...types].map((type) => `
      <button type="button" class="inv-filter${inventoryFilter === type ? ' active' : ''}" data-inv-filter="${esc(type)}">${esc(type)}</button>
    `).join('');
  }

  function renderInventory(char) {
    const list = $('inventoryList');
    // El álbum real nunca se muestra como objeto suelto: el botón de arriba es
    // la única entrada, tanto si el servidor ya lo filtra como si no.
    const items = (Array.isArray(char.inventory) ? char.inventory.slice() : [])
      .filter((item) => item && item.id !== 'album_cartas');

    // El álbum se muestra como una herramienta especial al inicio de la mochila.
    if (char.hasCardAlbum) {
      const cards = Array.isArray(char.cardsAlbum) ? char.cardsAlbum : [];
      const total = cards.reduce((sum, card) => sum + num(card.cantidad), 0);
      items.unshift({
        id: 'album_cartas',
        nombre: 'Álbum de cartas',
        icono: '📔',
        tipo: 'Herramienta',
        desc: `${total} carta${total === 1 ? '' : 's'} en tu colección · toca para desplegar`,
        cantidad: 1,
        isAlbum: true,
      });
    }

    $('inventoryCount').textContent = `${items.length} objeto${items.length === 1 ? '' : 's'}`;
    renderInventoryFilters(items);
    if (!items.length) {
      list.innerHTML = '<div class="chips-empty" style="padding:8px 2px;">La mochila esta vacia.</div>';
      return;
    }

    const visible = inventoryFilter === 'Todos'
      ? items
      : items.filter((item) => (item && item.tipo ? String(item.tipo) : 'Otros') === inventoryFilter);

    if (!visible.length) {
      list.innerHTML = '<div class="chips-empty" style="padding:8px 2px;">No hay objetos de este tipo.</div>';
      return;
    }

    list.innerHTML = visible.map((item) => {
      const initial = (item.icono || '📦').slice(0, 2);
      const rarityColor = item.rarezaColor || '';
      const rarityStyle = rarityColor
        ? ` style="color:${esc(rarityColor)};border-color:${esc(rarityColor)};background:${hexToRgba(rarityColor, 0.14)};"`
        : '';
      const rarityClass = item.rareza ? ' has-rarity' : '';
      const rarityVar = rarityColor ? ` style="--rarity-color:${esc(rarityColor)};"` : '';
      return `
        <div class="inv-item${item.imagen ? ' has-image' : ''}${rarityClass}${item.isAlbum ? ' is-album' : ''}"${rarityVar}>
          <div class="inv-icon">
            ${item.imagen
              ? `<img src="${esc(item.imagen)}" alt="${esc(item.nombre)}" onerror="this.onerror=null; this.style.display='none'; if(this.parentElement) this.parentElement.textContent='${esc(initial)}';">`
              : esc(initial)}
          </div>
          <div class="inv-body">
            <div class="inv-top">
              <span class="inv-name">${esc(item.nombre)}</span>
              <span class="inv-qty">x${num(item.cantidad)}</span>
            </div>
            ${(item.tipo || item.rareza) ? `
              <div class="inv-meta">
                ${item.tipo ? `<span class="inv-type">${esc(item.tipo)}</span>` : ''}
                ${item.rareza ? `<span class="inv-rarity"${rarityStyle}>${esc(item.rareza)}</span>` : ''}
              </div>` : ''}
            ${item.desc ? `<div class="inv-desc">${esc(item.desc)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function getCardRarityKeyMobile(card) {
    const key = String((card && card.rarezaKey) || '').toLowerCase();
    if (key && CARD_RARITY_ORDER.includes(key)) return key;
    const label = String((card && card.rareza) || '').toLowerCase();
    if (/legend/.test(label)) return 'legendary';
    if (/[ée]pica/.test(label)) return 'epic';
    if (/rara/.test(label)) return 'rare';
    if (/poco/.test(label)) return 'uncommon';
    return 'common';
  }

  function openCardAlbumModal() {
    const modal = $('cardAlbumModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    renderCardAlbum();
  }

  function closeCardAlbumModal() {
    const modal = $('cardAlbumModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function renderCardAlbum() {
    const grid = $('cardAlbumGrid');
    if (!grid) return;
    const char = current && current.character ? current.character : {};
    const cards = Array.isArray(char.cardsAlbum) ? char.cardsAlbum.slice() : [];
    const total = cards.reduce((sum, card) => sum + num(card.cantidad), 0);

    const count = $('cardAlbumCount');
    if (count) {
      count.textContent = `${total} carta${total === 1 ? '' : 's'} · ${cards.length} única${cards.length === 1 ? '' : 's'}`;
    }
    const dirBtn = $('cardAlbumDirBtn');
    if (dirBtn) dirBtn.textContent = cardAlbumSortDir === 1 ? '↑ Asc' : '↓ Desc';

    document.querySelectorAll('#cardAlbumToolbar [data-album-sort]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-album-sort') === cardAlbumSortMode);
    });

    currentCardAlbumCards = cards.sort((a, b) => {
      let result;
      if (cardAlbumSortMode === 'name') {
        result = String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
      } else {
        result = CARD_RARITY_ORDER.indexOf(getCardRarityKeyMobile(a))
          - CARD_RARITY_ORDER.indexOf(getCardRarityKeyMobile(b));
        if (result === 0) result = String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
      }
      return result * (cardAlbumSortDir === -1 ? -1 : 1);
    });

    if (!currentCardAlbumCards.length) {
      grid.innerHTML = '<div class="card-album-empty">Tu álbum está vacío. ¡Abre sobres o pide cartas al Master!</div>';
      return;
    }

    grid.innerHTML = currentCardAlbumCards.map((card, index) => {
      const color = card.rarezaColor || '';
      const style = color ? ` style="--card-rarity:${esc(color)};"` : '';
      const image = card.imagen || '';
      return `
        <div class="card-album-item${color ? ' has-rarity' : ''}"${style}
             data-card-index="${index}" role="button" tabindex="0"
             title="Ampliar ${esc(card.nombre || card.id || 'Carta')}">
          <div class="card-album-thumb">
            ${image ? `<img src="${esc(image)}" alt="${esc(card.nombre || '')}">` : '<span>🎴</span>'}
          </div>
          <div class="card-album-name">${esc(card.nombre || card.id || '')}</div>
          <div class="card-album-meta">
            <span class="card-album-rarity">${esc(card.rareza || 'Común')}</span>
            <span class="card-album-qty">x${num(card.cantidad)}</span>
          </div>
        </div>`;
    }).join('');
  }

  function cardPlaceholderDataUrl(card) {
    const label = String((card && (card.nombre || card.id)) || 'Carta');
    const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rarity = String((card && card.rareza) || 'Común').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
      <rect width="480" height="640" rx="24" fill="#0f172a" stroke="#f5c542" stroke-width="8"/>
      <text x="240" y="270" text-anchor="middle" font-size="150">🎴</text>
      <text x="240" y="380" text-anchor="middle" font-size="30" fill="#f8fafc" font-family="sans-serif">${safe}</text>
      <text x="240" y="430" text-anchor="middle" font-size="22" fill="#f5c542" font-family="sans-serif">${rarity}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function openCardPreview(card) {
    if (!card) return;
    const src = card.imagen || cardPlaceholderDataUrl(card);
    openImageLightbox(src, `${card.nombre || card.id || 'Carta'} · ${card.rareza || 'Común'} · x${num(card.cantidad)}`);
  }

  function setupCardAlbumModal() {
    const modal = $('cardAlbumModal');
    const closeBtn = $('cardAlbumCloseBtn');
    const grid = $('cardAlbumGrid');
    if (grid) {
      const previewFromEvent = (e) => {
        const cardEl = e.target.closest('[data-card-index]');
        if (!cardEl) return;
        const card = currentCardAlbumCards[Number(cardEl.getAttribute('data-card-index'))];
        if (card) openCardPreview(card);
      };
      grid.addEventListener('click', previewFromEvent);
      grid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const cardEl = e.target.closest('[data-card-index]');
        if (!cardEl) return;
        e.preventDefault();
        previewFromEvent(e);
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeCardAlbumModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCardAlbumModal();
      });
    }
    document.querySelectorAll('#cardAlbumToolbar [data-album-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cardAlbumSortMode = btn.getAttribute('data-album-sort') === 'name' ? 'name' : 'rarity';
        renderCardAlbum();
      });
    });
    const dirBtn = $('cardAlbumDirBtn');
    if (dirBtn) {
      dirBtn.addEventListener('click', () => {
        cardAlbumSortDir *= -1;
        renderCardAlbum();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.hidden) closeCardAlbumModal();
    });
  }

  function renderProsperity(data) {
    const list = $('prosperityList');
    const digimons = Array.isArray(data.prosperityDigimons) ? data.prosperityDigimons : [];
    const comforts = Array.isArray(data.comforts) ? data.comforts : [];
    const residents = Array.isArray(data.nativeResidents) ? data.nativeResidents : [];
    const news = Array.isArray(data.news) ? data.news : [];
    const char = data && data.character ? data.character : {};
    const cardMarket = char.cardMarket || {};
    const albumCards = Array.isArray(char.cardsAlbum) ? char.cardsAlbum : [];
    const comfortByKey = {};
    comforts.forEach((c) => { if (c && c.key) comfortByKey[c.key] = c; });
    $('prosperityNumber').textContent = num(data.prosperity);

    const comfortBox = $('comfortMetersPlayer');
    if (comfortBox) {
      comfortBox.innerHTML = comforts.map((c) => {
        const value = Math.max(0, Math.min(10, Number(c.value) || 0));
        const color = c.color || '#f5c542';
        const blocks = Array.from({ length: 10 }, (_, index) => {
          const filled = index < value;
          return `<span class="comfort-block${filled ? ' filled' : ''}"${filled ? ` style="background:${esc(color)};box-shadow:0 0 6px ${esc(color)}66;"` : ''}></span>`;
        }).join('');
        return `
          <div class="comfort-row" style="--comfort-color:${esc(color)};">
            <div class="comfort-head">
              <span>${esc(c.icon || '')} ${esc(c.label || '')}</span>
            </div>
            <div class="comfort-track" title="${esc(c.label || '')}: ${value} punto(s)">${blocks}</div>
          </div>`;
      }).join('');
    }

    const pendingSale = char.cardSaleRequest
      && String(char.cardSaleRequest.day || 0) === String(cardMarket.day || 0)
      ? char.cardSaleRequest
      : null;

    if (!digimons.length) {
      list.innerHTML = '<div class="card"><span class="chips-empty">Todavia no hay Digimon activos en la ciudad.</span></div>';
    } else {
      list.innerHTML = digimons.map((d) => {
        const initial = (d.name || '?').charAt(0);
        const daysLeft = Math.max(0, Math.trunc(num(d.daysLeft)));
        const onExpedition = d.name === 'Drimogemon' && daysLeft > 0;
        const isShellmon = d.name === 'Shellmon';
        const hasNews = isShellmon && news.length > 0;
        const shellmonAttrs = hasNews ? ' data-shellmon-toggle role="button" tabindex="0"' : '';
        const cardRequest = cardMarket.active && Array.isArray(cardMarket.requests)
          ? cardMarket.requests.find((entry) => entry && entry.npc === d.name)
          : null;
        const owned = cardRequest
          ? albumCards.filter((card) => card && (card.itemId || card.id) === cardRequest.itemId)
            .reduce((sum, card) => sum + num(card.cantidad), 0)
          : 0;
        const salePendingHere = !!(pendingSale && cardRequest && String(pendingSale.npc) === String(cardRequest.npc));
        const saleBlocked = !!(pendingSale && !salePendingHere);
        const sellLabel = !cardRequest ? ''
          : cardRequest.sold ? 'Vendido'
          : salePendingHere ? 'Pendiente'
          : saleBlocked ? 'Espera al GM'
          : !char.hasCardAlbum ? 'Sin álbum'
          : owned <= 0 ? 'Sin carta'
          : 'Vender';
        const sellDisabled = !cardRequest || cardRequest.sold || salePendingHere || saleBlocked || owned <= 0 || !char.hasCardAlbum;
        const cardMarketHtml = cardRequest ? `
          <div class="prosperity-card-market${salePendingHere ? ' is-pending' : ''}" data-market-npc="${esc(cardRequest.npc)}" style="--card-rarity:${esc(cardRequest.rarezaColor || '#64748b')};">
            <span class="prosperity-card-market-label">Se busca</span>
            <div class="prosperity-card-market-image">
              ${cardRequest.imagen
                ? `<img src="${esc(cardRequest.imagen)}" alt="" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.classList.add('no-image');">`
                : '<span>🃏</span>'}
            </div>
            <span class="prosperity-card-market-price">${esc(cardRequest.price)}<small>bits</small></span>
            ${sellDisabled || STATIC_MODE
              ? `<span class="prosperity-card-market-status">${STATIC_MODE ? 'Solo lectura' : esc(sellLabel)}</span>`
              : `<button type="button" class="prosperity-card-market-sell" data-sell-npc="${esc(cardRequest.npc)}">${esc(sellLabel)}</button>`}
          </div>` : '';
        const newsHtml = hasNews ? `
          <div class="shellmon-news-list" id="shellmonNewsList">
            ${news.map((item) => `
              <div class="shellmon-news-item">
                <span class="shellmon-news-emoji">${esc(item.emoji || '📰')}</span>
                <span>${esc(item.text || '')}</span>
              </div>`).join('')}
          </div>` : '';
        const itemHtml = `
          <div class="prosperity-item${onExpedition ? ' on-expedition' : ''}${isShellmon ? ' shellmon' : ''}${cardRequest ? ' has-card-market' : ''}${hasNews && shellmonNewsCollapsed ? ' is-collapsed' : ''}"${shellmonAttrs}>
            <div class="prosperity-avatar">
              ${d.image
                ? `<img src="${esc(d.image)}" alt="${esc(d.name)}" onerror="this.onerror=null; this.style.display='none'; if(this.parentElement) this.parentElement.textContent='${esc(initial)}';">`
                : esc(initial)}
            </div>
            <div class="prosperity-body">
              <strong>${esc(d.name)}${onExpedition ? ' <span class="prosperity-expedition-note">(En expedición)</span>' : ''}</strong>
              <span>${esc(d.benefit || 'Digimon activo en la ciudad')}</span>
            </div>
            ${onExpedition ? `
              <div class="prosperity-expedition" title="Días de expedición restantes">
                <span class="prosperity-expedition-days">${daysLeft}</span>
                <span class="prosperity-expedition-label">día${daysLeft === 1 ? '' : 's'}</span>
              </div>` : ''}
            ${isShellmon && news.length ? `
              <div class="prosperity-news-counter" title="${news.length} anuncio${news.length === 1 ? '' : 's'} disponible${news.length === 1 ? '' : 's'}">
                <span class="prosperity-news-count">${news.length}</span>
                <span class="prosperity-news-label">anuncio${news.length === 1 ? '' : 's'}</span>
              </div>
              <span class="prosperity-chevron" aria-hidden="true">▾</span>` : ''}
            ${cardMarketHtml}
          </div>`;
        return hasNews
          ? `<div class="prosperity-shellmon-group">${itemHtml}${newsHtml}</div>`
          : itemHtml;
      }).join('');
    }

    const residentsBox = $('nativeResidentsList');
    if (residentsBox) {
      residentsBox.innerHTML = residents.map((r) => {
        const initial = (r.name || '?').charAt(0);
        const residentComforts = (Array.isArray(r.comfort) ? r.comfort : [])
          .map((key) => comfortByKey[key])
          .filter(Boolean);
        const comfortText = residentComforts.length
          ? residentComforts.map((c) => `+1 ${esc(c.label || '')}`).join(' · ')
          : '';
        return `
          <div class="prosperity-item resident${r.grayscale ? ' deceased' : ''}">
            <div class="prosperity-avatar">
              ${r.image
                ? `<img src="${esc(r.image)}" alt="${esc(r.name)}" onerror="this.onerror=null; this.style.display='none'; if(this.parentElement) this.parentElement.textContent='${esc(initial)}';">`
                : esc(initial)}
            </div>
            <div class="prosperity-body">
              <strong>${esc(r.name)}</strong>
              <span>${esc(r.desc || '')}</span>
              ${comfortText ? `<span class="prosperity-comfort">${comfortText}</span>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    applyNativeResidentsCollapse();
    applyShellmonNewsCollapse();
  }

  // ---------- Mercado diario de cartas ----------
  async function refreshPlayerView() {
    if (STATIC_MODE) return;
    const res = await fetch(`/api/player/${token}`, { cache: 'no-store' });
    const data = await res.json();
    if (data && data.ok) render(data);
  }

  async function sellCardToMarket(npc, btn) {
    if (STATIC_MODE) {
      alert('📄 Esta es una consulta de solo lectura. Las ventas se hacen desde la partida en LAN.');
      return;
    }
    if (!token) return;
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const res = await fetch(`/api/player/${token}/sell-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error((data && data.error) || 'No se pudo completar la venta.');
      await refreshPlayerView();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = oldText;
      alert(`⚠️ ${err.message}`);
    }
  }

  function setupCardMarket() {
    const list = $('prosperityList');
    if (!list || STATIC_MODE) return;
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sell-npc]');
      if (!btn || btn.disabled) return;
      e.stopPropagation();
      sellCardToMarket(btn.getAttribute('data-sell-npc'), btn);
    });
  }

  // ---------- Notas ----------
  function setNotesState(kind, text) {
    const el = $('notesState');
    if (!el) return;
    el.className = `save-state ${kind}`;
    el.textContent = text;
  }

  function updateNotesCounter() {
    const area = $('notesInput');
    $('notesCounter').textContent = `${area.value.length} caracteres`;
  }

  function scheduleNotesSave() {
    if (STATIC_MODE) return;
    notesDirty = true;
    setNotesState('saving', 'Sin guardar...');
    clearTimeout(notesTimer);
    notesTimer = setTimeout(saveNotes, 1100);
  }

  async function saveNotes(force = false) {
    if (STATIC_MODE || !token) return;
    if (notesSaving && !force) {
      notesTimer = setTimeout(saveNotes, 1200);
      return;
    }
    const area = $('notesInput');
    const notes = area.value;
    if (!force && !notesDirty) return;
    notesSaving = true;
    setNotesState('saving', 'Guardando...');
    try {
      const res = await fetch(`/api/player/${token}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo guardar');
      notesDirty = lastNotesFromServer !== notes;
      lastNotesFromServer = notes;
      setNotesState('saved', 'Guardado ✓');
    } catch (err) {
      setNotesState('error', 'Error al guardar. Reintentando...');
      notesTimer = setTimeout(saveNotes, 2500);
    } finally {
      notesSaving = false;
    }
  }

  function setupNotes() {
    const area = $('notesInput');
    if (STATIC_MODE) {
      area.readOnly = true;
      if ($('notesSaveBtn')) $('notesSaveBtn').hidden = true;
      setNotesState('saved', 'Solo lectura · instantánea');
      area.addEventListener('input', updateNotesCounter);
      return;
    }
    area.addEventListener('input', () => {
      updateNotesCounter();
      scheduleNotesSave();
    });
    area.addEventListener('blur', () => {
      if (notesDirty) saveNotes();
    });
    $('notesSaveBtn').addEventListener('click', () => saveNotes(true));
    window.addEventListener('beforeunload', () => {
      if (notesDirty && navigator.sendBeacon) {
        // sendBeacon no permite cabeceras personalizadas; usamos fetch keepalive.
        fetch(`/api/player/${token}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: area.value }),
          keepalive: true,
        }).catch(() => {});
      }
    });
  }

  // ---------- Carga / SSE ----------
  function showStaticBanner(data) {
    const banner = $('staticBanner');
    if (!banner) return;
    const when = data && data.exportedAt ? new Date(data.exportedAt) : null;
    const whenText = when && !Number.isNaN(when.getTime())
      ? when.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
      : 'fecha desconocida';
    const name = data && data.saveName ? data.saveName : 'Partida';
    const day = Math.max(0, Math.trunc(num(data && data.day)));
    $('staticBannerText').textContent = `${name} · Día ${day} · instantánea del ${whenText}`;
    const lanBtn = $('staticLanBtn');
    const lanBase = String((data && data.lanBaseUrl) || '').replace(/\/$/, '');
    if (lanBtn) {
      lanBtn.hidden = !(lanBase && token);
      lanBtn.onclick = () => {
        location.href = `${lanBase}/p/${encodeURIComponent(token)}`;
      };
    }
    banner.hidden = false;
  }

  async function loadOnce() {
    if (!token) {
      showError('Enlace incompleto', 'Falta el identificador del jugador en la direccion. Usa el enlace que te dio el Master.');
      return;
    }
    if (STATIC_MODE) {
      try {
        const res = await fetch(`data/${encodeURIComponent(token)}.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se encontró la instantánea de este jugador');
        const data = await res.json();
        showStaticBanner(data);
        render(data);
      } catch (err) {
        showError('Consulta no disponible', `${err.message || 'No se pudo leer la instantánea.'} Pide un enlace nuevo al Master.`);
      }
      return;
    }
    try {
      const res = await fetch(`/api/player/${token}`, { cache: 'no-store' });
      const data = await res.json();
      render(data);
      if (data.ok) connectStream();
    } catch (err) {
      if (!booted) {
        showError('Sin conexion', 'No se pudo conectar con el Master. Verifica que esten en la misma red Wi-Fi.');
      } else {
        setLive(false);
      }
      scheduleRetry();
    }
  }

  function connectStream() {
    if (STATIC_MODE) return;
    closeStream();
    eventSource = new EventSource(`/api/player/${token}/events`);
    eventSource.addEventListener('open', () => setLive(true));
    eventSource.addEventListener('state', (event) => {
      try {
        const data = JSON.parse(event.data);
        render(data);
      } catch (_) {}
    });
    eventSource.addEventListener('error', () => {
      setLive(false);
      // EventSource reconecta solo; ademas refrescamos por si acaso.
      if (Date.now() - lastStateAt > 6000) {
        fetch(`/api/player/${token}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => { if (d.ok) render(d); })
          .catch(() => {});
      }
    });
  }

  function startHeartbeat() {
    if (STATIC_MODE) return;
    const ping = () => {
      if (!token) return;
      fetch(`/api/player/${token}/ping`, { method: 'POST' }).catch(() => {});
    };
    ping();
    setInterval(ping, 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ping();
    });
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return `rgba(139, 92, 246, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ---------- Init ----------
  setupTabs();
  setupNotes();
  setupEvolutionModal();
  setupInventoryFilters();
  setupShellmonToggle();
  setupNativeResidentsToggle();
  setupImageLightbox();
  setupCardAlbumModal();
  setupCardMarket();
  startHeartbeat();
  loadOnce();
})();
