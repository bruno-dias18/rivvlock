-- Add indexes for disputes pagination performance
-- Optimizes queries filtering by status + ordering

-- Index for status-based filtering with created_at sorting
CREATE INDEX IF NOT EXISTS idx_disputes_status_created 
ON public.disputes(status, created_at DESC);

-- Index for updated_at sorting (alternative sort)
CREATE INDEX IF NOT EXISTS idx_disputes_status_updated 
ON public.disputes(status, updated_at DESC);

-- Index for created_at only (for recent queries without filter issues)
CREATE INDEX IF NOT EXISTS idx_disputes_created 
ON public.disputes(created_at DESC);

-- Composite index for escalated disputes (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_disputes_escalated 
ON public.disputes(status, escalated_at DESC);

COMMENT ON INDEX idx_disputes_status_created IS 'Optimizes pagination with status filter and created_at sort';
COMMENT ON INDEX idx_disputes_status_updated IS 'Optimizes pagination with status filter and updated_at sort';
COMMENT ON INDEX idx_disputes_created IS 'Optimizes queries sorted by creation date';
COMMENT ON INDEX idx_disputes_escalated IS 'Optimizes escalated disputes queries';