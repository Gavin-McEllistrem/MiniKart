import * as THREE from 'three';

/**
 * VehicleController - Physics-based vehicle control system
 *
 * Provides realistic arcade-style physics with:
 * - Velocity-based movement (not just speed * heading)
 * - Smooth steering with wheel angle interpolation
 * - Grip vs drift mechanics
 * - Weight transfer and momentum
 */

export class VehicleController {
  constructor(options = {}) {
    // Current state
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.angularVelocity = 0;
    this.wheelAngle = 0; // Current steering angle (-1 to 1 normalized)

    // Tunable parameters
    this.enginePower = options.enginePower ?? 2500; // Increased for faster acceleration
    this.brakePower = options.brakePower ?? 3000;
    this.maxSpeed = options.maxSpeed ?? 40;
    this.mass = options.mass ?? 150;

    // Steering
    this.steeringSpeed = options.steeringSpeed ?? 4.0; // Faster steering response
    this.steeringLimit = options.steeringLimit ?? 0.7; // Sharper turns
    this.steeringReturnSpeed = options.steeringReturnSpeed ?? 6.0;

    // Grip/Drift
    this.maxGripFactor = options.maxGripFactor ?? 25.0; // Much higher grip (less slippery)
    this.driftThreshold = options.driftThreshold ?? 0.85; // Harder to drift
    this.driftGripFactor = options.driftGripFactor ?? 8.0; // More grip even while drifting

    // Friction
    this.rollingResistance = options.rollingResistance ?? 2.5; // Higher friction to stop sliding
    this.airDrag = options.airDrag ?? 0.05; // More drag

    // Boost
    this.boostTimer = 0;
    this.boostMultiplier = options.boostMultiplier ?? 1.5;
    this.boostDuration = options.boostDuration ?? 2.0;

    // Helpers
    this._forwardDir = new THREE.Vector3();
    this._lateralDir = new THREE.Vector3();
    this._forwardForce = new THREE.Vector3();
    this._lateralForce = new THREE.Vector3();
  }

  /**
   * Apply a boost to the vehicle
   */
  giveBoost() {
    this.boostTimer = this.boostDuration;
  }

  /**
   * Update vehicle physics
   * @param {number} delta - Time step
   * @param {THREE.Vector3} position - Current position (will be modified)
   * @param {number} heading - Current heading in radians (will be modified)
   * @param {Object} inputs - Input state { throttle, brake, steer }
   * @returns {Object} Updated { position, heading, speed }
   */
  update(delta, position, heading, inputs) {
    // Extract inputs (all normalized -1 to 1 or 0 to 1)
    const throttle = inputs.throttle ?? 0; // 0 to 1
    const brake = inputs.brake ?? 0; // 0 to 1
    const steer = inputs.steer ?? 0; // -1 to 1 (left to right)

    // Update steering angle (smooth interpolation)
    const targetWheelAngle = steer;
    if (Math.abs(targetWheelAngle) > 0.01) {
      // Steering input active
      this.wheelAngle = THREE.MathUtils.lerp(
        this.wheelAngle,
        targetWheelAngle,
        this.steeringSpeed * delta
      );
    } else {
      // Return to center
      this.wheelAngle = THREE.MathUtils.lerp(
        this.wheelAngle,
        0,
        this.steeringReturnSpeed * delta
      );
    }

    // Clamp wheel angle
    this.wheelAngle = THREE.MathUtils.clamp(this.wheelAngle, -1, 1);

    // Calculate forward and lateral directions
    // Forward: direction kart is facing
    this._forwardDir.set(Math.sin(heading), 0, Math.cos(heading));
    // Lateral: perpendicular to forward (right is positive)
    this._lateralDir.set(Math.cos(heading), 0, -Math.sin(heading));

    // --- Forward force (throttle/brake) ---
    let forwardForceMag = 0;

    if (throttle > 0) {
      forwardForceMag = this.enginePower * throttle;

      // Boost multiplier
      if (this.boostTimer > 0) {
        forwardForceMag *= this.boostMultiplier;
        this.boostTimer -= delta;
      }
    } else if (brake > 0) {
      forwardForceMag = -this.brakePower * brake;
    }

    this._forwardForce.copy(this._forwardDir).multiplyScalar(forwardForceMag);

    // --- Lateral force (grip/drift) ---
    // Calculate velocity in local frame
    const forwardVel = this.velocity.dot(this._forwardDir);
    const lateralVel = this.velocity.dot(this._lateralDir);

    // Current speed
    const speed = this.velocity.length();
    const speedRatio = speed / this.maxSpeed;

    // Determine grip factor (high speed + sharp turn = drift)
    const turnSharpness = Math.abs(this.wheelAngle);
    const isDrifting = speedRatio > this.driftThreshold && turnSharpness > 0.3;

    const gripFactor = isDrifting ? this.driftGripFactor : this.maxGripFactor;

    // Lateral force opposes lateral velocity (provides grip)
    const lateralForceMag = -lateralVel * gripFactor * this.mass;
    this._lateralForce.copy(this._lateralDir).multiplyScalar(lateralForceMag);

    // --- Apply forces ---
    const totalForce = new THREE.Vector3()
      .copy(this._forwardForce)
      .add(this._lateralForce);

    // F = ma → a = F/m
    const acceleration = totalForce.divideScalar(this.mass);

    // Update velocity
    this.velocity.add(acceleration.multiplyScalar(delta));

    // --- Apply friction/drag ---
    // Rolling resistance (constant)
    const frictionMag = this.rollingResistance * delta;
    if (this.velocity.length() > 0.01) {
      const frictionDir = this.velocity.clone().normalize().multiplyScalar(-frictionMag);
      this.velocity.add(frictionDir);
    } else {
      this.velocity.set(0, 0, 0); // Stop if very slow
    }

    // Air drag (speed-squared)
    const dragMag = this.airDrag * speed * speed * delta;
    if (speed > 0.01) {
      const dragDir = this.velocity.clone().normalize().multiplyScalar(-dragMag);
      this.velocity.add(dragDir);
    }

    // Clamp to max speed (unless boosting)
    if (this.boostTimer <= 0 && this.velocity.length() > this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }

    // --- Angular velocity (turning) ---
    // Only turn if moving
    if (Math.abs(forwardVel) > 1.0) {
      // Turn rate proportional to speed and wheel angle
      const actualSteeringLimit = this.steeringLimit;
      const steerAngle = this.wheelAngle * actualSteeringLimit;

      // Calculate angular velocity based on wheel angle and speed
      // Higher speed = tighter turn radius needed = more rotation
      this.angularVelocity = (forwardVel / 5.0) * steerAngle;
    } else {
      this.angularVelocity = 0;
    }

    // Update heading
    heading -= this.angularVelocity * delta;

    // --- Update position ---
    const deltaPos = this.velocity.clone().multiplyScalar(delta);
    position.add(deltaPos);

    // Return updated state
    return {
      position,
      heading,
      speed: this.velocity.length(),
      isDrifting,
      wheelAngle: this.wheelAngle,
      boostActive: this.boostTimer > 0
    };
  }

  /**
   * Get current speed
   * @returns {number} Speed magnitude
   */
  getSpeed() {
    return this.velocity.length();
  }

  /**
   * Reset vehicle state
   */
  reset() {
    this.velocity.set(0, 0, 0);
    this.angularVelocity = 0;
    this.wheelAngle = 0;
    this.boostTimer = 0;
  }

  /**
   * Set velocity directly (for initialization)
   * @param {THREE.Vector3} vel - Velocity vector
   */
  setVelocity(vel) {
    this.velocity.copy(vel);
  }
}
