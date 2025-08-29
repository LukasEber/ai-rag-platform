import { getExcelSqliteByProjectId } from '../db/queries';
import { getContextFilesByProjectId } from '../db/queries';
import { validators, excelLogger } from './utils';

export interface DataSourceAnalysis {
  hasExcelFiles: boolean;
  hasOtherFiles: boolean;
  excelFiles: Array<{
    fileName: string;
    tables: any[];
    rowCount: number;
  }>;
  otherFileTypes: string[];
  totalFiles: number;
  shouldUseAgent: boolean;
}

/**
 * Analyze a project to determine if Excel SQL processing should be used
 */
export async function analyzeProjectDataSources(projectId: string): Promise<DataSourceAnalysis> {
  try {
    excelLogger.info(`[TEST] Starting data source analysis for project ${projectId}`);
    
    // Get all context files for the project
    const contextFiles = await getContextFilesByProjectId({ projectId });
    excelLogger.info(`[TEST] Found ${contextFiles.length} total context files`, { 
      projectId, 
      fileNames: contextFiles.map(f => f.fileName) 
    });
    
    // Get Excel SQLite records
    const excelRecords = await getExcelSqliteByProjectId({ projectId });
    excelLogger.info(`[TEST] Found ${excelRecords.length} Excel SQLite records`, { 
      projectId, 
      excelFileNames: excelRecords.map(r => r.fileName) 
    });
    
    // Analyze file types
    const excelFiles = excelRecords.map(record => ({
      fileName: record.fileName,
      tables: record.tables as any[],
      rowCount: (record.tables as any[]).reduce((sum: number, table: any) => sum + table.rows, 0)
    }));
    
    const otherFiles = contextFiles.filter(file => {
      const isExcel = validators.isExcelFile(file.fileName);
      return !isExcel;
    });
    
    const otherFileTypes = [...new Set(otherFiles.map(f => f.fileName.split('.').pop()?.toLowerCase()).filter((type): type is string => type !== undefined))];
    
    const hasExcelFiles = excelFiles.length > 0;
    const hasOtherFiles = otherFiles.length > 0;
    const totalFiles = contextFiles.length;
    
    // Determine if agent should be used
    // Agent is useful when we have Excel files AND the question might benefit from SQL processing
    const shouldUseAgent = hasExcelFiles && totalFiles > 0;
    
    excelLogger.info(`[TEST] Data source analysis completed`, {
      projectId,
      hasExcelFiles,
      hasOtherFiles,
      totalFiles,
      shouldUseAgent,
      excelFiles: excelFiles.map(f => ({ fileName: f.fileName, tableCount: f.tables.length, rowCount: f.rowCount })),
      otherFileTypes,
      otherFileCount: otherFiles.length
    });
    
    return {
      hasExcelFiles,
      hasOtherFiles,
      excelFiles,
      otherFileTypes,
      totalFiles,
      shouldUseAgent
    };
  } catch (error) {
    excelLogger.error('[TEST] Error analyzing project data sources', error, { projectId });
    // Fallback: assume no Excel files
    return {
      hasExcelFiles: false,
      hasOtherFiles: true,
      excelFiles: [],
      otherFileTypes: [],
      totalFiles: 0,
      shouldUseAgent: false
    };
  }
}

/**
 * Quick check if a project has Excel files (for performance)
 */
export async function hasExcelFiles(projectId: string): Promise<boolean> {
  try {
    excelLogger.info(`[TEST] Quick check for Excel files in project ${projectId}`);
    const excelRecords = await getExcelSqliteByProjectId({ projectId });
    const hasExcel = excelRecords.length > 0;
    excelLogger.info(`[TEST] Quick Excel check result`, { 
      projectId, 
      hasExcel, 
      excelFileCount: excelRecords.length,
      excelFileNames: excelRecords.map(r => r.fileName)
    });
    return hasExcel;
  } catch (error) {
    excelLogger.error('[TEST] Error in quick Excel check', error, { projectId });
    return false;
  }
}

/**
 * Get Excel file information for a project
 */
export async function getExcelFileInfo(projectId: string): Promise<Array<{
  fileName: string;
  tableCount: number;
  totalRows: number;
  tables: any[];
}>> {
  try {
    const excelRecords = await getExcelSqliteByProjectId({ projectId });
    return excelRecords.map(record => ({
      fileName: record.fileName,
      tableCount: (record.tables as any[]).length,
      totalRows: (record.tables as any[]).reduce((sum: number, table: any) => sum + table.rows, 0),
      tables: record.tables as any[]
    }));
  } catch (error) {
    console.error('Error getting Excel file info:', error);
    return [];
  }
}
