import { myProvider } from '@/lib/ai/providers';
import { generateText } from 'ai';
import { executeSqlQuery, getDatabaseSchema, type TableInfo } from './sqlite';
import { excelLogger, validators, transformers, config } from './utils';

export interface SqlQueryResult {
  success: boolean;
  query?: string;
  data?: any[];
  error?: string;
  mode: 'sql' | 'vector' | 'failed';
  reason?: string;
}

// System prompt for SQL generation
export function createSqlSystemPrompt(schema: any[]): string {
  return `You are an expert SQL analyst. Your task is to generate SQL queries to answer user questions about Excel data.

Database Schema:
${JSON.stringify(schema, null, 2)}

Instructions:
1. Generate a single SELECT query that answers the user's question
2. Use exact column names from the schema
3. Prefer simple, readable queries
4. Use appropriate SQL functions for aggregations, filtering, and grouping
5. Always include a LIMIT clause (default 100, max 1000)
6. Only use the tables and columns provided in the schema

Available SQL Functions:
- COUNT(), SUM(), AVG(), MIN(), MAX()
- GROUP BY, ORDER BY, WHERE, HAVING
- LIKE, IN, BETWEEN
- Date functions: DATE(), STRFTIME()

Return only the SQL query, nothing else.`;
}

// Generate SQL query using LLM
export async function generateSqlQuery(
  question: string,
  schema: any[]
): Promise<{ success: boolean; query?: string; error?: string }> {
  try {
    const systemPrompt = createSqlSystemPrompt(schema);
    
    const result = await generateText({
      model: myProvider.languageModel('chat-model'),
      system: systemPrompt,
      prompt: `User Question: "${question}"\n\nGenerate a SQL query to answer this question.`
    });

    if (!result.text) {
      return { success: false, error: 'No SQL query generated' };
    }

    // Clean up the response
    let query = result.text.trim();
    
    // Remove markdown code blocks if present
    query = query.replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
    
    // Remove any explanatory text
    const lines = query.split('\n');
    const sqlLines = lines.filter((line: string) => 
      line.trim() && 
      !line.trim().startsWith('--') && 
      !line.trim().startsWith('#') &&
      !line.toLowerCase().includes('explanation') &&
      !line.toLowerCase().includes('note:')
    );
    
    query = sqlLines.join(' ').trim();

    // Validate the query
    if (!validators.isValidSqlQuery(query)) {
      return { success: false, error: 'Generated query is not a valid SELECT statement' };
    }

    return { success: true, query };

  } catch (error) {
    excelLogger.error('SQL generation failed', error, { question: question.substring(0, 100) });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in SQL generation' 
    };
  }
}

// Execute SQL query and return results
export async function executeSqlWithResults(
  question: string,
  dbPath: string,
  tables: TableInfo[]
): Promise<SqlQueryResult> {
  try {
    const schema = getDatabaseSchema(tables);
    const allowedTables = tables.map(t => t.table);
    
    // Generate SQL query
    const sqlResult = await generateSqlQuery(question, schema);
    if (!sqlResult.success || !sqlResult.query) {
      return {
        success: false,
        error: sqlResult.error || 'Failed to generate SQL query',
        mode: 'failed'
      };
    }

    // Execute the query
    const executionResult = await executeSqlQuery(
      dbPath,
      sqlResult.query,
      allowedTables,
      config.DEFAULT_SQL_LIMIT
    );

    if (!executionResult.success) {
      return {
        success: false,
        error: executionResult.error || 'Failed to execute SQL query',
        mode: 'failed'
      };
    }

    return {
      success: true,
      query: sqlResult.query,
      data: executionResult.data,
      mode: 'sql'
    };

  } catch (error) {
    excelLogger.error('SQL execution failed', error, { question: question.substring(0, 100) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in SQL execution',
      mode: 'failed'
    };
  }
}

// Execute SQL query directly (used by intelligent agent)
export async function executeSqlQueryForAgent(
  question: string,
  dbPath: string,
  tables: TableInfo[]
): Promise<SqlQueryResult> {
  try {
    // Try SQL processing directly
    const sqlResult = await executeSqlWithResults(question, dbPath, tables);
    
    if (sqlResult.success && sqlResult.mode === 'sql') {
      excelLogger.info('SQL processing successful', { 
        query: sqlResult.query,
        rowCount: sqlResult.data?.length || 0
      });
      return sqlResult;
    }

    // SQL failed
    return {
      success: false,
      error: sqlResult.error || 'SQL processing failed',
      mode: 'failed'
    };

  } catch (error) {
    excelLogger.error('SQL execution failed', error, { question: question.substring(0, 100) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      mode: 'failed'
    };
  }
}

// Format SQL results for LLM consumption
export function formatSqlResultsForLLM(data: any[], query: string): string {
  if (!data || data.length === 0) {
    return `SQL Query: ${query}\nResult: No data found.`;
  }

  const columns = Object.keys(data[0]);
  const maxRows = Math.min(data.length, 10); // Show max 10 rows
  const displayData = data.slice(0, maxRows);

  let formatted = `SQL Query: ${query}\n\n`;
  formatted += `Results: ${data.length} rows found\n\n`;
  formatted += `Columns: ${columns.join(', ')}\n\n`;

  // Add sample data
  formatted += `Sample Data:\n`;
  displayData.forEach((row, index) => {
    formatted += `Row ${index + 1}: `;
    formatted += columns.map(col => `${col}: ${row[col]}`).join(', ');
    formatted += '\n';
  });

  if (data.length > maxRows) {
    formatted += `\n... and ${data.length - maxRows} more rows`;
  }

  return formatted;
}

// Check if a question is suitable for SQL processing
export function isSqlSuitableQuestion(question: string): boolean {
  const lowerQuestion = question.toLowerCase();
  
  // SQL indicators
  const sqlIndicators = [
    'count', 'sum', 'average', 'total', 'how many', 'number of',
    'maximum', 'minimum', 'highest', 'lowest', 'top', 'bottom',
    'filter', 'where', 'group by', 'order by', 'sort',
    'percentage', 'ratio', 'per', 'each', 'every',
    'show me', 'list', 'find', 'get', 'select'
  ];

  // Vector indicators (questions that are better for semantic search)
  const vectorIndicators = [
    'explain', 'why', 'how', 'what does this mean', 'interpret',
    'analyze', 'compare', 'relationship', 'trend', 'pattern',
    'insight', 'recommendation', 'suggestion', 'context',
    'understand', 'meaning', 'significance'
  ];

  // Check for SQL suitability
  const hasSqlIndicators = sqlIndicators.some(indicator => lowerQuestion.includes(indicator));
  const hasVectorIndicators = vectorIndicators.some(indicator => lowerQuestion.includes(indicator));

  // If it has SQL indicators and no strong vector indicators, it's suitable for SQL
  if (hasSqlIndicators && !hasVectorIndicators) {
    return true;
  }

  // If it has both, prefer SQL for numerical/structured questions
  if (hasSqlIndicators && hasVectorIndicators) {
    // Check if it's more of a numerical/structured question
    const numericalWords = ['count', 'sum', 'average', 'total', 'how many', 'number'];
    const hasNumericalFocus = numericalWords.some(word => lowerQuestion.includes(word));
    return hasNumericalFocus;
  }

  return false;
}

// Enhanced SQL generation with better error handling
export async function generateSqlQueryWithRetry(
  question: string,
  schema: any[],
  maxRetries: number = 2
): Promise<{ success: boolean; query?: string; error?: string }> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateSqlQuery(question, schema);
      
      if (result.success) {
        return result;
      }
      
      lastError = result.error || 'Unknown error';
      
      // If it's the last attempt, don't retry
      if (attempt === maxRetries) {
        break;
      }

      // Add more context for retry
      const enhancedQuestion = `${question}\n\nPrevious attempt failed: ${lastError}\nPlease generate a simpler, more direct SQL query.`;
      
      const retryResult = await generateText({
        model: myProvider.languageModel('chat-model'),
        system: createSqlSystemPrompt(schema) + '\n\nIMPORTANT: Generate a simple, direct SQL query. Avoid complex joins or subqueries unless absolutely necessary.',
        prompt: `User Question: "${enhancedQuestion}"\n\nGenerate a simple SQL query to answer this question.`
      });

      if (retryResult.text) {
        let query = retryResult.text.trim();
        query = query.replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
        
        if (validators.isValidSqlQuery(query)) {
          return { success: true, query };
        }
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      excelLogger.warn(`SQL generation attempt ${attempt} failed`, { error: lastError });
    }
  }

  return { success: false, error: lastError };
}
