const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

exports.classify = async (req, res) => {
  const { content, nodeId, workspaceId, actorId } = req.body
  if (!content || content.trim().length < 5) return res.json({ intent: null })

  try {
    console.log('[AI] Classifying:', content.slice(0, 50) + '...')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) // gemini-2.5-flash does not exist

    const prompt = `You are classifying sticky notes from a brainstorming canvas.
Classify this note and respond ONLY with valid JSON — no markdown, no backticks, no explanation.
Note: "${content}"
Return exactly this format:
{"intent":"action_item","confidence":0.92,"title":"short task title max 8 words"}
intent must be exactly one of: action_item, decision, open_question, reference
confidence is 0.0 to 1.0`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    console.log('[AI] Response:', text)
    
    // Strip any accidental markdown backticks
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // 1. Update canvas_nodes with AI intent
    await supabase
      .from('canvas_nodes')
      .update({
        intent: parsed.intent,
        intent_confidence: parsed.confidence
      })
      .eq('id', nodeId)

    // 2. Log intent_classified event
    await supabase.from('canvas_events').insert({
      workspace_id: workspaceId,
      node_id: nodeId,
      event_type: 'intent_classified',
      payload: { intent: parsed.intent, confidence: parsed.confidence },
      actor_id: actorId
    })

    // 3. Create task if intent is recognized
    const validIntents = ['action_item', 'decision', 'open_question', 'reference']
    if (validIntents.includes(parsed.intent)) {
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('node_id', nodeId)
        .single()

      if (!existingTask) {
        await supabase.from('tasks').insert({
          workspace_id: workspaceId,
          node_id: nodeId,
          title: parsed.title || content.slice(0, 60),
          intent_type: parsed.intent,
          created_by: actorId,
          status: 'todo'
        })
      } else {
        await supabase.from('tasks').update({
          title: parsed.title || content.slice(0, 60),
          intent_type: parsed.intent
        }).eq('id', existingTask.id)
      }
    }

    return res.json(parsed)
  } catch (err) {
    console.error('Gemini classify error:', err.message)
    return res.json({ intent: null })
  }
}

exports.summary = async (req, res) => {
  const { workspaceId } = req.body

  const { data: nodes } = await supabase
    .from('canvas_nodes')
    .select('content, intent, created_at')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .not('content', 'is', null)
    .not('content', 'eq', '')

  if (!nodes || nodes.length === 0) {
    return res.json({ summary: 'No content on canvas yet.' })
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) // gemini-2.5-flash does not exist

    const prompt = `Summarize this brainstorming session into a structured brief.
Canvas notes: ${JSON.stringify(nodes)}

Format your response with EXACTLY these sections using ## headings:
## Decisions Made
## Action Items  
## Open Questions
## Key Insights

Be concise. Each section max 5 bullet points.`

    const result = await model.generateContent(prompt)
    return res.json({ summary: result.response.text() })
  } catch (err) {
    console.error('Gemini summary error:', err.message)
    return res.status(500).json({ error: 'Summary failed' })
  }
}


