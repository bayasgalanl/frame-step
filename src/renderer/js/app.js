/**
 * Frame Player Application
 * Main entry point that initializes all components
 */
(function () {
  'use strict';

  // Initialize application when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    console.log('FrameStep initializing...');

    // Create UI overlay manager
    const uiOverlay = new UIOverlay();

    // Create video controller
    const videoController = new VideoController(uiOverlay);

    // Create controls handler
    const controls = new Controls(videoController);

    // Setup custom titlebar
    setupTitlebar(videoController, controls);

    // Listen for files opened via menu
    window.electronAPI.onFileOpened(async (filePath) => {
      console.log('File opened via menu:', filePath);
      await videoController.loadVideo(filePath);
    });

    // Handle command line arguments (if video file was opened with the app)
    // This would be handled in main process and sent via IPC

    // Store global references for debugging
    window.app = {
      uiOverlay,
      videoController,
      controls
    };

    console.log('FrameStep ready');
    console.log('Keyboard shortcuts:');
    console.log('  Space - Play/Pause');
    console.log('  ← / → - Previous/Next frame');
    console.log('  Shift + ← / → - ±10 frames');
    console.log('  Mouse wheel (when paused) - Scrub frames');
    console.log('  O - Open file');
    console.log('  F - Toggle fullscreen');
    console.log('  ? - Show shortcuts help');
  }

  /**
   * Setup VS Code style titlebar with menus and window controls
   */
  function setupTitlebar(videoController, controls) {
    const maximizeBtn = document.getElementById('maximizeBtn');
    const maximizeIcon = maximizeBtn.querySelector('.maximize-icon');
    const restoreIcon = maximizeBtn.querySelector('.restore-icon');

    // Update maximize/restore icon
    function updateMaximizeIcon(isMaximized) {
      if (isMaximized) {
        maximizeIcon.style.display = 'none';
        restoreIcon.style.display = 'block';
        maximizeBtn.title = 'Restore';
        document.body.classList.add('maximized');
      } else {
        maximizeIcon.style.display = 'block';
        restoreIcon.style.display = 'none';
        maximizeBtn.title = 'Maximize';
        document.body.classList.remove('maximized');
      }
    }

    // Listen for maximize state changes
    window.electronAPI.onWindowMaximized(updateMaximizeIcon);

    // Check initial state
    window.electronAPI.windowIsMaximized().then(updateMaximizeIcon);

    // Window controls
    document.getElementById('minimizeBtn').addEventListener('click', () => {
      window.electronAPI.windowMinimize();
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
      window.electronAPI.windowMaximize();
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
      window.electronAPI.windowClose();
    });

    // Hamburger menu toggle
    const menuContainer = document.querySelector('.menu-container');
    document.getElementById('menuToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      menuContainer.classList.toggle('active');
    });

    // Menu: File > Open
    document.getElementById('menuOpen').addEventListener('click', async () => {
      closeAllMenus();
      const filePath = await window.electronAPI.openFileDialog();
      if (filePath) {
        await videoController.loadVideo(filePath);
      }
    });

    // Menu: View > Fullscreen
    document.getElementById('menuFullscreen').addEventListener('click', () => {
      closeAllMenus();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    });

    // Menu: Help > Shortcuts
    document.getElementById('menuShortcuts').addEventListener('click', () => {
      closeAllMenus();
      controls.toggleShortcutsHelp();
    });

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-item') && !e.target.closest('#menuToggle')) {
        closeAllMenus();
      }
    });

    // Close menus on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllMenus();
      }
    });
  }

  function closeAllMenus() {
    document.querySelector('.menu-container').classList.remove('active');
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
  }
})();
