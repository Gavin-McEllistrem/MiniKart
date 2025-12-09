import * as THREE from 'three';
import { getTile, TileRegistry } from './TileRegistry.js';
import { CheckpointSystem } from './CheckpointSystem.js';
import { Checkpoint } from '../entities/Checkpoint.js';

/**
 * Track - Grid-based track system
 *
 * Manages track layout, rendering, and collision
 */

export class Track {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.tileSize = options.tileSize ?? 10; // Size of each grid tile (10x10 units)
    this.trackData = options.trackData ?? []; // 2D array of tile IDs
    this.checkpointsData = options.checkpointsData ?? []; // Array of checkpoint definitions
    this.decorationsData = options.decorationsData ?? []; // Array of decoration definitions
    this.renderMode = options.renderMode ?? 'prototype'; // 'prototype' | 'full'

    // Track metadata
    this.width = 0; // Number of tiles wide
    this.height = 0; // Number of tiles tall
    this.startPosition = new THREE.Vector3(0, 0.5, 0);
    this.startHeading = 0;

    // Visual meshes
    this.tileMeshes = [];
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.materialCache = new Map();

    // Checkpoint system
    this.checkpointSystem = null;

    if (this.trackData.length > 0) {
      this.buildTrack();
    }
  }

  /**
   * Load track from 2D array of tile IDs
   * @param {Array<Array<string>>} trackData - 2D array of tile IDs
   */
  loadTrack(trackData) {
    this.trackData = trackData;
    this.height = trackData.length;
    this.width = trackData[0]?.length ?? 0;
    this.buildTrack();
  }

  /**
   * Set render mode and rebuild materials
   */
  setRenderMode(mode) {
    if (mode !== 'prototype' && mode !== 'full') return;
    if (this.renderMode === mode) return;
    this.renderMode = mode;
    this.buildTrack();
  }

  /**
   * Build track geometry from track data
   */
  buildTrack() {
    // Clear existing track
    this.clearTrack();
    this.materialCache.clear();

    this.height = this.trackData.length;
    this.width = this.trackData[0]?.length ?? 0;

    // Build each tile
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const tileId = this.trackData[row][col];
        const tile = getTile(tileId);

        // Calculate world position (centered at origin)
        const x = (col - this.width / 2) * this.tileSize + this.tileSize / 2;
        const z = (row - this.height / 2) * this.tileSize + this.tileSize / 2;

        // Create tile mesh
        const mesh = this._createTileMesh(tile, x, z);
        if (mesh) {
          this.trackGroup.add(mesh);
          this.tileMeshes.push({
            mesh,
            tile,
            row,
            col,
            bounds: new THREE.Box3().setFromObject(mesh)
          });
        }

        // Find start position
        if (tileId === 'start_finish' && !this.startPosition.x) {
          this.startPosition.set(x, 0.5, z);
          this.startHeading = 0; // Default facing +Z
        }
      }
    }

    console.log(`Track built: ${this.width}x${this.height} tiles`);

    // Load checkpoints if provided
    if (this.checkpointsData && this.checkpointsData.length > 0) {
      this.loadCheckpoints();
    }
  }

  /**
   * Load checkpoints from checkpoint data
   */
  loadCheckpoints() {
    // Create checkpoint system
    this.checkpointSystem = new CheckpointSystem(this.scene);

    // Add each checkpoint from data
    for (const cpData of this.checkpointsData) {
      // Convert rotation object to y-axis rotation value
      const rotation = typeof cpData.rotation === 'object' ? cpData.rotation.y : cpData.rotation;

      // Create position Vector3
      const position = new THREE.Vector3(
        cpData.position.x,
        cpData.position.y,
        cpData.position.z
      );

      // Create checkpoint directly with all options
      const id = this.checkpointSystem.checkpoints.length;
      const checkpoint = new Checkpoint(this.scene, {
        id,
        position,
        rotation,
        width: cpData.width ?? 20,
        height: cpData.height ?? 10,
        isFinishLine: cpData.isFinishLine ?? false
      });

      this.checkpointSystem.checkpoints.push(checkpoint);

      console.log(`Checkpoint ${id} loaded: pos(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}), rot: ${(rotation * 180 / Math.PI).toFixed(1)}°, width: ${cpData.width ?? 20}`);
    }

    // Hide checkpoints by default (use H key to toggle)
    this.checkpointSystem.setCheckpointsVisible(false);

    console.log(`Loaded ${this.checkpointsData.length} checkpoints (hidden - press H to toggle)`);
  }

  /**
   * Create 3D mesh for a tile
   */
  _createTileMesh(tile, x, z) {
    const height = tile.height ?? 0.2;
    const geometry = new THREE.BoxGeometry(this.tileSize, height, this.tileSize);

    const material = this._getTileMaterial(tile);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, height / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = tile.type === 'obstacle';

    // Store tile data on mesh for collision detection
    mesh.userData.tile = tile;
    mesh.userData.tileId = tile.id;

    // Special visual effects
    if (tile.hasCheckeredPattern) {
      this._addCheckeredPattern(mesh);
    }

    if (tile.hasStripes) {
      this._addStripePattern(mesh);
    }

    return mesh;
  }

  /**
   * Create or reuse a material for a tile based on render mode
   */
  _getTileMaterial(tile) {
    const key = `${this.renderMode}-${tile.id}`;
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key);
    }

    let material;
    if (this.renderMode === 'prototype') {
      material = new THREE.MeshStandardMaterial({
        color: tile.color,
        roughness: tile.roughness,
        metalness: tile.metalness
      });
    } else {
      const texture = this._createTileTexture(tile);
      material = new THREE.MeshStandardMaterial({
        color: tile.color,
        roughness: tile.roughness,
        metalness: tile.metalness,
        map: texture
      });
    }

    this.materialCache.set(key, material);
    return material;
  }

  /**
   * Generate simple procedural textures for tiles
   */
  _createTileTexture(tile) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const fill = (color) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const addNoise = (alpha = 0.12) => {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        imgData.data[i] += v * alpha;
        imgData.data[i + 1] += v * alpha;
        imgData.data[i + 2] += v * alpha;
      }
      ctx.putImageData(imgData, 0, 0);
    };

    const addStripes = (colorA, colorB, width = 10) => {
      for (let x = -width; x < canvas.width + width; x += width * 2) {
        ctx.fillStyle = colorA;
        ctx.fillRect(x, 0, width, canvas.height);
        ctx.fillStyle = colorB;
        ctx.fillRect(x + width, 0, width, canvas.height);
      }
    };

    if (tile.type === 'road' || tile.id === 'start_finish') {
      fill('#1f1f24');
      addNoise(0.18);
      if (tile.id === 'start_finish') {
        addStripes('#ffffff', '#000000', 6);
      }
    } else if (tile.id === 'grass' || tile.type === 'offroad') {
      fill('#1f7a42');
      addNoise(0.35);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }
    } else if (tile.id === 'dirt') {
      fill('#6d4c32');
      addNoise(0.3);
      ctx.fillStyle = 'rgba(30,15,0,0.18)';
      for (let i = 0; i < 90; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tile.id === 'barrier') {
      addStripes('#ff3b3b', '#ffffff', 10);
    } else if (tile.id === 'wall') {
      fill('#cfd4da');
      addNoise(0.12);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let y = 0; y < canvas.height; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    } else {
      fill('#4a4a4a');
      addNoise(0.15);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  /**
   * Add checkered pattern to start/finish line
   */
  _addCheckeredPattern(mesh) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw checkered pattern
    const squareSize = 16;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#FFFFFF' : '#000000';
        ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
  }

  /**
   * Add stripe pattern to barriers
   */
  _addStripePattern(mesh) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw diagonal stripes
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#FFFFFF';
    for (let i = -128; i < 256; i += 32) {
      ctx.fillRect(i, 0, 16, 128);
    }

    const texture = new THREE.CanvasTexture(canvas);
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
  }

  /**
   * Clear all track meshes
   */
  clearTrack() {
    while (this.trackGroup.children.length > 0) {
      const child = this.trackGroup.children[0];
      this.trackGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
    this.tileMeshes = [];
  }

  /**
   * Get tile at world position
   * @param {THREE.Vector3} position - World position
   * @returns {Object|null} Tile data or null
   */
  getTileAtPosition(position) {
    // Convert world position to grid coordinates
    const { row, col } = this.worldToGrid(position) ?? { row: -1, col: -1 };

    // Check bounds
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      return null;
    }

    const tileId = this.trackData[row][col];
    return getTile(tileId);
  }

  /**
   * Check if position is on valid track surface
   * @param {THREE.Vector3} position - World position
   * @returns {boolean}
   */
  isOnTrack(position) {
    const tile = this.getTileAtPosition(position);
    return tile && tile.collision && tile.type === 'road';
  }

  /**
   * Check if position is out of bounds or hits wall
   * @param {THREE.Vector3} position - World position
   * @returns {boolean}
   */
  isOutOfBounds(position) {
    const tile = this.getTileAtPosition(position);
    return !tile || !tile.collision;
  }

  /**
   * Get speed multiplier at position (for off-road slowdown)
   * @param {THREE.Vector3} position - World position
   * @returns {number}
   */
  getSpeedMultiplier(position) {
    const tile = this.getTileAtPosition(position);
    return tile?.speedMultiplier ?? 1.0;
  }

  /**
   * Convert a world position to grid coordinates
   * @param {THREE.Vector3} position
   * @returns {{row: number, col: number}|null}
   */
  worldToGrid(position) {
    const col = Math.floor((position.x + (this.width * this.tileSize) / 2) / this.tileSize);
    const row = Math.floor((position.z + (this.height * this.tileSize) / 2) / this.tileSize);

    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      return null;
    }

    return { row, col };
  }

  /**
   * Convert grid coordinates to world center position
   * @param {number} row
   * @param {number} col
   * @returns {THREE.Vector3|null}
   */
  gridToWorld(row, col) {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return null;

    const x = (col - this.width / 2) * this.tileSize + this.tileSize / 2;
    const z = (row - this.height / 2) * this.tileSize + this.tileSize / 2;
    return new THREE.Vector3(x, 0.5, z);
  }

  /**
   * Get start position and heading for kart
   * @returns {Object} { position, heading }
   */
  getStartTransform() {
    return {
      position: this.startPosition.clone(),
      heading: this.startHeading
    };
  }

  /**
   * Destroy track and free resources
   */
  destroy() {
    this.clearTrack();
    this.scene.remove(this.trackGroup);

    // Destroy checkpoint system
    if (this.checkpointSystem) {
      this.checkpointSystem.destroy();
      this.checkpointSystem = null;
    }
  }
}
