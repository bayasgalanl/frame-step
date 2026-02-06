/**
 * LRU Cache for storing extracted video frames
 * Prefetches adjacent frames for faster stepping
 */
class FrameCache {
  constructor(maxSize = 30) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Get a frame from cache
   * @param {number} frameNumber 
   * @returns {Object|null} Frame data or null if not cached
   */
  get(frameNumber) {
    if (!this.cache.has(frameNumber)) {
      return null;
    }
    
    // Move to end (most recently used)
    const value = this.cache.get(frameNumber);
    this.cache.delete(frameNumber);
    this.cache.set(frameNumber, value);
    
    return value;
  }

  /**
   * Store a frame in cache
   * @param {number} frameNumber 
   * @param {Object} frameData 
   */
  set(frameNumber, frameData) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(frameNumber, frameData);
  }

  /**
   * Check if frame is in cache
   * @param {number} frameNumber 
   * @returns {boolean}
   */
  has(frameNumber) {
    return this.cache.has(frameNumber);
  }

  /**
   * Clear all cached frames
   */
  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      frames: Array.from(this.cache.keys())
    };
  }

  /**
   * Prefetch frames around current position
   * @param {number} currentFrame 
   * @param {number} totalFrames 
   * @param {Function} extractFn - Async function to extract a frame
   * @param {number} radius - Number of frames to prefetch in each direction
   */
  async prefetch(currentFrame, totalFrames, extractFn, radius = 3) {
    const framesToFetch = [];
    
    // Prioritize forward frames, then backward
    for (let i = 1; i <= radius; i++) {
      const nextFrame = currentFrame + i;
      const prevFrame = currentFrame - i;
      
      if (nextFrame < totalFrames && !this.has(nextFrame) && !this.pendingRequests.has(nextFrame)) {
        framesToFetch.push(nextFrame);
      }
      if (prevFrame >= 0 && !this.has(prevFrame) && !this.pendingRequests.has(prevFrame)) {
        framesToFetch.push(prevFrame);
      }
    }

    // Fetch frames in parallel but don't await - let them complete in background
    framesToFetch.forEach(frameNum => {
      const promise = extractFn(frameNum)
        .then(data => {
          this.set(frameNum, data);
          this.pendingRequests.delete(frameNum);
        })
        .catch(err => {
          console.warn(`Failed to prefetch frame ${frameNum}:`, err);
          this.pendingRequests.delete(frameNum);
        });
      
      this.pendingRequests.set(frameNum, promise);
    });
  }

  /**
   * Wait for a specific frame if it's being fetched
   * @param {number} frameNumber 
   * @returns {Promise|null}
   */
  getPendingRequest(frameNumber) {
    return this.pendingRequests.get(frameNumber) || null;
  }
}

// Export for use in other modules
window.FrameCache = FrameCache;
