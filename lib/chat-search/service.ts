/**
 * Chat Search Service
 * 
 * Main orchestrator implementing OpenAI tool calling loop.
 * Handles conversation history, parallel tool execution, and result synthesis.
 */

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getToolDefinitions, executeToolCall } from './tools'
import { buildSystemPrompt, generateSuggestedQueries } from './prompt-builder'
import type {
  ChatSearchOptions,
  ChatSearchResult,
  ChatMessage,
  AgentContext,
  EmailContext,
  ToolExecutionContext,
  KBSearchResult,
  EmailSearchResult,
  ChatCompletionMessageParam,
} from './types'

// ============================================
// OpenAI Client
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================
// Main Service Function
// ============================================

/**
 * Execute a chat search with tool calling
 * @param query - User's query
 * @param options - Search options including context
 * @returns Chat search result
 */
export async function chatSearch(
  query: string,
  options: ChatSearchOptions
): Promise<ChatSearchResult> {
  console.log('\n' + '═'.repeat(70))
  console.log('🤖 CHAT SEARCH INITIATED')
  console.log('═'.repeat(70))
  console.log(`📝 Query: "${query}"`)
  console.log(`👤 User ID: ${options.userId}`)
  console.log(`🎯 Agent Config: ${options.agentConfigId || 'None'}`)
  console.log(`📧 Current Email: ${options.currentEmailId || 'None'}`)
  console.log('═'.repeat(70) + '\n')
  
  try {
    // 1. Load context from database
    const context = await loadSearchContext(options)
    
    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt(context.agent, context.email)
    
    // 3. Build messages array
    const messages = buildMessages(
      systemPrompt,
      query,
      options.conversationHistory
    )
    
    // 4. Create tool execution context
    const toolContext: ToolExecutionContext = {
      userId: options.userId,
      agentConfigId: options.agentConfigId,
      assignedKBIds: context.agent?.assigned_kb_ids || [],
      assignedKBNames: context.agent?.assigned_kb_names || [],
    }
    
    // 5. First API call - let GPT decide tools
    console.log('🧠 [Chat Search] Calling GPT for tool selection...')
    
    const initialResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: getToolDefinitions(),
      tool_choice: 'auto',
      temperature: 0.3,
    })
    
    const assistantMessage = initialResponse.choices[0].message
    
    // 6. Check if tools were called
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // No tools - direct response (clarification or simple answer)
      console.log('💬 [Chat Search] No tools called - direct response')
      
      return {
        success: true,
        response: assistantMessage.content || 'I need more information to search. What are you looking for?',
        toolsUsed: [],
      }
    }
    
    // 7. Execute tool calls in parallel
    console.log(`🔧 [Chat Search] Executing ${assistantMessage.tool_calls.length} tool(s)...`)
    
    const toolResults = await executeToolCallsFromResponse(
      assistantMessage.tool_calls,
      toolContext
    )
    
    // 8. Build tool result messages
    const toolMessages = buildToolResultMessages(
      assistantMessage.tool_calls,
      toolResults
    )
    
    // 9. Second API call - synthesize results
    console.log('🧠 [Chat Search] Calling GPT to synthesize results...')
    
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        ...messages,
        assistantMessage,
        ...toolMessages,
      ],
      temperature: 0.5,
    })
    
    // 10. Extract and return results
    const response = finalResponse.choices[0].message.content || 'Search completed.'
    
    // Aggregate results by type
    const { kbResults, emailResults, toolsUsed } = aggregateResults(toolResults)
    
    console.log('\n' + '═'.repeat(70))
    console.log('✅ CHAT SEARCH COMPLETE')
    console.log('═'.repeat(70))
    console.log(`📊 KB Results: ${kbResults.length}`)
    console.log(`📧 Email Results: ${emailResults.length}`)
    console.log(`🔧 Tools Used: ${toolsUsed.join(', ') || 'None'}`)
    console.log('═'.repeat(70) + '\n')
    
    return {
      success: true,
      response,
      kbResults: kbResults.length > 0 ? kbResults : undefined,
      emailResults: emailResults.length > 0 ? emailResults : undefined,
      toolsUsed,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [Chat Search] Error:', errorMessage)
    
    return {
      success: false,
      response: 'Sorry, something went wrong with the search. Please try again.',
      error: errorMessage,
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Load search context from database
 */
async function loadSearchContext(
  options: ChatSearchOptions
): Promise<{ agent?: AgentContext; email?: EmailContext }> {
  const supabase = await createClient()
  const context: { agent?: AgentContext; email?: EmailContext } = {}
  
  // Load agent configuration if provided
  if (options.agentConfigId) {
    console.log('📋 [Chat Search] Loading agent configuration...')
    
    const { data: agentData } = await supabase
      .from('agent_configurations')
      .select(`
        id,
        name,
        match_criteria,
        extraction_fields,
        user_intent,
        agent_kb_assignments (
          knowledge_bases (
            id,
            name
          )
        )
      `)
      .eq('id', options.agentConfigId)
      .eq('user_id', options.userId)
      .single()
    
    if (agentData) {
      const assignments = (agentData.agent_kb_assignments || []) as any[]
      const kbs = assignments.map((a: any) => a.knowledge_bases).filter(Boolean)
      
      context.agent = {
        id: agentData.id,
        name: agentData.name,
        match_criteria: agentData.match_criteria || undefined,
        extraction_fields: agentData.extraction_fields || undefined,
        user_intent: agentData.user_intent || undefined,
        assigned_kb_ids: kbs.map((kb: any) => kb.id),
        assigned_kb_names: kbs.map((kb: any) => kb.name),
      }
      
      console.log(`   ✅ Agent: ${context.agent.name}`)
      console.log(`   📚 KBs: ${context.agent.assigned_kb_names.join(', ') || 'None'}`)
    }
  }
  
  // Load current email if provided
  if (options.currentEmailId) {
    console.log('📧 [Chat Search] Loading current email context...')
    
    const { data: emailData } = await supabase
      .from('analyzed_emails')
      .select('id, email_subject, email_from, extracted_data, data_by_source, matched')
      .eq('id', options.currentEmailId)
      .eq('user_id', options.userId)
      .single()
    
    if (emailData) {
      context.email = {
        id: emailData.id,
        email_subject: emailData.email_subject || undefined,
        email_from: emailData.email_from,
        extracted_data: emailData.extracted_data || undefined,
        data_by_source: emailData.data_by_source || undefined,
        matched: emailData.matched,
      }
      
      console.log(`   ✅ Email: ${context.email.email_subject || 'Untitled'}`)
    }
  }
  
  return context
}

/**
 * Build messages array for OpenAI
 */
function buildMessages(
  systemPrompt: string,
  query: string,
  history?: ChatMessage[]
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]
  
  // Add conversation history
  if (history?.length) {
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
  }
  
  // Add current query
  messages.push({ role: 'user', content: query })
  
  return messages
}

/**
 * Execute tool calls from OpenAI response
 */
async function executeToolCallsFromResponse(
  toolCalls: OpenAI.ChatCompletionMessageToolCall[],
  context: ToolExecutionContext
): Promise<Map<string, { result: any; toolName: string }>> {
  const results = new Map<string, { result: any; toolName: string }>()
  
  await Promise.all(
    toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments)
      const result = await executeToolCall(toolCall.function.name, args, context)
      results.set(toolCall.id, {
        result,
        toolName: toolCall.function.name,
      })
    })
  )
  
  return results
}

/**
 * Build tool result messages for second API call
 */
function buildToolResultMessages(
  toolCalls: OpenAI.ChatCompletionMessageToolCall[],
  results: Map<string, { result: any; toolName: string }>
): ChatCompletionMessageParam[] {
  return toolCalls.map((toolCall) => {
    const { result } = results.get(toolCall.id) || { result: { error: 'No result' } }
    
    return {
      role: 'tool' as const,
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: result.success,
        source: result.source,
        count: result.count,
        results: result.results?.slice(0, 5).map((r: any) => ({
          title: r.title,
          subtitle: r.subtitle,
          similarity: r.similarity ? `${Math.round(r.similarity * 100)}%` : undefined,
          preview: r.preview?.substring(0, 150),
        })),
        error: result.error,
      }),
    }
  })
}

/**
 * Aggregate results from tool executions
 */
function aggregateResults(
  results: Map<string, { result: any; toolName: string }>
): {
  kbResults: KBSearchResult[]
  emailResults: EmailSearchResult[]
  toolsUsed: string[]
} {
  const kbResults: KBSearchResult[] = []
  const emailResults: EmailSearchResult[] = []
  const toolsUsed: string[] = []
  
  for (const [, { result, toolName }] of results) {
    toolsUsed.push(toolName)
    
    if (!result.success || !result.results) continue
    
    for (const item of result.results) {
      if (result.source === 'knowledge_base') {
        kbResults.push({
          chunk_id: item.id,
          document_id: item.id,
          document_title: item.title,
          document_type: item.metadata?.document_type || 'unknown',
          knowledge_base_id: '',
          kb_name: item.subtitle || '',
          kb_type: item.metadata?.kb_type || 'manual',
          content: item.preview || '',
          similarity: item.similarity || 0,
          chunk_index: item.metadata?.chunk_index || 0,
          context_tags: item.metadata?.context_tags,
        })
      } else if (result.source === 'analyzed_emails') {
        emailResults.push({
          email_id: item.id,
          email_subject: item.title,
          email_from: item.subtitle || '',
          matched: item.metadata?.matched || false,
          similarity: item.similarity || 0,
          content_type: item.metadata?.content_type || 'extracted_data',
          source_url: item.metadata?.source_url,
          embedded_text: item.preview || '',
        })
      } else if (result.source === 'exact_match') {
        // Exact matches go to appropriate bucket based on metadata
        if (item.metadata?.source_type === 'email') {
          emailResults.push({
            email_id: item.id,
            email_subject: item.title,
            email_from: item.subtitle || '',
            matched: item.metadata?.matched || false,
            extracted_data: item.metadata?.extracted_data,
            similarity: item.similarity || 1,
            content_type: 'extracted_data',
            embedded_text: item.preview || '',
          })
        } else {
          kbResults.push({
            chunk_id: item.id,
            document_id: item.id,
            document_title: item.title,
            document_type: item.metadata?.document_type || 'unknown',
            knowledge_base_id: '',
            kb_name: item.subtitle || '',
            kb_type: 'manual',
            content: item.preview || '',
            similarity: item.similarity || 1,
            chunk_index: 0,
            context_tags: item.metadata?.context_tags,
          })
        }
      }
    }
  }
  
  return { kbResults, emailResults, toolsUsed: [...new Set(toolsUsed)] }
}

// ============================================
// Exports
// ============================================

export { generateSuggestedQueries }

