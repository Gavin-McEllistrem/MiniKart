import * as THREE from "three";
import { Kart } from "./src/entities/Kart.js";
import { CpuDriver } from "./src/entities/CpuDriver.js";
import { Camera } from "./src/entities/Camera.js";
import { InputManager } from "./src/core/InputManager.js";
import { Game } from "./src/core/Game.js";
import { Renderer } from "./src/core/Renderer.js";
import { Track } from "./src/track/Track.js";
import { testTrack } from "./src/track/tracks/testTrack.js";
import { eventBus } from "./src/utils/EventBus.js";

// Core systems
let renderer;
let game;
let chaseCamera;

// UI elements
const hudEl = document.getElementById("hud");
const modeBtn = document.getElementById("mode-btn");
const mainMenu = document.getElementById("main-menu");
const playBtn = document.getElementById("play-btn");
const editorBtn = document.getElementById("editor-btn");

// Check URL params for test mode
const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.get('mode') === 'test';

function init() {
  // Show main menu unless in test mode
  if (!isTestMode) {
    showMainMenu();
    return;
  }

  // Test mode - load track from session storage
  const testTrackData = JSON.parse(sessionStorage.getItem('testTrack') || 'null');
  if (testTrackData) {
    startGame(testTrackData);
  } else {
    // No test track, show menu
    showMainMenu();
  }
}

/**
 * Show main menu
 */
function showMainMenu() {
  mainMenu.classList.remove('hidden');

  playBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    startGame();
  });

  editorBtn.addEventListener('click', () => {
    window.location.href = 'editor.html';
  });
}

/**
 * Start the game
 */
function startGame(customTrackData = null) {
  // Hide main menu
  mainMenu.classList.add('hidden');

  // Create renderer
  renderer = new Renderer({
    antialias: true,
    shadows: true,
    backgroundColor: 0x87CEEB // Sky blue
  });
  document.body.appendChild(renderer.getDomElement());

  // Create game instance
  game = new Game(renderer.scene, {
    wallSlideSpeedPenalty: 0.7,
    wallStopSpeedPenalty: 0.5
  });

  // Create input manager
  const inputManager = new InputManager();
  game.setInputManager(inputManager);

  // Create track (use custom track if provided, otherwise use testTrack)
  const trackData = customTrackData || testTrack;
  const track = new Track(renderer.scene, {
    tileSize: 10,
    trackData: trackData.layout,
    checkpointsData: trackData.checkpoints || []
  });
  game.setTrack(track);

  // Get start position from track
  const startTransform = track.getStartTransform();

  // Create player kart
  const player = new Kart(renderer.scene, {
    id: 'player',
    isPlayer: true,
    color: 0xff5555,
    mode: 'prototype'
  });
  player.pos.copy(startTransform.position);
  player.heading = startTransform.heading;
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  game.setPlayer(player);

  // Create a simple CPU kart to race against the player
  const cpuKart = new Kart(renderer.scene, {
    id: 'cpu-1',
    isPlayer: false,
    color: 0x3a86ff,
    mode: 'prototype',
    maxSpeed: 8000
  });

  // Offset the CPU kart slightly so it doesn't overlap the player on spawn
  const offset = new THREE.Vector3(2, 0, -3);
  const rotatedOffset = new THREE.Vector3(
    offset.x * Math.cos(startTransform.heading) - offset.z * Math.sin(startTransform.heading),
    0,
    offset.x * Math.sin(startTransform.heading) + offset.z * Math.cos(startTransform.heading)
  );
  cpuKart.pos.copy(startTransform.position).add(rotatedOffset);
  cpuKart.heading = startTransform.heading;
  cpuKart.mesh.position.copy(cpuKart.pos);
  cpuKart.mesh.rotation.y = cpuKart.heading;
  cpuKart.aiDriver = new CpuDriver({
    targetSpeedFactor: 0.9,
    cornerSlowdownAngle: 1.0
  });
  game.addKart(cpuKart);

  // Create chase camera
  chaseCamera = new Camera(renderer.camera, {
    distance: 12,
    height: 8,
    lookAhead: 5,
    smoothSpeed: 6.0,
    rotationSpeed: 5.0
  });
  chaseCamera.reset(player);
  game.setCamera(chaseCamera);

  // Setup keyboard controls
  setupControls();

  // Setup event listeners
  setupEventListeners();

  // Hide mode button
  modeBtn.style.display = 'none';

  // Show appropriate return button
  const returnBtn = document.createElement('button');
  if (isTestMode) {
    returnBtn.textContent = '← Return to Editor';
    returnBtn.addEventListener('click', () => {
      window.location.href = 'editor.html';
    });
  } else {
    returnBtn.textContent = '← Main Menu';
    returnBtn.addEventListener('click', () => {
      if (confirm('Return to main menu?')) {
        location.reload();
      }
    });
  }

  returnBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 10px 20px;
    background: #d32f2f;
    border: 2px solid #b71c1c;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    z-index: 100;
  `;
  document.body.appendChild(returnBtn);

  // Start game
  game.start();

  console.log('=== GAME INITIALIZED ===');
  console.log('Track:', trackData.name);
  console.log('Start position:', startTransform.position);

  // Start render loop
  animate();
}

// Initialize game
init();

/**
 * Setup keyboard controls
 */
function setupControls() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // Toggle debug vectors (V key)
    if (key === 'v' && game.player) {
      const currentlyVisible = game.player.debugVectors.heading.visible;
      game.player.toggleDebugVectors(!currentlyVisible);
      console.log('Debug vectors:', !currentlyVisible ? 'ON' : 'OFF');
    }

    // Toggle checkpoint visibility (H key for "hitboxes")
    if (key === 'h' && game.track && game.track.checkpointSystem) {
      const checkpointSystem = game.track.checkpointSystem;
      const currentlyVisible = checkpointSystem.checkpoints.length > 0 && checkpointSystem.checkpoints[0].mesh.visible;
      checkpointSystem.setCheckpointsVisible(!currentlyVisible);
      console.log('Checkpoint visibility:', !currentlyVisible ? 'ON' : 'OFF');
    }

    // Toggle camera mode (C key)
    if (key === 'c' && chaseCamera) {
      if (chaseCamera.currentMode === 'chase') {
        chaseCamera.setMode('orbit');
        renderer.setOrbitControls(true);
        console.log('Camera: ORBIT (free look)');
      } else {
        chaseCamera.setMode('chase');
        renderer.setOrbitControls(false);
        console.log('Camera: CHASE');
      }
    }

    // Reset kart (R key)
    if (key === 'r') {
      game.resetPlayer();
      console.log('Player reset');
    }
  });
}

/**
 * Setup event listeners for game events
 */
function setupEventListeners() {
  eventBus.on('boost-activated', (data) => {
    console.log('Boost activated!', data);
  });

  eventBus.on('drift-start', (data) => {
    console.log('Drift started!', data);
  });

  eventBus.on('drift-end', (data) => {
    console.log('Drift ended!', data);
  });

  eventBus.on('wall-hit', (data) => {
    console.log(`Wall hit [${data.type}]:`, data);
  });

  eventBus.on('checkpoint-reached', (data) => {
    console.log(`Checkpoint ${data.checkpointIndex + 1} reached!`);
  });

  eventBus.on('lap-completed', (data) => {
    console.log(`Lap ${data.lapNumber} completed! Time: ${data.lapTime.toFixed(2)}s`);
  });
}

/**
 * Main animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  // Update game logic
  game.update();

  // Update orbit controls if enabled
  renderer.updateOrbitControls();

  // Update HUD
  updateHUD();

  // Render scene
  renderer.render();
}

/**
 * Update HUD display
 */
function updateHUD() {
  if (!game.player) return;

  const player = game.player;
  const speed = player.speed.toFixed(1);
  const driftStatus = player.isDrifting ? " [DRIFT]" : "";
  const boostStatus = player.boostActive ? " [BOOST]" : "";

  const driftCharge = player.driftCharge;
  const driftMeter = '█'.repeat(Math.floor(driftCharge * 10));

  // Drift charge color indicator
  let driftColor = '';
  if (player.isDrifting) {
    if (driftCharge < 0.5) driftColor = ' (Blue)';
    else if (driftCharge < 1.0) driftColor = ' (Orange)';
    else driftColor = ' (PURPLE - RELEASE!)';
  }

  const driftAngleDisplay = (player.driftAngle * 180 / Math.PI).toFixed(1);
  const cameraMode = chaseCamera ? chaseCamera.currentMode.toUpperCase() : 'CHASE';

  // Track surface info
  let surfaceInfo = '';
  if (game.track) {
    const tile = game.track.getTileAtPosition(player.pos);
    if (tile) {
      const surfaceName = tile.name;
      const onTrack = tile.type === 'road';
      surfaceInfo = `Surface: ${surfaceName}${!onTrack ? ' [OFF-ROAD]' : ''}`;
    } else {
      surfaceInfo = 'Surface: OUT OF BOUNDS';
    }
  }

  // Checkpoint and lap info
  let checkpointInfo = '';
  if (game.track && game.track.checkpointSystem) {
    const cpSystem = game.track.checkpointSystem;
    const progress = cpSystem.getProgress(player.id);
    const lapTimes = cpSystem.getLapTimes(player.id);

    if (progress) {
      const currentCp = progress.checkpoint;
      const totalCps = progress.totalCheckpoints;
      const lapNum = progress.lap;
      const progressPct = progress.percentage.toFixed(0);

      checkpointInfo += `Lap: ${lapNum} | Checkpoint: ${currentCp}/${totalCps} (${progressPct}%)\n`;

      // Current lap time
      if (lapTimes) {
        const kartState = cpSystem.kartStates.get(player.id);
        if (kartState && kartState.lapStartTime > 0) {
          const currentLapTime = (performance.now() - kartState.lapStartTime) / 1000;
          checkpointInfo += `Current Lap: ${currentLapTime.toFixed(2)}s\n`;
        }

        // Best lap time
        if (lapTimes.bestLapTime !== null && lapTimes.bestLapTime > 0) {
          checkpointInfo += `Best Lap: ${lapTimes.bestLapTime.toFixed(2)}s\n`;
        }

        // Last lap time
        if (lapTimes.lastLapTime !== null && lapTimes.lastLapTime > 0) {
          checkpointInfo += `Last Lap: ${lapTimes.lastLapTime.toFixed(2)}s\n`;
        }
      }
    }
  }

  hudEl.textContent =
    `=== ${testTrack.name.toUpperCase()} ===\n` +
    `Speed: ${speed} m/s${driftStatus}${boostStatus}\n` +
    `Position: (${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)})\n` +
    `Heading: ${(player.heading * 180 / Math.PI).toFixed(0)}°\n` +
    `${surfaceInfo}\n` +
    checkpointInfo +
    (player.isDrifting ? `Drift Angle: ${driftAngleDisplay}°\n` : ``) +
    (player.isDrifting ? `Drift: [${driftMeter}]${driftColor}\n` : ``) +
    `Camera: ${cameraMode}\n` +
    `\n` +
    `Controls:\n` +
    `W/↑ - Throttle\n` +
    `S/↓ - Brake\n` +
    `A/← - Steer Left\n` +
    `D/→ - Steer Right\n` +
    `SPACE/SHIFT - Drift\n` +
    `C - Toggle Camera Mode\n` +
    `V - Toggle Debug Vectors\n` +
    `H - Toggle Checkpoints\n` +
    `R - Reset Kart\n` +
    `\n` +
    `Yellow cone = FRONT\n` +
    `Green arrow = Heading\n` +
    `Red arrow = Movement`;
}
