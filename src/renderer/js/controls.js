/**
 * Controls Handler
 * Manages keyboard shortcuts and mouse interactions
 */
class Controls {
  constructor(videoController) {
    this.vc = videoController;
    this.shortcutsVisible = false;
    this.frameOverlayVisible = false;

    this.isMouseOverControls = false;
    this.isMouseOverOverlay = false;
    this.autoHideTimer = null;

    this.setupKeyboardControls();
    this.setupMouseControls();
    this.setupButtonControls();
    this.setupTimelineControls();
    this.setupDragDrop();
    this.setupAutoHide();
    this.setFrameOverlayVisible(false);
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardControls() {
    document.addEventListener('keydown', async (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const digit = parseInt(e.key, 10);
            await this.vc.seekToProgress(digit / 10);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          await this.vc.stepFrame(e.shiftKey ? -10 : -1);
          break;

        case 'ArrowRight':
          e.preventDefault();
          await this.vc.stepFrame(e.shiftKey ? 10 : 1);
          break;

        case ' ':
          e.preventDefault();
          this.vc.togglePlayPause();
          break;

        case 'o':
        case 'O':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.openFile();
          }
          break;

        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;

        case '?':
          e.preventDefault();
          this.toggleShortcutsHelp();
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          this.vc.toggleMute();
          break;

        case 'c':
        case 'C':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleFrameOverlay();
          }
          break;

        case '<':
        case ',':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.vc.adjustPlaybackRate(-1);
          }
          break;

        case '>':
        case '.':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.vc.adjustPlaybackRate(1);
          }
          break;

        case 'r':
        case 'R':
          e.preventDefault();
          this.vc.goToBeginning();
          break;

        case 'Escape':
          if (this.shortcutsVisible) {
            this.toggleShortcutsHelp();
          }
          break;
      }
    });
  }

  /**
   * Setup mouse wheel scrubbing
   */
  setupMouseControls() {
    const videoContainer = document.getElementById('videoContainer');

    // Wheel scrubbing (only when paused)
    videoContainer.addEventListener('wheel', async (e) => {
      const state = this.vc.getState();
      if (!state.isPaused && !state.isFrameMode) {
        return; // Only scrub when paused or in frame mode
      }

      e.preventDefault();

      // Determine direction
      const delta = e.deltaY > 0 ? 1 : -1;
      await this.vc.stepFrame(delta);
    }, { passive: false });

    // Double-click to toggle play/pause
    videoContainer.addEventListener('dblclick', (e) => {
      // Ignore clicks on controls
      if (e.target.closest('.controls-bar')) return;
      this.vc.togglePlayPause();
    });

    // Single click to pause (if playing)
    let clickTimeout = null;
    videoContainer.addEventListener('click', (e) => {
      // Ignore clicks on controls or drop zone
      if (e.target.closest('.controls-bar') || e.target.closest('.drop-zone')) return;

      // Use timeout to distinguish from double-click
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        return;
      }

      clickTimeout = setTimeout(() => {
        this.vc.togglePlayPause();
        clickTimeout = null;
      }, 200);
    });
  }

  /**
   * Setup control button click handlers
   */
  setupButtonControls() {
    // Play/Pause button

    document.getElementById('playPauseBtn').addEventListener('click', () => {
      this.vc.togglePlayPause();
    });

    // Restart button
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.vc.goToBeginning();
    });

    // Previous frame button
    document.getElementById('prevFrameBtn').addEventListener('click', () => {
      this.vc.stepFrame(-1);
    });

    // Next frame button
    document.getElementById('nextFrameBtn').addEventListener('click', () => {
      this.vc.stepFrame(1);
    });

    // Fullscreen button
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Listen for fullscreen changes to update UI
    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreenUI();
    });

    // Mute button
    document.getElementById('muteBtn').addEventListener('click', () => {
      this.vc.toggleMute();
    });

    // Volume slider
    const volumeSlider = document.getElementById('volumeSlider');
    volumeSlider.addEventListener('input', (e) => {
      this.vc.setVolume(parseFloat(e.target.value));
    });

    // Mouse wheel on volume container for quick adjustment
    document.querySelector('.volume-container').addEventListener('wheel', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.vc.setVolume(this.vc.volume + delta);
    }, { passive: false });

    // Playback speed buttons
    document.getElementById('speedDownBtn').addEventListener('click', () => {
      this.vc.adjustPlaybackRate(-1);
    });

    document.getElementById('speedUpBtn').addEventListener('click', () => {
      this.vc.adjustPlaybackRate(1);
    });
  }

  /**
   * Setup auto-hide functionality for controls
   */
  setupAutoHide() {
    const controlsBar = document.getElementById('controlsBar');
    const hideTimeout = 3000; // 3 seconds

    const showControls = () => {
      document.body.classList.remove('hide-controls');
      this.resetAutoHideTimer();
    };

    const hideControls = () => {
      if (!this.isMouseOverControls && !this.isMouseOverOverlay) {
        document.body.classList.add('hide-controls');
      }
    };

    this.resetAutoHideTimer = () => {
      if (this.autoHideTimer) {
        clearTimeout(this.autoHideTimer);
      }
      this.autoHideTimer = setTimeout(hideControls, hideTimeout);
    };

    // Show on mouse move/down or key press
    document.addEventListener('mousemove', showControls);
    document.addEventListener('mousedown', showControls);
    document.addEventListener('keydown', showControls);

    // Prevent hiding when mouse is over controls
    controlsBar.addEventListener('mouseenter', () => {
      this.isMouseOverControls = true;
      showControls();
    });

    controlsBar.addEventListener('mouseleave', () => {
      this.isMouseOverControls = false;
      this.resetAutoHideTimer();
    });

    // Prevent hiding when mouse is over frame overlay
    const frameOverlay = document.getElementById('frameOverlay');
    frameOverlay.addEventListener('mouseenter', () => {
      this.isMouseOverOverlay = true;
      showControls();
    });

    frameOverlay.addEventListener('mouseleave', () => {
      this.isMouseOverOverlay = false;
      this.resetAutoHideTimer();
    });

    // Initial timer
    this.resetAutoHideTimer();
  }

  /**
   * Setup timeline click/drag
   */
  setupTimelineControls() {
    const timeline = document.getElementById('timeline');
    let isDragging = false;

    const updateFromMouse = (e) => {
      const rect = timeline.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.vc.seekToProgress(progress);
    };

    timeline.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateFromMouse(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        updateFromMouse(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Click to seek
    timeline.addEventListener('click', (e) => {
      updateFromMouse(e);
    });
  }

  /**
   * Setup drag and drop for video files
   */
  setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    const videoContainer = document.getElementById('videoContainer');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
      videoContainer.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
        if (dropZone.classList.contains('hidden')) {
          dropZone.classList.remove('hidden');
        }
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      videoContainer.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
        if (this.vc.metadata) {
          dropZone.classList.add('hidden');
        }
      });
    });

    // Handle dropped files
    videoContainer.addEventListener('drop', async (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        // Check if it's a video file
        if (file.type.startsWith('video/') || this.isVideoExtension(file.name)) {
          await this.vc.loadVideo(file.path);
        }
      }
    });

    // Click on drop zone to open file dialog
    dropZone.addEventListener('click', (e) => {
      if (!e.target.closest('kbd')) {
        this.openFile();
      }
    });
  }

  /**
   * Check if filename has a video extension
   */
  isVideoExtension(filename) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv', '.flv', '.m4v'];
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext);
  }

  /**
   * Open file dialog
   */
  async openFile() {
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) {
      await this.vc.loadVideo(filePath);
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  /**
   * Update fullscreen UI state
   */
  updateFullscreenUI() {
    const isFullscreen = !!document.fullscreenElement;
    const btn = document.getElementById('fullscreenBtn');

    if (isFullscreen) {
      document.body.classList.add('fullscreen-active');
      btn.title = 'Exit fullscreen (F)';
    } else {
      document.body.classList.remove('fullscreen-active');
      btn.title = 'Enter fullscreen (F)';
    }
  }

  /**
   * Toggle shortcuts help visibility
   */
  toggleShortcutsHelp() {
    const help = document.getElementById('shortcutsHelp');
    this.shortcutsVisible = !this.shortcutsVisible;

    if (this.shortcutsVisible) {
      help.classList.add('visible');
    } else {
      help.classList.remove('visible');
    }
  }

  /**
   * Toggle frame counter visibility
   */
  toggleFrameOverlay() {
    this.setFrameOverlayVisible(!this.frameOverlayVisible);
  }

  /**
   * Set frame counter visibility
   * @param {boolean} visible
   */
  setFrameOverlayVisible(visible) {
    this.frameOverlayVisible = visible;
    document.body.classList.toggle('frame-overlay-hidden', !visible);
    this.updateFrameOverlayMenuLabel();
  }

  /**
   * Update menu label for frame counter
   */
  updateFrameOverlayMenuLabel() {
    const label = document.getElementById('menuFrameCounterLabel');
    if (label) {
      label.textContent = this.frameOverlayVisible ? 'Hide Frame Counter' : 'Show Frame Counter';
    }
  }
}

// Export for use in other modules
window.Controls = Controls;
