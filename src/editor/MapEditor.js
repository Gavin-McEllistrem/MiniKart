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
    this.ui = null; // Will be set by EditorUI

    // Grid settings
    this.gridWidth = options.gridWidth ?? 30;
    this.gridHeight = options.gridHeight ?? 30;
    this.tileSize = options.tileSize ?? 10;

    // Editor state
    this.editorMode = 'tiles'; // 'tiles', 'checkpoints', 'decorations'
    this.selectedTileType = 'straight';
    this.currentRotation = 0; // 0, 90, 180, 270
    this.isPlacing = false;
    this.isPainting = false; // Track if mouse is held down
    this.lastPaintedCell = { x: -1, z: -1 }; // Prevent painting same cell repeatedly
    this.trackName = 'My Track';

    // Checkpoints and decorations (independent of tiling)
    this.checkpoints = [];
    this.decorations = [];
    this.checkpointMeshes = []; // Visual representations of checkpoints

    // Checkpoint drawing state
    this.isDrawingCheckpoint = false;
    this.checkpointStartPoint = null;
    this.checkpointPreviewLine = null;

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
      if (this.editorMode === 'checkpoints') {
        // Checkpoint drawing mode
        if (this.isDrawingCheckpoint && this.checkpointStartPoint) {
          this.updateCheckpointPreview(intersection);
        }

        // Emit world position for UI
        eventBus.emit('editor-grid-hover', {
          gridX: -1,
          gridZ: -1,
          worldX: intersection.x.toFixed(1),
          worldZ: intersection.z.toFixed(1)
        });
      } else {
        // Tile editing mode
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
      }
    } else {
      this.highlightMesh.visible = false;
    }
  }

  /**
   * Handle mouse down - start painting or drawing checkpoint
   */
  onMouseDown(event) {
    // Only left click (button 0)
    if (event.button !== 0) return;

    if (this.editorMode === 'checkpoints') {
      // Start drawing checkpoint
      this.startDrawingCheckpoint(event);
    } else {
      // Tile painting mode
      const { x: gridX, z: gridZ } = this.currentGridCell;

      if (gridX >= 0 && gridZ >= 0) {
        this.isPainting = true;
        this.lastPaintedCell = { x: gridX, z: gridZ };

        // Push undo state at start of paint stroke
        this.pushUndo();

        this.placeTile(gridX, gridZ, this.selectedTileType, true);
      }
    }
  }

  /**
   * Handle mouse up - stop painting or finish checkpoint
   */
  onMouseUp(event) {
    if (event.button !== 0) return;

    if (this.editorMode === 'checkpoints' && this.isDrawingCheckpoint) {
      // Finish drawing checkpoint
      this.finishDrawingCheckpoint(event);
    } else if (this.isPainting) {
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
   * Set editor mode
   */
  setEditorMode(mode) {
    this.editorMode = mode;
    eventBus.emit('editor-mode-changed', { mode });
  }

  /**
   * Start drawing a checkpoint line
   */
  startDrawingCheckpoint(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      this.isDrawingCheckpoint = true;
      this.checkpointStartPoint = intersection.clone();

      // Create preview line
      const geometry = new THREE.BufferGeometry().setFromPoints([
        intersection.clone(),
        intersection.clone()
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 3
      });
      this.checkpointPreviewLine = new THREE.Line(geometry, material);
      this.scene.add(this.checkpointPreviewLine);
    }
  }

  /**
   * Update checkpoint preview line while dragging
   */
  updateCheckpointPreview(endPoint) {
    if (!this.checkpointPreviewLine || !this.checkpointStartPoint) return;

    const points = [
      this.checkpointStartPoint.clone(),
      endPoint.clone()
    ];

    this.checkpointPreviewLine.geometry.setFromPoints(points);
  }

  /**
   * Finish drawing checkpoint
   */
  finishDrawingCheckpoint(event) {
    if (!this.isDrawingCheckpoint || !this.checkpointStartPoint) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const endPoint = new THREE.Vector3();

    if (this.raycaster.ray.intersectPlane(plane, endPoint)) {
      // Calculate checkpoint center, rotation, and width from line
      const center = new THREE.Vector3().addVectors(this.checkpointStartPoint, endPoint).multiplyScalar(0.5);
      const direction = new THREE.Vector3().subVectors(endPoint, this.checkpointStartPoint);
      const width = direction.length();

      // Only create checkpoint if line is long enough
      if (width > 2) {
        // Rotation should align the checkpoint plane WITH the drawn line (not perpendicular)
        // atan2(z, x) gives the angle of the line in the XZ plane
        const rotation = Math.atan2(direction.z, direction.x);

        this.addCheckpointFromLine(center, rotation, width, false);
      }
    }

    // Clean up preview
    if (this.checkpointPreviewLine) {
      this.scene.remove(this.checkpointPreviewLine);
      this.checkpointPreviewLine.geometry.dispose();
      this.checkpointPreviewLine.material.dispose();
      this.checkpointPreviewLine = null;
    }

    this.isDrawingCheckpoint = false;
    this.checkpointStartPoint = null;
  }

  /**
   * Add checkpoint from line drawing
   */
  addCheckpointFromLine(center, rotation, width, isFinishLine = false) {
    // Check if UI wants this to be a finish line
    if (this.ui && this.ui.nextIsFinishLine) {
      isFinishLine = true;
      // Reset the flag after using it
      this.ui.nextIsFinishLine = false;
      this.ui.toggleFinishLineBtn.textContent = 'Make Next Finish Line';
      this.ui.toggleFinishLineBtn.classList.remove('primary');
    }

    const checkpoint = {
      id: this.checkpoints.length,
      position: { x: center.x, y: 2, z: center.z },
      rotation: { x: 0, y: rotation, z: 0 },
      width: width,
      height: 10,
      isFinishLine
    };

    this.checkpoints.push(checkpoint);
    this.renderCheckpoint(checkpoint);
    eventBus.emit('checkpoint-added', { checkpoint });

    console.log(`Checkpoint added at (${center.x.toFixed(1)}, ${center.z.toFixed(1)}), width: ${width.toFixed(1)}, rotation: ${(rotation * 180 / Math.PI).toFixed(1)}°, ${isFinishLine ? 'FINISH LINE' : 'checkpoint'}`);

    return checkpoint;
  }

  /**
   * Render checkpoint visual in editor
   */
  renderCheckpoint(checkpoint) {
    const geometry = new THREE.PlaneGeometry(checkpoint.width, checkpoint.height);
    const material = new THREE.MeshBasicMaterial({
      color: checkpoint.isFinishLine ? 0xff0000 : 0x00ff00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(checkpoint.position.x, checkpoint.position.y + checkpoint.height / 2, checkpoint.position.z);
    // Negate rotation to correct for coordinate system when rendering
    mesh.rotation.y = -checkpoint.rotation.y;

    // Add edges for visibility
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: checkpoint.isFinishLine ? 0xff0000 : 0x00ff00,
      linewidth: 2
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    mesh.add(edges);

    // Store reference
    mesh.userData.checkpointId = checkpoint.id;
    this.checkpointMeshes.push(mesh);
    this.scene.add(mesh);
  }

  /**
   * Re-render all checkpoints
   */
  renderAllCheckpoints() {
    // Clear existing checkpoint meshes
    this.checkpointMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.checkpointMeshes = [];

    // Render all checkpoints
    this.checkpoints.forEach(cp => this.renderCheckpoint(cp));
  }

  /**
   * Add checkpoint at position (legacy method for compatibility)
   */
  addCheckpoint(position, rotation = 0, isFinishLine = false) {
    const checkpoint = {
      id: this.checkpoints.length,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: 0, y: rotation, z: 0 },
      width: 20,
      height: 10,
      isFinishLine
    };
    this.checkpoints.push(checkpoint);
    this.renderCheckpoint(checkpoint);
    eventBus.emit('checkpoint-added', { checkpoint });
    return checkpoint;
  }

  /**
   * Remove checkpoint by ID
   */
  removeCheckpoint(id) {
    const index = this.checkpoints.findIndex(cp => cp.id === id);
    if (index !== -1) {
      this.checkpoints.splice(index, 1);
      // Reindex
      this.checkpoints.forEach((cp, i) => {
        cp.id = i;
      });
      eventBus.emit('checkpoint-removed', { id });
    }
  }

  /**
   * Serialize track to JSON
   */
  serializeTrack() {
    return {
      name: this.trackName,
      width: this.gridWidth,
      height: this.gridHeight,
      layout: this.cloneGrid(),
      checkpoints: this.checkpoints,
      decorations: this.decorations
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

    // Load checkpoints if present
    if (trackData.checkpoints) {
      this.checkpoints = trackData.checkpoints.map(cp => ({...cp}));
      this.renderAllCheckpoints();
    }

    // Load decorations if present
    if (trackData.decorations) {
      this.decorations = trackData.decorations.map(dec => ({...dec}));
    }

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

    // Clean up checkpoint meshes
    this.checkpointMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.checkpointMeshes = [];

    // Clean up preview line if exists
    if (this.checkpointPreviewLine) {
      this.scene.remove(this.checkpointPreviewLine);
      this.checkpointPreviewLine.geometry.dispose();
      this.checkpointPreviewLine.material.dispose();
      this.checkpointPreviewLine = null;
    }

    this.scene.remove(this.gridHelper);
    this.scene.remove(this.highlightMesh);
  }
}
