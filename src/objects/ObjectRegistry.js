/**
 * ObjectRegistry - Defines all available 3D decorative objects
 *
 * Each object type has:
 * - id: unique identifier
 * - name: display name
 * - category: grouping (nature, signs, structures, etc.)
 * - model: path to 3D model file (GLTF/GLB) or 'primitive' for basic shapes
 * - texture: path to texture file (optional, for primitive mode texturing)
 * - prototypeGeometry: THREE geometry type for prototype mode
 * - prototypeColor: color for prototype mode
 * - defaultScale: default scale {x, y, z}
 * - collisionRadius: radius for collision detection (optional)
 *
 * In full render mode:
 * - If model path exists and file is found, GLTF model will be loaded
 * - If model is 'primitive' or file fails to load, falls back to prototype geometry
 *
 * In prototype mode:
 * - Always uses prototypeGeometry with prototypeColor
 */

export const ObjectRegistry = {
  TREE_PINE: {
    id: 'tree_pine',
    name: 'Pine Tree',
    category: 'nature',
    model: null,
    texture: null,
    prototypeGeometry: 'cone',
    prototypeColor: 0x228B22,
    defaultScale: { x: 2, y: 4, z: 2 },
    collisionRadius: 1.5
  },

  TREE_OAK: {
    id: 'tree_oak',
    name: 'Oak Tree',
    category: 'nature',
    model: null,
    texture: null,
    prototypeGeometry: 'sphere',
    prototypeColor: 0x2D5016,
    defaultScale: { x: 3, y: 4, z: 3 },
    collisionRadius: 2
  },

  BUSH: {
    id: 'bush',
    name: 'Bush',
    category: 'nature',
    model: null,
    texture: null,
    prototypeGeometry: 'sphere',
    prototypeColor: 0x3CB371,
    defaultScale: { x: 1.5, y: 1, z: 1.5 },
    collisionRadius: 0.75
  },

  ROCK: {
    id: 'rock',
    name: 'Rock',
    category: 'nature',
    model: null,
    texture: null,
    prototypeGeometry: 'dodecahedron',
    prototypeColor: 0x808080,
    defaultScale: { x: 1, y: 0.8, z: 1 },
    collisionRadius: 0.8
  },

  SIGN_ARROW_LEFT: {
    id: 'sign_arrow_left',
    name: 'Arrow Sign (Left)',
    category: 'signs',
    model: null,
    texture: null,
    prototypeGeometry: 'box',
    prototypeColor: 0xFFFF00,
    defaultScale: { x: 0.3, y: 2, z: 1.5 },
    collisionRadius: 0.5
  },

  SIGN_ARROW_RIGHT: {
    id: 'sign_arrow_right',
    name: 'Arrow Sign (Right)',
    category: 'signs',
    model: null,
    texture: null,
    prototypeGeometry: 'box',
    prototypeColor: 0xFFFF00,
    defaultScale: { x: 0.3, y: 2, z: 1.5 },
    collisionRadius: 0.5
  },

  SIGN_WARNING: {
    id: 'sign_warning',
    name: 'Warning Sign',
    category: 'signs',
    model: null,
    texture: null,
    prototypeGeometry: 'box',
    prototypeColor: 0xFF6600,
    defaultScale: { x: 0.3, y: 2, z: 1.5 },
    collisionRadius: 0.5
  },

  FENCE_POST: {
    id: 'fence_post',
    name: 'Fence Post',
    category: 'structures',
    model: null,
    texture: null,
    prototypeGeometry: 'box',
    prototypeColor: 0x8B4513,
    defaultScale: { x: 0.2, y: 1.5, z: 0.2 },
    collisionRadius: 0.3
  },

  CONE_TRAFFIC: {
    id: 'cone_traffic',
    name: 'Traffic Cone',
    category: 'structures',
    model: null,
    texture: null,
    prototypeGeometry: 'cone',
    prototypeColor: 0xFF4500,
    defaultScale: { x: 0.5, y: 1, z: 0.5 },
    collisionRadius: 0.4
  },

  BARREL: {
    id: 'barrel',
    name: 'Barrel',
    category: 'structures',
    model: null,
    texture: null,
    prototypeGeometry: 'cylinder',
    prototypeColor: 0x8B0000,
    defaultScale: { x: 0.6, y: 1.2, z: 0.6 },
    collisionRadius: 0.5
  },

  LAMP_POST: {
    id: 'lamp_post',
    name: 'Lamp Post',
    category: 'props',
    model: null,
    texture: null,
    prototypeGeometry: 'cylinder',
    prototypeColor: 0x404040,
    defaultScale: { x: 0.3, y: 4, z: 0.3 },
    collisionRadius: 0.4
  },

  BANNER: {
    id: 'banner',
    name: 'Banner',
    category: 'props',
    model: null,
    texture: null,
    prototypeGeometry: 'box',
    prototypeColor: 0xFF1493,
    defaultScale: { x: 3, y: 1.5, z: 0.1 },
    collisionRadius: 0.2
  }
};

export function getObject(id) {
  const key = id.toUpperCase().replace(/[_-]/g, '_');
  return ObjectRegistry[key] || null;
}

export function getObjectsByCategory(category) {
  return Object.values(ObjectRegistry).filter(obj => obj.category === category);
}

export function getCategories() {
  const categories = new Set();
  Object.values(ObjectRegistry).forEach(obj => categories.add(obj.category));
  return Array.from(categories);
}
