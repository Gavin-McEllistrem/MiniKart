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

    // Game entities
    this.player = null;
    this.track = null;
    this.camera = null;
    this.inputManager = null;

    // Game state
    this.isRunning = false;
    this.updateCallbacks = [];

    // Collision settings
    this.wallSlideSpeedPenalty = options.wallSlideSpeedPenalty ?? 0.7;
    this.wallStopSpeedPenalty = options.wallStopSpeedPenalty ?? 0.5;
  }

  /**
   * Set the player kart
   */
  setPlayer(player) {
    this.player = player;
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

    const delta = this.clock.getDelta();

    if (this.player && this.inputManager) {
      // Get input state
      const inputs = this.inputManager.getState();

      // Check track surface for speed multiplier
      if (this.track) {
        const speedMultiplier = this.track.getSpeedMultiplier(this.player.pos);
        inputs.speedMultiplier = speedMultiplier;
      }

      // Store previous position for collision handling
      const prevPos = this.player.pos.clone();

      // Update player physics
      this.player.step(delta, inputs);

      // Handle collisions
      this.handleCollisions(prevPos);

      // Update camera
      if (this.camera) {
        this.camera.update(delta, this.player);
      }
    }

    // Call custom update callbacks
    for (const callback of this.updateCallbacks) {
      callback(delta);
    }
  }

  /**
   * Handle wall collisions and sliding
   */
  handleCollisions(prevPos) {
    if (!this.track) return;

    // Check for wall collision
    if (this.track.isOutOfBounds(this.player.pos)) {
      // Hit a wall - try sliding along it
      const slidePos = this.tryWallSlide(prevPos, this.player.pos);

      if (slidePos) {
        // Successfully found a slide position
        this.player.pos.copy(slidePos);
        this.player.mesh.position.copy(slidePos);
        // Reduce speed when hitting wall
        this.player.speed *= this.wallSlideSpeedPenalty;
        this.player.controller.speed *= this.wallSlideSpeedPenalty;

        eventBus.emit('wall-hit', {
          kartId: this.player.id,
          type: 'slide',
          speed: this.player.speed
        });
      } else {
        // Can't slide, just stop
        this.player.pos.copy(prevPos);
        this.player.speed *= this.wallStopSpeedPenalty;
        this.player.controller.speed *= this.wallStopSpeedPenalty;
        this.player.mesh.position.copy(prevPos);

        eventBus.emit('wall-hit', {
          kartId: this.player.id,
          type: 'stop',
          speed: this.player.speed
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
  }
}
