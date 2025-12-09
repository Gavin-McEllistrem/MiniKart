import { TileRegistry } from '../track/TileRegistry.js';
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
    this.trackNameInput = document.getElementById('track-name');

    // Mode elements
    this.modeTilesBtn = document.getElementById('mode-tiles-btn');
    this.modeCheckpointsBtn = document.getElementById('mode-checkpoints-btn');
    this.tilePalette = document.getElementById('tile-palette');
    this.checkpointControls = document.getElementById('checkpoint-controls');

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

    // Checkpoint state
    this.nextIsFinishLine = false;

    // Initialize
    this.setupTilePalette();
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

      // Draw tile preview
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

    // Show/hide relevant panels
    if (mode === 'tiles') {
      this.tilePalette.classList.remove('hidden');
      this.checkpointControls.classList.add('hidden');
    } else if (mode === 'checkpoints') {
      this.tilePalette.classList.add('hidden');
      this.checkpointControls.classList.remove('hidden');
      this.updateCheckpointList();
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
