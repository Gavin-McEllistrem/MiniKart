/**
 * RenderConfig - Global rendering mode configuration
 *
 * Controls whether the game runs in:
 * - 'prototype': Fast, untextured, colored boxes (for development)
 * - 'full': Textured models with full visual quality
 */

export class RenderConfig {
  static mode = 'prototype'; // Default to prototype mode

  /**
   * Set rendering mode
   * @param {string} mode - 'prototype' or 'full'
   */
  static setMode(mode) {
    if (mode !== 'prototype' && mode !== 'full') {
      console.warn(`Invalid render mode: ${mode}. Using 'prototype'.`);
      this.mode = 'prototype';
      return;
    }

    this.mode = mode;
    console.log(`Render mode set to: ${this.mode}`);
  }

  /**
   * Check if in prototype mode
   */
  static isPrototype() {
    return this.mode === 'prototype';
  }

  /**
   * Check if in full mode
   */
  static isFull() {
    return this.mode === 'full';
  }

  /**
   * Get mode
   */
  static getMode() {
    return this.mode;
  }
}
