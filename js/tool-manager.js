// tool-manager.js
// Tool management and keyboard shortcuts

const ToolManager = {
    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();

        // Set initial tool and brush presets
        this.setTool('pencil');

        // Update brush size label for initial tool
        this.updateBrushSizeLabel();

        // Fix: Set initial brush size (radius 0 for 1x1) and sync UI/State
        // Assuming Config.DEFAULT_BRUSH_SIZE is 0.
        this.setBrushSize(Config.DEFAULT_BRUSH_SIZE);

        console.log('Tool Manager initialized');
    },

    setupEventListeners() {
        // Tool button clicks (excluding layers and settings)
        DOM.elements.toolButtons.forEach(button => {
            if (button.dataset.tool) {
                button.addEventListener('click', () => {
                    const tool = button.dataset.tool;
                    this.setTool(tool);
                });
            }
        });

        // Brush size slider (right panel)
        if (DOM.elements.brushSizeSlider) {
            DOM.elements.brushSizeSlider.addEventListener('input', (e) => {
                const size = parseInt(e.target.value, 10);
                this.setBrushSize(size);
            });
        }

        // Opacity slider (right panel)
        if (DOM.elements.opacitySlider) {
            DOM.elements.opacitySlider.addEventListener('input', (e) => {
                const opacity = e.target.value / 100;
                State.setOpacity(opacity);
                // Update display immediately
                if (DOM.elements.opacityDisplay) {
                    DOM.elements.opacityDisplay.textContent = `${e.target.value}%`;
                }
                // Update opacity preset buttons
                if (typeof InputHandler !== 'undefined' && InputHandler.updatePresetOpacityButtons) {
                    InputHandler.updatePresetOpacityButtons(opacity);
                }
            });
        }

        // Spray-can controls
        if (DOM.elements.sprayDensity) {
            DOM.elements.sprayDensity.addEventListener('input', (e) => {
                State.sprayDensity = parseInt(e.target.value, 10);
                if (DOM.elements.sprayDensityDisplay) {
                    DOM.elements.sprayDensityDisplay.textContent = `${State.sprayDensity}%`;
                }
            });
        }
        if (DOM.elements.sprayOpacityVariation) {
            DOM.elements.sprayOpacityVariation.addEventListener('input', (e) => {
                State.sprayOpacityVariation = parseInt(e.target.value, 10) / 100;
                if (DOM.elements.sprayOpacityVariationDisplay) {
                    DOM.elements.sprayOpacityVariationDisplay.textContent = `${e.target.value}%`;
                }
            });
        }
        if (DOM.elements.sprayUsePalette) {
            DOM.elements.sprayUsePalette.addEventListener('change', (e) => {
                State.sprayUsePalette = e.target.checked;
            });
        }

        // Attach preset button listeners
        this.attachPresetButtonListeners();
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;

            // Tool shortcuts
            if (!ctrl) {
                switch (key) {
                    case 'p':
                        this.setTool('pencil');
                        e.preventDefault();
                        break;
                    case 'b':
                        this.setTool('brush');
                        e.preventDefault();
                        break;
                    case 'e':
                        this.setTool('eraser');
                        e.preventDefault();
                        break;
                    case 's':
                        this.setTool('spray');
                        e.preventDefault();
                        break;
                    case 'i':
                        this.setTool('eyedropper');
                        e.preventDefault();
                        break;
                    case 'l':
                        // Show layers panel through the shared sidebar manager
                        if (typeof UIManager !== 'undefined') {
                            UIManager.showPanelSections(['panel-layers']);
                            UIManager.setActiveSidebarButton('layersBtn');
                        }
                        e.preventDefault();
                        break;
                }
            }

            // File operations
            if (ctrl) {
                switch (key) {
                    case 's':
                        FileManager.saveProject();
                        e.preventDefault();
                        break;
                    case 'o':
                        FileManager.loadProject();
                        e.preventDefault();
                        break;
                    case 'z':
                        State.undo();
                        e.preventDefault();
                        break;
                    case 'y':
                        State.redo();
                        e.preventDefault();
                        break;
                }
            }
        });
    },

    updateBrushSizeLabel() {
        const labelPanel = DOM.elements.brushSizeLabelPanel;
        
        if (!labelPanel) return;
        
        if (State.currentTool === 'pencil') {
            labelPanel.textContent = 'Pencil Size:';
        } else if (State.currentTool === 'spray') {
            labelPanel.textContent = 'Spray Size:';
        } else if (State.currentTool === 'eraser') {
            labelPanel.textContent = 'Eraser Size:';
        } else {
            labelPanel.textContent = 'Brush Size:';
        }
    },

    setTool(tool) {
        State.currentTool = tool;

        // Erasing is handled by the drawing code; keep the user's selected
        // colour intact so it is still there when they switch back to pencil.
        // (Setting State.currentColor to "transparent" previously broke the
        // colour picker after using the eraser.)

        // Update active class on buttons
        DOM.elements.toolButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tool === tool) {
                button.classList.add('active');
            }
        });

        // Spray works on a 3×3 logical-pixel minimum.
        if (DOM.elements.brushSizeSlider) {
            DOM.elements.brushSizeSlider.min = tool === 'spray' ? '1' : '0';
        }
        if (tool === 'spray' && State.brushSize < 1) {
            this.setBrushSize(1);
        }

        // Update tool options visibility
        this.showToolOptions(tool);

        // Update brush size label based on tool
        this.updateBrushSizeLabel();

        // Switch brush size presets based on tool
        this.updateBrushSizePresets(tool);

        // Ensure UI and State are in sync for brush size
        if (State.brushSize !== undefined) {
            this.setBrushSize(State.brushSize);
        }

        // Stop a running spray timer when leaving the spray tool.
        if (tool !== 'spray' && typeof TilemapCore !== 'undefined' && TilemapCore.stopSpray) {
            TilemapCore.stopSpray();
        }

        // Spray-only options
        const sprayOptions = document.getElementById('spray-options');
        if (sprayOptions) {
            sprayOptions.classList.toggle('hidden', tool !== 'spray');
        }

        // Selecting a drawing tool leaves the Layers/Canvas/Tilemap views.
        // This also covers keyboard shortcuts, not just mouse clicks.
        if (typeof State !== 'undefined') {
            State.showLayers = false;
        }
        ['layersBtn', 'canvasBtn', 'settingsBtn', 'tilemapBtn'].forEach((id) => {
            document.getElementById(id)?.classList.remove('active');
        });
        if (typeof UIManager !== 'undefined' && UIManager.updatePanelForTool) {
            UIManager.updatePanelForTool(tool);
        }
    },

    setBrushSize(radius) {
        // Ensure radius is an integer
        radius = Math.round(radius);

        // 1. Update State
        State.setBrushSize(radius);

        // 2. Update UI (slider and displays)
        if (DOM.elements.brushSizeSlider) {
            DOM.elements.brushSizeSlider.value = radius;
        }
        DOM.updateBrushDisplay(radius);
        this.updateActivePresetButton(radius);
    },

    updateToolUI() {
        DOM.elements.toolButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tool === State.currentTool);
        });
    },

    updateActivePresetButton(size) {
        // Update floating overlay preset buttons (uses radius as data-size)
        // Exclude opacity buttons
        document.querySelectorAll('.preset-btn:not(.opacity-btn)').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === size);
        });
        
        // Update right panel preset buttons (uses radius as data-size)
        document.querySelectorAll('.preset-size').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size, 10) === size);
        });
    },

    updateBrushSizePresets(tool) {
        const floatingContainer = document.getElementById('floating-brush-presets');
        const panelContainer = document.getElementById('panel-preset-sizes');
        
        // Only require floating container, panel container is optional
        if (!floatingContainer) return;

        if (tool === 'pencil') {
            // Pencil tool: hard edges, sizes 1,2,3,4
            floatingContainer.innerHTML = `
                <button class="preset-btn" data-size="0">1</button>
                <button class="preset-btn" data-size="1">2</button>
                <button class="preset-btn" data-size="2">3</button>
                <button class="preset-btn" data-size="3">4</button>
            `;
            if (panelContainer) {
                panelContainer.innerHTML = `
                    <button class="preset-size active" data-size="0"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">1</button>
                    <button class="preset-size" data-size="1"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">2</button>
                    <button class="preset-size" data-size="2"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">3</button>
                    <button class="preset-size" data-size="3"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">4</button>
                `;
            }
        } else if (tool === 'spray') {
            // Spray can: wider working sizes
            floatingContainer.innerHTML = `
                <button class="preset-btn" data-size="1">3</button>
                <button class="preset-btn" data-size="3">7</button>
                <button class="preset-btn" data-size="5">11</button>
                <button class="preset-btn" data-size="8">17</button>
            `;
            if (panelContainer) {
                panelContainer.innerHTML = '';
            }
        } else {
            // Brush tool: soft edges with alpha, sizes 1,3,7,11
            floatingContainer.innerHTML = `
                <button class="preset-btn" data-size="0">1</button>
                <button class="preset-btn" data-size="1">3</button>
                <button class="preset-btn" data-size="3">7</button>
                <button class="preset-btn" data-size="5">11</button>
            `;
            if (panelContainer) {
                panelContainer.innerHTML = `
                    <button class="preset-size active" data-size="0"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">1</button>
                    <button class="preset-size" data-size="1"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">3</button>
                    <button class="preset-size" data-size="3"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">7</button>
                    <button class="preset-size" data-size="5"
                        style="background:var(--bg-light); border:1px solid var(--border-color); color:var(--text-primary); padding:2px 6px; border-radius:3px; cursor:pointer; font-size:10px; min-width:24px;">11</button>
                `;
            }
        }

        // Re-attach event listeners for the new buttons
        this.attachPresetButtonListeners();
    },

    attachPresetButtonListeners() {
        // Use event delegation on document level to handle dynamically created buttons.
        // Bind once; updateBrushSizePresets replaces the buttons, not the listener.
        if (this._presetDelegationAttached) return;
        this._presetDelegationAttached = true;
        // Exclude opacity buttons which have their own handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-btn') && !e.target.classList.contains('opacity-btn')) {
                const radius = parseInt(e.target.dataset.size, 10);
                if (!isNaN(radius)) {
                    this.setBrushSize(radius);
                }
            } else if (e.target.classList.contains('preset-brush-size')) {
                const radius = parseInt(e.target.dataset.size, 10);
                if (!isNaN(radius)) {
                    this.setBrushSize(radius);
                }
            }
        });
    },

    showToolOptions(tool) {
        // Hide all panels first
        this.hideAllPanels();

        // Show relevant options based on tool
        switch (tool) {
            case 'pencil':
                this.showPalettePanel();
                this.showToolOptionsPanel(true); // Show opacity but hide brush sizes for pencil
                break;
            case 'brush':
                this.showPalettePanel();
                this.showToolOptionsPanel(false); // Show both brush sizes and opacity
                break;
            case 'spray':
                this.showPalettePanel();
                this.showToolOptionsPanel(false);
                break;
            case 'eraser':
                this.showToolOptionsPanel(false); // Show brush sizes and opacity
                break;
            case 'eyedropper':
                this.showPalettePanel();
                break;
        }
    },

    hideAllPanels() {
        // Hide all panel sections
        const panels = [
            'panel-palette',
            'panel-layers',
            'panel-tool-options'
        ];

        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('hidden');
            }
        });
    },

    showPalettePanel() {
        const panel = document.getElementById('panel-palette');
        if (panel) {
            panel.classList.remove('hidden');
        }
    },

    showToolOptionsPanel(pencilMode = false) {
        const panel = document.getElementById('panel-tool-options');
        if (panel) {
            panel.classList.remove('hidden');

            // Always show brush size controls for all tools
            const brushSizeControls = panel.querySelector('div[style*="margin-bottom:10px"]');
            if (brushSizeControls) {
                brushSizeControls.style.display = 'block';
            }
        }
    },



    // Eyedropper tool functionality
    pickColor(x, y) {
        // Get pixel color from canvas at coordinates
        const imageData = DOM.editorCtx.getImageData(x, y, 1, 1);
        const [r, g, b, a] = imageData.data;

        if (a === 0) {
            // Transparent pixel, return white
            return '#ffffff';
        }

        // Convert RGB to hex
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        return hex;
    },

    // Get current tool info
    getCurrentTool() {
        return {
            type: State.currentTool,
            color: State.currentColor,
            brushSize: State.brushSize,
            opacity: State.opacity
        };
    },

    // Set tool properties
    setToolProperties(properties) {
        if (properties.color) {
            State.setColor(properties.color);
        }
        if (properties.brushSize !== undefined) {
            State.setBrushSize(properties.brushSize);
            DOM.elements.brushSizeSlider.value = properties.brushSize;
            DOM.updateBrushDisplay(properties.brushSize);
        }
        if (properties.opacity !== undefined) {
            State.setOpacity(properties.opacity);
            DOM.elements.opacitySlider.value = properties.opacity * 100;
        }
    },

    // Get all available tools
    getAvailableTools() {
        return [
            { id: 'pencil', name: 'Pencil', icon: 'fas fa-pencil-alt', shortcut: 'P' },
            { id: 'brush', name: 'Brush', icon: 'fas fa-paint-brush', shortcut: 'B' },
            { id: 'spray', name: 'Spray Can', icon: 'fas fa-spray-can', shortcut: 'S' },
            { id: 'eraser', name: 'Eraser', icon: 'fas fa-eraser', shortcut: 'E' },
            { id: 'eyedropper', name: 'Color Picker', icon: 'fas fa-eye-dropper', shortcut: 'I' }
        ];
    },

    // Tool descriptions
    getToolDescription(tool) {
        const descriptions = {
            pencil: 'Draw with a single pixel at a time.',
            brush: 'Paint with the selected color. Left click to paint, right click to erase.',
            spray: 'Spray dither particles over an area. Adjust size, density and opacity variation.',
            eraser: 'Remove pixels from the canvas. Left click to erase, right click to paint.',
            eyedropper: 'Pick a color from the canvas by clicking on it.'
        };
        return descriptions[tool] || 'Unknown tool';
    },

    // Get tool icon class
    getToolIcon(tool) {
        const icons = {
            pencil: 'fas fa-pencil-alt',
            brush: 'fas fa-paint-brush',
            spray: 'fas fa-spray-can',
            eraser: 'fas fa-eraser',
            eyedropper: 'fas fa-eye-dropper'
        };
        return icons[tool] || 'fas fa-question';
    },

    // Drawing methods for tool interaction
    startDrawing(x, y, tileX, tileY) {
        if (State.currentTool === 'eyedropper') {
            // Eyedropper tool: pick color and update palette
            const color = this.pickColor(x, y);
            if (typeof PaletteManager !== 'undefined') {
                PaletteManager.setCurrentColor(color);
            }
            // Don't actually draw, just pick color
            return;
        }
        
        // For other tools, implement drawing logic here
        // This would handle pencil, brush, eraser tools
    },

    continueDrawing(x, y, tileX, tileY) {
        if (State.currentTool === 'eyedropper') {
            // Eyedropper doesn't continue drawing, just picks on click
            return;
        }
        
        // For other tools, implement continuous drawing logic here
    },

    stopDrawing(x, y, tileX, tileY) {
        if (State.currentTool === 'eyedropper') {
            // Eyedropper stops after picking color
            return;
        }
        
        // For other tools, implement drawing end logic here
    },

    cancelOperation() {
        // Cancel current operation
        State.setDrawing(false);
    }
};