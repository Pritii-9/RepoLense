// API Types and Interfaces
export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ReportType = 'csv' | 'pdf'

export interface User {
  id: string
  email: string
  full_name: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface RegistrationResponse {
  message: string
  verification_required: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  full_name?: string | undefined
}

export interface VerifyPayload {
  email: string
  code: string
}

export interface ResendPayload {
  email: string
}

export interface VerifyResponse {
  message: string
}

export interface CodeMetricResponse {
  id: string
  analysis_id: string
  file_count: number
  line_count: number
  commit_count: number
  duplicate_block_count: number
  duplicate_line_count: number
  average_cyclomatic_complexity: number
  max_cyclomatic_complexity: number
  maintainability_index: number
  technical_debt_score: number
  created_at: string
  updated_at: string
}

export interface ReportResponse {
  id: string
  analysis_id: string
  report_type: ReportType
  file_name: string
  content_type: string
  created_at: string
  updated_at: string
}

export interface AiInsightResponse {
  id: string
  analysis_id: string
  insight_type: string
  model_used: string
  prompt_version: string
  structured_data: Record<string, unknown>
  raw_text: string | null
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  latency_ms: number
  created_at: string
  updated_at: string
}

export interface AiRepositorySummary {
  overview: string
  strengths: string[]
  risks: string[]
  top_recommendations: string[]
  code_health_score: number
}

export interface AiArchitectureInsight {
  tech_stack: Record<string, string>
  design_patterns: string[]
  scalability_score: number
  modularization_description: string
  architectural_notes: string
}

export interface ChatPayload {
  question: string
}

export interface ChatResponse {
  answer: string
  sources: string[]
  metrics: {
    input_tokens: number
    output_tokens: number
    latency_ms: number
    estimated_cost_usd: number
  }
}

export interface AnalysisResponse {
  id: string
  user_id: string
  repository_url: string
  repository_name: string
  branch: string | null
  status: AnalysisStatus
  submitted_at: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  code_metric: CodeMetricResponse | null
  reports: ReportResponse[]
  ai_insights: AiInsightResponse[]
}

export interface SubmitAnalysisPayload {
  repository_url: string
  branch?: string | undefined
}

export interface ReportDownloadUrlResponse {
  report_id: string
  url: string
  expires_in_seconds: number
}

export interface StoredAnalysis extends AnalysisResponse {
  last_synced_at: string
}

export interface CsvHotspot {
  filePath: string
  entityName: string
  complexity: number
  lineNumber: number
}

export interface ParsedAnalysisReport {
  metrics: Record<string, string>
  hotspots: CsvHotspot[]
}

// Export types
export interface ExportRequest {
  format: 'csv' | 'json'
}

export interface ExportResponse {
  download_url: string
  filename: string
  expires_in_seconds: number
}
