/**
 * Video Controller
 * Handles video playback and frame-accurate stepping
 */
class VideoController {
  constructor(uiOverlay) {
    this.ui = uiOverlay;
    this.frameCache = new FrameCache(30);

    // DOM Elements
    this.videoElement = document.getElementById('videoElement');
    this.canvas = document.getElementById('frameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.timelineProgress = document.getElementById('timelineProgress');

    // State
    this.filePath = null;
    this.metadata = null;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.isFrameMode = false; // True when showing extracted frame on canvas
    this.isStepping = false;

    // Bind methods
    this.onVideoFrame = this.onVideoFrame.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);

    // Setup video element events
    this.setupVideoEvents();
  }

  /**
   * Setup video element event listeners
   */
  setupVideoEvents() {
    this.videoElement.addEventListener('loadedmetadata', () => {
      this.canvas.width = this.videoElement.videoWidth;
      this.canvas.height = this.videoElement.videoHeight;
    });

    this.videoElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.exitFrameMode();
      this.updatePlayPauseUI();
    });

    this.videoElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayPauseUI();
    });

    this.videoElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayPauseUI();
    });

    this.videoElement.addEventListener('timeupdate', this.onTimeUpdate);

    // Use requestVideoFrameCallback for frame-accurate tracking during playback
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this.videoElement.requestVideoFrameCallback(this.onVideoFrame);
    }
  }

  /**
   * Callback for requestVideoFrameCallback - tracks frame number during playback
   */
  onVideoFrame(now, metadata) {
    if (this.metadata && !this.isFrameMode) {
      this.currentFrame = Math.round(metadata.mediaTime * this.metadata.frameRate);
      this.ui.update(this.currentFrame, metadata.mediaTime);
      this.updateTimeline(metadata.mediaTime / this.metadata.duration);
    }
    this.videoElement.requestVideoFrameCallback(this.onVideoFrame);
  }

  /**
   * Fallback time update handler
   */
  onTimeUpdate() {
    if (this.metadata && !this.isFrameMode && !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
      const time = this.videoElement.currentTime;
      this.currentFrame = Math.round(time * this.metadata.frameRate);
      this.ui.update(this.currentFrame, time);
      this.updateTimeline(time / this.metadata.duration);
    }
  }

  /**
   * Load a video file
   * @param {string} filePath - Absolute path to video file
   */
  async loadVideo(filePath) {
    try {
      this.ui.showLoading();

      // Reset state
      this.reset();
      this.filePath = filePath;

      // Get metadata from ffprobe
      this.metadata = await window.electronAPI.getVideoMetadata(filePath);
      console.log('Video metadata:', this.metadata);

      // Initialize UI
      this.ui.init(this.metadata);

      // Load video in video element
      this.videoElement.src = `file://${filePath}`;
      await new Promise((resolve, reject) => {
        this.videoElement.onloadeddata = resolve;
        this.videoElement.onerror = reject;
      });

      // Set canvas dimensions
      this.canvas.width = this.metadata.width;
      this.canvas.height = this.metadata.height;

      // Update titlebar with filename
      const filename = filePath.split('/').pop().split('\\').pop();
      document.getElementById('titlebarTitle').textContent = `${filename} - FrameStep`;

      // Hide drop zone
      document.getElementById('dropZone').classList.add('hidden');

      // Enable controls
      this.enableControls(true);

      // Show first frame
      this.currentFrame = 0;
      this.ui.update(0, 0);
      this.updateTimeline(0);

      this.ui.hideLoading();

      // Auto-play after loading
      this.videoElement.play();

      return true;
    } catch (error) {
      console.error('Failed to load video:', error);
      this.ui.hideLoading();
      alert(`Failed to load video: ${error.message}`);
      return false;
    }
  }

  /**
   * Step forward or backward by N frames
   * Uses native video seeking (instant, decoder stays warm) like QuickTime
   * @param {number} delta - Number of frames to step (positive = forward, negative = backward)
   */
  async stepFrame(delta) {
    if (!this.metadata || this.isStepping) return;

    // Pause if playing
    if (this.isPlaying) {
      this.videoElement.pause();
    }

    this.isStepping = true;

    try {
      // Calculate target frame
      const targetFrame = Math.max(0, Math.min(
        this.currentFrame + delta,
        this.metadata.totalFrames - 1
      ));

      // Skip if already at boundary
      if (targetFrame === this.currentFrame) {
        this.isStepping = false;
        return;
      }

      // Calculate target time
      const frameDuration = 1 / this.metadata.frameRate;
      const targetTime = targetFrame * frameDuration;

      // Use native video seeking (instant - decoder stays warm)
      await this.seekVideoToTime(targetTime);

      // Draw current video frame to canvas (instant)
      this.drawVideoToCanvas();

      // Update state
      this.currentFrame = targetFrame;
      this.ui.update(targetFrame, targetTime);
      this.ui.showSteppingFeedback();
      this.updateTimeline(targetTime / this.metadata.duration);

      // Enter frame mode (show canvas)
      this.enterFrameMode();

    } catch (error) {
      console.error('Failed to step frame:', error);
    }

    this.isStepping = false;
  }

  /**
   * Seek video element to exact time - returns promise that resolves when seek completes
   * @param {number} time - Target time in seconds
   */
  seekVideoToTime(time) {
    return new Promise((resolve) => {
      // If already at this time (within small tolerance), resolve immediately
      if (Math.abs(this.videoElement.currentTime - time) < 0.001) {
        resolve();
        return;
      }

      const onSeeked = () => {
        this.videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };

      this.videoElement.addEventListener('seeked', onSeeked);
      this.videoElement.currentTime = time;
    });
  }

  /**
   * Draw current video frame to canvas (instant operation)
   */
  drawVideoToCanvas() {
    this.ctx.drawImage(
      this.videoElement,
      0, 0,
      this.canvas.width,
      this.canvas.height
    );
  }

  /**
   * Display a frame on the canvas
   * @param {Object} frameData - Frame data with base64 image
   */
  async displayFrame(frameData) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        resolve();
      };
      img.onerror = reject;
      // Support both JPEG and PNG formats
      const format = frameData.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      img.src = `data:${format};base64,${frameData.data}`;
    });
  }

  /**
   * Enter frame mode - show canvas, hide video
   */
  enterFrameMode() {
    if (!this.isFrameMode) {
      this.isFrameMode = true;
      this.videoElement.classList.add('hidden');
      this.canvas.classList.add('visible');
    }
  }

  /**
   * Exit frame mode - show video, hide canvas
   */
  exitFrameMode() {
    if (this.isFrameMode) {
      this.isFrameMode = false;
      this.videoElement.classList.remove('hidden');
      this.canvas.classList.remove('visible');

      // Sync video position to current frame
      const targetTime = this.currentFrame / this.metadata.frameRate;
      this.videoElement.currentTime = targetTime;
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (!this.metadata) return;

    if (this.isPlaying) {
      this.videoElement.pause();
    } else {
      this.exitFrameMode();
      this.videoElement.play();
    }
  }

  /**
   * Play video
   */
  play() {
    if (!this.metadata) return;
    this.exitFrameMode();
    this.videoElement.play();
  }

  /**
   * Pause video
   */
  pause() {
    if (!this.metadata) return;
    this.videoElement.pause();
  }

  /**
   * Seek to a specific progress position (0-1)
   * @param {number} progress - Position as fraction of duration
   */
  async seekToProgress(progress) {
    if (!this.metadata) return;

    const targetTime = progress * this.metadata.duration;
    const targetFrame = Math.round(targetTime * this.metadata.frameRate);

    if (this.isFrameMode || this.videoElement.paused) {
      // In frame mode, extract the exact frame
      this.currentFrame = Math.max(0, targetFrame - 1);
      await this.stepFrame(1);
    } else {
      // During playback, use video seeking
      this.videoElement.currentTime = targetTime;
    }
  }

  /**
   * Update timeline progress bar
   * @param {number} progress - Progress as fraction (0-1)
   */
  updateTimeline(progress) {
    this.timelineProgress.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  }

  /**
   * Update play/pause button UI
   */
  updatePlayPauseUI() {
    const playIcon = document.querySelector('#playPauseBtn .play-icon');
    const pauseIcon = document.querySelector('#playPauseBtn .pause-icon');

    if (this.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }

    // Show center feedback animation
    if (this.metadata) {
      this.ui.showPlaybackFeedback(this.isPlaying);
    }
  }

  /**
   * Enable or disable control buttons
   * @param {boolean} enabled 
   */
  enableControls(enabled) {
    document.getElementById('playPauseBtn').disabled = !enabled;
    document.getElementById('prevFrameBtn').disabled = !enabled;
    document.getElementById('nextFrameBtn').disabled = !enabled;
  }

  /**
   * Reset controller state
   */
  reset() {
    this.videoElement.src = '';
    this.videoElement.classList.remove('hidden');
    this.canvas.classList.remove('visible');
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.frameCache.clear();
    this.filePath = null;
    this.metadata = null;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.isFrameMode = false;
    this.isStepping = false;

    this.ui.reset();
    this.enableControls(false);
    this.updateTimeline(0);
    this.updatePlayPauseUI();

    // Reset titlebar
    document.getElementById('titlebarTitle').textContent = 'FrameStep';
  }

  /**
   * Get current playback state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: !this.isPlaying && this.metadata !== null,
      isFrameMode: this.isFrameMode,
      currentFrame: this.currentFrame,
      totalFrames: this.metadata?.totalFrames || 0,
      currentTime: this.currentFrame / (this.metadata?.frameRate || 1),
      duration: this.metadata?.duration || 0
    };
  }
}

// Export for use in other modules
window.VideoController = VideoController;
