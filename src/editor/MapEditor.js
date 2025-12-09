import * as THREE from 'three';
import { TileRegistry, getTile } from '../track/TileRegistry.js';
import { Track } from '../track/Track.js';
import { eventBus } from '../utils/EventBus.js';

/**
 * MapEditor - Visual track editor
 *
 * Features:
 * - Grid-based tile placement
 * - Raycasting for mouse picking
 * - Undo/redo system
 * - Save/load tracks
 * - Test mode
 */

export class MapEditor {
  constructor(scene, camera, renderer, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Grid settings
    this.gridWidth = options.gridWidth ?? 30;
    this.gridHeight = options.gridHeight ?? 30;
    this.tileSize = options.tileSize ?? 10;

    // Editor state
    this.selectedTileType = 'straight';
    this.currentRotation = 0; // 0, 90, 180, 270
    this.isPlacing = false;
    this.isPainting = false; // Track if mouse is held down
    this.lastPaintedCell = { x: -1, z: -1 }; // Prevent painting same cell repeatedly
    this.trackName = 'My Track';

    // Grid data (2D array)
    this.grid = [];
    this.initGrid();

    // Undo/redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoStack = 50;

    // Visual elements
    this.gridHelper = null;
    this.track = null;
    this.highlightMesh = null;
    this.currentGridCell = { x: -1, z: -1 };

    // Raycaster for mouse picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Bind events
    this.setupRaycasting();
    this.setupGridVisuals();
  }

  /**
   * Initialize empty grid
   */
  initGrid() {
    this.grid = [];
    for (let row = 0; row < this.gridHeight; row++) {
      const rowData = [];
      for (let col = 0; col < this.gridWidth; col++) {
        rowData.push('grass'); // Default to grass
      }
      this.grid.push(rowData);
    }
  }

  /**
   * Setup grid visual helper
   */
  setupGridVisuals() {
    // Grid helper
    const size = Math.max(this.gridWidth, this.gridHeight) * this.tileSize;
    this.gridHelper = new THREE.GridHelper(size, Math.max(this.gridWidth, this.gridHeight), 0x888888, 0x444444);
    this.gridHelper.position.y = 0.1; // Slightly above ground
    this.scene.add(this.gridHelper);

    // Highlight mesh for current tile
    const highlightGeom = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.highlightMesh = new THREE.Mesh(highlightGeom, highlightMat);
    this.highlightMesh.rotation.x = -Math.PI / 2;
    this.highlightMesh.position.y = 0.2;
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Render initial grid
    this.renderGrid();
  }

  /**
   * Setup raycasting for mouse picking
   */
  setupRaycasting() {
    const domElement = this.renderer.domElement;

    domElement.addEventListener('mousemove', (e) => {
      this.onMouseMove(e);
    });

    domElement.addEventListener('mousedown', (e) => {
      this.onMouseDown(e);
    });

    domElement.addEventListener('mouseup', (e) => {
      this.onMouseUp(e);
    });

    domElement.addEventListener('mouseleave', () => {
      this.isPainting = false;
      this.lastPaintedCell = { x: -1, z: -1 };
    });
  }

  /**
   * Handle mouse move for grid highlighting and painting
   */
  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to ground plane
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Create invisible ground plane for raycasting
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      // Convert to grid coordinates
      const gridX = Math.floor((intersection.x + (this.gridWidth * this.tileSize) / 2) / this.tileSize);
      const gridZ = Math.floor((intersection.z + (this.gridHeight * this.tileSize) / 2) / this.tileSize);

      if (gridX >= 0 && gridX < this.gridWidth && gridZ >= 0 && gridZ < this.gridHeight) {
        this.currentGridCell = { x: gridX, z: gridZ };

        // Update highlight position
        const worldX = (gridX - this.gridWidth / 2) * this.tileSize + this.tileSize / 2;
        const worldZ = (gridZ - this.gridHeight / 2) * this.tileSize + this.tileSize / 2;

        this.highlightMesh.position.x = worldX;
        this.highlightMesh.position.z = worldZ;
        this.highlightMesh.visible = true;

        // Paint if mouse is held down and moved to new cell
        if (this.isPainting && (gridX !== this.lastPaintedCell.x || gridZ !== this.lastPaintedCell.z)) {
          this.placeTile(gridX, gridZ, this.selectedTileType, true); // true = skip undo push per tile
          this.lastPaintedCell = { x: gridX, z: gridZ };
        }

        // Emit event for UI update
        eventBus.emit('editor-grid-hover', {
          gridX,
          gridZ,
          worldX,
          worldZ
        });
      } else {
        this.highlightMesh.visible = false;
        this.currentGridCell = { x: -1, z: -1 };
      }
    } else {
      this.highlightMesh.visible = false;
    }
  }

  /**
   * Handle mouse down - start painting
   */
  onMouseDown(event) {
    // Only left click (button 0)
    if (event.button !== 0) return;

    const { x: gridX, z: gridZ } = this.currentGridCell;

    if (gridX >= 0 && gridZ >= 0) {
      this.isPainting = true;
      this.lastPaintedCell = { x: gridX, z: gridZ };

      // Push undo state at start of paint stroke
      this.pushUndo();

      this.placeTile(gridX, gridZ, this.selectedTileType, true);
    }
  }

  /**
   * Handle mouse up - stop painting
   */
  onMouseUp(event) {
    if (event.button !== 0) return;

    if (this.isPainting) {
      this.isPainting = false;
      this.lastPaintedCell = { x: -1, z: -1 };
    }
  }

  /**
   * Place a tile at grid position
   */
  placeTile(gridX, gridZ, tileType, skipUndoPush = false) {
    // Save current state for undo (unless we're in a paint stroke)
    if (!skipUndoPush) {
      this.pushUndo();
    }

    // Update grid
    this.grid[gridZ][gridX] = tileType;

    // Re-render grid
    this.renderGrid();

    eventBus.emit('editor-tile-placed', { gridX, gridZ, tileType });
  }

  /**
   * Remove tile at grid position
   */
  removeTile(gridX, gridZ) {
    this.placeTile(gridX, gridZ, 'grass'); // Reset to grass
  }

  /**
   * Render entire grid from data
   */
  renderGrid() {
    // Remove old track
    if (this.track) {
      this.track.destroy();
    }

    // Create new track from grid
    this.track = new Track(this.scene, {
      tileSize: this.tileSize,
      trackData: this.grid
    });
  }

  /**
   * Set selected tile type
   */
  setSelectedTile(tileType) {
    this.selectedTileType = tileType;
    eventBus.emit('editor-tile-selected', { tileType });
  }

  /**
   * Rotate current tile selection
   */
  rotateTile() {
    this.currentRotation = (this.currentRotation + 90) % 360;
    eventBus.emit('editor-rotation-changed', { rotation: this.currentRotation });
  }

  /**
   * Clear entire grid
   */
  clearGrid() {
    if (confirm('Clear entire track? This cannot be undone.')) {
      this.pushUndo();
      this.initGrid();
      this.renderGrid();
      eventBus.emit('editor-grid-cleared');
    }
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) return;

    // Push current state to redo
    this.redoStack.push(this.cloneGrid());

    // Restore previous state
    this.grid = this.undoStack.pop();
    this.renderGrid();

    eventBus.emit('editor-undo');
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return;

    // Push current state to undo
    this.pushUndo();

    // Restore redo state
    this.grid = this.redoStack.pop();
    this.renderGrid();

    eventBus.emit('editor-redo');
  }

  /**
   * Push current grid state to undo stack
   */
  pushUndo() {
    this.undoStack.push(this.cloneGrid());

    // Limit stack size
    if (this.undoStack.length > this.maxUndoStack) {
      this.undoStack.shift();
    }

    // Clear redo stack
    this.redoStack = [];
  }

  /**
   * Clone current grid state
   */
  cloneGrid() {
    return this.grid.map(row => [...row]);
  }

  /**
   * Serialize track to JSON
   */
  serializeTrack() {
    return {
      name: this.trackName,
      width: this.gridWidth,
      height: this.gridHeight,
      layout: this.cloneGrid()
    };
  }

  /**
   * Load track from JSON
   */
  loadTrack(trackData) {
    this.trackName = trackData.name;
    this.gridWidth = trackData.width;
    this.gridHeight = trackData.height;
    this.grid = trackData.layout.map(row => [...row]);

    this.renderGrid();
    eventBus.emit('editor-track-loaded', { trackName: this.trackName });
  }

  /**
   * Export track as JSON file
   */
  exportTrack() {
    const trackData = this.serializeTrack();
    const json = JSON.stringify(trackData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.trackName.replace(/\s+/g, '_')}.json`;
    a.click();

    URL.revokeObjectURL(url);

    eventBus.emit('editor-track-exported', { trackName: this.trackName });
  }

  /**
   * Save track to LocalStorage
   */
  saveToLocalStorage() {
    const trackData = this.serializeTrack();
    const key = `track_${this.trackName}`;
    localStorage.setItem(key, JSON.stringify(trackData));

    // Update track list
    let trackList = JSON.parse(localStorage.getItem('trackList') || '[]');
    if (!trackList.includes(this.trackName)) {
      trackList.push(this.trackName);
      localStorage.setItem('trackList', JSON.stringify(trackList));
    }

    eventBus.emit('editor-track-saved', { trackName: this.trackName });
    return true;
  }

  /**
   * Load track from LocalStorage
   */
  loadFromLocalStorage(trackName) {
    const key = `track_${trackName}`;
    const json = localStorage.getItem(key);

    if (json) {
      const trackData = JSON.parse(json);
      this.loadTrack(trackData);
      return true;
    }

    return false;
  }

  /**
   * Get list of saved tracks
   */
  static getSavedTracks() {
    return JSON.parse(localStorage.getItem('trackList') || '[]');
  }

  /**
   * Validate track (ensure it has start/finish)
   */
  validateTrack() {
    let hasStartFinish = false;

    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (this.grid[row][col] === 'start_finish') {
          hasStartFinish = true;
          break;
        }
      }
      if (hasStartFinish) break;
    }

    return {
      valid: hasStartFinish,
      errors: hasStartFinish ? [] : ['Track needs a start/finish line']
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.track) {
      this.track.destroy();
    }
    this.scene.remove(this.gridHelper);
    this.scene.remove(this.highlightMesh);
  }
}
