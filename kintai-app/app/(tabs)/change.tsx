import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../../store/appStore';
import { addChangeRequest } from '../../firebase/firestore';
import { ChangeRequest } from '../../types';
import ChangeEntryRow from '../../components/ChangeEntryRow';

interface ChangeRow {
  oldDate: string;
  oldStartTime: string;
  oldEndTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  workType: string;
  changeReason: '病気' | 'その他';
  reasonText: string;
}

const emptyRow = (): ChangeRow => ({
  oldDate: '',
  oldStartTime: '',
  oldEndTime: '',
  newDate: '',
  newStartTime: '',
  newEndTime: '',
  workType: '',
  changeReason: 'その他',
  reasonText: '',
});

export default function ChangeScreen() {
  const { currentUser } = useAppStore();
  const [rows, setRows] = useState<ChangeRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  function handleRowChange(index: number, field: keyof ChangeRow, value: string) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function handleRowRemove(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    if (rows.length >= 5) {
      Toast.show({ type: 'info', text1: '最大5件まで追加できます' });
      return;
    }
    setRows(prev => [...prev, emptyRow()]);
  }

  function deriveReqType(row: ChangeRow): '変更' | '追加申請' | '削除申請' {
    if (row.oldDate && row.newDate) return '変更';
    if (row.oldDate && !row.newDate) return '削除申請';
    return '追加申請';
  }

  async function handleSubmit() {
    const valid = rows.every(r => r.workType && (r.oldDate || r.newDate));
    if (!valid) {
      Toast.show({ type: 'error', text1: '種別と変更前後の日付を少なくとも1つ入力してください' });
      return;
    }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      for (const row of rows) {
        const reqType = deriveReqType(row);
        const req: Omit<ChangeRequest, 'id'> = {
          name: currentUser,
          reqType,
          workType: row.workType,
          changeReason: row.changeReason,
          reasonText: row.reasonText || undefined,
          status: '申請中',
          oldDate: row.oldDate || undefined,
          oldStartTime: row.oldStartTime || undefined,
          oldEndTime: row.oldEndTime || undefined,
          newDate: row.newDate || undefined,
          newStartTime: row.newStartTime || undefined,
          newEndTime: row.newEndTime || undefined,
        };
        await addChangeRequest(req);
      }
      Toast.show({ type: 'success', text1: '変更申請が完了しました' });
      setRows([emptyRow()]);
    } catch {
      Toast.show({ type: 'error', text1: '申請に失敗しました' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FF' }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          変更前のみ入力→削除申請、変更後のみ→追加申請、両方→変更申請
        </Text>

        {rows.map((row, i) => (
          <ChangeEntryRow
            key={i}
            row={row}
            index={i}
            onChange={handleRowChange}
            onRemove={handleRowRemove}
          />
        ))}

        <TouchableOpacity
          onPress={addRow}
          style={{
            borderWidth: 1.5,
            borderColor: '#4A86C8',
            borderStyle: 'dashed',
            borderRadius: 12,
            padding: 14,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#4A86C8', fontSize: 15, fontWeight: '600' }}>＋ 変更を追加</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: '#4A86C8',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            minHeight: 52,
          }}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>変更申請する</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
