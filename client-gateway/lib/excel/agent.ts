import { myProvider } from '@/lib/ai/providers';
import { generateText } from 'ai';
import { executeSqlQueryForAgent, formatSqlResultsForLLM } from './llm-integration';
import { queryProjectChunks } from '../vector/query';
import { getExcelSqliteByProjectId } from '../db/queries';
import type { TableInfo } from './sqlite';
import { excelLogger, performanceMonitor, config } from './utils';

export interface DataSource {
  type: 'excel-sql' | 'vector-search';
  confidence: number;
  reasoning: string;
  metadata?: any;
}

export interface AgentDecision {
  selectedSource: DataSource;
  alternativeSources: DataSource[];
  context: string;
  mode: 'sql' | 'vector' | 'hybrid' | 'iterative';
}

export interface IterationResult {
  approach: string;
  result: string;
  confidence: number;
  reasoning: string;
  metadata?: any;
}

export interface IterativeAgentResult {
  finalAnswer: string;
  iterations: IterationResult[];
  totalIterations: number;
  confidence: number;
  reasoning: string;
}

// System prompt for iterative agent with self-review
const createIterativeAgentPrompt = (question: string, availableSources: any[]): string => {
  return `You are an advanced iterative data analysis agent. Your task is to answer complex questions by trying multiple approaches and reviewing your own results.

Question: "${question}"

Available Data Sources:
${JSON.stringify(availableSources, null, 2)}

Your Process:
1. **Plan**: Decide which approaches to try (SQL, Vector, Hybrid)
2. **Execute**: Try each approach systematically
3. **Review**: Evaluate each result for completeness and accuracy
4. **Iterate**: If needed, try additional approaches or refine queries
5. **Synthesize**: Combine the best results into a comprehensive answer

Review Criteria:
- **Completeness**: Does the result fully answer the question?
- **Accuracy**: Is the information correct and relevant?
- **Clarity**: Is the result clear and understandable?
- **Depth**: Does it provide sufficient detail?

Instructions:
- Start with the most promising approach
- If a result is incomplete, try alternative approaches
- Review each result critically
- Combine multiple results when beneficial
- Provide confidence scores for each iteration
- Explain your reasoning for each step

Return a JSON object with your iterative analysis plan:
{
  "plan": [
    {
      "approach": "sql",
      "reasoning": "Question asks for numerical data, SQL will be most precise",
      "expectedOutcome": "Exact counts and aggregations"
    },
    {
      "approach": "vector", 
      "reasoning": "May need context and interpretation",
      "expectedOutcome": "Additional insights and explanations"
    }
  ],
  "reviewCriteria": ["completeness", "accuracy", "clarity"],
  "maxIterations": 3
}`;
};

// System prompt for result review
const createReviewPrompt = (question: string, result: string, approach: string): string => {
  return `You are reviewing a data analysis result. Evaluate if this result adequately answers the user's question.

Question: "${question}"
Approach Used: ${approach}
Result: "${result}"

Evaluation Criteria:
1. **Completeness** (0-1): Does it fully answer the question?
2. **Accuracy** (0-1): Is the information correct?
3. **Clarity** (0-1): Is it clear and understandable?
4. **Relevance** (0-1): Is it relevant to the question?

Review Questions:
- What's missing from this answer?
- What could be improved?
- Should we try a different approach?
- Is this result sufficient or do we need more?

Return a JSON object:
{
  "overallScore": 0.85,
  "completeness": 0.9,
  "accuracy": 0.95,
  "clarity": 0.8,
  "relevance": 0.9,
  "missing": ["context about trends", "comparison with other data"],
  "improvements": ["add more context", "include percentages"],
  "shouldTryAlternative": true,
  "reasoning": "Good numerical data but lacks interpretation"
}`;
};

// System prompt for final synthesis
const createSynthesisPrompt = (question: string, iterations: IterationResult[]): string => {
  return `You are synthesizing multiple data analysis results into a comprehensive answer.

Question: "${question}"

Results from different approaches:
${iterations.map((iter, i) => `Approach ${i + 1} (${iter.approach}): ${iter.result}`).join('\n\n')}

Your task:
1. Combine the best parts of each result
2. Eliminate redundancy
3. Ensure completeness
4. Provide a clear, coherent answer
5. Include confidence level and reasoning

Return a JSON object:
{
  "finalAnswer": "Comprehensive answer combining all approaches",
  "confidence": 0.92,
  "reasoning": "Combined precise SQL data with vector search context",
  "sourcesUsed": ["sql", "vector"],
  "keyInsights": ["main findings", "important patterns"]
}`;
};

// Analyze available data sources for a project
async function analyzeAvailableSources(projectId: string): Promise<any[]> {
  const sources = [];
  
  // Check for Excel SQLite databases
  const excelRecords = await getExcelSqliteByProjectId({ projectId });
  if (excelRecords.length > 0) {
    for (const record of excelRecords) {
      sources.push({
        type: 'excel-sql',
        fileName: record.fileName,
        tables: record.tables,
        capabilities: [
          'numerical_aggregation',
          'filtering_sorting',
          'group_by_analysis',
          'date_time_analysis',
          'structured_queries'
        ],
        tableCount: (record.tables as any[]).length,
        totalRows: (record.tables as any[]).reduce((sum: number, table: any) => sum + table.rows, 0)
      });
    }
  }
  
  // Always include vector search capability
  sources.push({
    type: 'vector-search',
    capabilities: [
      'semantic_search',
      'context_understanding',
      'pattern_recognition',
      'interpretation',
      'cross_reference'
    ]
  });
  
  return sources;
}

// Decide on data source with iterative planning
async function decideDataSource(question: string, projectId: string): Promise<AgentDecision> {
  try {
    const availableSources = await analyzeAvailableSources(projectId);
    const systemPrompt = createIterativeAgentPrompt(question, availableSources);
    
    const result = await generateText({
      model: myProvider.languageModel('chat-model'),
      system: systemPrompt,
      prompt: `Analyze this question and create an iterative analysis plan: "${question}"`
    });

    if (!result.text) {
      throw new Error('No response from agent decision model');
    }

    // Parse the response
    let plan;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      excelLogger.warn('Failed to parse agent plan, using fallback', { error: parseError });
      plan = {
        plan: [
          { approach: 'sql', reasoning: 'Fallback to SQL for structured data' },
          { approach: 'vector', reasoning: 'Fallback to vector for context' }
        ],
        maxIterations: 2
      };
    }

    // Create decision based on plan
    const selectedSource: DataSource = {
      type: plan.plan[0]?.approach === 'sql' ? 'excel-sql' : 'vector-search',
      confidence: 0.8,
      reasoning: plan.plan[0]?.reasoning || 'Default reasoning',
      metadata: { plan, maxIterations: plan.maxIterations }
    };

    const alternativeSources: DataSource[] = plan.plan.slice(1).map((p: any, i: number) => ({
      type: p.approach === 'sql' ? 'excel-sql' : 'vector-search',
      confidence: 0.6 - (i * 0.1),
      reasoning: p.reasoning || 'Alternative approach',
      metadata: { iteration: i + 2 }
    }));

    return {
      selectedSource,
      alternativeSources,
      context: `Iterative plan with ${plan.plan.length} approaches`,
      mode: plan.plan.length > 1 ? 'iterative' : selectedSource.type === 'excel-sql' ? 'sql' : 'vector'
    };

  } catch (error) {
    excelLogger.error('Error in agent decision making', error);
    // Fallback decision
    return {
      selectedSource: {
        type: 'vector-search',
        confidence: 0.5,
        reasoning: 'Fallback to vector search due to error'
      },
      alternativeSources: [],
      context: 'Fallback mode',
      mode: 'vector'
    };
  }
}

// Execute a single iteration
async function executeIteration(
  question: string,
  projectId: string,
  approach: string,
  iteration: number
): Promise<IterationResult> {
  try {
    let result = '';
    let metadata: any = {};

    if (approach === 'sql') {
      // Execute SQL approach
      const excelRecords = await getExcelSqliteByProjectId({ projectId });
      for (const record of excelRecords) {
        const sqlResult = await executeSqlQueryForAgent(
          question,
          record.dbPath,
          record.tables as TableInfo[]
        );
        
        if (sqlResult.success && sqlResult.mode === 'sql') {
          result = formatSqlResultsForLLM(sqlResult.data!, sqlResult.query!);
          metadata = {
            sqlQuery: sqlResult.query,
            rowCount: sqlResult.data!.length,
            fileName: record.fileName
          };
          break;
        }
      }
    } else {
      // Execute vector approach
      const chunks = await queryProjectChunks(projectId, question);
      result = chunks.map(c => c.text).join('\n\n');
      metadata = {
        chunkCount: chunks.length,
        averageScore: chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length
      };
    }

    // Review the result
    const reviewPrompt = createReviewPrompt(question, result, approach);
    const reviewResult = await generateText({
      model: myProvider.languageModel('chat-model'),
      system: reviewPrompt,
      prompt: `Review this result for the question: "${question}"`
    });

    let review;
    try {
      const jsonMatch = reviewResult.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        review = JSON.parse(jsonMatch[0]);
      } else {
        review = { overallScore: 0.7, shouldTryAlternative: false };
      }
    } catch {
      review = { overallScore: 0.7, shouldTryAlternative: false };
    }

    return {
      approach,
      result,
      confidence: review.overallScore || 0.7,
      reasoning: review.reasoning || 'Standard execution',
      metadata: { ...metadata, review }
    };

  } catch (error) {
    excelLogger.error(`Error in iteration ${iteration}`, error);
    return {
      approach,
      result: 'Error occurred during execution',
      confidence: 0.1,
      reasoning: 'Execution failed',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Execute iterative agent with self-review
async function executeIterativeAgent(
  question: string,
  projectId: string,
  decision: AgentDecision
): Promise<IterativeAgentResult> {
  const iterations: IterationResult[] = [];
  const maxIterations = decision.selectedSource.metadata?.maxIterations || 3;
  
  // Get the plan from the decision
  const plan = decision.selectedSource.metadata?.plan || [
    { approach: 'sql', reasoning: 'Primary approach' },
    { approach: 'vector', reasoning: 'Secondary approach' }
  ];

  // Execute iterations
  for (let i = 0; i < Math.min(plan.length, maxIterations); i++) {
    const planItem = plan[i];
    const approach = planItem.approach === 'sql' ? 'sql' : 'vector';
    
    excelLogger.info(`Executing iteration ${i + 1}`, { approach, reasoning: planItem.reasoning });
    
    const iterationResult = await executeIteration(question, projectId, approach, i + 1);
    iterations.push(iterationResult);

    // Check if we should continue based on review
    if (iterationResult.metadata?.review?.shouldTryAlternative === false) {
      excelLogger.info(`Stopping iterations - result deemed sufficient`, { 
        confidence: iterationResult.confidence 
      });
      break;
    }
  }

  // Synthesize final answer
  const synthesisPrompt = createSynthesisPrompt(question, iterations);
  const synthesisResult = await generateText({
    model: myProvider.languageModel('chat-model'),
    system: synthesisPrompt,
    prompt: `Synthesize the results for: "${question}"`
  });

  let synthesis;
  try {
    const jsonMatch = synthesisResult.text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      synthesis = JSON.parse(jsonMatch[0]);
    } else {
      synthesis = {
        finalAnswer: iterations.map(i => i.result).join('\n\n'),
        confidence: iterations.reduce((sum, i) => sum + i.confidence, 0) / iterations.length,
        reasoning: 'Combined all results'
      };
    }
  } catch {
    synthesis = {
      finalAnswer: iterations.map(i => i.result).join('\n\n'),
      confidence: iterations.reduce((sum, i) => sum + i.confidence, 0) / iterations.length,
      reasoning: 'Combined all results'
    };
  }

  return {
    finalAnswer: synthesis.finalAnswer,
    iterations,
    totalIterations: iterations.length,
    confidence: synthesis.confidence,
    reasoning: synthesis.reasoning
  };
}

// Execute agent decision (existing function, enhanced for iterative mode)
async function executeAgentDecision(
  question: string,
  projectId: string,
  decision: AgentDecision
): Promise<{ context: string; mode: string; metadata?: any }> {
  try {
    if (decision.mode === 'iterative') {
      // Use new iterative approach
      const iterativeResult = await executeIterativeAgent(question, projectId, decision);
      
      return {
        context: iterativeResult.finalAnswer,
        mode: 'iterative',
        metadata: {
          iterations: iterativeResult.iterations,
          totalIterations: iterativeResult.totalIterations,
          confidence: iterativeResult.confidence,
          reasoning: iterativeResult.reasoning
        }
      };
    } else {
      // Use existing single-approach logic
      let context = '';
      let metadata: any = {};

      if (decision.selectedSource.type === 'excel-sql') {
        // Execute SQL approach
        const excelRecords = await getExcelSqliteByProjectId({ projectId });
        for (const record of excelRecords) {
          const sqlResult = await executeSqlQueryForAgent(
            question,
            record.dbPath,
            record.tables as TableInfo[]
          );
          
          if (sqlResult.success && sqlResult.mode === 'sql') {
            context = formatSqlResultsForLLM(sqlResult.data!, sqlResult.query!);
            metadata = {
              sqlQuery: sqlResult.query,
              rowCount: sqlResult.data!.length,
              fileName: record.fileName,
              source: 'excel-sql'
            };
            break;
          }
        }
        
        if (!context) {
          // SQL failed, fallback to vector
          const chunks = await queryProjectChunks(projectId, question);
          context = chunks.map(c => c.text).join('\n\n');
          metadata = { source: 'vector-fallback' };
        }
      } else {
        // Execute vector approach
        const chunks = await queryProjectChunks(projectId, question);
        context = chunks.map(c => c.text).join('\n\n');
        metadata = { 
          source: 'vector-search',
          chunkCount: chunks.length,
          averageScore: chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length
        };
      }

      return { context, mode: decision.mode, metadata };
    }

  } catch (error) {
    console.error('Error executing agent decision:', error);
    // Final fallback
    const chunks = await queryProjectChunks(projectId, question);
    const context = chunks.map(c => c.text).join('\n\n');
    return { context, mode: 'vector', metadata: { source: 'fallback' } };
  }
}

// Main agent function that decides and executes
export async function intelligentDataAgent(
  question: string,
  projectId: string
): Promise<{ context: string; mode: string; metadata?: any; decision?: AgentDecision }> {
  const perf = performanceMonitor.start('Intelligent Data Agent');
  
  try {
    excelLogger.info(`Agent analyzing question`, { question: question.substring(0, 100), projectId });
    
    // Step 1: Make intelligent decision
    const decision = await decideDataSource(question, projectId);
    excelLogger.info(`Agent decision made`, { 
      type: decision.selectedSource.type, 
      confidence: decision.selectedSource.confidence,
      reasoning: decision.selectedSource.reasoning.substring(0, 200),
      mode: decision.mode
    });
    
    // Step 2: Execute the decision
    const result = await executeAgentDecision(question, projectId, decision);
    
    const duration = perf.end();
    excelLogger.info(`Agent execution completed`, { 
      mode: result.mode, 
      contextLength: result.context.length,
      duration: `${duration.toFixed(2)}ms`,
      iterations: result.metadata?.totalIterations || 1
    });
    
    return {
      ...result,
      decision
    };
  } catch (error) {
    excelLogger.error(`Agent execution failed`, error, { question: question.substring(0, 100), projectId });
    throw error;
  }
}

// Enhanced question analysis for better decision making
export function analyzeQuestionComplexity(question: string): {
  complexity: 'simple' | 'moderate' | 'complex';
  features: string[];
  sqlSuitable: boolean;
  vectorSuitable: boolean;
} {
  const lowerQuestion = question.toLowerCase();
  const features = [];
  let sqlSuitable = false;
  let vectorSuitable = false;

  // SQL indicators
  const sqlIndicators = [
    'count', 'sum', 'average', 'total', 'how many', 'number of',
    'maximum', 'minimum', 'highest', 'lowest', 'top', 'bottom',
    'filter', 'where', 'group by', 'order by', 'sort',
    'percentage', 'ratio', 'per', 'each', 'every'
  ];

  // Vector indicators
  const vectorIndicators = [
    'explain', 'why', 'how', 'what does this mean', 'interpret',
    'analyze', 'compare', 'relationship', 'trend', 'pattern',
    'insight', 'recommendation', 'suggestion', 'context'
  ];

  // Check for SQL suitability
  if (sqlIndicators.some(indicator => lowerQuestion.includes(indicator))) {
    sqlSuitable = true;
    features.push('numerical_analysis');
  }

  // Check for vector suitability
  if (vectorIndicators.some(indicator => lowerQuestion.includes(indicator))) {
    vectorSuitable = true;
    features.push('semantic_analysis');
  }

  // Determine complexity
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (question.length > 100 || features.length > 2) {
    complexity = 'complex';
  } else if (question.length > 50 || features.length > 1) {
    complexity = 'moderate';
  }

  return { complexity, features, sqlSuitable, vectorSuitable };
}
