// palette-manager.js
// Color palette management

const PaletteManager = {
    init() {
        State.loadRecentColors();
        this.renderPalette();
        this.renderRecentColors();
        this.setupEventListeners();
        this.setupColorHistoryDrag();
        this.setupColorHistoryShortcuts();
        console.log('Palette Manager initialized');
    },
    
    setupEventListeners() {
        const colorPicker = DOM.elements.colorPicker;
        const colorHex = DOM.elements.colorHex;
        const saveColorBtn = DOM.elements.saveColorBtn;
        
        // Color picker change
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            this.setCurrentColor(color);
        });
        
        // Hex input change
        colorHex.addEventListener('input', (e) => {
            const color = e.target.value;
            if (this.isValidHex(color)) {
                this.setCurrentColor(color);
            }
        });
        
        // Color picker blur (when user finishes typing)
        colorHex.addEventListener('blur', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) {
                color = '#' + color;
            }
            if (this.isValidHex(color)) {
                this.setCurrentColor(color);
            } else {
                // Revert to previous valid color
                e.target.value = State.currentColor;
            }
        });
        
        // Save color to palette
        saveColorBtn.addEventListener('click', () => {
            this.saveCurrentColor();
        });
        
        // Palette swatch clicks
        DOM.elements.paletteContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('swatch')) {
                const color = e.target.dataset.color;
                this.setCurrentColor(color);
            }
        });

        // Floating colour history palette
        const recentContainer = document.getElementById('recent-colors-swatches');
        if (recentContainer) {
            recentContainer.addEventListener('click', (event) => {
                const swatch = event.target.closest('.color-swatch');
                if (!swatch) return;
                this.setCurrentColor(swatch.dataset.color);
            });
        }
    },

    setupColorHistoryShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.ctrlKey || event.metaKey || event.altKey) return;
            const index = parseInt(event.key, 10) - 1;
            if (index < 0 || index > 3) return;
            const color = State.recentColors[index];
            if (color) {
                this.setCurrentColor(color);
                event.preventDefault();
            }
        });
    },

    setupColorHistoryDrag() {
        const element = document.getElementById('recent-colors');
        if (!element) return;

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        element.addEventListener('mousedown', (event) => {
            if (event.target.closest('.color-swatch') || event.target.closest('button')) return;
            isDragging = true;
            const rect = element.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            element.style.transform = 'none';
            element.style.cursor = 'grabbing';
            event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
            if (!isDragging) return;
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            const x = Math.max(6, Math.min(window.innerWidth - width - 6, event.clientX - offsetX));
            const y = Math.max(6, Math.min(window.innerHeight - height - 6, event.clientY - offsetY));
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            element.style.cursor = 'move';
        });

        element.addEventListener('dblclick', (event) => {
            if (event.target.closest('.color-swatch')) return;
            element.style.left = '140px';
            element.style.top = '50%';
            element.style.transform = 'translateY(-50%)';
        });
    },

    renderRecentColors() {
        const container = document.getElementById('recent-colors-swatches');
        if (!container) return;
        container.innerHTML = '';
        State.recentColors.slice(0, 4).forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.dataset.color = color;
            swatch.dataset.colorIndex = index;
            swatch.title = `Recent Color ${index + 1} (Press ${index + 1})`;
            swatch.setAttribute('role', 'button');
            swatch.setAttribute('tabindex', '0');
            swatch.setAttribute('aria-label', `Use recent colour ${color}`);
            swatch.style.backgroundColor = color;
            if (color.toLowerCase() === String(State.currentColor).toLowerCase()) {
                swatch.classList.add('active');
            }
            container.appendChild(swatch);
        });
    },
    
    setCurrentColor(color) {
        if (this.isValidHex(color)) {
            State.setColor(color);
            DOM.elements.colorPicker.value = color;
            DOM.elements.colorHex.value = color;
            this.updateActiveSwatch(color);
            this.renderRecentColors();
        }
    },
    
    updateActiveSwatch(color) {
        // Remove active class from all swatches
        DOM.elements.paletteContainer.querySelectorAll('.swatch').forEach(swatch => {
            swatch.classList.remove('active');
        });
        
        // Add active class to current color swatch
        const activeSwatch = DOM.elements.paletteContainer.querySelector(`[data-color="${color}"]`);
        if (activeSwatch) {
            activeSwatch.classList.add('active');
        }
    },
    
    renderPalette() {
        const container = DOM.elements.paletteContainer;
        container.innerHTML = '';
        
        State.paletteColors.forEach(color => {
            const swatch = DOM.createSwatch(color, color === State.currentColor);
            container.appendChild(swatch);
        });
    },
    
    saveCurrentColor() {
        State.addColorToPalette(State.currentColor);
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Color ${State.currentColor} saved to palette`);
        }
    },
    
    isValidHex(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    },
    
    // Import palette from array of colors
    importPalette(colors) {
        State.paletteColors = colors.filter(color => this.isValidHex(color)).slice(0, Config.PALETTE_SIZE);
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Palette imported with ${State.paletteColors.length} colors`);
        }
    },
    
    // Import palette from Coolors URL
    importPaletteFromUrl(url) {
        if (!url) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('No URL provided');
            }
            return;
        }

        // Validate Coolors URL format
        const coolorsPattern = /^https:\/\/coolors\.co\/([a-fA-F0-9-]{5,})$/;
        const match = url.match(coolorsPattern);

        if (!match) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Invalid Coolors URL format');
            }
            return;
        }

        // Extract color codes from URL
        const colorCodes = match[1].split('-');

        // Convert to full hex colors (add # if missing)
        const colors = colorCodes.map(code => {
            return code.startsWith('#') ? code : '#' + code;
        }).filter(color => this.isValidHex(color));

        if (colors.length === 0) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('No valid colors found in URL');
            }
            return;
        }

        // Import the colors
        this.importPalette(colors);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Imported ${colors.length} colors from Coolors`);
        }
    },
    
    // Export current palette
    exportPalette() {
        return [...State.paletteColors];
    },
    
    // Get specific color from palette
    getColor(index) {
        return State.paletteColors[index];
    },
    
    // Get all palette colors
    getAllColors() {
        return [...State.paletteColors];
    },
    
    // Clear palette
    clearPalette() {
        State.paletteColors = [];
        this.renderPalette();
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.info('Palette cleared');
        }
    },
    
    // Add multiple colors to palette
    addColors(colors) {
        colors.forEach(color => {
            if (this.isValidHex(color) && !State.paletteColors.includes(color)) {
                State.paletteColors.push(color);
            }
        });
        
        // Limit palette size
        if (State.paletteColors.length > Config.PALETTE_SIZE) {
            State.paletteColors = State.paletteColors.slice(-Config.PALETTE_SIZE);
        }
        
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
    }
};