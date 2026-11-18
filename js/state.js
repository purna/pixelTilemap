// state.js
// Application state management

const State = {
    // Drawing state
    currentTool: 'pencil',
    currentColor: '#282828',
    brushSize: 0,  // 1x1 brush for pencil tool
    opacity: 1.0,
    sprayDensity: 14,
    sprayOpacityVariation: 0.5,
    sprayUsePalette: false,
    
    // Canvas state
    isDrawing: false,
    currentBrush: Config.DRAW_COLOR,
    zoom: 1,
    
    // Layers state
    layers: [],
    activeLayerIndex: 0,
    
    // UI state
    showLayers: false,
    recentColors: ['#282828', '#ffffff', '#ff0000', '#00ff00'],
    paletteColors: [
        '#282828', '#ffffff', '#ff0000', '#00ff00', 
        '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
        '#ffa500', '#800080', '#ffc0cb', '#a52a2a',
        '#808080', '#c0c0c0', '#90ee90', '#ff6347'
    ],
    
    // File state
    hasUnsavedChanges: false,
    filename: null,
    
    // History for undo/redo
    history: [],
    historyIndex: -1,
    
    // Methods
    setTool(tool) {
        this.currentTool = tool;
        this.updateUI();
    },
    
    setColor(color) {
        // Ensure color is in hex format for storage
        if (color.startsWith('#')) {
            this.currentColor = color;
            this.currentBrush = this.hexToRgb(color);
        } else if (color.startsWith('rgb')) {
            // Convert RGB to hex for storage
            this.currentColor = this.rgbToHex(color);
            this.currentBrush = color;
        } else {
            // Assume it's already in hex format
            this.currentColor = color.startsWith('#') ? color : '#' + color;
            this.currentBrush = color === 'transparent' ? 'transparent' : this.hexToRgb(this.currentColor);
        }
        this.recordRecentColor(this.currentColor);
        this.updateUI();
    },

    recordRecentColor(color) {
        if (!/^#[A-Fa-f0-9]{6}$/.test(color)) return;
        const normalized = color.toLowerCase();
        this.recentColors = [normalized, ...this.recentColors.filter(item => item.toLowerCase() !== normalized)].slice(0, 4);
        try {
            localStorage.setItem('tilemap-recent-colors', JSON.stringify(this.recentColors));
        } catch (error) {
            // Storage may be unavailable; the palette still works for this session.
        }
        if (typeof PaletteManager !== 'undefined' && typeof PaletteManager.renderRecentColors === 'function') {
            PaletteManager.renderRecentColors();
        }
    },

    loadRecentColors() {
        try {
            const saved = JSON.parse(localStorage.getItem('tilemap-recent-colors') || '[]');
            if (Array.isArray(saved) && saved.length) {
                this.recentColors = saved.filter(color => /^#[A-Fa-f0-9]{6}$/.test(color)).slice(0, 4);
            }
        } catch (error) {
            // Ignore malformed recent colour history.
        }
    },
    
    setBrushSize(size) {
        this.brushSize = size;
        this.updateUI();
    },
    
    setOpacity(opacity) {
        this.opacity = opacity;
        this.updateUI();
    },
    
    setDrawing(drawing) {
        this.isDrawing = drawing;
    },
    
    setBrush(brush) {
        this.currentBrush = brush;
    },
    
    setZoom(zoom) {
        this.zoom = Math.max(0.1, Math.min(zoom, 50));
        this.updateUI();
    },
    
    zoomIn() {
        this.setZoom(this.zoom + 0.1);
    },
    
    zoomOut() {
        this.setZoom(this.zoom - 0.1);
    },
    
    resetZoom() {
        this.setZoom(1);
    },
    
    addLayer(name = 'Layer') {
        const layer = {
            id: Date.now(),
            name: name,
            visible: true,
            opacity: 1.0,
            canvas: this.createLayerCanvas()
        };
        this.layers.push(layer);
        this.activeLayerIndex = this.layers.length - 1;
        this.updateUI();
        // Update previews when layer is added
        if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
            TilemapCore.updatePreviews();
        }
    },
    
    createLayerCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = Config.CANVAS_SIZE;
        canvas.height = Config.CANVAS_SIZE;
        const ctx = canvas.getContext('2d');
        // Clear to transparent instead of white
        ctx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        return canvas;
    },
    
    removeLayer(index) {
        if (this.layers.length > 1) {
            this.layers.splice(index, 1);
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            }
            this.updateUI();
            // Update previews when layer is removed
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.updateUI();
            // Update previews when active layer changes
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    toggleLayerVisibility(index) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].visible = !this.layers[index].visible;
            this.updateUI();
            // Update previews when visibility changes
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    addColorToPalette(color) {
        if (!this.paletteColors.includes(color)) {
            this.paletteColors.push(color);
            if (this.paletteColors.length > Config.PALETTE_SIZE) {
                this.paletteColors.shift();
            }
            this.updateUI();
        }
    },
    
    setShowLayers(show) {
        this.showLayers = show;
        this.updateUI();
    },
    
    markUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateSaveState();
    },
    
    markSaved() {
        this.hasUnsavedChanges = false;
        this.updateSaveState();
    },
    
    saveState() {
        // Capture the current drawing state for undo/redo.
        const state = this.captureCurrentState();
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        // Keep undo memory bounded; large tiles store a data URL per entry.
        if (this.history.length > 40) this.history.shift();
        this.historyIndex = this.history.length - 1;
        this.notifyHistoryChanged();
    },

    /**
     * Start a fresh history with the current artwork as the baseline. This is
     * called after the initial layer, a project load, or clearing the canvas so
     * the very first paint stroke can be undone.
     */
    resetHistory() {
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
    },

    notifyHistoryChanged() {
        if (typeof FileManager !== 'undefined' && typeof FileManager.updateHistoryButtons === 'function') {
            FileManager.updateHistoryButtons();
        }
    },
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.markUnsaved();
            this.updateUI();
            this.notifyHistoryChanged();
        }
    },
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.markUnsaved();
            this.updateUI();
            this.notifyHistoryChanged();
        }
    },
    
    captureCurrentState() {
        // Capture current drawing state for undo/redo. The canvas is stored as
        // a data URL so each history entry stays reasonably compact.
        return {
            layers: this.layers.map(layer => ({
                ...layer,
                canvas: layer.canvas.toDataURL()
            })),
            activeLayerIndex: this.activeLayerIndex
        };
    },
    
    restoreState(state) {
        // Recreate layer canvases at the current resolution and paint the
        // saved data URLs into them. The old implementation assigned the new
        // canvas element to img.src, so the image never loaded and undo did
        // nothing for painting.
        this.layers = state.layers.map(layerData => ({
            ...layerData,
            canvas: this.createLayerCanvas()
        }));

        this.activeLayerIndex = Math.min(
            Math.max(0, state.activeLayerIndex || 0),
            Math.max(0, this.layers.length - 1)
        );

        const imageLoads = this.layers.map((layer, index) => {
            const dataUrl = state.layers[index] && state.layers[index].canvas;
            if (!dataUrl) return Promise.resolve();

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const ctx = layer.canvas.getContext('2d');
                    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(img, 0, 0, layer.canvas.width, layer.canvas.height);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = dataUrl;
            });
        });

        if (typeof LayerManager !== 'undefined') LayerManager.renderLayers();
        this.notifyHistoryChanged();

        return Promise.all(imageLoads).then(() => {
            if (typeof LayerManager !== 'undefined') LayerManager.renderLayers();
            if (typeof TilemapCore !== 'undefined') TilemapCore.updatePreviews();
            this.updateUI();
        });
    },
    
    hexToRgb(hex) {
        // Ensure hex starts with #
        hex = hex.startsWith('#') ? hex : '#' + hex;
        const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : 'rgb(40, 40, 40)';
    },
    
    rgbToHex(rgb) {
        const result = rgb.match(/\d+/g);
        if (result && result.length >= 3) {
            const r = Math.max(0, Math.min(255, parseInt(result[0], 10)));
            const g = Math.max(0, Math.min(255, parseInt(result[1], 10)));
            const b = Math.max(0, Math.min(255, parseInt(result[2], 10)));
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
        return '#282828'; // Default dark gray
    },
    
    updateUI() {
        // Update UI elements based on current state
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        
        // Update color controls - ensure valid hex format
        const colorPicker = document.getElementById('colorPicker');
        const colorHex = document.getElementById('colorHex');
        const validColor = this.currentColor.startsWith('#') ? this.currentColor : '#' + this.currentColor;
        if (colorPicker && /^#[A-Fa-f0-9]{6}$/.test(validColor)) colorPicker.value = validColor;
        if (colorHex && /^#[A-Fa-f0-9]{6}$/.test(validColor)) colorHex.value = validColor;
        
        // Update brush controls
        const brushSize = document.getElementById('brushSizeSlider');
        const brushSizeValue = document.getElementById('brushSizeDisplay');
        if (brushSize) brushSize.value = this.brushSize;
        if (brushSizeValue) brushSizeValue.textContent = `${this.brushSize * 2 + 1} px`;
        
        // Update opacity controls
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityDisplay = document.getElementById('opacityDisplay');
        if (opacitySlider) opacitySlider.value = this.opacity * 100;
        if (opacityDisplay) opacityDisplay.textContent = `${Math.round(this.opacity * 100)}%`;

        // Spray-can options
        const sprayDensity = document.getElementById('sprayDensity');
        const sprayDensityDisplay = document.getElementById('sprayDensityDisplay');
        if (sprayDensity) sprayDensity.value = this.sprayDensity;
        if (sprayDensityDisplay) sprayDensityDisplay.textContent = this.sprayDensity;

        const sprayOpacityVariation = document.getElementById('sprayOpacityVariation');
        const sprayOpacityVariationDisplay = document.getElementById('sprayOpacityVariationDisplay');
        if (sprayOpacityVariation) sprayOpacityVariation.value = this.sprayOpacityVariation * 100;
        if (sprayOpacityVariationDisplay) {
            sprayOpacityVariationDisplay.textContent = `${Math.round(this.sprayOpacityVariation * 100)}%`;
        }

        const sprayUsePalette = document.getElementById('sprayUsePalette');
        if (sprayUsePalette) sprayUsePalette.checked = this.sprayUsePalette;
        
        // Update panel visibility
        const layersPanel = document.getElementById('panel-layers');
        if (layersPanel) layersPanel.classList.toggle('hidden', !this.showLayers);
        
        const layersBtn = document.getElementById('layersBtn');
        if (layersBtn) layersBtn.classList.toggle('active', this.showLayers);
        
        // Update zoom display
        const zoomDisplay = document.getElementById('zoomDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${this.zoom.toFixed(1)}x`;
        }

        // Update studio chrome (header badges + footer)
        const zoomBadge = document.getElementById('zoomBadge');
        const footerZoom = document.getElementById('footerZoom');
        const zoomText = `${this.zoom.toFixed(1)}×`;
        if (zoomBadge) zoomBadge.textContent = zoomText;
        if (footerZoom) footerZoom.textContent = `Zoom ${zoomText}`;

        const tileDim = (typeof Config !== 'undefined' && Config.TILE_DIM) || 32;
        const canvasBadge = document.getElementById('canvasBadge');
        const footerCanvas = document.getElementById('footerCanvas');
        if (canvasBadge) canvasBadge.textContent = `${tileDim} × ${tileDim} px`;
        if (footerCanvas) footerCanvas.textContent = `Canvas ${tileDim} × ${tileDim}`;

        this.updateSaveState();
    },

    updateSaveState() {
        const saveState = document.getElementById('saveState');
        const footerStatus = document.getElementById('footerStatus');
        if (saveState) {
            saveState.textContent = this.hasUnsavedChanges ? 'Unsaved changes' : 'Saved';
            saveState.classList.toggle('dirty', this.hasUnsavedChanges);
        }
        if (footerStatus) {
            footerStatus.textContent = this.hasUnsavedChanges ? 'Unsaved changes' : 'Ready';
        }
    }
};