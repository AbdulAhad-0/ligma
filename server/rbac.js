const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

module.exports = {
  canEditNode: async (userId, nodeId, workspaceId) => {
    try {
      // 1. Get user's role in the workspace
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single()

      if (!member) return false
      if (member.role === 'lead') return true

      // 2. Check node's restricted role in its props
      const { data: node } = await supabase
        .from('canvas_nodes')
        .select('props')
        .eq('id', nodeId)
        .single()

      if (!node) return true // If node doesn't exist yet, allow creation by any member
      
      const minRole = node.props?.min_role || 'viewer' // default: anyone can edit

      // Role hierarchy: lead > contributor > viewer
      if (minRole === 'lead') return false // only lead can edit (and we already handled lead above)
      if (minRole === 'contributor') return member.role === 'contributor'
      
      return true // minRole is 'viewer'
    } catch (err) {
      console.error('[RBAC] Error:', err)
      return false
    }
  }
}
