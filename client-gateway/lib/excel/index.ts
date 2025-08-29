// Main exports for Excel SQL functionality
export { intelligentDataAgent, analyzeQuestionComplexity } from './agent';
export { importExcelToSQLite, executeSqlQuery, getDatabaseSchema, cleanupDatabase } from './sqlite';
export { executeSqlQueryForAgent, formatSqlResultsForLLM, isSqlSuitableQuestion } from './llm-integration';
export { analyzeProjectDataSources, hasExcelFiles, getExcelFileInfo } from './detection';

// Utility exports
export { 
  excelLogger, 
  performanceMonitor, 
  validators, 
  transformers, 
  config, 
  cache,
  ExcelSqlError,
  ExcelSqlErrorType 
} from './utils';

// Type exports
export type { TableInfo, ExcelSqliteResult } from './sqlite';
export type { SqlQueryResult } from './llm-integration';
export type { DataSource, AgentDecision } from './agent';
