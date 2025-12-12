import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RenderConfig } from '../config/RenderConfig.js';

/**
 * TextureManager - Centralized texture and model loading and caching
 *
 * Features:
 * - Lazy loading (only load when requested)
 * - Caching (load once, reuse many times)
 * - Mode-aware (returns null in prototype mode)
 * - Error handling with fallbacks
 * - GLTF model loading support
 */

export class TextureManager {
  static textureCache = new Map();
  static modelCache = new Map();
  static loader = new THREE.TextureLoader();
  static gltfLoader = new GLTFLoader();
  static loadingPromises = new Map();
  static modelLoadingPromises = new Map();

  /**
   * Load a texture (returns immediately from cache if available)
   * @param {string} path - Path to texture file
   * @param {object} options - Texture options (repeat, wrapS, wrapT, etc.)
   * @returns {THREE.Texture|null} Texture or null if in prototype mode
   */
  static loadTexture(path, options = {}) {
    // In prototype mode, return null (use colored materials instead)
    if (RenderConfig.isPrototype()) {
      return null;
    }

    // Check cache first
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path);
    }

    // Start loading texture
    const texture = this.loader.load(
      path,
      (tex) => {
        if (options.repeat) {
          tex.repeat.set(options.repeat.x ?? 1, options.repeat.y ?? 1);
        }
        if (options.wrapS) {
          tex.wrapS = options.wrapS;
        }
        if (options.wrapT) {
          tex.wrapT = options.wrapT;
        }
        if (options.anisotropy !== undefined) {
          tex.anisotropy = options.anisotropy;
        }

        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 16;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error(`Failed to load texture: ${path}`, error);
      }
    );

    this.textureCache.set(path, texture);
    return texture;
  }

  /**
   * Load texture asynchronously (returns Promise)
   * @param {string} path - Path to texture file
   * @param {object} options - Texture options
   * @returns {Promise<THREE.Texture|null>}
   */
  static async loadTextureAsync(path, options = {}) {
    if (RenderConfig.isPrototype()) {
      return Promise.resolve(null);
    }

    if (this.textureCache.has(path)) {
      return Promise.resolve(this.textureCache.get(path));
    }

    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path);
    }

    const promise = new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (texture) => {
          if (options.repeat) {
            texture.repeat.set(options.repeat.x ?? 1, options.repeat.y ?? 1);
          }
          if (options.wrapS) {
            texture.wrapS = options.wrapS;
          }
          if (options.wrapT) {
            texture.wrapT = options.wrapT;
          }
          if (options.anisotropy !== undefined) {
            texture.anisotropy = options.anisotropy;
          }

          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 16;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;

          this.textureCache.set(path, texture);
          this.loadingPromises.delete(path);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error(`Failed to load texture: ${path}`, error);
          this.loadingPromises.delete(path);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(path, promise);
    return promise;
  }

  /**
   * Preload multiple textures
   */
  static async preloadTextures(paths) {
    if (RenderConfig.isPrototype()) {
      return Promise.resolve();
    }
    const promises = paths.map(path => this.loadTextureAsync(path));
    await Promise.all(promises);
  }

  /**
   * Clear texture cache
   */
  static clearCache() {
    for (const texture of this.textureCache.values()) {
      if (texture) {
        texture.dispose();
      }
    }
    this.textureCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cached texture (without loading)
   */
  static getCached(path) {
    return this.textureCache.get(path) || null;
  }

  /**
   * Load a GLTF model asynchronously
   * @param {string} path - Path to GLTF/GLB file
   * @param {object} options - Model options (scale, position, rotation, etc.)
   * @returns {Promise<THREE.Group|null>} Promise resolving to cloned model group
   */
  static async loadModel(path, options = {}) {
    if (RenderConfig.isPrototype()) {
      console.log(`[TextureManager] Prototype mode - not loading model: ${path}`);
      return Promise.resolve(null);
    }

    if (this.modelCache.has(path)) {
      const cachedModel = this.modelCache.get(path);
      return Promise.resolve(cachedModel.clone());
    }

    if (this.modelLoadingPromises.has(path)) {
      const cachedModel = await this.modelLoadingPromises.get(path);
      return cachedModel.clone();
    }

    const promise = new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          if (options.castShadow !== undefined) {
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = options.castShadow;
                child.receiveShadow = options.receiveShadow ?? false;
              }
            });
          }

          this.modelCache.set(path, model);
          this.modelLoadingPromises.delete(path);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.error(`Failed to load GLTF model: ${path}`, error);
          this.modelLoadingPromises.delete(path);
          reject(error);
        }
      );
    });

    this.modelLoadingPromises.set(path, promise);
    return promise;
  }

  /**
   * Preload multiple GLTF models
   */
  static async preloadModels(paths) {
    if (RenderConfig.isPrototype()) {
      return Promise.resolve();
    }

    const promises = paths.map(path => this.loadModel(path));
    await Promise.all(promises);
  }

  /**
   * Get cached model (without loading)
   */
  static getCachedModel(path) {
    const model = this.modelCache.get(path);
    return model ? model.clone() : null;
  }

  /**
   * Clear all caches (textures and models)
   */
  static clearAllCaches() {
    for (const texture of this.textureCache.values()) {
      if (texture) {
        texture.dispose();
      }
    }

    for (const model of this.modelCache.values()) {
      if (model) {
        model.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    }

    this.textureCache.clear();
    this.modelCache.clear();
    this.loadingPromises.clear();
    this.modelLoadingPromises.clear();
  }
}
