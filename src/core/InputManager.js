/**
 * InputManager - Unified input handling for keyboard, touch, and gamepad
 *
 * Provides normalized input values (-1 to 1 for steering, 0 to 1 for throttle/brake)
 */

export class InputManager {
  constructor() {
    // Raw input state
    this.keys = {};
    this.touch = { up: false, down: false, left: false, right: false };
    this.gamepad = null;

    // Normalized output
    this.state = {
      throttle: 0,  // 0 to 1
      brake: 0,     // 0 to 1
      steer: 0      // -1 to 1 (left to right)
    };

    this._setupKeyboard();
    this._setupTouch();
  }

  /**
   * Setup keyboard event listeners
   */
  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  /**
   * Setup touch controls
   */
  _setupTouch() {
    const buttons = document.querySelectorAll('.ctrl-btn');

    buttons.forEach((btn) => {
      const action = btn.dataset.action;

      const setAction = (val) => {
        if (action in this.touch) {
          this.touch[action] = val;
        }
      };

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setAction(true);
      });

      btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        setAction(false);
      });

      btn.addEventListener('pointerleave', () => setAction(false));
    });
  }

  /**
   * Update input state and return normalized values
   * @returns {Object} { throttle, brake, steer, drift }
   */
  getState() {
    // Check throttle (W, Up arrow, or touch up)
    const throttlePressed =
      this.keys['w'] ||
      this.keys['arrowup'] ||
      this.touch.up;

    // Check brake (S, Down arrow, or touch down)
    const brakePressed =
      this.keys['s'] ||
      this.keys['arrowdown'] ||
      this.touch.down;

    // Check steering
    const leftPressed =
      this.keys['a'] ||
      this.keys['arrowleft'] ||
      this.touch.left;

    const rightPressed =
      this.keys['d'] ||
      this.keys['arrowright'] ||
      this.touch.right;

    // Check drift (Space or Shift)
    const driftPressed =
      this.keys[' '] ||
      this.keys['shift'];

    // Normalize inputs
    this.state.throttle = throttlePressed ? 1.0 : 0.0;
    this.state.brake = brakePressed ? 1.0 : 0.0;
    this.state.drift = driftPressed;

    // Steering: -1 (left) to 1 (right)
    if (leftPressed && !rightPressed) {
      this.state.steer = -1.0;
    } else if (rightPressed && !leftPressed) {
      this.state.steer = 1.0;
    } else {
      this.state.steer = 0.0;
    }

    // TODO: Add gamepad support
    // this._updateGamepad();

    return { ...this.state };
  }

  /**
   * Check if a specific key is pressed
   * @param {string} key - Key name (lowercase)
   * @returns {boolean}
   */
  isKeyPressed(key) {
    return this.keys[key.toLowerCase()] || false;
  }

  /**
   * Reset all input state
   */
  reset() {
    this.keys = {};
    this.touch = { up: false, down: false, left: false, right: false };
    this.state = { throttle: 0, brake: 0, steer: 0 };
  }

  /**
   * Future: Gamepad support
   */
  _updateGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (const gp of gamepads) {
      if (gp && gp.connected) {
        // Left stick for steering
        const stickX = gp.axes[0]; // -1 to 1
        if (Math.abs(stickX) > 0.1) {
          this.state.steer = stickX;
        }

        // Triggers for throttle/brake
        // RT (right trigger) = throttle
        // LT (left trigger) = brake
        const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
        const lt = gp.buttons[6] ? gp.buttons[6].value : 0;

        this.state.throttle = Math.max(this.state.throttle, rt);
        this.state.brake = Math.max(this.state.brake, lt);

        break; // Use first connected gamepad
      }
    }
  }
}
