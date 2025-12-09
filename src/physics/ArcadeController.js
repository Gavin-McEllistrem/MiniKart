import * as THREE from 'three';

/**
 * ArcadeController - Simple Mario Kart style controls
 *
 * - Kart always moves in direction it's facing
 * - No physics slip/slide (unless drifting)
 * - Drift is a deliberate mechanic (hold brake + steer)
 * - Speed is a simple scalar value
 */

export class ArcadeController {
  constructor(options = {}) {
    // Simple speed value
    this.speed = 0;

    // Parameters
    this.acceleration = options.acceleration ?? 30; // How fast to speed up
    this.brakeForce = options.brakeForce ?? 80; // How fast to slow down
    this.maxSpeed = options.maxSpeed ?? 40;
    this.reverseSpeed = options.reverseSpeed ?? 20;
    this.friction = options.friction ?? 25; // Natural slowdown

    // Turning
    this.turnSpeed = options.turnSpeed ?? 1.25; // Radians per second at full speed (reduced from 1.8)
    this.minTurnSpeed = options.minTurnSpeed ?? 0.4; // Turn speed when stopped (reduced from 0.6)

    // Drift mechanics
    this.isDrifting = false;
    this.driftDirection = 0; // -1 left, 1 right (locked when drifting)
    this.driftTurnPenalty = options.driftTurnPenalty ?? 0.7; // Turn SLOWER while drifting (60% of normal)
    this.driftOutwardPush = options.driftOutwardPush ?? 0.5; // Push outward during drift
    this.driftAngleControl = options.driftAngleControl ?? 0.3; // How much counter-steer affects drift angle
    this.driftSpeedBonus = options.driftSpeedBonus ?? 1.02; // Slight speed bonus (encourage drifting)
    this.driftCharge = 0; // Build up for boost
    this.driftChargeRate = options.driftChargeRate ?? 1.0;
    this.smoothedOutwardPush = 0; // Smoothed outward push for movement

    // Boost
    this.boostTimer = 0;
    this.boostSpeed = options.boostSpeed ?? 50; // Increased from 45
    this.boostDuration = options.boostDuration ?? 2.0; // Increased from 1.5
  }

  /**
   * Give a speed boost
   */
  giveBoost() {
    this.boostTimer = this.boostDuration;
  }

  /**
   * Update arcade controls
   * @param {number} delta - Time step
   * @param {THREE.Vector3} position - Current position (will be modified)
   * @param {number} heading - Current heading in radians (will be modified)
   * @param {Object} inputs - { throttle, brake, steer, drift, speedMultiplier }
   * @returns {Object} Updated state
   */
  update(delta, position, heading, inputs) {
    const throttle = inputs.throttle ?? 0; // 0 to 1
    const brake = inputs.brake ?? 0; // 0 to 1
    const steer = inputs.steer ?? 0; // -1 to 1
    const drift = inputs.drift ?? false; // boolean
    const speedMultiplier = inputs.speedMultiplier ?? 1.0; // Surface speed multiplier

    // --- Speed Control ---
    let targetSpeed = this.maxSpeed * speedMultiplier; // Apply surface speed multiplier

    // Boost handling with smooth transition
    if (this.boostTimer > 0) {
      targetSpeed = this.boostSpeed * speedMultiplier; // Boost also affected by surface
      this.boostTimer -= delta;
    } else if (this.speed > this.maxSpeed * speedMultiplier) {
      // Smoothly decay back to max speed after boost ends or when hitting off-road
      this.speed = THREE.MathUtils.lerp(this.speed, this.maxSpeed * speedMultiplier, 2.0 * delta);
    }

    // Accelerate or brake
    if (throttle > 0) {
      this.speed += this.acceleration * throttle * delta;
    } else if (brake > 0) {
      this.speed -= this.brakeForce * brake * delta;
    } else {
      // Natural friction when no input
      if (this.speed > 0) {
        this.speed -= this.friction * delta;
        if (this.speed < 0) this.speed = 0;
      } else if (this.speed < 0) {
        this.speed += this.friction * delta;
        if (this.speed > 0) this.speed = 0;
      }
    }

    // Clamp speed (but allow exceeding max during boost transition)
    // Use targetSpeed which already includes speedMultiplier
    const maxAllowedSpeed = this.boostTimer > 0 ? targetSpeed : targetSpeed + 5; // Small buffer for smooth transition
    this.speed = THREE.MathUtils.clamp(this.speed, -this.reverseSpeed, maxAllowedSpeed);

    // --- Drift Mechanics ---
    const isMoving = Math.abs(this.speed) > 2;
    const wantsToDrift = drift && isMoving && Math.abs(steer) > 0.3;

    if (wantsToDrift && !this.isDrifting) {
      // Start drifting
      this.isDrifting = true;
      this.driftDirection = Math.sign(steer);
      this.driftCharge = 0;
      this.driftAngle = 0; // Visual drift angle
    } else if (!wantsToDrift && this.isDrifting) {
      // End drift, release boost if charged
      this.isDrifting = false;

      if (this.driftCharge >= 1.0) {
        // Give mini boost
        this.giveBoost();
      }

      this.driftCharge = 0;
      this.driftDirection = 0;
      this.driftAngle = 0;
    }

    if (this.isDrifting) {
      // Build drift charge
      this.driftCharge += this.driftChargeRate * delta;

      // Slight speed bonus during drift (reward skilled drifting)
      const driftTargetSpeed = this.maxSpeed * this.driftSpeedBonus;
      if (this.speed < driftTargetSpeed) {
        this.speed += this.acceleration * 0.2 * delta; // Gentle boost
      }

      // Build up drift angle (kart angles OUTWARD from turn significantly)
      const targetDriftAngle = this.driftDirection * 0.8; // ~45 degrees - much wider!
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetDriftAngle, 2.5 * delta);
    } else {
      // Return drift angle to zero when not drifting
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle || 0, 0, 8.0 * delta);
    }

    // --- Turning ---
    if (isMoving && Math.abs(steer) > 0.05) {
      // Calculate turn rate based on speed
      const speedRatio = Math.abs(this.speed) / this.maxSpeed;
      const turnRate = THREE.MathUtils.lerp(
        this.minTurnSpeed,
        this.turnSpeed,
        speedRatio
      );

      // PENALTY: Turn SLOWER while drifting (wider arc)
      const finalTurnRate = this.isDrifting
        ? turnRate * this.driftTurnPenalty
        : turnRate;

      // Apply turning (negative because of coordinate system)
      heading -= steer * finalTurnRate * delta;
    }

    // --- Movement ---
    const moveDistance = this.speed * delta;

    // Smooth outward push transition
    const targetPush = this.isDrifting ? (this.driftDirection * this.driftOutwardPush) : 0;
    this.smoothedOutwardPush = THREE.MathUtils.lerp(
      this.smoothedOutwardPush,
      targetPush,
      5.0 * delta // Smooth transition speed
    );

    // Calculate movement direction with smoothed outward push
    const moveHeading = heading + this.smoothedOutwardPush;

    // Calculate movement direction
    const forwardX = Math.sin(moveHeading);
    const forwardZ = Math.cos(moveHeading);

    // Update position
    position.x += forwardX * moveDistance;
    position.z += forwardZ * moveDistance;

    // --- Return state ---
    return {
      position,
      heading,
      speed: this.speed,
      isDrifting: this.isDrifting,
      boostActive: this.boostTimer > 0,
      driftCharge: this.driftCharge,
      driftAngle: this.driftAngle || 0,
      smoothedOutwardPush: this.smoothedOutwardPush
    };
  }

  /**
   * Reset controller state
   */
  reset() {
    this.speed = 0;
    this.isDrifting = false;
    this.driftDirection = 0;
    this.driftCharge = 0;
    this.boostTimer = 0;
    this.smoothedOutwardPush = 0;
  }

  /**
   * Get current speed
   */
  getSpeed() {
    return this.speed;
  }
}
