const { spawn } = require('child_process');
const { app } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Note: Paths are set dynamically in the constructor to handle packaged app correctly


class FFmpegService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'frame-player');

    // Resolve paths for ffmpeg and ffprobe
    if (app.isPackaged) {
      this.ffmpegPath = path.join(process.resourcesPath, 'bin/ffmpeg');
      this.ffprobePath = path.join(process.resourcesPath, 'bin/ffprobe');
    } else {
      this.ffmpegPath = ffmpegStatic;
      this.ffprobePath = ffprobeStatic.path;
    }

    // Set fluent-ffmpeg paths
    ffmpeg.setFfmpegPath(this.ffmpegPath);
    ffmpeg.setFfprobePath(this.ffprobePath);

    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get video metadata using ffprobe
   * @param {string} filePath - Path to the video file
   * @returns {Promise<Object>} Video metadata
   */
  async getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          return reject(new Error(`Failed to probe video: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }

        // Parse frame rate (can be "30/1", "30000/1001", etc.)
        let frameRate = 30; // default
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          frameRate = den ? num / den : num;
        } else if (videoStream.avg_frame_rate) {
          const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
          frameRate = den ? num / den : num;
        }

        // Get duration from video stream or format
        const duration = parseFloat(videoStream.duration) ||
          parseFloat(metadata.format.duration) || 0;

        // Calculate total frames
        const totalFrames = Math.floor(frameRate * duration);

        // Check for variable frame rate
        const isVFR = videoStream.r_frame_rate !== videoStream.avg_frame_rate;

        resolve({
          frameRate: Math.round(frameRate * 1000) / 1000, // Round to 3 decimal places
          duration,
          totalFrames,
          width: videoStream.width,
          height: videoStream.height,
          codec: videoStream.codec_name,
          isVFR,
          bitRate: parseInt(metadata.format.bit_rate) || 0,
          format: metadata.format.format_name
        });
      });
    });
  }

  /**
   * Extract a single frame from video - TRUE FRAME-ACCURATE VERSION
   * Uses -vf select filter for exact frame number selection
   * @param {string} filePath - Path to the video file
   * @param {number} frameNumber - Frame number to extract (0-indexed)
   * @param {number} frameRate - Video frame rate
   * @returns {Promise<Object>} Frame data with base64 JPEG
   */
  async extractFrame(filePath, frameNumber, frameRate) {
    const timestamp = frameNumber / frameRate;

    return new Promise((resolve, reject) => {
      const chunks = [];
      let settled = false;

      // For TRUE frame-accurate extraction, we use the select filter
      // This decodes frames sequentially and picks the exact frame number
      // Trade-off: More accurate but slower for frames far into the video

      // Optimization: Fast seek to ~2 seconds before target, then decode from there
      // This limits the decode window while maintaining accuracy
      const seekTime = Math.max(0, timestamp - 2);
      const framesToSkip = Math.round(seekTime * frameRate);
      const relativeFrame = frameNumber - framesToSkip;

      const args = [
        '-ss', seekTime.toFixed(3),           // Fast seek to near target
        '-i', filePath,
        '-vf', `select=eq(n\\,${relativeFrame})`,  // Select exact frame number (relative to seek point)
        '-frames:v', '1',                     // Output only 1 frame
        '-vsync', 'vfr',                      // Variable frame rate output (needed for select filter)
        '-f', 'image2pipe',                   // Output to pipe
        '-vcodec', 'mjpeg',                   // JPEG codec
        '-q:v', '2',                          // High quality
        '-'                                   // Output to stdout
      ];

      const proc = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'ignore']
      });

      proc.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code === 0 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          resolve({
            frameNumber,
            timestamp,
            data: buffer.toString('base64'),
            format: 'jpeg'
          });
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      });

      // Longer timeout for frame-accurate extraction
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill('SIGTERM');
        reject(new Error('Frame extraction timeout'));
      }, 10000);
    });
  }

  /**
   * Extract multiple frames in batch
   * @param {string} filePath - Path to the video file
   * @param {number[]} frameNumbers - Array of frame numbers to extract
   * @param {number} frameRate - Video frame rate
   * @returns {Promise<Object[]>} Array of frame data objects
   */
  async extractFramesBatch(filePath, frameNumbers, frameRate) {
    const results = await Promise.all(
      frameNumbers.map(frameNum =>
        this.extractFrame(filePath, frameNum, frameRate).catch(err => ({
          frameNumber: frameNum,
          error: err.message
        }))
      )
    );
    return results;
  }

  /**
   * Clean up temporary files
   */
  cleanup() {
    try {
      const files = fs.readdirSync(this.tempDir);
      files.forEach(file => {
        if (file.startsWith('frame_')) {
          fs.unlinkSync(path.join(this.tempDir, file));
        }
      });
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }
}

module.exports = FFmpegService;
