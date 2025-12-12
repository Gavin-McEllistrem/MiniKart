import * as THREE from 'three';

/**
 * SkyboxManager - Manages skybox loading and rendering
 *
 * Features:
 * - Load skyboxes from cubemap textures (6 images) or equirectangular panoramas
 * - Predefined skybox presets
 * - Per-track skybox configuration
 */

export class SkyboxManager {
  static skyboxCache = new Map();
  static loader = new THREE.CubeTextureLoader();

  /**
   * Predefined skybox configurations
   */
  static SKYBOXES = {
    'clear_sky': {
      name: 'Clear Sky',
      type: 'cubemap',
      path: 'assets/skyboxes/clear_sky/',
      files: ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']
    },
    'sunset': {
      name: 'Sunset',
      type: 'cubemap',
      path: 'assets/skyboxes/sunset/',
      files: ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']
    },
    'night': {
      name: 'Night',
      type: 'cubemap',
      path: 'assets/skyboxes/night/',
      files: ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']
    },
    'cloudy': {
      name: 'Cloudy',
      type: 'cubemap',
      path: 'assets/skyboxes/cloudy/',
      files: ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg']
    },
    'default': {
      name: 'Default Gradient',
      type: 'gradient',
      topColor: 0x87CEEB,
      bottomColor: 0xFFFFFF
    }
  };

  /**
   * Load and apply a skybox to the scene
   * @param {THREE.Scene} scene - The scene to apply skybox to
   * @param {string} skyboxId - ID of the skybox preset or custom path
   * @returns {Promise<void>}
   */
  static async loadSkybox(scene, skyboxId = 'default') {
    const skyboxConfig = this.SKYBOXES[skyboxId];

    if (!skyboxConfig) {
      console.warn(`Skybox '${skyboxId}' not found, using default`);
      return this.loadSkybox(scene, 'default');
    }

    if (this.skyboxCache.has(skyboxId)) {
      scene.background = this.skyboxCache.get(skyboxId);
      return;
    }

    if (skyboxConfig.type === 'gradient') {
      const skybox = this.createGradientSkybox(
        skyboxConfig.topColor,
        skyboxConfig.bottomColor
      );
      this.skyboxCache.set(skyboxId, skybox);
      scene.background = skybox;
    } else if (skyboxConfig.type === 'cubemap') {
      try {
        const urls = skyboxConfig.files.map(file => skyboxConfig.path + file);
        const texture = await this.loadCubemap(urls);
        this.skyboxCache.set(skyboxId, texture);
        scene.background = texture;
      } catch (error) {
        console.error(`Failed to load skybox '${skyboxId}':`, error);
        if (skyboxId !== 'default') {
          return this.loadSkybox(scene, 'default');
        }
      }
    }
  }

  /**
   * Load a cubemap texture
   */
  static loadCubemap(urls) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        urls,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * Create a gradient skybox (simple fallback)
   */
  static createGradientSkybox(topColor, bottomColor) {
    return new THREE.Color(topColor ?? bottomColor ?? 0x87CEEB);
  }

  /**
   * Remove skybox from scene
   */
  static removeSkybox(scene) {
    scene.background = null;
  }

  /**
   * Get list of available skybox IDs
   */
  static getAvailableSkyboxes() {
    return Object.keys(this.SKYBOXES);
  }

  /**
   * Get skybox configuration
   */
  static getSkyboxConfig(skyboxId) {
    return this.SKYBOXES[skyboxId] || null;
  }

  /**
   * Clear skybox cache
   */
  static clearCache() {
    for (const texture of this.skyboxCache.values()) {
      if (texture && texture.dispose) {
        texture.dispose();
      }
    }
    this.skyboxCache.clear();
  }
}
