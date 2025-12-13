import * as THREE from 'three';
import { MapEditor } from './src/editor/MapEditor.js';
import { EditorUI } from './src/editor/EditorUI.js';
import { Renderer } from './src/core/Renderer.js';
import { eventBus } from './src/utils/EventBus.js';
import { RenderConfig } from './src/config/RenderConfig.js';

/**
 * Editor Mode Entry Point
 */

// Check URL params for render mode
const urlParams = new URLSearchParams(window.location.search);
const renderMode = urlParams.get('render') || 'prototype';
RenderConfig.setMode(renderMode);

// Setup render mode toggle button
const renderModeBtn = document.getElementById('render-mode-btn');
if (renderModeBtn) {
  updateRenderModeButton();
  renderModeBtn.addEventListener('click', () => {
    const newMode = RenderConfig.getMode() === 'prototype' ? 'full' : 'prototype';
    const url = new URL(window.location);
    url.searchParams.set('render', newMode);
    window.location.href = url.toString();
  });
}

function updateRenderModeButton() {
  if (!renderModeBtn) return;
  const mode = RenderConfig.getMode();
  if (mode === 'full') {
    renderModeBtn.textContent = '✨ Full Mode';
    renderModeBtn.classList.add('full-mode');
  } else {
    renderModeBtn.textContent = '🎨 Prototype Mode';
    renderModeBtn.classList.remove('full-mode');
  }
}

let renderer;
let mapEditor;
let editorUI;

function initEditor() {
  console.log('=== EDITOR MODE INITIALIZED ===');
  console.log(`Render Mode: ${renderMode.toUpperCase()}`);

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
    tileSize: 5
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

  // Hide game HUD and touch controls (keep top bar for render toggle)
  document.getElementById('hud').classList.add('hidden');
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
    window.location.href = `index.html?mode=test&render=${RenderConfig.getMode()}`;
  });
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  if (mapEditor?.update) {
    mapEditor.update();
  }

  // Update orbit controls
  renderer.updateOrbitControls();

  updatePerformanceHUD();

  // Render scene
  renderer.render();
}

function updatePerformanceHUD() {
  const hudEl = document.getElementById('hud');
  if (!hudEl || !mapEditor?.getCullingStats) return;

  const stats = mapEditor.getCullingStats();
  if (stats) {
    hudEl.textContent =
      `=== EDITOR PERFORMANCE ===\n` +
      `Total Objects: ${stats.total}\n` +
      `Visible: ${stats.visible}\n` +
      `Culled: ${stats.culled} (${stats.cullPercentage}%)\n` +
      `\n` +
      `Use mouse wheel to zoom\n` +
      `Right-click drag to pan`;
  }
}

// Initialize editor on load
initEditor();
