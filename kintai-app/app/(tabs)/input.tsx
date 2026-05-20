import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../../store/appStore';
import { addShift, getShiftsForUser, deleteShift } from '../../firebase/firestore';
import { getShiftMonthKey, formatDateJP, getNowJSTDate } from '../../lib/utils';
import { WorkType, ShiftEntry } from '../../types';
import ShiftEntryRow from '../../components/ShiftEntryRow';

interface ShiftRow {
  date: string;
  startTime: string;
  endTime: string;
  workType: WorkType;
}

const emptyRow = (): ShiftRow => ({
  date: '',
  startTime: '',
  endTime: '',
  workType: '' as WorkType,
});

export default function InputScreen() {
  const { currentUser } = useAppStore();
  const [mode, setMode] = useState<'申請' | '削除'>('申請');
  const [rows, setRows] = useState<ShiftRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [myShifts, setMyShifts] = useState<ShiftEntry[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  useEffect(() => {
    if (mode === '削除') loadMyShifts();
  }, [mode]);

  async function loadMyShifts() {
    if (!currentUser) return;
    setLoadingShifts(true);
    try {
      const now = getNowJSTDate();
      const monthKey = getShiftMonthKey(now);
      const shifts = await getShiftsForUser(currentUser, monthKey);
      setMyShifts(shifts.filter(s => s.status === 'pending'));
    } catch {
      Toast.show({ type: 'error', text1: 'シフトの読み込みに失敗しました' });
    } finally {
      setLoadingShifts(false);
    }
  }

  function handleRowChange(index: number, field: keyof ShiftRow, value: string) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function handleRowRemove(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    if (rows.length >= 5) {
      Toast.show({ type: 'info', text1: '最大5行まで追加できます' });
      return;
    }
    setRows(prev => [...prev, emptyRow()]);
  }

  async function handleSubmit() {
    const valid = rows.every(r => r.date && r.startTime && r.endTime && r.workType);
    if (!valid) {
      Toast.show({ type: 'error', text1: '全ての項目を入力してください' });
      return;
    }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      for (const row of rows) {
        await addShift({
          name: currentUser,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          workType: row.workType,
          status: 'pending',
        });
      }
      Toast.show({ type: 'success', text1: '申請が完了しました' });
      setRows([emptyRow()]);
    } catch (e) {
      Toast.show({ type: 'error', text1: '申請に失敗しました' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(shift: ShiftEntry) {
    Alert.alert(
      '削除確認',
      `${formatDateJP(shift.date)} ${shift.startTime}〜${shift.endTime} のシフトを削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              const monthKey = getShiftMonthKey(new Date(shift.date + 'T00:00:00'));
              await deleteShift(monthKey, shift.id!);
              Toast.show({ type: 'success', text1: '削除しました' });
              loadMyShifts();
            } catch {
              Toast.show({ type: 'error', text1: '削除に失敗しました' });
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FF' }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <Text style={{ fontSize: 15, color: '#333', fontWeight: '600' }}>
            {currentUser}
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 20, padding: 2 }}>
            {(['申請', '削除'] as const).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 18,
                  backgroundColor: mode === m ? '#4A86C8' : 'transparent',
                }}
              >
                <Text style={{ color: mode === m ? '#fff' : '#666', fontWeight: '600', fontSize: 13 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {mode === '申請' ? (
          <>
            {rows.map((row, i) => (
              <ShiftEntryRow
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
              <Text style={{ color: '#4A86C8', fontSize: 15, fontWeight: '600' }}>＋ 日付を追加</Text>
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
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>申請する</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
              申請中のシフト（承認前のみ削除可能）
            </Text>
            {loadingShifts ? (
              <ActivityIndicator color="#4A86C8" style={{ marginTop: 40 }} />
            ) : myShifts.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>削除可能なシフトはありません</Text>
            ) : (
              myShifts.map(shift => (
                <View
                  key={shift.id}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>{formatDateJP(shift.date)}</Text>
                    <Text style={{ fontSize: 13, color: '#666' }}>{shift.startTime}〜{shift.endTime}</Text>
                    <Text style={{ fontSize: 12, color: '#4A86C8' }}>{shift.workType}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(shift)}
                    style={{ backgroundColor: '#FFE0E0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ color: '#D32F2F', fontWeight: '700' }}>削除</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
