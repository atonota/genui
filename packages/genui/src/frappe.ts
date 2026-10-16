// Frappe port only: re-exports the canonical host adapter, which validates every query intent and
// the returned message envelope. Consumers supply the call transport; this entry adds no live
// client, endpoint, credentials or authentication.
export { createFrappeQuerySource } from '../../../docs/src/genui/adapters/frappe';
export type { QuerySource } from '../../../docs/src/genui/definitions';
