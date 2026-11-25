// ==========================================
// TEMA UNIFICADO DE FASES DIGIMON (GM + MÓVIL)
// ==========================================
// Paleta única para mostrar la fase de cualquier Digimon en todas las vistas.
// Se carga antes que el resto de scripts para que todos puedan usarla.
(function (global) {
  'use strict';

  var UNIFIED_PHASE_THEMES = {
    'training-1': {
      key: 'training-1', label: 'Entrenamiento I',
      color: '#fde047', strong: '#eab308',
      bg: 'rgba(254, 240, 138, 0.18)', border: 'rgba(253, 224, 71, 0.6)',
      glow: 'rgba(253, 224, 71, 0.45)'
    },
    'training-2': {
      key: 'training-2', label: 'Entrenamiento II',
      color: '#facc15', strong: '#eab308',
      bg: 'rgba(234, 179, 8, 0.20)', border: 'rgba(250, 204, 21, 0.62)',
      glow: 'rgba(250, 204, 21, 0.5)'
    },
    'rookie': {
      key: 'rookie', label: 'Novato',
      color: '#4ade80', strong: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.20)', border: 'rgba(74, 222, 128, 0.58)',
      glow: 'rgba(74, 222, 128, 0.45)'
    },
    'champion': {
      key: 'champion', label: 'Campeón',
      color: '#60a5fa', strong: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.20)', border: 'rgba(96, 165, 250, 0.58)',
      glow: 'rgba(96, 165, 250, 0.45)'
    },
    'final': {
      key: 'final', label: 'Final',
      color: '#c084fc', strong: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.20)', border: 'rgba(192, 132, 252, 0.58)',
      glow: 'rgba(192, 132, 252, 0.45)'
    },
    'mega': {
      key: 'mega', label: 'Mega',
      color: '#f87171', strong: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.20)', border: 'rgba(248, 113, 113, 0.58)',
      glow: 'rgba(248, 113, 113, 0.45)'
    },
    'default': {
      key: 'default', label: 'Fase desconocida',
      color: '#cbd5e1', strong: '#64748b',
      bg: 'rgba(148, 163, 184, 0.16)', border: 'rgba(148, 163, 184, 0.5)',
      glow: 'rgba(148, 163, 184, 0.35)'
    }
  };

  // Normaliza las distintas formas en que la DB nombra las fases.
  function getUnifiedPhaseKey(fase) {
    var text = String(fase == null ? '' : fase).trim().toLowerCase();
    if (!text) return 'default';

    if (/entrenamiento|training|beb[eé]|baby|fresca/.test(text)) {
      return /(?:\bii\b|\b2\b|ii|2)/.test(text) ? 'training-2' : 'training-1';
    }
    if (/novato|rookie|child|principiante/.test(text)) return 'rookie';
    if (/campe|champion|adult/.test(text)) return 'champion';
    if (/final|perfecto|perfect|ultra/.test(text)) return 'final';
    if (/mega|ultimate/.test(text)) return 'mega';
    return 'default';
  }

  function getUnifiedPhaseTheme(fase) {
    return UNIFIED_PHASE_THEMES[getUnifiedPhaseKey(fase)];
  }

  function getUnifiedPhaseClass(fase) {
    return 'phase--' + getUnifiedPhaseKey(fase);
  }

  // Orden canónico de fases. Se usa también para detectar regresiones
  // (por ejemplo Campeón → Novato) en la animación del jugador.
  var UNIFIED_PHASE_ORDER = ['training-1', 'training-2', 'rookie', 'champion', 'final', 'mega'];

  function getUnifiedPhaseRank(fase) {
    var index = UNIFIED_PHASE_ORDER.indexOf(getUnifiedPhaseKey(fase));
    return index >= 0 ? index : -1;
  }

  // Estilo en línea para los contenedores que no pueden usar variables CSS.
  function getUnifiedPhaseStyle(fase) {
    var theme = getUnifiedPhaseTheme(fase);
    return 'color:' + theme.color + ';background-color:' + theme.bg +
      ';border-color:' + theme.border + ';';
  }

  function phaseColorSpan(fase, text, extraClass, tag) {
    var el = tag || 'span';
    var cls = ['phase-color', getUnifiedPhaseClass(fase), extraClass || '']
      .filter(Boolean).join(' ');
    var content = (text == null || text === '') ? (String(fase || '') || '') : String(text);
    return '<' + el + ' class="' + cls + '">' + content + '</' + el + '>';
  }

  function phaseColorBadge(fase, text, extraClass) {
    return phaseColorSpan(fase, text, ['phase-badge', extraClass || ''].filter(Boolean).join(' '), 'span');
  }

  // ----------------------------------------------------------------------
  // VALORES BASE POR FASE
  // ----------------------------------------------------------------------
  // Los valores son los mayoritarios de digimonDB para cada fase. Se usan
  // cuando una entrada no existe o no tiene datos válidos, para que las ramas
  // evolutivas y los enemigos nunca caigan a 0/0/0/0 ni a fases vacías.
  var PHASE_LABELS = {
    'training-1': 'Entrenamiento I',
    'training-2': 'Entrenamiento II',
    'rookie': 'Novato',
    'champion': 'Campeón',
    'final': 'Final',
    'mega': 'Mega'
  };

  var PHASE_STAT_DEFAULTS = {
    'training-1': { salud: 50, inteligencia: 10, fuerza: 15, defensa: 10, velocidad: 15, allowedAttacks: [] },
    'training-2': { salud: 60, inteligencia: 15, fuerza: 20, defensa: 15, velocidad: 20, allowedAttacks: [] },
    'rookie': {
      salud: 85, inteligencia: 20, fuerza: 25, defensa: 20, velocidad: 25,
      allowedAttacks: ['Fuego_0', 'Agua_0', 'Aire_0', 'Tierra_0', 'Lucha_0']
    },
    'champion': {
      salud: 125, inteligencia: 30, fuerza: 40, defensa: 35, velocidad: 35,
      allowedAttacks: ['Fuego_1', 'Agua_1', 'Aire_1', 'Tierra_1', 'Lucha_1']
    },
    'final': {
      salud: 160, inteligencia: 45, fuerza: 60, defensa: 50, velocidad: 50,
      allowedAttacks: ['Fuego_3', 'Agua_3', 'Aire_3', 'Tierra_3', 'Lucha_3']
    },
    'mega': {
      salud: 220, inteligencia: 85, fuerza: 90, defensa: 85, velocidad: 85,
      allowedAttacks: ['Fuego_3', 'Agua_3', 'Aire_3', 'Tierra_3', 'Maquina_3']
    }
  };

  // Nombres citados por los árboles evolutivos (o por cartas extra) que no
  // tienen entrada en digimonDB. Todos ellos son Novato por su posición en el
  // árbol (padres de Entrenamiento II e hijos de Campeón), salvo Rey Sukamon.
  var DIGIMON_DEFAULT_OVERRIDES = {
    'Agumon (Black)': { fase: 'Novato', tipo: 'Virus' },
    'Algomon (Child)': { fase: 'Novato', tipo: 'Virus' },
    'Arkadimon Child': { fase: 'Novato', tipo: 'Virus' },
    'Black Guilmon': { fase: 'Novato', tipo: 'Virus' },
    'Bushi Agumon': { fase: 'Novato', tipo: 'Vacuna' },
    'Cardmon C1': { fase: 'Novato', tipo: 'Datos' },
    'Cardmon C2': { fase: 'Novato', tipo: 'Datos' },
    'Dracumon': { fase: 'Novato', tipo: 'Virus' },
    'Ebi Burgamon': { fase: 'Novato', tipo: 'Datos' },
    'Elecmon (Violet)': { fase: 'Novato', tipo: 'Datos' },
    'Falcomon (2006 Anime Version)': { fase: 'Novato', tipo: 'Vacuna' },
    'Funbeemon': { fase: 'Novato', tipo: 'Datos' },
    'Gabumon (Black)': { fase: 'Novato', tipo: 'Virus' },
    'Loogamon': { fase: 'Novato', tipo: 'Virus' },
    "Meicoomon's Unnamed Child Form": { fase: 'Novato', tipo: 'Datos' },
    'Nise Agumon Hakase': { fase: 'Novato', tipo: 'Vacuna' },
    'Otamamon (Red)': { fase: 'Novato', tipo: 'Virus' },
    'Pawn Chessmon (Black)': { fase: 'Novato', tipo: 'Virus' },
    'Pawn Chessmon (White)': { fase: 'Novato', tipo: 'Virus' },
    'Petit Mamon': { fase: 'Novato', tipo: 'Virus' },
    'Proto Gizmon': { fase: 'Novato', tipo: 'Datos' },
    'Rey Sukamon': { fase: 'Mega', tipo: 'Virus' },
    'Ryudamon': { fase: 'Novato', tipo: 'Datos' },
    'Shoutmon (Blue)': { fase: 'Novato', tipo: 'Datos' },
    'Shoutmon (Star Sword)': { fase: 'Novato', tipo: 'Datos' },
    'Shoutmon B': { fase: 'Novato', tipo: 'Datos' },
    'Sistermon Blanc': { fase: 'Novato', tipo: 'Vacuna' },
    'Toy Agumon (Black)': { fase: 'Novato', tipo: 'Virus' }
  };

  function getPhaseDefaults(fase) {
    var key = getUnifiedPhaseKey(fase);
    var stats = PHASE_STAT_DEFAULTS[key] || PHASE_STAT_DEFAULTS.rookie;
    return {
      fase: PHASE_LABELS[key] || 'Novato',
      tipo: 'Datos',
      salud: stats.salud,
      espiritu: 0,
      inteligencia: stats.inteligencia,
      fuerza: stats.fuerza,
      defensa: stats.defensa,
      velocidad: stats.velocidad,
      allowedAttacks: (stats.allowedAttacks || []).slice()
    };
  }

  // Devuelve una entrada completa para un Digimon ausente o incompleto.
  function getDigimonDefaults(nombre) {
    var override = DIGIMON_DEFAULT_OVERRIDES[String(nombre == null ? '' : nombre)] || {};
    var base = getPhaseDefaults(override.fase);
    return {
      fase: override.fase || base.fase,
      tipo: override.tipo || base.tipo,
      salud: base.salud,
      espiritu: 0,
      inteligencia: base.inteligencia,
      fuerza: base.fuerza,
      defensa: base.defensa,
      velocidad: base.velocidad,
      allowedAttacks: base.allowedAttacks.slice()
    };
  }

  // Rellena la base en memoria sin tocar el archivo fuente. Se añaden también
  // los nombres referenciados por los árboles evolutivos para que cualquier
  // consulta (enemigos, ramas, cartas) tenga una base coherente con su fase.
  function normalizeDigimonDB(db, trees) {
    if (!db || typeof db !== 'object') return db;
    var statKeys = ['salud', 'inteligencia', 'fuerza', 'defensa', 'velocidad'];

    Object.keys(db).forEach(function (name) {
      var info = db[name];
      var defaults = getDigimonDefaults(name);
      if (!info || typeof info !== 'object') {
        db[name] = defaults;
        return;
      }
      if (!String(info.fase || '').trim()) info.fase = defaults.fase;
      if (!String(info.tipo || '').trim()) info.tipo = defaults.tipo;
      statKeys.forEach(function (key) {
        var value = Number(info[key]);
        if (!Number.isFinite(value) || value <= 0) info[key] = defaults[key];
      });
      if (!Number.isFinite(Number(info.espiritu))) info.espiritu = 0;
      if (!Array.isArray(info.allowedAttacks)) info.allowedAttacks = defaults.allowedAttacks.slice();
    });

    if (trees && typeof trees === 'object') {
      Object.keys(trees).forEach(function (source) {
        if (source && !db[source]) db[source] = getDigimonDefaults(source);
        (Array.isArray(trees[source]) ? trees[source] : []).forEach(function (target) {
          if (target && !db[target]) db[target] = getDigimonDefaults(target);
        });
      });
    }
    // Nombres de cartas u otros catálogos que no aparecen en los árboles.
    Object.keys(DIGIMON_DEFAULT_OVERRIDES).forEach(function (name) {
      if (!db[name]) db[name] = getDigimonDefaults(name);
    });
    return db;
  }

  global.PHASE_STAT_DEFAULTS = PHASE_STAT_DEFAULTS;
  global.DIGIMON_DEFAULT_OVERRIDES = DIGIMON_DEFAULT_OVERRIDES;
  global.UNIFIED_PHASE_THEMES = UNIFIED_PHASE_THEMES;
  global.UNIFIED_PHASE_ORDER = UNIFIED_PHASE_ORDER;
  global.getUnifiedPhaseKey = getUnifiedPhaseKey;
  global.getUnifiedPhaseRank = getUnifiedPhaseRank;
  global.getUnifiedPhaseTheme = getUnifiedPhaseTheme;
  global.getUnifiedPhaseClass = getUnifiedPhaseClass;
  global.getUnifiedPhaseStyle = getUnifiedPhaseStyle;
  global.getPhaseDefaults = getPhaseDefaults;
  global.getDigimonDefaults = getDigimonDefaults;
  global.normalizeDigimonDB = normalizeDigimonDB;
  global.phaseColorSpan = phaseColorSpan;
  global.phaseColorBadge = phaseColorBadge;
})(typeof window !== 'undefined' ? window : globalThis);
