// settings-manager.js
// Settings modal and configuration management

const SettingsManager = {
    isOpen: false,
    modalListenersSetup: false,
    settings: {
        showGrid: true,
        showAxes: true,
        snapToGrid: false,
        showTooltips: true,
        showHelpers: true,
        cameraSpeed: 1.0,
        autoSave: true,
        theme: 'dark',
        exportQuality: 1.0,
        canvasSize: { width: 32, height: 32 },
        backgroundColor: '#ffffff'
    },

    init() {
        console.log('Initializing Settings Manager...');
        
        // Initialize canvas size from config if not set
        if (!this.settings.canvasSize) {
            this.settings.canvasSize = { 
                width: Config.TILE_DIM, 
                height: Config.TILE_DIM 
            };
        }

        // Ensure DOM is ready before setting up event listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.loadSettings();
                console.log('Settings Manager initialized (DOM ready)');
            });
        } else {
            this.setupEventListeners();
            this.loadSettings();
            console.log('Settings Manager initialized');
        }

        // Fallback: Also try to attach event listener after a short delay
        setTimeout(() => {
            const settingsBtn = document.getElementById('settingsBtn');
            console.log('Fallback check - settingsBtn found:', !!settingsBtn);
            if (settingsBtn && !settingsBtn.hasAttribute('data-settings-listener')) {
                console.log('Attaching fallback settings button listener');
                settingsBtn.addEventListener('click', (e) => {
                    console.log('Settings button clicked (fallback)');
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSettings();
                });
                settingsBtn.setAttribute('data-settings-listener', 'true');
            }
        }, 1000);
    },

    setupEventListeners() {
        // Settings button click
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            console.log('Settings button found, attaching event listener');
            settingsBtn.addEventListener('click', (e) => {
                console.log('Settings button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleSettings();
            });
        } else {
            console.error('Settings button not found!');
        }
    },

    toggleSettings() {
        if (this.isOpen) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    },

    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (!modal) {
            console.error('Settings modal not found in HTML');
            return;
        }

        this.isOpen = true;
        modal.classList.add('open');

        // Update form values from current settings
        this.updateFormFromSettings();

        // Setup modal event listeners (only once)
        if (!this.modalListenersSetup) {
            this.setupModalEventListeners();
            this.modalListenersSetup = true;
        }

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettings();
            }
        });
    },

    updateFormFromSettings() {
        // Update HTML form values from current settings
        const gridCheckbox = document.getElementById('setting-grid');
        const axesCheckbox = document.getElementById('setting-axes');
        const snapCheckbox = document.getElementById('setting-snap');
        const tooltipsCheckbox = document.getElementById('setting-tooltips');
        const helpersCheckbox = document.getElementById('setting-helpers');
        const cameraSlider = document.getElementById('setting-camera-speed');
        const cameraDisplay = document.getElementById('camera-speed-value');
        const bgColorPicker = document.getElementById('setting-bg-color');
        
        // Canvas size inputs
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');

        if (gridCheckbox) gridCheckbox.checked = this.settings.showGrid;
        if (axesCheckbox) axesCheckbox.checked = this.settings.showAxes || true;
        if (snapCheckbox) snapCheckbox.checked = this.settings.snapToGrid;
        if (tooltipsCheckbox) tooltipsCheckbox.checked = this.settings.showTooltips || true;
        if (helpersCheckbox) helpersCheckbox.checked = this.settings.showHelpers !== false; // default to true
        if (cameraSlider) {
            cameraSlider.value = this.settings.cameraSpeed || 1.0;
            if (cameraDisplay) cameraDisplay.textContent = (this.settings.cameraSpeed || 1.0).toFixed(1);
        }
        if (bgColorPicker) bgColorPicker.value = this.settings.backgroundColor || '#ffffff';
        
        // Update canvas size inputs with current settings or config defaults
        const canvasWidth = this.settings.canvasSize?.width || Config.TILE_DIM;
        const canvasHeight = this.settings.canvasSize?.height || Config.TILE_DIM;
        
        if (widthInput) widthInput.value = canvasWidth;
        if (heightInput) heightInput.value = canvasHeight;
    },

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('open');
        }
        this.isOpen = false;
    },

    createSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

        panel.innerHTML = `
            <button class="close-settings" title="Close Settings"><i class="fas fa-times"></i></button>
            <h2>Settings</h2>
            
            <div class="settings-content">
                <div class="settings-group">
                    <h3>Display</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="showGrid">Show Grid</label>
                        <div class="setting-control">
                            <input type="checkbox" id="showGrid" ${this.settings.showGrid ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="setting-item">
                        <label class="setting-label" for="snapToGrid">Snap to Grid</label>
                        <div class="setting-control">
                            <input type="checkbox" id="snapToGrid" ${this.settings.snapToGrid ? 'checked' : ''}>
                        </div>
                    </div>
                </div>
                
                <div class="settings-group">
                    <h3>Canvas</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="canvasWidth">Tile Resolution (W&times;H)</label>
                        <div class="setting-control setting-control-group">
                            <input type="number" id="canvasWidth" min="8" max="128" value="${this.settings.canvasSize.width}" title="Tile Width">
                            <span>&times;</span>
                            <input type="number" id="canvasHeight" min="8" max="128" value="${this.settings.canvasSize.height}" title="Tile Height">
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>Export</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="exportQuality">Export Quality</label>
                        <div class="setting-control control-range">
                            <input type="range" id="exportQuality" min="0.1" max="1.0" step="0.1" value="${this.settings.exportQuality}">
                            <span class="range-value">${Math.round(this.settings.exportQuality * 100)}%</span>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>General</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="autoSave">Auto Save</label>
                        <div class="setting-control">
                            <input type="checkbox" id="autoSave" ${this.settings.autoSave ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="setting-item">
                        <label class="setting-label" for="theme">Theme</label>
                        <div class="setting-control">
                            <select id="theme">
                                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="settings-actions">
                <button class="btn" id="resetSettingsBtn"><i class="fas fa-undo"></i> Reset to Defaults</button>
                <button class="btn primary" id="saveSettingsBtn"><i class="fas fa-check"></i> Save & Close</button>
            </div>
        `;

        modal.appendChild(panel);
        return modal;
    },

    setupModalEventListeners() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // X close button
        const xCloseBtn = document.getElementById('btn-settings-x');
        if (xCloseBtn) {
            xCloseBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }

        // Close button
        const closeBtn = document.getElementById('btn-settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }

        // Save button
        const saveBtn = document.getElementById('btn-settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                this.closeSettings();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('btn-settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // Camera speed display
        const cameraSlider = document.getElementById('setting-camera-speed');
        const cameraDisplay = document.getElementById('camera-speed-value');
        if (cameraSlider && cameraDisplay) {
            cameraSlider.addEventListener('input', (e) => {
                cameraDisplay.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }

        // Canvas resize apply button
        const applyResizeBtn = document.getElementById('apply-canvas-resize');
        if (applyResizeBtn) {
            applyResizeBtn.addEventListener('click', () => {
                this.applyCanvasResize();
            });
        }
    },

    saveSettings() {
        // Read settings from HTML form
        const gridCheckbox = document.getElementById('setting-grid');
        const axesCheckbox = document.getElementById('setting-axes');
        const snapCheckbox = document.getElementById('setting-snap');
        const tooltipsCheckbox = document.getElementById('setting-tooltips');
        const helpersCheckbox = document.getElementById('setting-helpers');
        const cameraSlider = document.getElementById('setting-camera-speed');
        const bgColorPicker = document.getElementById('setting-bg-color');
        
        // Canvas size inputs
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');

        this.settings.showGrid = gridCheckbox ? gridCheckbox.checked : true;
        this.settings.showAxes = axesCheckbox ? axesCheckbox.checked : true;
        this.settings.snapToGrid = snapCheckbox ? snapCheckbox.checked : false;
        this.settings.showTooltips = tooltipsCheckbox ? tooltipsCheckbox.checked : true;
        this.settings.showHelpers = helpersCheckbox ? helpersCheckbox.checked : true;
        this.settings.cameraSpeed = cameraSlider ? parseFloat(cameraSlider.value) : 1.0;
        this.settings.backgroundColor = bgColorPicker ? bgColorPicker.value : '#ffffff';
        
        // Save canvas size from inputs (use current input values)
        if (widthInput && heightInput) {
            this.settings.canvasSize = {
                width: parseInt(widthInput.value) || Config.TILE_DIM,
                height: parseInt(heightInput.value) || Config.TILE_DIM
            };
        }

        // Apply settings
        this.applySettings();

        // Save to localStorage
        this.saveSettingsToStorage();

        if (typeof InputHandler !== 'undefined') {
            InputHandler.showNotification('Settings saved successfully', 'success');
        }
    },

    applyCanvasResize() {
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        
        if (!widthInput || !heightInput) {
            console.error('Canvas size inputs not found');
            return;
        }
        
        const newWidth = parseInt(widthInput.value);
        const newHeight = parseInt(heightInput.value);
        
        // Validate input ranges
        if (newWidth < 4 || newWidth > 512 || newHeight < 4 || newHeight > 512) {
            if (typeof InputHandler !== 'undefined') {
                InputHandler.showNotification('Canvas size must be between 4 and 512 pixels', 'error');
            }
            return;
        }
        
        // Update settings
        this.settings.canvasSize = { width: newWidth, height: newHeight };
        
        // Apply the resize to the actual canvas
        this.resizeCanvas(newWidth, newHeight);
        
        // Save to storage
        this.saveSettingsToStorage();
        
        if (typeof InputHandler !== 'undefined') {
            InputHandler.showNotification(`Canvas resized to ${newWidth}×${newHeight}`, 'success');
        }
    },

    resizeCanvas(width, height) {
        // Update config values
        Config.TILE_DIM = width;
        Config.CANVAS_SIZE = width * Config.PIXEL_SIZE;
        
        // Resize all canvas elements
        if (DOM && DOM.allCanvases) {
            DOM.allCanvases.forEach(canvas => {
                canvas.width = Config.CANVAS_SIZE;
                canvas.height = Config.CANVAS_SIZE;
            });
        }
        
        // Redraw the canvases
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }
        
        console.log(`Canvas resized to ${width}×${height} (${Config.CANVAS_SIZE}px)`);
    },

    resetSettings() {
        if (confirm('Reset all settings to default values?')) {
            // Reset to defaults using config values for canvas size
            this.settings = {
                showGrid: true,
                showAxes: true,
                snapToGrid: false,
                showTooltips: true,
                showHelpers: true,
                cameraSpeed: 1.0,
                autoSave: true,
                theme: 'dark',
                exportQuality: 1.0,
                canvasSize: { 
                    width: Config.TILE_DIM, 
                    height: Config.TILE_DIM 
                },
                backgroundColor: '#ffffff'
            };

            // Update HTML form
            this.updateFormFromSettings();

            // Apply settings
            this.applySettings();

            // Save to localStorage
            this.saveSettingsToStorage();

            if (typeof InputHandler !== 'undefined') {
                InputHandler.showNotification('Settings reset to defaults', 'info');
            }
        }
    },

    applySettings() {
        // Apply theme
        if (this.settings.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Apply auto-save setting
        if (this.settings.autoSave) {
            FileManager.startAutoSave();
        } else {
            FileManager.stopAutoSave();
        }

        // Apply helpers setting (show/hide welcome message)
        if (this.settings.showHelpers === false) {
            // Hide any existing welcome notifications
            const existingWelcome = document.querySelector('.welcome-notification');
            if (existingWelcome) {
                existingWelcome.remove();
            }
        }

        // Apply background color to canvas
        if (this.settings.backgroundColor) {
            this.applyBackgroundColor(this.settings.backgroundColor);
        }

        // Apply other settings as needed
        console.log('Settings applied:', this.settings);
    },

    applyBackgroundColor(color) {
        // Apply background color to the tile grid container
        const tileGrid = document.querySelector('.tile-grid');
        if (tileGrid) {
            tileGrid.style.backgroundColor = color;
        }
        
        // Also update the workspace background
        const workspace = document.querySelector('.workspace');
        if (workspace) {
            workspace.style.setProperty('--canvas-bg-color', color);
        }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('tilemap-settings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this.settings = { ...this.settings, ...loadedSettings };
                
                // Apply loaded canvas size to config
                if (loadedSettings.canvasSize) {
                    Config.TILE_DIM = loadedSettings.canvasSize.width || Config.TILE_DIM;
                    Config.CANVAS_SIZE = Config.TILE_DIM * Config.PIXEL_SIZE;
                    console.log(`Loaded canvas size: ${Config.TILE_DIM}×${Config.TILE_DIM}`);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }

        this.applySettings();
    },

    saveSettingsToStorage() {
        try {
            localStorage.setItem('tilemap-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    },

    getSettings() {
        return { ...this.settings };
    },

    updateSetting(key, value) {
        this.settings[key] = value;
        this.applySettings();
        this.saveSettingsToStorage();
    },

    exportSettings() {
        const dataStr = JSON.stringify(this.settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'tilemap-settings.json';
        link.click();

        URL.revokeObjectURL(url);

        if (typeof InputHandler !== 'undefined') {
            InputHandler.showNotification('Settings exported successfully', 'success');
        }
    }
};

SettingsManager.init();