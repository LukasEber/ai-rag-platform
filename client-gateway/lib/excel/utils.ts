import { ChatSDKError } from '../errors';

// Error types for Excel SQL operations
export enum ExcelSqlErrorType {
  FILE_PROCESSING = 'excel_file_processing',
  SQL_GENERATION = 'sql_generation',
  SQL_EXECUTION = 'sql_execution',
  AGENT_DECISION = 'agent_decision',
  DATABASE_OPERATION = 'database_operation'
}

// Enhanced error handling for Excel SQL operations
export class ExcelSqlError extends ChatSDKError {
  constructor(
    type: ExcelSqlErrorType,
    message: string,
    public metadata?: any
  ) {
    super('bad_request:api', `Excel SQL Error (${type}): ${message}`);
  }
}

// Logging utilities for Excel SQL operations
export const excelLogger = {
  info: (message: string, metadata?: any) => {
    console.log(`[Excel SQL] ${message}`, metadata ? metadata : '');
  },
  
  warn: (message: string, metadata?: any) => {
    console.warn(`[Excel SQL] WARNING: ${message}`, metadata ? metadata : '');
  },
  
  error: (message: string, error?: any, metadata?: any) => {
    console.error(`[Excel SQL] ERROR: ${message}`, error ? error : '', metadata ? metadata : '');
  },
  
  debug: (message: string, metadata?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Excel SQL] DEBUG: ${message}`, metadata ? metadata : '');
    }
  }
};

// Performance monitoring utilities
export const performanceMonitor = {
  start: (operation: string) => {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        excelLogger.debug(`${operation} completed in ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  }
};

// Validation utilities
export const validators = {
  isExcelFile: (fileName: string): boolean => {
    const excelExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
    return excelExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  },
  
  isValidSqlQuery: (query: string): boolean => {
    const trimmed = query.trim().toLowerCase();
    return trimmed.startsWith('select ') && 
           !trimmed.includes(';') &&
           !/(update|delete|insert|drop|create|alter)/.test(trimmed);
  },
  
  isValidTableName: (tableName: string): boolean => {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  }
};

// Data transformation utilities
export const transformers = {
  // Normalize Excel table names for SQL compatibility
  normalizeTableName: (name: string): string => {
    if (!name || name.trim() === '') {
      return 'table_1';
    }
    
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&') // Prefix numbers with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 63); // SQLite table name limit
  },
  
  // Normalize Excel column names for SQL compatibility
  normalizeColumnName: (name: string, index?: number): string => {
    if (!name || name.trim() === '') {
      return `col_${(index || 0) + 1}`;
    }
    
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&') // Prefix numbers with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  },
  
  // Convert Excel data types to SQLite types
  excelTypeToSqlite: (value: any): string => {
    if (value instanceof Date) return 'TEXT';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    }
    if (typeof value === 'boolean') return 'INTEGER';
    return 'TEXT';
  },
  
  // Format SQL results for better readability
  formatSqlResults: (results: any[], maxRows: number = 10): string => {
    if (!results || results.length === 0) {
      return 'No results found.';
    }
    
    const columns = Object.keys(results[0]);
    const displayResults = results.slice(0, maxRows);
    
    let formatted = `Results: ${results.length} rows\n\n`;
    formatted += `Columns: ${columns.join(', ')}\n\n`;
    
    displayResults.forEach((row, index) => {
      formatted += `Row ${index + 1}: `;
      formatted += columns.map(col => `${col}: ${row[col]}`).join(', ');
      formatted += '\n';
    });
    
    if (results.length > maxRows) {
      formatted += `\n... and ${results.length - maxRows} more rows`;
    }
    
    return formatted;
  }
};

// Configuration utilities
export const config = {
  // Default limits for SQL queries
  DEFAULT_SQL_LIMIT: 100,
  MAX_SQL_LIMIT: 1000,
  
  // File size limits
  MAX_EXCEL_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  
  // Database settings
  SQLITE_TIMEOUT: 30000, // 30 seconds
  SQLITE_BUSY_TIMEOUT: 5000, // 5 seconds
  
  // Agent settings
  MIN_CONFIDENCE_THRESHOLD: 0.3,
  AGENT_TIMEOUT: 10000, // 10 seconds
};

// Cache utilities for performance optimization
export const cache = {
  private: new Map<string, any>(),
  
  set: (key: string, value: any, ttl: number = 300000) => { // 5 minutes default
    cache.private.set(key, {
      value,
      expires: Date.now() + ttl
    });
  },
  
  get: (key: string): any => {
    const item = cache.private.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      cache.private.delete(key);
      return null;
    }
    
    return item.value;
  },
  
  clear: () => {
    cache.private.clear();
  }
};
