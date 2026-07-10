// =============================================================================
// ExplainabilityService
// src/transport/core/ExplainabilityService.js
//
// Lightweight in-memory store for explainability payloads.
// No external database required — suitable for demo and single-session use.
//
// Keyed by journeyId. Payloads are stored as-is (already frozen by formatter).
//
// Client-side usage:
//   explainabilityService.store(journeyId, payload)
//   explainabilityService.retrieve(journeyId)  → payload | null
//   explainabilityService.listAll()            → array of all payloads
//
// Server-side usage (server.js):
//   POST /api/transport/explain   — React app pushes payload after journey
//   GET  /api/transport/explain/:journeyId — external query
//
// Singleton — shared across the transport module.
// =============================================================================

class ExplainabilityService {
  constructor() {
    this._store = new Map(); // journeyId → ExplainabilityPayload
  }

  /**
   * Stores an explainability payload.
   * Overwrites any existing payload for the same journeyId.
   *
   * @param {string} journeyId
   * @param {object} payload — from ExplainabilityFormatter.buildExplainabilityPayload()
   */
  store(journeyId, payload) {
    if (!journeyId || !payload) return;
    this._store.set(journeyId, payload);
    console.log(`[EXPLAINABILITY] Stored payload for journeyId=${journeyId}`);
  }

  /**
   * Retrieves a stored explainability payload by journeyId.
   *
   * @param {string} journeyId
   * @returns {object|null}
   */
  retrieve(journeyId) {
    return this._store.get(journeyId) ?? null;
  }

  /**
   * Returns all stored payloads as an array, most recent first.
   * @returns {object[]}
   */
  listAll() {
    return [...this._store.values()].reverse();
  }

  /**
   * Returns the count of stored payloads.
   * @returns {number}
   */
  count() {
    return this._store.size;
  }

  /**
   * Clears all stored payloads.
   * Called on session reset / new journey demo cycle.
   */
  clear() {
    this._store.clear();
  }
}

// Singleton export — shared across entire transport module
export const explainabilityService = new ExplainabilityService();
