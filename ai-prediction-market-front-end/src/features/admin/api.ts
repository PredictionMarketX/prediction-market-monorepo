import { config } from '@/config';

const API_BASE = config.api.baseUrl;

// Helper to get wallet address from localStorage (set by wallet adapter)
function getStoredWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try to get from localStorage where wallet adapter might store it
    const walletState = localStorage.getItem('walletName');
    // This is a fallback - the actual address should be passed from components
    return null;
  } catch {
    return null;
  }
}

// Create headers with optional wallet address
function createHeaders(walletAddress?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (walletAddress) {
    headers['x-user-address'] = walletAddress;
  }
  return headers;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    total: number;
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}

export interface AdminProposal {
  id: string;
  proposal_text: string;
  status: string;
  category_hint?: string;
  created_at: string;
  processed_at?: string;
  draft_title?: string;
  confidence_score?: number;
  validation_decision?: {
    status: string;
    reason: string;
    evidence: string[];
  };
}

export interface AdminProposalDetail {
  id: string;
  proposal_text: string;
  status: string;
  category_hint?: string;
  created_at: string;
  processed_at?: string;
  market_id?: string;
  market_title?: string;
  market_description?: string;
  market_category?: string;
  market_resolution?: {
    exact_question: string;
    expiry: string;
    criteria: {
      must_meet_all: string[];
      must_not_count: string[];
      allowed_sources: Array<{ name: string; url: string; type: string }>;
    };
  };
  market_confidence?: number;
  market_status?: string;
  validation_decision?: {
    status: string;
    reason: string;
    evidence: string[];
  };
}

export interface ReviewDecision {
  decision: 'approve' | 'reject';
  reason: string;
  modifications?: {
    title?: string;
    resolution?: Record<string, unknown>;
  };
}

// List proposals needing review
export async function listAdminProposals(options: {
  status?: string;
  limit?: number;
  walletAddress?: string;
} = {}): Promise<{ data: AdminProposal[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', options.limit.toString());

  const response = await fetch(`${API_BASE}/api/v1/admin/proposals?${params}`, {
    method: 'GET',
    headers: createHeaders(options.walletAddress),
  });

  const result: ApiResponse<AdminProposal[]> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || 'Failed to fetch proposals');
  }

  return {
    data: result.data || [],
    hasMore: result.pagination?.has_more || false,
  };
}

// Get proposal details
export async function getAdminProposal(id: string, walletAddress?: string): Promise<AdminProposalDetail> {
  const response = await fetch(`${API_BASE}/api/v1/admin/proposals/${id}`, {
    method: 'GET',
    headers: createHeaders(walletAddress),
  });

  const result: ApiResponse<AdminProposalDetail> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || 'Failed to fetch proposal');
  }

  return result.data!;
}

// Review a proposal
export async function reviewProposal(
  id: string,
  decision: ReviewDecision,
  walletAddress?: string
): Promise<{ status: string; decision: string }> {
  const response = await fetch(`${API_BASE}/api/v1/admin/proposals/${id}/review`, {
    method: 'POST',
    headers: createHeaders(walletAddress),
    body: JSON.stringify(decision),
  });

  const result: ApiResponse<{ status: string; decision: string }> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error?.message || 'Failed to review proposal');
  }

  return result.data!;
}
