import * as THREE from 'three';
import { MapEditor } from './src/editor/MapEditor.js';
import { EditorUI } from './src/editor/EditorUI.js';
import { Renderer } from './src/core/Renderer.js';
import { eventBus } from './src/utils/EventBus.js';

/**
 * Editor Mode Entry Point
 */

let renderer;
let mapEditor;
let editorUI;

function initEditor() {
  console.log('=== EDITOR MODE INITIALIZED ===');

  // Create renderer
  renderer = new Renderer({
    antialias: true,
    shadows: false, // Disable shadows for editor performance
    backgroundColor: 0x333333 // Darker background for editor
  });
  document.body.appendChild(renderer.getDomElement());

  // Setup editor camera (locked top-down view)
  renderer.camera.position.set(0, 100, 0);
  renderer.camera.lookAt(0, 0, 0);

  // Enable orbit controls for editor (panning only, no rotation)
  renderer.setOrbitControls(true);
  renderer.orbitControls.enableRotate = false; // Lock rotation - stay top-down
  renderer.orbitControls.enableDamping = true;
  renderer.orbitControls.dampingFactor = 0.1; // Smooth panning
  renderer.orbitControls.screenSpacePanning = true; // Better panning behavior
  renderer.orbitControls.minDistance = 30; // Minimum zoom
  renderer.orbitControls.maxDistance = 200; // Maximum zoom
  renderer.orbitControls.panSpeed = 1.5; // Faster panning (right-click drag or two-finger drag)

  // Create map editor
  mapEditor = new MapEditor(renderer.scene, renderer.camera, renderer.renderer, {
    gridWidth: 30,
    gridHeight: 30,
    tileSize: 10
  });

  // Restore editor state if returning from test mode
  const savedState = sessionStorage.getItem('editorState');
  if (savedState) {
    const trackData = JSON.parse(savedState);
    mapEditor.loadTrack(trackData);
    console.log('Restored track from test mode:', trackData.name);
  }

  // Create editor UI
  editorUI = new EditorUI(mapEditor);
  editorUI.show();

  // Update UI to match loaded track
  if (savedState) {
    const trackData = JSON.parse(savedState);
    editorUI.updateTrackName(trackData.name);
  }

  // Hide game HUD and UI
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('ui').classList.add('hidden');
  document.getElementById('touch-controls').classList.add('hidden');
  document.getElementById('main-menu').classList.add('hidden');

  // Setup editor events
  setupEditorEvents();

  // Start render loop
  animate();
}

/**
 * Setup editor-specific events
 */
function setupEditorEvents() {
  // Exit editor
  eventBus.on('editor-exit', () => {
    if (confirm('Exit editor? Unsaved changes will be lost.')) {
      window.location.href = 'index.html'; // Return to main menu
    }
  });

  // Test track
  eventBus.on('editor-test-track', (data) => {
    // Save track data to session storage
    sessionStorage.setItem('testTrack', JSON.stringify(data.trackData));

    // Redirect to main game
    window.location.href = 'index.html?mode=test';
  });
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  // Update orbit controls
  renderer.updateOrbitControls();

  // Render scene
  renderer.render();
}

// Initialize editor on load
initEditor();
