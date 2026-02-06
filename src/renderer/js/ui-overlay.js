/**
 * UI Overlay Manager
 * Handles frame number and timestamp display
 */
class UIOverlay {
  constructor() {
    this.elements = {
      overlay: document.getElementById('frameOverlay'),
      frameNumber: document.getElementById('frameNumber'),
      totalFrames: document.getElementById('totalFrames'),
      timestamp: document.getElementById('timestamp'),
      timeDisplay: document.getElementById('timeDisplay'),
      vfrWarning: document.getElementById('vfrWarning'),
      loadingIndicator: document.getElementById('loadingIndicator')
    };
    
    this.totalFramesCount = 0;
    this.duration = 0;
  }

  /**
   * Initialize overlay with video metadata
   * @param {Object} metadata 
   */
  init(metadata) {
    this.totalFramesCount = metadata.totalFrames;
    this.duration = metadata.duration;
    
    this.elements.totalFrames.textContent = metadata.totalFrames.toLocaleString();
    this.elements.overlay.classList.add('visible');
    
    // Show VFR warning if applicable
    if (metadata.isVFR) {
      this.elements.vfrWarning.classList.add('visible');
    } else {
      this.elements.vfrWarning.classList.remove('visible');
    }
    
    this.updateTimeDisplay(0, metadata.duration);
  }

  /**
   * Update frame display
   * @param {number} frameNumber - Current frame (0-indexed)
   * @param {number} timestamp - Current time in seconds
   */
  update(frameNumber, timestamp) {
    this.elements.frameNumber.textContent = `Frame: ${(frameNumber + 1).toLocaleString()}`;
    this.elements.timestamp.textContent = this.formatTimestamp(timestamp);
    this.updateTimeDisplay(timestamp, this.duration);
  }

  /**
   * Update the time display in controls bar
   * @param {number} current - Current time in seconds
   * @param {number} total - Total duration in seconds
   */
  updateTimeDisplay(current, total) {
    const currentStr = this.formatTime(current);
    const totalStr = this.formatTime(total);
    this.elements.timeDisplay.textContent = `${currentStr} / ${totalStr}`;
  }

  /**
   * Format time as MM:SS or HH:MM:SS
   * @param {number} seconds 
   * @returns {string}
   */
  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format timestamp with milliseconds
   * @param {number} seconds 
   * @returns {string}
   */
  formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Show stepping animation feedback
   */
  showSteppingFeedback() {
    this.elements.overlay.classList.remove('stepping');
    // Trigger reflow to restart animation
    void this.elements.overlay.offsetWidth;
    this.elements.overlay.classList.add('stepping');
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.elements.loadingIndicator.classList.add('visible');
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.elements.loadingIndicator.classList.remove('visible');
  }

  /**
   * Reset overlay to initial state
   */
  reset() {
    this.elements.overlay.classList.remove('visible');
    this.elements.vfrWarning.classList.remove('visible');
    this.elements.frameNumber.textContent = 'Frame: 0';
    this.elements.totalFrames.textContent = '0';
    this.elements.timestamp.textContent = '00:00:00.000';
    this.elements.timeDisplay.textContent = '00:00 / 00:00';
    this.totalFramesCount = 0;
    this.duration = 0;
  }
}

// Export for use in other modules
window.UIOverlay = UIOverlay;
