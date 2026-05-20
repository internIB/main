import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../../store/appStore';
import {
  subscribeChangeRequests,
  updateChangeRequest,
  getShiftsForMonth,
  updateShift,
  deleteShift,
  addShift,
  getMembers,
  updateMembers,
  deleteOldShifts,
  getSettings,
  updateSettings,
} from '../../firebase/firestore';
import { getShiftMonthKey, getNowJSTDate, sha256 } from '../../lib/utils';
import { ChangeRequest, ShiftEntry } from '../../types';
import { createCalendarEvent } from '../../lib/calendar';
import PendingApprovalCard from '../../components/PendingApprovalCard';

type AdminTab = 'approval' | 'calendar' | 'members' | 'cleanup';

export default function AdminScreen() {
  const { isAdmin, googleAccessToken, setGoogleAccessToken } = useAppStore();
  const [tab, setTab] = useState<AdminTab>('approval');

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0FF' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#7B1FA2', padding: 14 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontSize: 16 }}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>管理者画面</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' }}>
        {([
          { key: 'approval', label: '承認' },
          { key: 'calendar', label: 'カレンダー' },
          { key: 'members', label: 'メンバー' },
          { key: 'cleanup', label: 'データ整理' },
        ] as { key: AdminTab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: 10,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === t.key ? '#7B1FA2' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, color: tab === t.key ? '#7B1FA2' : '#888', fontWeight: tab === t.key ? '700' : '400' }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'approval' && <ApprovalTab />}
      {tab === 'calendar' && <CalendarTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'cleanup' && <CleanupTab />}
    </SafeAreaView>
  );
}

// ---- Approval Tab ----

function ApprovalTab() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    unsubRef.current = subscribeChangeRequests('申請中', setRequests);
    return () => unsubRef.current?.();
  }, []);

  async function handleApprove(id: string) {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    setProcessingId(id);
    try {
      const now = getNowJSTDate();
      const monthKey = getShiftMonthKey(now);

      if (req.reqType === '削除申請' && req.oldDate) {
        const oldMonthKey = getShiftMonthKey(new Date(req.oldDate + 'T00:00:00'));
        const allShifts = await getShiftsForMonth(oldMonthKey);
        const target = allShifts.find(s =>
          s.name === req.name &&
          s.date === req.oldDate &&
          (!req.oldStartTime || s.startTime === req.oldStartTime)
        );
        if (target?.id) await deleteShift(oldMonthKey, target.id);
      } else if (req.reqType === '追加申請' && req.newDate) {
        await addShift({
          name: req.name,
          date: req.newDate,
          startTime: req.newStartTime || '',
          endTime: req.newEndTime || '',
          workType: req.workType as any,
          status: 'confirmed',
        });
      } else if (req.reqType === '変更' && req.oldDate && req.newDate) {
        const oldMonthKey = getShiftMonthKey(new Date(req.oldDate + 'T00:00:00'));
        const allShifts = await getShiftsForMonth(oldMonthKey);
        const target = allShifts.find(s =>
          s.name === req.name &&
          s.date === req.oldDate &&
          (!req.oldStartTime || s.startTime === req.oldStartTime)
        );
        if (target?.id) await deleteShift(oldMonthKey, target.id);
        await addShift({
          name: req.name,
          date: req.newDate,
          startTime: req.newStartTime || '',
          endTime: req.newEndTime || '',
          workType: req.workType as any,
          status: 'confirmed',
        });
      }

      await updateChangeRequest(id, { status: '承認済' });
      Toast.show({ type: 'success', text1: '承認しました' });
    } catch {
      Toast.show({ type: 'error', text1: '承認処理に失敗しました' });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    try {
      await updateChangeRequest(id, { status: '却下' });
      Toast.show({ type: 'info', text1: '却下しました' });
    } catch {
      Toast.show({ type: 'error', text1: '処理に失敗しました' });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {requests.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>承認待ちの申請はありません</Text>
      ) : (
        requests.map(req => (
          <PendingApprovalCard
            key={req.id}
            request={req}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={processingId === req.id}
          />
        ))
      )}
    </ScrollView>
  );
}

// ---- Calendar Tab ----

function CalendarTab() {
  const { googleAccessToken, setGoogleAccessToken } = useAppStore();
  const [pendingShifts, setPendingShifts] = useState<ShiftEntry[]>([]);
  const [calendarId, setCalendarId] = useState('primary');
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const settings = await getSettings();
      if (settings?.calendarId) setCalendarId(settings.calendarId);
      const now = getNowJSTDate();
      const monthKey = getShiftMonthKey(now);
      const shifts = await getShiftsForMonth(monthKey);
      setPendingShifts(shifts.filter(s => s.status === 'pending'));
    } catch {
      Toast.show({ type: 'error', text1: 'データの読み込みに失敗しました' });
    } finally {
      setLoading(false);
    }
  }

  async function saveCalendarId() {
    try {
      await updateSettings({ calendarId });
      Toast.show({ type: 'success', text1: 'カレンダーIDを保存しました' });
    } catch {
      Toast.show({ type: 'error', text1: '保存に失敗しました' });
    }
  }

  async function reflectShift(shift: ShiftEntry) {
    if (!googleAccessToken) {
      Toast.show({ type: 'error', text1: 'Googleアカウントでログインが必要です' });
      return;
    }
    if (!shift.id) return;
    setProcessingId(shift.id);
    try {
      const monthKey = getShiftMonthKey(new Date(shift.date + 'T00:00:00'));
      const eventId = await createCalendarEvent(googleAccessToken, calendarId, shift);
      await updateShift(monthKey, shift.id, { status: 'confirmed', calendarEventId: eventId });
      Toast.show({ type: 'success', text1: 'カレンダーに反映しました' });
      setPendingShifts(prev => prev.filter(s => s.id !== shift.id));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: `反映に失敗しました: ${e.message}` });
    } finally {
      setProcessingId(null);
    }
  }

  async function reflectAll() {
    if (!googleAccessToken) {
      Toast.show({ type: 'error', text1: 'Googleアカウントでログインが必要です' });
      return;
    }
    for (const shift of pendingShifts) {
      await reflectShift(shift);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: '#555', marginBottom: 8, fontWeight: '600' }}>カレンダーID設定</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={calendarId}
            onChangeText={setCalendarId}
            placeholder="primary"
            style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13 }}
          />
          <TouchableOpacity
            onPress={saveCalendarId}
            style={{ backgroundColor: '#7B1FA2', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>保存</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
          「primary」で自分のメインカレンダー、またはカレンダーIDを入力
        </Text>
      </View>

      <View style={{ backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: '#FF6F00' }}>
          Google Calendar連携にはOAuth認証が必要です。アクセストークンをセットしてください。
        </Text>
        <TextInput
          value={googleAccessToken || ''}
          onChangeText={setGoogleAccessToken}
          placeholder="Google Access Token"
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 12, marginTop: 8, backgroundColor: '#fff' }}
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#7B1FA2" />
      ) : (
        <>
          {pendingShifts.length > 0 && (
            <TouchableOpacity
              onPress={reflectAll}
              style={{ backgroundColor: '#7B1FA2', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 16 }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>全件まとめて反映（{pendingShifts.length}件）</Text>
            </TouchableOpacity>
          )}

          {pendingShifts.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 20 }}>反映待ちのシフトはありません</Text>
          ) : (
            pendingShifts.map(shift => (
              <View
                key={shift.id}
                style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View>
                  <Text style={{ fontWeight: '600', color: '#333' }}>{shift.name}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>{shift.date} {shift.startTime}〜{shift.endTime}</Text>
                  <Text style={{ fontSize: 12, color: '#4A86C8' }}>{shift.workType}</Text>
                </View>
                {processingId === shift.id ? (
                  <ActivityIndicator color="#7B1FA2" />
                ) : (
                  <TouchableOpacity
                    onPress={() => reflectShift(shift)}
                    style={{ backgroundColor: '#7B1FA2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>反映</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// ---- Members Tab ----

function MembersTab() {
  const [members, setMembers] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    setLoading(true);
    try {
      const list = await getMembers();
      setMembers(list);
    } catch {
      Toast.show({ type: 'error', text1: 'メンバーの読み込みに失敗しました' });
    } finally {
      setLoading(false);
    }
  }

  async function addMember() {
    const name = newName.trim();
    if (!name || members.includes(name)) {
      Toast.show({ type: 'error', text1: '有効な名前を入力してください' });
      return;
    }
    setSaving(true);
    try {
      const updated = [...members, name];
      await updateMembers(updated);
      setMembers(updated);
      setNewName('');
      Toast.show({ type: 'success', text1: `${name} を追加しました` });
    } catch {
      Toast.show({ type: 'error', text1: '追加に失敗しました' });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(name: string) {
    Alert.alert('削除確認', `${name} をメンバーから削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = members.filter(m => m !== name);
            await updateMembers(updated);
            setMembers(updated);
            Toast.show({ type: 'success', text1: '削除しました' });
          } catch {
            Toast.show({ type: 'error', text1: '削除に失敗しました' });
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 }}>メンバーを追加</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="名前を入力"
            style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 }}
            onSubmitEditing={addMember}
          />
          <TouchableOpacity
            onPress={addMember}
            disabled={saving}
            style={{ backgroundColor: '#7B1FA2', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', minWidth: 60, alignItems: 'center' }}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>追加</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7B1FA2" />
      ) : members.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 20 }}>メンバーがいません</Text>
      ) : (
        members.map(name => (
          <View
            key={name}
            style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 15, color: '#333' }}>{name}</Text>
            <TouchableOpacity
              onPress={() => removeMember(name)}
              style={{ backgroundColor: '#FFE0E0', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: '#D32F2F', fontWeight: '700', fontSize: 13 }}>削除</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ---- Cleanup Tab ----

function CleanupTab() {
  const [loading, setLoading] = useState(false);

  async function handleCleanup() {
    Alert.alert(
      'データ削除確認',
      '4ヶ月以上前のシフトデータを削除します。この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const count = await deleteOldShifts();
              Toast.show({ type: 'success', text1: `${count}件のデータを削除しました` });
            } catch {
              Toast.show({ type: 'error', text1: '削除に失敗しました' });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 }}>古いデータの削除</Text>
        <Text style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 20 }}>
          4ヶ月以上前のシフトデータをFirestoreから削除します。{'\n'}
          データ量の削減とコスト最適化のために定期的に実行することをお勧めします。
        </Text>
        <TouchableOpacity
          onPress={handleCleanup}
          disabled={loading}
          style={{
            backgroundColor: '#FF6F00',
            borderRadius: 10,
            padding: 14,
            alignItems: 'center',
            minHeight: 50,
          }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>4ヶ月以上前のデータを削除</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
