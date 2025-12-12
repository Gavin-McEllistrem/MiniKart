import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';

/**
 * Game - Core game loop and collision handling
 *
 * Manages:
 * - Game state and entities
 * - Collision detection
 * - Physics updates
 * - Game loop
 */

export class Game {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.clock = new THREE.Clock();
    this._frameCount = 0;

    // Game entities
    this.player = null;
    this.track = null;
    this.camera = null;
    this.inputManager = null;
    this.karts = [];

    // Game state
    this.isRunning = false;
    this.updateCallbacks = [];
    this.winCondition = options.winCondition ?? { lapsToWin: 3, enabled: true };
    this.winner = null;

    // Collision settings
    this.wallSlideSpeedPenalty = options.wallSlideSpeedPenalty ?? 0.7;
    this.wallStopSpeedPenalty = options.wallStopSpeedPenalty ?? 0.5;
  }

  /**
   * Set the player kart
   */
  setPlayer(player) {
    this.player = player;
    this._registerKart(player);
  }

  /**
   * Set the track
   */
  setTrack(track) {
    this.track = track;
  }

  /**
   * Set the camera controller
   */
  setCamera(camera) {
    this.camera = camera;
  }

  /**
   * Set the input manager
   */
  setInputManager(inputManager) {
    this.inputManager = inputManager;
  }

  /**
   * Register a non-player kart (e.g. CPU opponent)
   */
  addKart(kart) {
    this._registerKart(kart);
  }

  /**
   * Internal helper to avoid duplicate registration
   */
  _registerKart(kart) {
    if (!this.karts.includes(kart)) {
      this.karts.push(kart);
    }
  }

  /**
   * Register a callback to run each update
   */
  onUpdate(callback) {
    this.updateCallbacks.push(callback);
  }

  /**
   * Start the game loop
   */
  start() {
    this.isRunning = true;
    this.winner = null;
    this.clock.start();
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Main update loop (call this from requestAnimationFrame)
   */
  update() {
    if (!this.isRunning) return;
    if (this.winner) return;

    const delta = this.clock.getDelta();

    if (this.karts.length === 0) {
      return;
    }

      // Cache player input once per frame
      const playerInputs = (this.player && this.inputManager)
        ? this.inputManager.getState()
        : null;

      for (const kart of this.karts) {
        let inputs = {};

        if (kart.isPlayer) {
        if (!playerInputs) continue;
        inputs = { ...playerInputs };
      } else if (kart.aiDriver) {
        inputs = kart.aiDriver.getInputs({
          kart,
          track: this.track,
          delta
        });
      } else {
        // No control source for this kart
        continue;
      }

      // Apply surface speed multiplier
      if (this.track) {
        inputs.speedMultiplier = this.track.getSpeedMultiplier(kart.pos);
      }

      if (!kart._prevPosCache) {
        kart._prevPosCache = new THREE.Vector3();
      }
      kart._prevPosCache.copy(kart.pos);
      const prevPos = kart._prevPosCache;

      // Update physics
      kart.step(delta, inputs);

      // Handle collisions
      this.handleCollisions(kart, prevPos);

      // Update checkpoint system (throttle for non-player karts)
      if (this.track && this.track.checkpointSystem) {
        if (kart.isPlayer || this._frameCount % 3 === 0) {
          const result = this.track.checkpointSystem.update(kart.id, kart.pos);
          if (result?.type === 'lap') {
            this._checkWin(kart.id, result.lapNumber);
          }
        }
      }

      // Only the player drives the camera
      if (kart.isPlayer && this.camera) {
        this.camera.update(delta, kart);
      }
    }

    this._frameCount = (this._frameCount + 1) >>> 0;

    // Call custom update callbacks
    for (const callback of this.updateCallbacks) {
      callback(delta);
    }
  }

  /**
   * Handle wall collisions and sliding
   */
  handleCollisions(kart, prevPos) {
    if (!this.track) return;

    // Check for wall collision
    if (this.track.isOutOfBounds(kart.pos)) {
      // Hit a wall - try sliding along it
      const slidePos = this.tryWallSlide(prevPos, kart.pos);

      if (slidePos) {
        // Successfully found a slide position
        kart.pos.copy(slidePos);
        kart.mesh.position.copy(slidePos);
        // Reduce speed when hitting wall
        kart.speed *= this.wallSlideSpeedPenalty;
        kart.controller.speed *= this.wallSlideSpeedPenalty;

        eventBus.emit('wall-hit', {
          kartId: kart.id,
          type: 'slide',
          speed: kart.speed
        });
      } else {
        // Can't slide, just stop
        kart.pos.copy(prevPos);
        kart.speed *= this.wallStopSpeedPenalty;
        kart.controller.speed *= this.wallStopSpeedPenalty;
        kart.mesh.position.copy(prevPos);

        eventBus.emit('wall-hit', {
          kartId: kart.id,
          type: 'stop',
          speed: kart.speed
        });
      }
    }
  }

  /**
   * Try to slide along a wall
   * @param {THREE.Vector3} prevPos - Previous valid position
   * @param {THREE.Vector3} newPos - New position (colliding)
   * @returns {THREE.Vector3|null} Slide position or null if can't slide
   */
  tryWallSlide(prevPos, newPos) {
    // Try sliding along X axis only
    const slideX = new THREE.Vector3(newPos.x, prevPos.y, prevPos.z);
    if (!this.track.isOutOfBounds(slideX)) {
      return slideX;
    }

    // Try sliding along Z axis only
    const slideZ = new THREE.Vector3(prevPos.x, prevPos.y, newPos.z);
    if (!this.track.isOutOfBounds(slideZ)) {
      return slideZ;
    }

    // Can't slide in either direction
    return null;
  }

  /**
   * Get current player state
   */
  getPlayerState() {
    if (!this.player) return null;

    return {
      position: this.player.pos.clone(),
      heading: this.player.heading,
      speed: this.player.speed,
      isDrifting: this.player.isDrifting,
      boostActive: this.player.boostActive,
      driftCharge: this.player.driftCharge
    };
  }

  /**
   * Reset player to start position
   */
  resetPlayer() {
    if (!this.player || !this.track) return;

    const startTransform = this.track.getStartTransform();
    this.player.reset(startTransform.position, startTransform.heading);

    // Reset checkpoint progress
    if (this.track.checkpointSystem) {
      this.track.checkpointSystem.resetKart(this.player.id);
    }

    if (this.camera) {
      this.camera.reset(this.player);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    this.updateCallbacks = [];
    this.karts = [];
    this.player = null;
  }

  _checkWin(kartId, lapNumber) {
    if (!this.winCondition?.enabled) return;
    if (this.winner) return;

    const lapsToWin = this.winCondition.lapsToWin ?? 3;
    if (lapNumber >= lapsToWin) {
      this.winner = kartId;
      this.isRunning = false;
      eventBus.emit('race-won', { kartId });
    }
  }
}
