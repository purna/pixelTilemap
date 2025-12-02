// ui-manager.js
// UI state management and panel control for the Seamless Tilemap Editor

const UIManager = {
    init() {
        console.log('Initializing UI Manager...');
        this.setupPanelToggle();
        this.setupContextSwitching();
        this.setupBrushControlsDrag();
        
        // Load saved panel state
        this.loadPanelState();
        
        // Set initial panel state for default tool (pencil)
        this.updatePanelForTool('pencil');
        
        console.log('UI Manager initialized successfully');
    },

    setupPanelToggle() {
        const toggleBtn = document.getElementById('panel-toggle');
        const panel = document.getElementById('side-panel');
        const mainContainer = document.querySelector('.main-container');
        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('closed');
            const icon = toggleBtn.querySelector('i');
            if (panel.classList.contains('closed')) {
                icon.className = 'fas fa-chevron-left';
                toggleBtn.style.right = '0';
                mainContainer?.classList.add('panel-closed');
            } else {
                icon.className = 'fas fa-chevron-right';
                toggleBtn.style.right = '280px';
                mainContainer?.classList.remove('panel-closed');
            }
            
            // Save state
            this.savePanelState(!panel.classList.contains('closed'));
        });
    },

    setupContextSwitching() {
        // 1. Listen for Drawing Tool Clicks (Pencil, Brush, etc) - exclude Layers/Canvas/Settings buttons
        const drawingToolBtns = document.querySelectorAll('[data-tool]:not(#layersBtn):not(#canvasBtn):not(#settingsBtn)');
        drawingToolBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Determine tool name from data attribute
                const toolName = btn.getAttribute('data-tool');
                this.updatePanelForTool(toolName);
                
                // Remove active styling from Layers/Canvas/Settings buttons
                document.getElementById('layersBtn')?.classList.remove('active');
                document.getElementById('canvasBtn')?.classList.remove('active');
                document.getElementById('settingsBtn')?.classList.remove('active');
            });
        });

        // 2. Listen for Layers Button (prevent event bubbling)
        const layersBtn = document.getElementById('layersBtn');
        if (layersBtn) {
            layersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPanelSections(['panel-layers']);
                this.setActiveSidebarButton('layersBtn');
            });
        }

        // 3. Listen for Canvas Button (prevent event bubbling)
        const canvasBtn = document.getElementById('canvasBtn');
        if (canvasBtn) {
            canvasBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPanelSections(['panel-tool-canvas']);
                this.setActiveSidebarButton('canvasBtn');
            });
        }
    },

    setupBrushControlsDrag() {
        const brushOverlay = document.querySelector('.brush-controls-overlay');
        if (!brushOverlay) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;

        // Start dragging
        const onPointerDown = (e) => {
            isDragging = true;
            startX = e.clientX || e.touches?.[0]?.clientX || 0;
            startY = e.clientY || e.touches?.[0]?.clientY || 0;
            
            // Get current position (remove transform for accurate positioning)
            const rect = brushOverlay.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            brushOverlay.style.transform = 'none';
            brushOverlay.style.transition = 'none';
            brushOverlay.style.cursor = 'grabbing';
            brushOverlay.style.pointerEvents = 'auto';
            
            e.preventDefault();
        };

        // Dragging
        const onPointerMove = (e) => {
            if (!isDragging) return;
            
            const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
            const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
            
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // Get current dimensions and viewport size
            const overlayWidth = brushOverlay.offsetWidth;
            const overlayHeight = brushOverlay.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate bounds (allow full movement within viewport with 10px padding)
            const maxX = viewportWidth - overlayWidth - 10;
            const maxY = viewportHeight - overlayHeight - 10;
            const minX = 10;
            const minY = 10;
            
            // Clamp positions to stay within bounds
            newX = Math.max(minX, Math.min(newX, maxX));
            newY = Math.max(minY, Math.min(newY, maxY));
            
            // Update position
            brushOverlay.style.left = newX + 'px';
            brushOverlay.style.top = newY + 'px';
            brushOverlay.style.bottom = 'auto'; // Clear bottom positioning when dragging
            
            e.preventDefault();
        };

        // End dragging
        const onPointerUp = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            brushOverlay.style.cursor = 'move';
            brushOverlay.style.pointerEvents = 'none';
            
            // Restore transform for centering when at default position
            if (brushOverlay.style.left === '' && brushOverlay.style.top === '') {
                brushOverlay.style.transform = 'translateX(-50%)';
            }
            
            e.preventDefault();
        };

        // Add event listeners
        brushOverlay.addEventListener('mousedown', onPointerDown);
        brushOverlay.addEventListener('touchstart', onPointerDown, { passive: false });
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchend', onPointerUp);

        // Double-click to return to bottom center
        brushOverlay.addEventListener('dblclick', () => {
            brushOverlay.style.left = '';
            brushOverlay.style.top = '';
            brushOverlay.style.transform = 'translateX(-50%)';
            brushOverlay.style.bottom = '10px';
        });

        // Clean up function (in case we need to remove listeners)
        this.cleanupBrushControlsDrag = () => {
            brushOverlay.removeEventListener('mousedown', onPointerDown);
            brushOverlay.removeEventListener('touchstart', onPointerDown);
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('touchmove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
            window.removeEventListener('touchend', onPointerUp);
        };
    },



    /**
     * Update the right panel content based on the active drawing tool
     */
    updatePanelForTool(toolName) {
        // Hide all tool option groups first
        document.querySelectorAll('.tool-options-group').forEach(group => group.classList.add('hidden'));

        switch (toolName) {
            case 'pencil':
            case 'brush':
            case 'bucket':
            case 'dither':
            case 'stroke':
            case 'rect':
            case 'circle':
                // Drawing tools need Palette and Options
                this.showPanelSections(['panel-palette', 'panel-tool-options']);
                break;

            case 'eraser':
                // Eraser needs Size (Options) but not Palette
                this.showPanelSections(['panel-tool-options']);
                break;

            case 'eyedropper':
                // Eyedropper mainly needs Palette to see what was picked
                this.showPanelSections(['panel-palette']);
                break;

            case 'move':
                // Move tool doesn't need options, just Preview
                this.showPanelSections([]);
                break;

            default:
                // Fallback
                this.showPanelSections(['panel-palette', 'panel-tool-options']);
                break;
        }
    },

    /**
     * Utility to hide all sections and show only the requested IDs
     */
    showPanelSections(idsToShow) {
        const allSections = [
            'panel-palette',
            'panel-tool-options',
            'panel-layers',
            'panel-tool-canvas'
        ];

        allSections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (idsToShow.includes(id)) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        });
        
        // Ensure panel is open if the user clicks a specific view
        const panel = document.getElementById('side-panel');
        if (panel && panel.classList.contains('closed')) {
            // Trigger the toggle click to animate it open nicely
            const toggleBtn = document.getElementById('panel-toggle');
            if (toggleBtn) {
                toggleBtn.click();
            }
        }
    },

    /**
     * Visual helper to highlight Layers/Settings buttons
     */
    setActiveSidebarButton(activeId) {
        // Deactivate tools (visually only - assumes ToolManager handles tool state logic separately)
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        
        // Activate the specific button
        const btn = document.getElementById(activeId);
        if (btn) btn.classList.add('active');
    },

    /**
     * Update individual setting
     */
    updateSetting(key, value) {
        // Store setting in localStorage
        const settings = this.getStoredSettings();
        settings[key] = value;
        this.saveSettings(settings);
        
        // Apply setting immediately
        this.applySetting(key, value);
        
        console.log(`Setting "${key}" updated to:`, value);
    },

    /**
     * Apply a specific setting
     */
    applySetting(key, value) {
        switch (key) {
            case 'showGrid':
                // Toggle grid visibility
                const gridOverlay = document.querySelector('.grid-overlay');
                if (gridOverlay) {
                    gridOverlay.style.display = value ? 'block' : 'none';
                }
                break;
                
            case 'snapToGrid':
                // Enable/disable snap-to-grid functionality
                console.log('Snap to grid:', value ? 'enabled' : 'disabled');
                break;
                
            case 'darkMode':
                // Toggle dark/light mode
                document.body.classList.toggle('light-mode', !value);
                break;
                
            case 'autoSave':
                // Enable/disable auto-save
                if (typeof FileManager !== 'undefined') {
                    if (value) {
                        FileManager.startAutoSave();
                    } else {
                        FileManager.stopAutoSave();
                    }
                }
                break;
        }
    },

    /**
     * Get stored settings from localStorage
     */
    getStoredSettings() {
        const defaultSettings = {
            showGrid: true,
            snapToGrid: false,
            darkMode: true,
            autoSave: false
        };
        
        try {
            const stored = localStorage.getItem('tilemapSettings');
            return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
        } catch (e) {
            console.warn('Failed to load settings:', e);
            return defaultSettings;
        }
    },

    /**
     * Save settings to localStorage
     */
    saveSettings(settings) {
        try {
            localStorage.setItem('tilemapSettings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    },

    /**
     * Reset settings to defaults
     */
    resetSettings() {
        const defaultSettings = {
            showGrid: true,
            snapToGrid: false,
            darkMode: true,
            autoSave: false
        };
        
        // Apply default settings
        Object.entries(defaultSettings).forEach(([key, value]) => {
            this.applySetting(key, value);
        });
        
        // Save to localStorage
        this.saveSettings(defaultSettings);
        
        // Update UI checkboxes
        this.updateSettingsUI(defaultSettings);
        
        if (typeof InputHandler !== 'undefined') {
            InputHandler.showNotification('Settings reset to defaults', 'success');
        }
    },

    /**
     * Export settings to JSON file
     */
    exportSettings() {
        const settings = this.getStoredSettings();
        const dataStr = JSON.stringify(settings, null, 2);
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
    },

    /**
     * Update settings UI checkboxes
     */
    updateSettingsUI(settings) {
        Object.entries(settings).forEach(([key, value]) => {
            const checkbox = document.getElementById(key);
            if (checkbox && checkbox.type === 'checkbox') {
                checkbox.checked = value;
            }
        });
    },

    /**
     * Save panel state to localStorage
     */
    savePanelState(isOpen) {
        try {
            localStorage.setItem('tilemapPanelOpen', JSON.stringify(isOpen));
        } catch (e) {
            console.warn('Failed to save panel state:', e);
        }
    },

    /**
     * Load panel state from localStorage
     */
    loadPanelState() {
        try {
            const saved = localStorage.getItem('tilemapPanelOpen');
            if (saved !== null) {
                const isOpen = JSON.parse(saved);
                const panel = document.getElementById('side-panel');
                const toggleBtn = document.getElementById('panel-toggle');
                const toggleIcon = toggleBtn?.querySelector('i');
                const mainContainer = document.querySelector('.main-container');
                
                if (panel && toggleBtn && toggleIcon) {
                    if (!isOpen) {
                        panel.classList.add('closed');
                        toggleIcon.className = 'fas fa-chevron-left';
                        toggleBtn.style.right = '0';
                        mainContainer?.classList.add('panel-closed');
                    } else {
                        panel.classList.remove('closed');
                        toggleIcon.className = 'fas fa-chevron-right';
                        toggleBtn.style.right = '280px';
                        mainContainer?.classList.remove('panel-closed');
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load panel state:', e);
        }
    },



    /**
     * Show notification (delegate to InputHandler if available)
     */
    showNotification(message, type = 'info') {
        if (typeof InputHandler !== 'undefined' && InputHandler.showNotification) {
            InputHandler.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
}