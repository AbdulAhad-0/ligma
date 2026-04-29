/**
 * Maps tldraw record IDs to valid UUIDs for Supabase.
 * tldraw IDs are like 'shape:uuid-part' or 'page:page-id'.
 */
export function toGuid(tldrawId) {
  if (!tldrawId) return null
  const parts = tldrawId.split(':')
  const idPart = parts[parts.length - 1]
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(idPart)) return idPart

  // Convert string to hex to ensure it's valid for PostgreSQL UUID type
  let hexString = ''
  for (let i = 0; i < idPart.length; i++) {
    hexString += idPart.charCodeAt(i).toString(16).padStart(2, '0')
  }
  // Ensure exactly 32 chars
  hexString = hexString.padEnd(32, '0').slice(0, 32)
  return `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-${hexString.slice(12, 16)}-${hexString.slice(16, 20)}-${hexString.slice(20, 32)}`
}

/**
 * Maps tldraw types to DB node_type enum.
 */
export function toNodeType(tldrawType) {
  switch (tldrawType) {
    case 'note': return 'sticky_note'
    case 'text': return 'text'
    case 'geo': return 'shape'
    case 'draw': return 'drawing'
    default: return 'shape'
  }
}
