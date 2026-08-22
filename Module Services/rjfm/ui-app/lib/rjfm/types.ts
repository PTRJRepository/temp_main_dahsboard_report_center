export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REVISION_NEEDED' | 'APPROVED'
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED_NEEDS_REVISION'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface RjfmTask {
  task_id: number
  title: string
  description: string
  category_id: number
  deadline: string
  priority: Priority
  allowed_mime_types?: string
  current_status?: TaskStatus
  assignment_id?: number
  category_name?: string
  created_by_user_id?: number
}

export interface RjfmAssignment {
  assignment_id: number
  task_id: number
  kerani_user_id: number
  current_status: TaskStatus
  title?: string
  description?: string
  deadline?: string
  kerani_username?: string
  priority?: Priority
}

export interface RjfmRevision {
  revision_id: number
  assignment_id: number
  revision_number: number
  file_original_name: string
  file_storage_path: string
  file_size_bytes: number
  file_mime_type: string
  file_hash_sha256: string
  notes_from_kerani?: string | null
  submitted_at: string
  review_status: ReviewStatus
  manager_feedback?: string | null
  reviewed_at?: string | null
  reviewed_by_user_id?: number | null
}

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Ditugaskan',
  IN_PROGRESS: 'Dikerjakan',
  SUBMITTED: 'Menunggu Review',
  REVISION_NEEDED: 'Perlu Revisi',
  APPROVED: 'Disetujui',
  PENDING: 'Menunggu',
  REJECTED_NEEDS_REVISION: 'Perlu Revisi',
}

export const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  REVISION_NEEDED: 'bg-red-50 text-red-700 border-red-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
}

export const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
}
