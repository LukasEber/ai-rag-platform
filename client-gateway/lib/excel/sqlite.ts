import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { transformers, validators, excelLogger, performanceMonitor } from './utils';

export interface TableInfo {
  table: string;
  rows: number;
  columns: string[];
}

export interface ExcelSqliteResult {
  dbPath: string;
  tables: TableInfo[];
  projectId: string;
}

// Ensure data directory exists - Docker volume compatible
function ensureDataDir(): string {
  // Use environment variable for Docker volume path, fallback to local development
  const baseDir = getExcelDataBaseDir();
  const dataDir = path.join(baseDir, 'excel-data');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    excelLogger.info(`Created Excel data directory`, { dataDir });
  }
  
  return dataDir;
}

// Get the appropriate base directory for Excel data
function getExcelDataBaseDir(): string {
  // In Docker container, use the mounted volume
  if (process.env.EXCEL_DATA_DIR) {
    return process.env.EXCEL_DATA_DIR;
  }
  
  // In development, use local directory
  if (process.env.NODE_ENV === 'development') {
    return path.join(process.cwd(), 'data');
  }
  
  // Default fallback
  return '/app/data';
}

export async function importExcelToSQLite(
  buffer: Buffer,
  projectId: string,
  fileName: string
): Promise<ExcelSqliteResult> {
  const perf = performanceMonitor.start('Excel to data conversion');

  try {
    excelLogger.info(`Starting Excel to data conversion for ${fileName}`, { projectId, fileSize: buffer.length });

    const dataDir = ensureDataDir();
    const dbId = `${projectId}_${randomUUID()}`;
    const dbPath = path.join(dataDir, `${dbId}.json`);

    // Read Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const tables: TableInfo[] = [];
    const allData: Record<string, any[]> = {};

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (jsonData.length === 0) continue;

      // Normalize table name
      const tableName = transformers.normalizeTableName(sheetName);
      
      // Get column names from first row
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow).map(col => transformers.normalizeColumnName(col));

      // Store data
      allData[tableName] = jsonData;
      
      tables.push({
        table: tableName,
        rows: jsonData.length,
        columns
      });
    }

    // Save data to JSON file
    await fs.promises.writeFile(dbPath, JSON.stringify(allData, null, 2));

    const duration = perf.end();
    excelLogger.info(`Excel to data conversion completed`, {
      fileName,
      tableCount: tables.length,
      totalRows: tables.reduce((sum, t) => sum + t.rows, 0),
      duration: `${duration.toFixed(2)}ms`
    });

    return {
      dbPath,
      tables,
      projectId
    };
  } catch (error) {
    excelLogger.error(`Excel to data conversion failed`, error, { fileName, projectId });
    throw error;
  }
}

export function executeSqlQuery(
  dbPath: string,
  query: string,
  allowedTables: string[],
  limit: number = 100
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      // Validate query
      if (!validators.isValidSqlQuery(query)) {
        resolve({ success: false, error: 'Invalid SQL query' });
        return;
      }

      // Load data from JSON file
      if (!fs.existsSync(dbPath)) {
        resolve({ success: false, error: 'Database file not found' });
        return;
      }

      const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

      // Parse and execute query
      const result = executeSimpleSqlQuery(query, data, allowedTables, limit);
      resolve(result);

    } catch (error) {
      resolve({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}

// Simple SQL query parser and executor
function executeSimpleSqlQuery(
  query: string,
  data: Record<string, any[]>,
  allowedTables: string[],
  limit: number
): { success: boolean; data?: any[]; error?: string } {
  try {
    const lowerQuery = query.toLowerCase().trim();
    
    // Basic SELECT parsing
    if (!lowerQuery.startsWith('select ')) {
      return { success: false, error: 'Only SELECT queries are supported' };
    }

    // Extract table name (simple parsing)
    const fromMatch = lowerQuery.match(/from\s+([a-z0-9_"]+)/);
    if (!fromMatch) {
      return { success: false, error: 'No FROM clause found' };
    }

    let tableName = fromMatch[1].replace(/"/g, '');
    
    // Check if table is allowed
    if (!allowedTables.includes(tableName)) {
      return { success: false, error: `Table '${tableName}' not allowed` };
    }

    // Get table data
    const tableData = data[tableName];
    if (!tableData) {
      return { success: false, error: `Table '${tableName}' not found` };
    }

    let result = [...tableData];

    // Apply WHERE clause if present
    const whereMatch = lowerQuery.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      result = applyWhereClause(result, whereClause);
    }

    // Apply ORDER BY if present
    const orderMatch = lowerQuery.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
    if (orderMatch) {
      const orderClause = orderMatch[1];
      result = applyOrderByClause(result, orderClause);
    }

    // Apply LIMIT
    const limitMatch = lowerQuery.match(/limit\s+(\d+)/i);
    const actualLimit = limitMatch ? parseInt(limitMatch[1]) : limit;
    result = result.slice(0, actualLimit);

    return { success: true, data: result };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Query execution failed' 
    };
  }
}

// Simple WHERE clause implementation
function applyWhereClause(data: any[], whereClause: string): any[] {
  // This is a simplified implementation
  // In a real scenario, you'd want a proper SQL parser
  return data.filter(row => {
    try {
      // Simple equality checks
      const conditions = whereClause.split(/\s+and\s+/i);
      return conditions.every(condition => {
        const match = condition.match(/([a-z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?/i);
        if (match) {
          const [, column, value] = match;
          return row[column]?.toString().toLowerCase() === value.toLowerCase();
        }
        return true; // If we can't parse it, include the row
      });
    } catch {
      return true; // If there's an error, include the row
    }
  });
}

// Simple ORDER BY implementation
function applyOrderByClause(data: any[], orderClause: string): any[] {
  try {
    const parts = orderClause.split(/\s*,\s*/);
    const sortConfigs = parts.map(part => {
      const match = part.match(/([a-z0-9_]+)\s+(asc|desc)?/i);
      if (match) {
        const [, column, direction] = match;
        return { column, direction: direction?.toLowerCase() || 'asc' };
      }
      return null;
    }).filter(Boolean);

    return [...data].sort((a, b) => {
      for (const config of sortConfigs) {
        if (!config) continue;
        
        const aVal = a[config.column]?.toString().toLowerCase() || '';
        const bVal = b[config.column]?.toString().toLowerCase() || '';
        
        if (aVal < bVal) return config.direction === 'desc' ? 1 : -1;
        if (aVal > bVal) return config.direction === 'desc' ? -1 : 1;
      }
      return 0;
    });
  } catch {
    return data; // If there's an error, return original data
  }
}

export function getDatabaseSchema(tables: TableInfo[]): any[] {
  return tables.map(table => ({
    table: table.table,
    columns: table.columns,
    rowCount: table.rows
  }));
}

export function cleanupDatabase(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      excelLogger.info(`Cleaned up data file: ${dbPath}`);
    }
  } catch (error) {
    excelLogger.error(`Failed to cleanup data file: ${dbPath}`, error);
  }
}
