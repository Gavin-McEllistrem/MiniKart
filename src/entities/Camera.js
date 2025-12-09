import * as THREE from 'three';

/**
 * Camera - Chase camera system for kart racing
 *
 * Provides smooth camera following with multiple modes
 */

export class Camera {
  constructor(camera, options = {}) {
    this.camera = camera;

    // Camera modes
    this.modes = {
      CHASE: 'chase',      // Behind kart
      ORBIT: 'orbit',      // Free orbit (for testing)
      FIRST_PERSON: 'fps', // Future: cockpit view
      CINEMATIC: 'cinematic' // Future: smooth cinematic
    };

    this.currentMode = this.modes.CHASE;

    // Chase camera settings
    this.distance = options.distance ?? 12; // Distance behind kart
    this.height = options.height ?? 6; // Height above kart
    this.lookAhead = options.lookAhead ?? 3; // How far ahead to look
    this.smoothSpeed = options.smoothSpeed ?? 5.0; // Camera lerp speed
    this.rotationSpeed = options.rotationSpeed ?? 3.0; // Rotation lerp speed

    // Current smoothed values
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();

    // Helper vectors
    this._targetPosition = new THREE.Vector3();
    this._targetLookAt = new THREE.Vector3();
  }

  /**
   * Set camera mode
   */
  setMode(mode) {
    if (Object.values(this.modes).includes(mode)) {
      this.currentMode = mode;
    }
  }

  /**
   * Update chase camera
   */
  updateChase(delta, kart) {
    const kartPos = kart.pos;
    const kartHeading = kart.heading;

    // Calculate target position (behind and above kart)
    const behindOffset = new THREE.Vector3(
      -Math.sin(kartHeading) * this.distance,
      this.height,
      -Math.cos(kartHeading) * this.distance
    );

    this._targetPosition.copy(kartPos).add(behindOffset);

    // Calculate look-at target (ahead of kart)
    const lookAheadOffset = new THREE.Vector3(
      Math.sin(kartHeading) * this.lookAhead,
      1.5, // Look slightly above ground
      Math.cos(kartHeading) * this.lookAhead
    );

    this._targetLookAt.copy(kartPos).add(lookAheadOffset);

    // Smooth camera position
    this.currentPosition.lerp(this._targetPosition, this.smoothSpeed * delta);

    // Smooth look-at
    this.currentLookAt.lerp(this._targetLookAt, this.rotationSpeed * delta);

    // Apply to camera
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Main update - delegates to current mode
   */
  update(delta, kart) {
    if (this.currentMode === this.modes.CHASE) {
      this.updateChase(delta, kart);
    }
    // Other modes handled by external controllers (orbit, etc.)
  }

  /**
   * Reset camera to initial position
   */
  reset(kart) {
    const kartPos = kart.pos;
    const kartHeading = kart.heading;

    // Set initial position immediately (no lerp)
    const behindOffset = new THREE.Vector3(
      -Math.sin(kartHeading) * this.distance,
      this.height,
      -Math.cos(kartHeading) * this.distance
    );

    this.currentPosition.copy(kartPos).add(behindOffset);
    this._targetPosition.copy(this.currentPosition);

    const lookAheadOffset = new THREE.Vector3(
      Math.sin(kartHeading) * this.lookAhead,
      1.5,
      Math.cos(kartHeading) * this.lookAhead
    );

    this.currentLookAt.copy(kartPos).add(lookAheadOffset);
    this._targetLookAt.copy(this.currentLookAt);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
}
