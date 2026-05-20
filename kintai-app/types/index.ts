export type WorkType =
  | '出社申請'
  | 'リモート申請'
  | 'PC持参出社申請'
  | '出社'
  | 'リモート'
  | 'PC持参出社';

export const WORK_TYPE_COLORS: Record<WorkType, string> = {
  '出社':          '#FFA500',
  'リモート':       '#FFFFFF',
  'PC持参出社':     '#C8E6C9',
  '出社申請':       '#FFE0B2',
  'リモート申請':   '#E3F2FD',
  'PC持参出社申請': '#C8E6C9',
};

export interface ShiftEntry {
  id?: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  workType: WorkType;
  status: 'pending' | 'confirmed';
  calendarEventId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ChangeRequest {
  id?: string;
  name: string;
  reqType: '変更' | '追加申請' | '削除申請';
  oldDate?: string;
  oldStartTime?: string;
  oldEndTime?: string;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  workType: string;
  changeReason: '病気' | 'その他';
  reasonText?: string;
  status: '申請中' | '承認済' | '却下';
  createdAt?: any;
}

export interface AppSettings {
  calendarId: string;
  adminPasswordHash: string;
}
