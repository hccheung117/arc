/**
 * Type declarations for sql.js-fts5
 * 
 * sql.js-fts5 is API-compatible with sql.js but includes FTS5 support.
 * We import and re-export all types from sql.js.
 */
declare module 'sql.js-fts5' {
  import initSqlJs from 'sql.js';
  export * from 'sql.js';
  export default initSqlJs;
}

