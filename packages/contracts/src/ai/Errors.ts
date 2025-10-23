/**
 * Re-export existing ProviderError types from core
 * This ensures consistency across the codebase
 */
export { ProviderError, ProviderErrorCode } from '../IProvider.js';

// For backward compatibility, also export as type
export type { ProviderError as IProviderError } from '../IProvider.js';
