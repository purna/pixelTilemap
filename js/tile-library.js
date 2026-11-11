// tile-library.js
// Browser-based library for saving, reopening, renaming and deleting tiles.

const TileLibrary = {
    storageKey: 'tilemap-tile-library',
    currentTileIdKey: 'tilemap-current-tile',
    currentTileId: null,
    tiles: [],

    init() {
        this.load();
        this.currentTileId = localStorage.getItem(this.currentTileIdKey) || null;
        this.setupEventListeners();
        this.render();
        console.log('Tile Library initialized');
    },

    setupEventListeners() {
        const saveNewBtn = document.getElementById('save-new-tile-btn');
        if (saveNewBtn) {
            saveNewBtn.addEventListener('click', () => this.saveCurrentAsNewTile());
        }

        const newBlankBtn = document.getElementById('new-blank-tile-btn');
        if (newBlankBtn) {
            newBlankBtn.addEventListener('click', () => this.newBlankTile());
        }

        const saveWorkingCopyBtn = document.getElementById('save-working-copy-btn');
        if (saveWorkingCopyBtn) {
            saveWorkingCopyBtn.addEventListener('click', () => {
                if (typeof FileManager !== 'undefined') FileManager.saveToBrowser();
            });
        }

        const restoreWorkingCopyBtn = document.getElementById('restore-working-copy-btn');
        if (restoreWorkingCopyBtn) {
            restoreWorkingCopyBtn.addEventListener('click', async () => {
                if (typeof FileManager !== 'undefined') await FileManager.loadFromBrowser();
            });
        }

        const tileList = document.getElementById('tile-library-list');
        if (tileList) {
            tileList.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-action]');
                if (!button) return;
                const id = button.dataset.id;
                switch (button.dataset.action) {
                    case 'open': this.openTile(id); break;
                    case 'update': this.updateTile(id); break;
                    case 'rename': this.renameTile(id); break;
                    case 'delete': this.deleteTile(id); break;
                }
            });
        }

        const tilesBtn = document.getElementById('tilesBtn');
        if (tilesBtn) {
            tilesBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (typeof SettingsManager !== 'undefined') {
                    SettingsManager.openSettings();
                    SettingsManager.openTab('tiles');
                }
                if (typeof UIManager !== 'undefined') {
                    UIManager.setActiveSidebarButton('tilesBtn');
                }
            });
        }

        const nameInput = document.getElementById('tile-name-input');
        if (nameInput) {
            nameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.saveCurrentAsNewTile();
                }
            });
        }
    },

    load() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            this.tiles = Array.isArray(parsed) ? parsed.filter(tile => tile && tile.id && tile.data) : [];
        } catch (error) {
            console.warn('Could not load tile library:', error);
            this.tiles = [];
        }
    },

    persist() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.tiles));
            if (this.currentTileId) {
                localStorage.setItem(this.currentTileIdKey, this.currentTileId);
            } else {
                localStorage.removeItem(this.currentTileIdKey);
            }
        } catch (error) {
            console.error('Could not save tile library:', error);
            if (typeof Notifications !== 'undefined') {
                new Notifications().error('Browser storage is full. Delete a tile and try again.');
            }
        }
    },

    createId() {
        return (window.crypto && typeof window.crypto.randomUUID === 'function')
            ? window.crypto.randomUUID()
            : `tile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    getSuggestedName() {
        const input = document.getElementById('tile-name-input');
        const value = input?.value.trim();
        return value || `Tile ${this.tiles.length + 1}`;
    },

    getThumbnail() {
        if (typeof DOM === 'undefined' || !DOM.editorCanvas) return '';
        try {
            const thumb = document.createElement('canvas');
            thumb.width = 96;
            thumb.height = 96;
            const ctx = thumb.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 96, 96);
            ctx.drawImage(DOM.editorCanvas, 0, 0, 96, 96);
            return thumb.toDataURL('image/png');
        } catch (error) {
            console.warn('Could not create tile thumbnail:', error);
            return '';
        }
    },

    saveCurrentAsNewTile() {
        if (typeof FileManager === 'undefined') return;
        const name = this.getSuggestedName();
        const now = new Date().toISOString();
        const tile = {
            id: this.createId(),
            name,
            thumbnail: this.getThumbnail(),
            data: FileManager.createProjectData(),
            createdAt: now,
            updatedAt: now
        };

        this.tiles.unshift(tile);
        this.currentTileId = tile.id;
        this.persist();
        this.render();
        this.setNameInput(name);
        if (typeof State !== 'undefined') State.markSaved();

        if (typeof Notifications !== 'undefined') {
            new Notifications().success(`"${name}" saved to your browser tile library`);
        }
    },

    updateTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile || typeof FileManager === 'undefined') return;

        tile.data = FileManager.createProjectData();
        tile.thumbnail = this.getThumbnail();
        tile.updatedAt = new Date().toISOString();
        this.currentTileId = id;
        this.persist();
        this.render();
        if (typeof State !== 'undefined') State.markSaved();

        if (typeof Notifications !== 'undefined') {
            new Notifications().success(`"${tile.name}" updated in the browser`);
        }
    },

    async openTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile || typeof FileManager === 'undefined') return;

        if (State.hasUnsavedChanges && !confirm('Open this tile and discard the current unsaved changes?')) {
            return;
        }

        try {
            await FileManager.loadProjectData(tile.data);
            this.currentTileId = id;
            this.persist();
            this.setNameInput(tile.name);
            this.render();
            if (typeof Notifications !== 'undefined') {
                new Notifications().success(`"${tile.name}" opened for editing`);
            }
        } catch (error) {
            console.error('Could not open tile:', error);
            if (typeof Notifications !== 'undefined') {
                new Notifications().error('Could not open this tile.');
            }
        }
    },

    renameTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile) return;
        const name = prompt('Rename tile:', tile.name);
        if (!name || !name.trim()) return;
        tile.name = name.trim();
        tile.updatedAt = new Date().toISOString();
        if (this.currentTileId === id) this.setNameInput(tile.name);
        this.persist();
        this.render();
        if (typeof Notifications !== 'undefined') new Notifications().success('Tile renamed');
    },

    deleteTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile) return;
        if (!confirm(`Delete "${tile.name}" from your browser? This cannot be undone.`)) return;

        this.tiles = this.tiles.filter(item => item.id !== id);
        if (this.currentTileId === id) this.currentTileId = null;
        this.persist();
        this.render();
        if (typeof Notifications !== 'undefined') new Notifications().info(`"${tile.name}" deleted`);
    },

    newBlankTile() {
        if (State.hasUnsavedChanges && !confirm('Start a new blank tile and discard the current unsaved changes?')) {
            return;
        }

        State.layers.forEach(layer => {
            layer.canvas.getContext('2d').clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        });
        if (State.layers.length === 0) State.addLayer('Layer 1');

        State.activeLayerIndex = 0;
        State.history = [];
        State.historyIndex = -1;
        this.currentTileId = null;
        this.persist();

        if (typeof LayerManager !== 'undefined') LayerManager.renderLayers();
        if (typeof TilemapCore !== 'undefined') TilemapCore.updatePreviews();
        State.markUnsaved();

        this.setNameInput(`Tile ${this.tiles.length + 1}`);
        this.render();
        if (typeof Notifications !== 'undefined') new Notifications().info('New blank tile created');
    },

    setNameInput(name) {
        const input = document.getElementById('tile-name-input');
        if (input) input.value = name || '';
    },

    escape(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    render() {
        const list = document.getElementById('tile-library-list');
        if (!list) return;

        if (this.tiles.length === 0) {
            list.innerHTML = `
                <div class="tile-library-empty">
                    <i class="fas fa-table-cells-large"></i>
                    <p>No saved tiles yet.</p>
                    <span>Draw a tile, give it a name, then choose “Save Current as New Tile”.</span>
                </div>
            `;
            return;
        }

        list.innerHTML = this.tiles.map(tile => {
            const isCurrent = tile.id === this.currentTileId;
            const updated = new Date(tile.updatedAt || tile.createdAt).toLocaleDateString();
            return `
                <article class="tile-card${isCurrent ? ' current' : ''}" data-tile-id="${this.escape(tile.id)}">
                    <div class="tile-card-preview">
                        ${tile.thumbnail ? `<img src="${tile.thumbnail}" alt="" draggable="false">` : '<i class="fas fa-image"></i>'}
                    </div>
                    <div class="tile-card-info">
                        <strong title="${this.escape(tile.name)}">${this.escape(tile.name)}</strong>
                        <span>${isCurrent ? 'Currently editing · ' : ''}Updated ${updated}</span>
                    </div>
                    <div class="tile-card-actions">
                        <button type="button" class="btn compact primary" data-action="open" data-id="${this.escape(tile.id)}">Edit</button>
                        <button type="button" class="btn compact" data-action="update" data-id="${this.escape(tile.id)}" title="Overwrite with the current canvas">Update</button>
                        <button type="button" class="btn compact icon-only" data-action="rename" data-id="${this.escape(tile.id)}" title="Rename tile"><i class="fas fa-pen"></i></button>
                        <button type="button" class="btn compact icon-only danger" data-action="delete" data-id="${this.escape(tile.id)}" title="Delete tile"><i class="fas fa-trash"></i></button>
                    </div>
                </article>
            `;
        }).join('');
    }
};
