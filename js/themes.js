/* ============================================================
   DAMAS 3D — Temas de Tabuleiro e Peças
   ============================================================ */

export const BOARD_THEMES = [
  { 
    nome: 'PADRÃO CLÁSSICO', 
    light: 0xE8D5B0, dark: 0x7B4A2D, frame: 0x3A2418, 
    bg: 0x14110D, table: 0x221710,
    fogColor: 0x14110D, fogNear: 16, fogFar: 42,
    weather: 'none'
  },
  { 
    nome: 'TAVERNA MEDIEVAL', 
    light: 0xE8D5B0, dark: 0x7B4A2D, frame: 0x3A2418, 
    bg: 0x14110D, table: 0x221710,
    fogColor: 0x14110D, fogNear: 16, fogFar: 42,
    weather: 'dust'
  },
  { 
    nome: 'JARDIM ZEN', 
    light: 0xF0EEE8, dark: 0x5C6470, frame: 0x2A2E36, 
    bg: 0x3A2830, table: 0x4A3840,
    fogColor: 0x3A2830, fogNear: 14, fogFar: 36,
    weather: 'sakura'
  },
  { 
    nome: 'METRÓPOLE CYBER', 
    light: 0x8A93A8, dark: 0x232A3A, frame: 0x10141F, 
    bg: 0x050A1A, table: 0x1A284A, 
    fogColor: 0x050A1A, fogNear: 12, fogFar: 30,
    weather: 'rain'
  },
  { 
    nome: 'FOSSO VULCÂNICO', 
    light: 0xDCD6CC, dark: 0x6E1F24, frame: 0x270A0D, 
    bg: 0x1A0808, table: 0x2A1212, 
    fogColor: 0x1A0808, fogNear: 10, fogFar: 32,
    weather: 'embers'
  }
];

export const PIECE_THEMES = [
  { nome: 'PADRÃO CLÁSSICO', p1: 0xF5EFE0, p2: 0x23201C, n1: 'CLARAS', n2: 'ESCURAS', shape: 'standard', mat: 'phong' },
  { nome: 'MADEIRA IMPERIAL', p1: 0xF5EFE0, p2: 0x23201C, n1: 'CLARAS', n2: 'ESCURAS', shape: 'standard', mat: 'phong' },
  { nome: 'CRISTAL ENCANTADO', p1: 0xD4E4ED, p2: 0x101318, n1: 'GELO', n2: 'QUARTZO', shape: 'crystal', mat: 'physical' },
  { nome: 'ESCUDOS ESPARTANOS', p1: 0xB87333, p2: 0xA8B0B8, n1: 'BRONZE', n2: 'PRATA', shape: 'spartan', mat: 'metal' },
  { nome: 'FICHAS CASSINO', p1: 0xB3282D, p2: 0x1E1C1A, n1: 'RUBI', n2: 'ÔNIX', shape: 'poker', mat: 'phong' }
];
