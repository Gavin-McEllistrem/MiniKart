/**
 * EventBus - Central event system for decoupling game systems
 *
 * Usage:
 *   eventBus.on('lap-completed', (data) => { ... });
 *   eventBus.emit('lap-completed', { lapTime: 45.2 });
 *   eventBus.off('lap-completed', handler);
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Register an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Handler function
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} eventName - Name of the event
   * @param {Function} callback - Handler function to remove
   */
  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;

    const callbacks = this.listeners.get(eventName);
    const index = callbacks.indexOf(callback);

    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to pass to listeners
   */
  emit(eventName, data) {
    if (!this.listeners.has(eventName)) return;

    // Call each listener with the data
    this.listeners.get(eventName).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for '${eventName}':`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event (or all events if no name provided)
   * @param {string} eventName - Optional event name
   */
  clear(eventName) {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get number of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number} Number of listeners
   */
  listenerCount(eventName) {
    return this.listeners.has(eventName) ? this.listeners.get(eventName).length : 0;
  }

  /**
   * Get all registered event names
   * @returns {string[]} Array of event names
   */
  getEventNames() {
    return Array.from(this.listeners.keys());
  }
}

// Export singleton instance
export const eventBus = new EventBus();
