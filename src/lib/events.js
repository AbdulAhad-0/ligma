import { supabase } from './supabase'
import { toGuid } from './utils'

export async function logEvent({ workspaceId, nodeId, eventType, payload, actorId }, retryCount = 0) {
  try {
    const guid = toGuid(nodeId)
    if (!guid) return false

    const { error } = await supabase.from('canvas_events').insert([
      {
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        node_id: guid,
        event_type: eventType,
        payload: payload || {},
        actor_id: actorId,
      },
    ])

    if (error) {
      // If it's a foreign key error, retry up to 3 times with a delay
      if (error.code === '23503' && retryCount < 3) {
        console.warn(`[logEvent] Foreign key violation, retrying... (${retryCount + 1}/3)`)
        await new Promise(resolve => setTimeout(resolve, 200 * (retryCount + 1)))
        return logEvent({ workspaceId, nodeId, eventType, payload, actorId }, retryCount + 1)
      }
      console.error('[logEvent] Supabase error:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('[logEvent] Exception:', error)
    return false
  }
}
