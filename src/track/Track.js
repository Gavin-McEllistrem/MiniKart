import * as THREE from 'three';
import { getTile, TileRegistry } from './TileRegistry.js';

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

    // Track metadata
    this.width = 0; // Number of tiles wide
    this.height = 0; // Number of tiles tall
    this.startPosition = new THREE.Vector3(0, 0.5, 0);
    this.startHeading = 0;

    // Visual meshes
    this.tileMeshes = [];
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

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
   * Build track geometry from track data
   */
  buildTrack() {
    // Clear existing track
    this.clearTrack();

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
  }

  /**
   * Create 3D mesh for a tile
   */
  _createTileMesh(tile, x, z) {
    const height = tile.height ?? 0.2;
    const geometry = new THREE.BoxGeometry(this.tileSize, height, this.tileSize);

    const material = new THREE.MeshStandardMaterial({
      color: tile.color,
      roughness: tile.roughness,
      metalness: tile.metalness
    });

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
    const col = Math.floor((position.x + this.width * this.tileSize / 2) / this.tileSize);
    const row = Math.floor((position.z + this.height * this.tileSize / 2) / this.tileSize);

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
  }
}
