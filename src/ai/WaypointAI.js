import * as THREE from 'three';

/**
 * WaypointAI - AI controller that uses direction field navigation
 *
 * Uses waypoints to generate a direction field (slope field),
 * then navigates by following the field directions
 */

export class WaypointAI {
  constructor(kart, directionField, options = {}) {
    this.kart = kart;
    this.directionField = directionField;

    // AI parameters
    this.targetDistance = options.targetDistance ?? 10;
    this.updateInterval = options.updateInterval ?? 5;
    this.steeringStrength = options.steeringStrength ?? 0.8;
    this.maxSpeed = options.maxSpeed ?? 1.0;
    this.minSpeed = options.minSpeed ?? 0.3;

    this.tickCount = 0;
    this.currentTarget = null;
    this.enabled = true;
  }

  /**
   * Build input values for the kart controller
   */
  getInputs() {
    if (!this.enabled || !this.directionField) {
      return { throttle: 0, brake: 0, steer: 0 };
    }

    this.tickCount++;
    if (this.tickCount % this.updateInterval === 0) {
      this.updateTarget();
    }

    let steering = 0;
    if (this.currentTarget) {
      steering = this.calculateSteering();
    }

    const throttle = this.calculateThrottle(steering);

    return {
      throttle,
      brake: 0,
      steer: steering
    };
  }

  updateTarget() {
    const position = this.kart.mesh.position;
    this.currentTarget = this.directionField.getTargetAhead(position, this.targetDistance);
  }

  calculateSteering() {
    const kartPos = this.kart.mesh.position;
    const targetVector = new THREE.Vector3()
      .subVectors(this.currentTarget, kartPos)
      .normalize();

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.kart.mesh.quaternion);
    forward.y = 0;
    forward.normalize();

    const cross = new THREE.Vector3().crossVectors(forward, targetVector);
    const turnDirection = Math.sign(cross.y);

    const angle = forward.angleTo(targetVector);
    if (angle < 0.05) {
      return 0;
    }

    return -turnDirection * this.steeringStrength;
  }

  calculateThrottle(steering = 0) {
    const baseThrottle = this.minSpeed + (this.maxSpeed - this.minSpeed);
    const steeringFactor = 1.0 - Math.abs(steering) * 0.3;
    return baseThrottle * steeringFactor;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.kart.input.throttle = 0;
      this.kart.input.brake = 0;
      this.kart.input.steering = 0;
    }
  }

  setDirectionField(directionField) {
    this.directionField = directionField;
    this.currentTarget = null;
  }

  getTarget() {
    return this.currentTarget;
  }
}
