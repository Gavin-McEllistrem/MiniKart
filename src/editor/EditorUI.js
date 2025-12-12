import { TileRegistry } from '../track/TileRegistry.js';
import { ObjectRegistry, getCategories } from '../objects/ObjectRegistry.js';
import { eventBus } from '../utils/EventBus.js';
import { MapEditor } from './MapEditor.js';

/**
 * EditorUI - Manages editor interface and user interactions
 */

export class EditorUI {
  constructor(mapEditor) {
    this.editor = mapEditor;
    this.editor.ui = this; // Set bidirectional reference

    // UI Elements
    this.editorPanel = document.getElementById('editor-ui');
    this.tileGrid = document.getElementById('tile-grid');
    this.gridCoordsSpan = document.getElementById('grid-coords');
    this.selectedTileSpan = document.getElementById('selected-tile');
    this.rotationDisplay = document.getElementById('rotation-display');
    this.scaleDisplay = document.getElementById('scale-display');
    this.trackNameInput = document.getElementById('track-name');

    // Mode elements
    this.modeTilesBtn = document.getElementById('mode-tiles-btn');
    this.modeCheckpointsBtn = document.getElementById('mode-checkpoints-btn');
    this.modeWaypointsBtn = document.getElementById('mode-waypoints-btn');
    this.modeDecorationsBtn = document.getElementById('mode-decorations-btn');
    this.tilePalette = document.getElementById('tile-palette');
    this.checkpointControls = document.getElementById('checkpoint-controls');
    this.waypointControls = document.getElementById('waypoint-controls');
    this.decorationControls = document.getElementById('decoration-controls');

    // Buttons
    this.rotateBtn = document.getElementById('rotate-btn');
    this.undoBtn = document.getElementById('undo-btn');
    this.redoBtn = document.getElementById('redo-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.testBtn = document.getElementById('test-btn');
    this.saveBtn = document.getElementById('save-btn');
    this.loadBtn = document.getElementById('load-btn');
    this.importBtn = document.getElementById('import-btn');
    this.fileInput = document.getElementById('file-input');
    this.exportBtn = document.getElementById('export-btn');
    this.exitBtn = document.getElementById('exit-editor-btn');

    // Checkpoint buttons
    this.toggleFinishLineBtn = document.getElementById('toggle-finish-line-btn');
    this.clearCheckpointsBtn = document.getElementById('clear-checkpoints-btn');
    this.checkpointItemsDiv = document.getElementById('checkpoint-items');

    // Waypoint buttons
    this.clearWaypointsBtn = document.getElementById('clear-waypoints-btn');
    this.visualizeFieldBtn = document.getElementById('visualize-field-btn');
    this.waypointItemsDiv = document.getElementById('waypoint-items');
    this.waypointCountSpan = document.getElementById('waypoint-count');

    // Decoration buttons
    this.objectGrid = document.getElementById('object-grid');
    this.rotateObjectLeftBtn = document.getElementById('rotate-object-left-btn');
    this.rotateObjectRightBtn = document.getElementById('rotate-object-right-btn');
    this.scaleUpBtn = document.getElementById('scale-up-btn');
    this.scaleDownBtn = document.getElementById('scale-down-btn');
    this.clearObjectsBtn = document.getElementById('clear-objects-btn');
    this.objectItemsDiv = document.getElementById('object-items');

    // Brush controls
    this.brushSizeSlider = document.getElementById('brush-size-slider');
    this.brushSizeValue = document.getElementById('brush-size-value');
    this.autoTileToggle = document.getElementById('auto-tile-toggle');

    // Checkpoint state
    this.nextIsFinishLine = false;

    // Initialize
    this.setupTilePalette();
    this.setupObjectPalette();
    this.setupEventListeners();
    this.setupEditorEvents();
  }

  /**
   * Show editor UI
   */
  show() {
    this.editorPanel.classList.remove('hidden');
  }

  /**
   * Hide editor UI
   */
  hide() {
    this.editorPanel.classList.add('hidden');
  }

  /**
   * Setup tile palette with all available tiles
   */
  setupTilePalette() {
    this.tileGrid.innerHTML = '';

    for (const key in TileRegistry) {
      const tile = TileRegistry[key];

      // Skip empty tile
      if (tile.id === 'empty') continue;

      // Create tile option
      const option = document.createElement('div');
      option.className = 'tile-option';
      option.dataset.tileId = tile.id;

      // Create preview canvas
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');

      // If tile has a texture, load and draw it
      if (tile.texture) {
        const img = new Image();
        img.onload = () => {
          // Draw texture to fill canvas
          ctx.drawImage(img, 0, 0, 100, 60);

          // Add border
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, 100, 60);
        };
        img.onerror = () => {
          // Fallback to color if texture fails to load
          ctx.fillStyle = `#${tile.color.toString(16).padStart(6, '0')}`;
          ctx.fillRect(0, 0, 100, 60);

          // Add border
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, 100, 60);
        };
        img.src = tile.texture;
      } else {
        // Draw tile preview with color
        ctx.fillStyle = `#${tile.color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, 100, 60);

        // Add border
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 100, 60);

        // Add special patterns
        if (tile.hasCheckeredPattern) {
          this.drawCheckeredPattern(ctx, 100, 60);
        }
        if (tile.hasStripes) {
          this.drawStripePattern(ctx, 100, 60);
        }
      }

      // Add tile name
      const label = document.createElement('span');
      label.textContent = tile.name;

      option.appendChild(canvas);
      option.appendChild(label);
      this.tileGrid.appendChild(option);

      // Click handler
      option.addEventListener('click', () => {
        this.selectTile(tile.id);
      });
    }

    // Select default tile
    this.selectTile('straight');
  }

  /**
   * Setup object palette with all available 3D objects
   */
  setupObjectPalette() {
    this.objectGrid.innerHTML = '';

    for (const key in ObjectRegistry) {
      const obj = ObjectRegistry[key];

      // Create object option
      const option = document.createElement('div');
      option.className = 'object-option';
      option.dataset.objectType = obj.id;

      // Create preview canvas
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');

      // Draw simple colored preview
      ctx.fillStyle = `#${obj.prototypeColor.toString(16).padStart(6, '0')}`;

      // Draw shape based on geometry type
      if (obj.prototypeGeometry === 'cone') {
        // Draw triangle for cone
        ctx.beginPath();
        ctx.moveTo(50, 10);
        ctx.lineTo(20, 50);
        ctx.lineTo(80, 50);
        ctx.closePath();
        ctx.fill();
      } else if (obj.prototypeGeometry === 'sphere') {
        // Draw circle
        ctx.beginPath();
        ctx.arc(50, 30, 20, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw rectangle
        ctx.fillRect(25, 15, 50, 30);
      }

      // Add border
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 100, 60);

      // Add object name
      const label = document.createElement('span');
      label.textContent = obj.name;

      option.appendChild(canvas);
      option.appendChild(label);
      this.objectGrid.appendChild(option);

      // Click handler
      option.addEventListener('click', () => {
        this.selectObject(obj.id);
      });
    }

    // Select default object
    this.selectObject('tree_pine');
  }

  /**
   * Select an object type
   */
  selectObject(objectType) {
    // Update UI
    document.querySelectorAll('.object-option').forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.objectType === objectType) {
        el.classList.add('selected');
      }
    });

    // Update editor
    this.editor.setSelectedObject(objectType);

    // Update displays
    this.updateRotationDisplay();
    this.updateScaleDisplay();
  }

  /**
   * Draw checkered pattern on canvas
   */
  drawCheckeredPattern(ctx, width, height) {
    const squareSize = 10;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < width / squareSize; i++) {
      for (let j = 0; j < height / squareSize; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
        }
      }
    }
  }

  /**
   * Draw stripe pattern on canvas
   */
  drawStripePattern(ctx, width, height) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < width; i += 15) {
      ctx.fillRect(i, 0, 7, height);
    }
  }

  /**
   * Select a tile type
   */
  selectTile(tileId) {
    // Update UI
    document.querySelectorAll('.tile-option').forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.tileId === tileId) {
        el.classList.add('selected');
      }
    });

    // Update editor
    this.editor.setSelectedTile(tileId);
    this.selectedTileSpan.textContent = TileRegistry[tileId.toUpperCase()?.replace(/[_-]/g, '_')]?.name || tileId;
  }

  /**
   * Setup button event listeners
   */
  setupEventListeners() {
    // Mode switching
    this.modeTilesBtn.addEventListener('click', () => {
      this.switchMode('tiles');
    });

    this.modeCheckpointsBtn.addEventListener('click', () => {
      this.switchMode('checkpoints');
    });

    this.modeWaypointsBtn.addEventListener('click', () => {
      this.switchMode('waypoints');
    });

    this.modeDecorationsBtn.addEventListener('click', () => {
      this.switchMode('decorations');
    });

    // Checkpoint controls
    this.toggleFinishLineBtn.addEventListener('click', () => {
      this.nextIsFinishLine = !this.nextIsFinishLine;
      this.toggleFinishLineBtn.textContent = this.nextIsFinishLine
        ? '🏁 Next: Finish Line'
        : 'Make Next Finish Line';
      this.toggleFinishLineBtn.classList.toggle('primary', this.nextIsFinishLine);
    });

    this.clearCheckpointsBtn.addEventListener('click', () => {
      if (confirm('Clear all checkpoints?')) {
        this.editor.checkpoints = [];
        this.editor.renderAllCheckpoints();
        this.updateCheckpointList();
      }
    });

    // Waypoint controls
    this.clearWaypointsBtn.addEventListener('click', () => {
      if (confirm('Clear all waypoints?')) {
        this.editor.clearWaypoints();
        this.updateWaypointList();
      }
    });

    this.visualizeFieldBtn.addEventListener('click', () => {
      this.visualizeDirectionField();
    });

    // Decoration controls
    this.rotateObjectLeftBtn.addEventListener('click', () => {
      this.editor.rotateObject(-Math.PI / 4); // Rotate 45° left
      this.updateRotationDisplay();
    });

    this.rotateObjectRightBtn.addEventListener('click', () => {
      this.editor.rotateObject(Math.PI / 4); // Rotate 45° right
      this.updateRotationDisplay();
    });

    this.scaleUpBtn.addEventListener('click', () => {
      this.editor.scaleObject(1.2); // Scale up by 20%
      this.updateScaleDisplay();
    });

    this.scaleDownBtn.addEventListener('click', () => {
      this.editor.scaleObject(0.8); // Scale down by 20%
      this.updateScaleDisplay();
    });

    this.clearObjectsBtn.addEventListener('click', () => {
      if (confirm('Clear all decorative objects?')) {
        this.editor.objects = [];
        this.editor.renderAllObjects();
        this.updateObjectList();
      }
    });

    // Brush size slider
    this.brushSizeSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      this.brushSizeValue.textContent = size;
      this.editor.setBrushSize(size);
    });

    // Auto-tile toggle
    this.autoTileToggle.addEventListener('change', (e) => {
      this.editor.toggleAutoTile(e.target.checked);
    });

    // Rotate button
    this.rotateBtn.addEventListener('click', () => {
      this.editor.rotateTile();
    });

    // Undo/Redo
    this.undoBtn.addEventListener('click', () => {
      this.editor.undo();
    });

    this.redoBtn.addEventListener('click', () => {
      this.editor.redo();
    });

    // Clear
    this.clearBtn.addEventListener('click', () => {
      this.editor.clearGrid();
    });

    // Save
    this.saveBtn.addEventListener('click', () => {
      this.editor.trackName = this.trackNameInput.value;
      if (this.editor.saveToLocalStorage()) {
        alert(`Track "${this.editor.trackName}" saved!`);
      }
    });

    // Load from LocalStorage
    this.loadBtn.addEventListener('click', () => {
      this.showLoadDialog();
    });

    // Import from JSON file
    this.importBtn.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Handle file selection
    this.fileInput.addEventListener('change', (e) => {
      this.handleFileImport(e);
    });

    // Export to JSON file
    this.exportBtn.addEventListener('click', () => {
      this.editor.trackName = this.trackNameInput.value;
      this.editor.exportTrack();
    });

    // Test (emit event for main to handle)
    this.testBtn.addEventListener('click', () => {
      const validation = this.editor.validateTrack();
      if (!validation.valid) {
        alert('Track validation failed:\n' + validation.errors.join('\n'));
        return;
      }

      // Save current track to session storage before testing
      const trackData = this.editor.serializeTrack();
      sessionStorage.setItem('editorState', JSON.stringify(trackData));

      eventBus.emit('editor-test-track', {
        trackData: trackData
      });
    });

    // Exit editor
    this.exitBtn.addEventListener('click', () => {
      eventBus.emit('editor-exit');
    });

    // Track name input
    this.trackNameInput.addEventListener('input', (e) => {
      this.editor.trackName = e.target.value;
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Only handle if editor is visible
      if (this.editorPanel.classList.contains('hidden')) return;

      // R - Rotate
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.editor.rotateTile();
      }

      // Ctrl+Z - Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.editor.undo();
      }

      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        this.editor.redo();
      }
    });
  }

  /**
   * Setup editor event listeners
   */
  setupEditorEvents() {
    // Grid hover
    eventBus.on('editor-grid-hover', (data) => {
      if (data.gridX >= 0) {
        this.gridCoordsSpan.textContent = `(${data.gridX}, ${data.gridZ})`;
      } else {
        this.gridCoordsSpan.textContent = `(${data.worldX}, ${data.worldZ})`;
      }
    });

    // Rotation changed
    eventBus.on('editor-rotation-changed', (data) => {
      this.rotationDisplay.textContent = `${data.rotation}°`;
    });

    // Track saved
    eventBus.on('editor-track-saved', (data) => {
      console.log('Track saved:', data.trackName);
    });

    // Track exported
    eventBus.on('editor-track-exported', (data) => {
      console.log('Track exported:', data.trackName);
    });

    // Checkpoint added
    eventBus.on('checkpoint-added', (data) => {
      this.updateCheckpointList();
    });

    // Checkpoint removed
    eventBus.on('checkpoint-removed', (data) => {
      this.updateCheckpointList();
    });

    // Object added
    eventBus.on('object-added', (data) => {
      this.updateObjectList();
    });

    // Object removed
    eventBus.on('object-removed', (data) => {
      this.updateObjectList();
    });

    // Object rotation changed
    eventBus.on('editor-object-rotation-changed', (data) => {
      this.updateRotationDisplay();
    });

    // Object scale changed
    eventBus.on('editor-object-scale-changed', (data) => {
      this.updateScaleDisplay();
    });
  }

  /**
   * Show load dialog with saved tracks
   */
  showLoadDialog() {
    const tracks = MapEditor.getSavedTracks();

    if (tracks.length === 0) {
      alert('No saved tracks found.');
      return;
    }

    let message = 'Select a track to load:\n\n';
    tracks.forEach((track, index) => {
      message += `${index + 1}. ${track}\n`;
    });

    const input = prompt(message + '\nEnter track number:');
    const trackIndex = parseInt(input) - 1;

    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const trackName = tracks[trackIndex];
      if (this.editor.loadFromLocalStorage(trackName)) {
        this.trackNameInput.value = trackName;
        alert(`Track "${trackName}" loaded!`);
      } else {
        alert('Failed to load track.');
      }
    }
  }

  /**
   * Update track name display
   */
  updateTrackName(name) {
    this.trackNameInput.value = name;
  }

  /**
   * Switch editor mode
   */
  switchMode(mode) {
    this.editor.setEditorMode(mode);

    // Update button states
    this.modeTilesBtn.classList.toggle('active', mode === 'tiles');
    this.modeCheckpointsBtn.classList.toggle('active', mode === 'checkpoints');
    this.modeWaypointsBtn.classList.toggle('active', mode === 'waypoints');
    this.modeDecorationsBtn.classList.toggle('active', mode === 'decorations');

    // Show/hide relevant panels
    if (mode === 'tiles') {
      this.tilePalette.classList.remove('hidden');
      this.checkpointControls.classList.add('hidden');
      this.waypointControls.classList.add('hidden');
      this.decorationControls.classList.add('hidden');
    } else if (mode === 'checkpoints') {
      this.tilePalette.classList.add('hidden');
      this.checkpointControls.classList.remove('hidden');
      this.waypointControls.classList.add('hidden');
      this.decorationControls.classList.add('hidden');
      this.updateCheckpointList();
    } else if (mode === 'waypoints') {
      this.tilePalette.classList.add('hidden');
      this.checkpointControls.classList.add('hidden');
      this.waypointControls.classList.remove('hidden');
      this.decorationControls.classList.add('hidden');
      this.updateWaypointList();
    } else if (mode === 'decorations') {
      this.tilePalette.classList.add('hidden');
      this.checkpointControls.classList.add('hidden');
      this.waypointControls.classList.add('hidden');
      this.decorationControls.classList.remove('hidden');
      this.updateObjectList();
    }
  }

  /**
   * Update checkpoint list UI
   */
  updateCheckpointList() {
    this.checkpointItemsDiv.innerHTML = '';

    if (this.editor.checkpoints.length === 0) {
      this.checkpointItemsDiv.innerHTML = '<div class="info-text">No checkpoints yet</div>';
      return;
    }

    this.editor.checkpoints.forEach((cp, index) => {
      const item = document.createElement('div');
      item.className = 'checkpoint-item';
      item.innerHTML = `
        <span>${cp.isFinishLine ? '🏁' : '✓'} Checkpoint ${index + 1}</span>
        <button class="delete-checkpoint-btn" data-id="${cp.id}">🗑️</button>
      `;

      // Delete button handler
      const deleteBtn = item.querySelector('.delete-checkpoint-btn');
      deleteBtn.addEventListener('click', () => {
        this.editor.removeCheckpoint(cp.id);
      });

      this.checkpointItemsDiv.appendChild(item);
    });
  }

  /**
   * Update object list UI
   */
  updateObjectList() {
    this.objectItemsDiv.innerHTML = '';

    if (this.editor.objects.length === 0) {
      this.objectItemsDiv.innerHTML = '<div class="info-text">No objects placed yet</div>';
      return;
    }

    this.editor.objects.forEach((obj, index) => {
      const objDef = ObjectRegistry[obj.type.toUpperCase().replace(/[_-]/g, '_')];
      const item = document.createElement('div');
      item.className = 'object-item';
      item.innerHTML = `
        <span>${objDef?.name || obj.type} ${index + 1}</span>
        <button class="delete-object-btn" data-id="${obj.id}">🗑️</button>
      `;

      // Delete button handler
      const deleteBtn = item.querySelector('.delete-object-btn');
      deleteBtn.addEventListener('click', () => {
        this.editor.removeObject(obj.id);
      });

      this.objectItemsDiv.appendChild(item);
    });
  }

  /**
   * Update waypoint list UI
   */
  updateWaypointList() {
    this.waypointItemsDiv.innerHTML = '';
    this.waypointCountSpan.textContent = this.editor.waypoints.length;

    if (this.editor.waypoints.length === 0) {
      this.waypointItemsDiv.innerHTML = '<div class="info-text">No waypoints placed yet</div>';
      return;
    }

    this.editor.waypoints.forEach((waypoint, index) => {
      const item = document.createElement('div');
      item.className = 'waypoint-item';
      item.innerHTML = `
        <span>Waypoint ${index + 1}: (${waypoint.position.x.toFixed(1)}, ${waypoint.position.z.toFixed(1)})</span>
        <button class="delete-waypoint-btn" data-id="${waypoint.id}">🗑️</button>
      `;

      // Delete button handler
      const deleteBtn = item.querySelector('.delete-waypoint-btn');
      deleteBtn.addEventListener('click', () => {
        this.editor.removeWaypoint(waypoint.id);
        this.updateWaypointList();
      });

      this.waypointItemsDiv.appendChild(item);
    });
  }

  /**
   * Visualize direction field for debugging
   */
  visualizeDirectionField() {
    if (this.editor.waypoints.length < 2) {
      alert('Need at least 2 waypoints to visualize direction field');
      return;
    }

    // Import DirectionField
    import('../ai/DirectionField.js').then(({ DirectionField }) => {
      const field = new DirectionField({
        gridWidth: this.editor.gridWidth,
        gridHeight: this.editor.gridHeight,
        tileSize: this.editor.tileSize,
        waypoints: this.editor.waypoints
      });

      // Visualize with arrows (every 3 cells)
      const arrows = field.visualize(this.editor.scene, 3);

      // Store for cleanup
      if (!this.directionFieldArrows) {
        this.directionFieldArrows = [];
      }

      // Clear old arrows
      this.directionFieldArrows.forEach(arrow => this.editor.scene.remove(arrow));
      this.directionFieldArrows = arrows;

      console.log('Direction field visualized');
    });
  }

  /**
   * Update rotation display
   */
  updateRotationDisplay() {
    const degrees = (this.editor.objectRotation * 180 / Math.PI).toFixed(0);
    if (this.rotationDisplay) {
      this.rotationDisplay.textContent = `${degrees}°`;
    }
  }

  /**
   * Update scale display
   */
  updateScaleDisplay() {
    const scale = this.editor.objectScale;
    if (this.scaleDisplay) {
      this.scaleDisplay.textContent = `${scale.x.toFixed(2)}x`;
    }
  }

  /**
   * Handle JSON file import
   */
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a JSON file
    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const trackData = JSON.parse(e.target.result);

        // Validate track data
        if (!trackData.layout || !Array.isArray(trackData.layout)) {
          alert('Invalid track file: missing layout data.');
          return;
        }

        // Load the track
        this.editor.loadTrack(trackData);
        this.updateTrackName(trackData.name || 'Imported Track');

        // Update checkpoint list if in checkpoint mode
        if (this.editor.editorMode === 'checkpoints') {
          this.updateCheckpointList();
        }

        alert(`Track "${trackData.name || 'Imported Track'}" loaded successfully!`);
        console.log('Track imported:', trackData);
      } catch (error) {
        alert('Error loading track file: ' + error.message);
        console.error('Import error:', error);
      }
    };

    reader.onerror = () => {
      alert('Error reading file.');
    };

    reader.readAsText(file);

    // Reset file input so the same file can be loaded again
    event.target.value = '';
  }
}
