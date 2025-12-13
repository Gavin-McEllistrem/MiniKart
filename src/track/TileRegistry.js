/**
 * TileRegistry - Defines all available track tile types
 *
 * Each tile has:
 * - id: unique identifier
 * - name: display name
 * - type: category (road, decoration, etc.)
 * - geometry: shape data
 * - material: visual properties
 * - collision: whether kart can drive on it
 * - texture: path to texture file (optional, for full mode)
 * - textureRepeat: texture repeat settings (optional)
 */

export const TileRegistry = {
  // Road tiles
  STRAIGHT: {
    id: 'straight',
    name: 'Straight Road',
    type: 'road',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    texture: 'assets/asphalt.jpg',
    textureRepeat: { x: 1, y: 1 }
  },

  CORNER: {
    id: 'corner',
    name: 'Corner',
    type: 'road',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    texture: null,
    textureRepeat: { x: 1, y: 1 }
  },

  START_FINISH: {
    id: 'start_finish',
    name: 'Start/Finish Line',
    type: 'road',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    hasCheckeredPattern: true,
    texture: null,
    textureRepeat: { x: 1, y: 1 }
  },

  // Off-road tiles
  GRASS: {
    id: 'grass',
    name: 'Grass',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.6,
    texture: 'assets/tiles/grass.png',
    textureRepeat: { x: 1, y: 1 }
  },

  DIRT: {
    id: 'dirt',
    name: 'Dirt',
    type: 'road',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt.png',
    textureRepeat: { x: 1, y: 1 }
  },

  // Grass transition tiles
  GRASS_TL: {
    id: 'grass_tl',
    name: 'Grass Top-Left',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.6,
    texture: 'assets/tiles/grass_tl.png',
    textureRepeat: { x: 1, y: 1 }
  },
  GRASS_TR: {
    id: 'grass_tr',
    name: 'Grass Top-Right',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.6,
    texture: 'assets/tiles/grass_tr.png',
    textureRepeat: { x: 1, y: 1 }
  },
  GRASS_BL: {
    id: 'grass_bl',
    name: 'Grass Bottom-Left',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.6,
    texture: 'assets/tiles/grass_bl.png',
    textureRepeat: { x: 1, y: 1 }
  },
  GRASS_BR: {
    id: 'grass_br',
    name: 'Grass Bottom-Right',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.6,
    texture: 'assets/tiles/grass_br.png',
    textureRepeat: { x: 1, y: 1 }
  },

  // Dirt transition tiles
  DIRT_TL: {
    id: 'dirt_tl',
    name: 'Dirt Top-Left',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_tl.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_TR: {
    id: 'dirt_tr',
    name: 'Dirt Top-Right',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_tr.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_BL: {
    id: 'dirt_bl',
    name: 'Dirt Bottom-Left',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_bl.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_BR: {
    id: 'dirt_br',
    name: 'Dirt Bottom-Right',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_br.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_L: {
    id: 'dirt_l',
    name: 'Dirt Left',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_l.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_R: {
    id: 'dirt_r',
    name: 'Dirt Right',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_r.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_T: {
    id: 'dirt_t',
    name: 'Dirt Top',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_t.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_B: {
    id: 'dirt_b',
    name: 'Dirt Bottom',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_b.png',
    textureRepeat: { x: 1, y: 1 }
  },
  DIRT_B_2: {
    id: 'dirt_b_2',
    name: 'Dirt Bottom (Variation 2)',
    type: 'offroad',
    collision: true,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    speedMultiplier: 0.7,
    texture: 'assets/tiles/dirt_b_2.png',
    textureRepeat: { x: 1, y: 1 }
  },

  // Obstacles
  WALL: {
    id: 'wall',
    name: 'Wall',
    type: 'obstacle',
    collision: false,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    height: 2.0,
    texture: 'assets/tiles/wall.png',
    textureRepeat: { x: 1, y: 1 }
  },

  BARRIER: {
    id: 'barrier',
    name: 'Barrier',
    type: 'obstacle',
    collision: false,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    height: 1.0,
    hasStripes: true,
    texture: null,
    textureRepeat: { x: 1, y: 1 }
  },

  // Empty
  EMPTY: {
    id: 'empty',
    name: 'Empty',
    type: 'empty',
    collision: false,
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.1,
    texture: null,
    textureRepeat: { x: 1, y: 1 }
  }
};

export function getTile(id) {
  for (const key in TileRegistry) {
    if (TileRegistry[key].id === id) {
      return TileRegistry[key];
    }
  }
  return TileRegistry.EMPTY;
}

export function getTilesByType(type) {
  const tiles = [];
  for (const key in TileRegistry) {
    if (TileRegistry[key].type === type) {
      tiles.push(TileRegistry[key]);
    }
  }
  return tiles;
}
