// src/lib/constants.ts

// ── Timing ──────────────────────────────────────────────
export const SNAPSHOT_INTERVAL = 200 // ops before auto-snapshot
export const FILE_SAVE_DELAY = 1000 // ms debounce before writing to disk
export const WRITE_COOLDOWN = 2000 // ms minimum between file writes
export const IDB_FLUSH_DELAY = 50 // ms to batch IndexedDB ops
export const INDEX_UPDATE_DELAY = 500 // ms debounce for search index rebuild
export const TEXT_DEBOUNCE_DELAY = 300 // ms debounce for text edits
export const SEARCH_DEBOUNCE_DELAY = 200 // ms debounce for search input
export const VIM_PENDING_TIMEOUT = 500 // ms before vim pending key resets
export const TAG_PICKER_HIDE_DELAY = 150 // ms delay before hiding tag picker
export const FILE_POLL_INTERVAL = 5000 // ms between file polls (web-fs)
export const FILE_POLL_INTERVAL_FAST = 2000 // ms between file polls (single-file)

// ── Undo ────────────────────────────────────────────────
export const MAX_UNDO = 200

// ── Layout ──────────────────────────────────────────────
export const ROW_HEIGHT = 32 // px per outline row
export const VIRTUAL_SCROLL_BUFFER = 10 // extra rows above/below viewport
export const VIRTUAL_SCROLL_THRESHOLD = 100 // min rows before virtualization kicks in

// ── Drag & Drop ─────────────────────────────────────────
export const DRAG_THRESHOLD = 5 // px movement before drag starts
export const DROP_ZONE_BEFORE = 0.25 // top 25% = insert before
export const DROP_ZONE_AFTER = 0.75 // bottom 25% = insert after (middle = into)
export const OVERLAY_Z_INDEX = '9999'
export const DRAG_SCALE = 'scale(1.02)'
export const DRAG_SHADOW_CARD = '0 8px 24px rgba(0,0,0,0.18)'
export const DRAG_SHADOW_ROW = '0 4px 16px rgba(0,0,0,0.15)'
export const DRAG_OPACITY = '0.9'
export const DRAG_BORDER_RADIUS = '4px'
export const DRAG_TRANSITION = 'box-shadow 0.15s, transform 0.15s'

// ── Popover / Dropdown ──────────────────────────────────
export const POPOVER_PADDING = 8 // px from viewport edge
export const POPOVER_OFFSET = 4 // px gap between trigger and popover
export const POPOVER_MIN_EDGE = 4 // px minimum from any viewport edge
export const DEFAULT_DROPDOWN_HEIGHT = 256 // px estimated dropdown height
export const SUBMENU_WIDTH_THRESHOLD = 160 // px remaining space to flip submenu

// ── Outline ─────────────────────────────────────────────
export const OUTLINE_DEPTH_INDENT = 24 // px per depth level
export const OUTLINE_BASE_PADDING = 8 // px left padding at depth 0

// ── Sidebar ─────────────────────────────────────────────
export const SIDEBAR_DEPTH_INDENT = 16 // px per depth level
export const SIDEBAR_BASE_PADDING = 12 // px left padding at depth 0

// ── Tags ────────────────────────────────────────────────
export const MAX_TAG_SUGGESTIONS = 8
export const TAG_ITEM_HEIGHT = 30 // px per suggestion item
export const TAG_DROPDOWN_PADDING = 4 // px padding in dropdown
