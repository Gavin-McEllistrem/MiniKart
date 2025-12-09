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
 */

export const TileRegistry = {
  // Road tiles
  STRAIGHT: {
    id: 'straight',
    name: 'Straight Road',
    type: 'road',
    collision: true,
    color: 0x444444, // Dark gray asphalt
    roughness: 0.9,
    metalness: 0.1
  },

  CORNER: {
    id: 'corner',
    name: 'Corner',
    type: 'road',
    collision: true,
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.1
  },

  START_FINISH: {
    id: 'start_finish',
    name: 'Start/Finish Line',
    type: 'road',
    collision: true,
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.1,
    hasCheckeredPattern: true
  },

  // Off-road tiles
  GRASS: {
    id: 'grass',
    name: 'Grass',
    type: 'offroad',
    collision: true,
    color: 0x228B22, // Forest green
    roughness: 0.95,
    metalness: 0.0,
    speedMultiplier: 0.6 // Slow down on grass
  },

  DIRT: {
    id: 'dirt',
    name: 'Dirt',
    type: 'offroad',
    collision: true,
    color: 0x8B7355, // Brown
    roughness: 0.95,
    metalness: 0.0,
    speedMultiplier: 0.7
  },

  // Obstacles
  WALL: {
    id: 'wall',
    name: 'Wall',
    type: 'obstacle',
    collision: false, // Can't drive through
    color: 0xCCCCCC, // Light gray
    roughness: 0.7,
    metalness: 0.3,
    height: 2.0
  },

  BARRIER: {
    id: 'barrier',
    name: 'Barrier',
    type: 'obstacle',
    collision: false,
    color: 0xFF4444, // Red and white
    roughness: 0.6,
    metalness: 0.4,
    height: 1.0,
    hasStripes: true
  },

  // Empty
  EMPTY: {
    id: 'empty',
    name: 'Empty',
    type: 'empty',
    collision: false,
    color: 0x333333, // Dark void
    roughness: 1.0,
    metalness: 0.0
  }
};

/**
 * Get tile definition by id
 */
export function getTile(id) {
  for (const key in TileRegistry) {
    if (TileRegistry[key].id === id) {
      return TileRegistry[key];
    }
  }
  return TileRegistry.EMPTY;
}

/**
 * Get all tiles of a specific type
 */
export function getTilesByType(type) {
  const tiles = [];
  for (const key in TileRegistry) {
    if (TileRegistry[key].type === type) {
      tiles.push(TileRegistry[key]);
    }
  }
  return tiles;
}
