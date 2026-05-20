import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getShiftsForMonth, getMembers } from '../../firebase/firestore';
import { getShiftMonthKey, getPeriodRange, formatDateJP, getNowJSTDate } from '../../lib/utils';
import { ShiftEntry, WORK_TYPE_COLORS } from '../../types';

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const isWide = width > 768;

  const [currentMonthKey, setCurrentMonthKey] = useState(() => getShiftMonthKey(getNowJSTDate()));
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentMonthKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [shiftData, memberList] = await Promise.all([
        getShiftsForMonth(currentMonthKey),
        getMembers(),
      ]);
      setShifts(shiftData);
      setMembers(memberList);
    } catch {
      Toast.show({ type: 'error', text1: 'データの読み込みに失敗しました' });
    } finally {
      setLoading(false);
    }
  }

  function prevMonth() {
    const [y, m] = currentMonthKey.split('_').map(Number);
    const prev = m === 1 ? `${y - 1}_12` : `${y}_${String(m - 1).padStart(2, '0')}`;
    setCurrentMonthKey(prev);
  }

  function nextMonth() {
    const [y, m] = currentMonthKey.split('_').map(Number);
    const next = m === 12 ? `${y + 1}_01` : `${y}_${String(m + 1).padStart(2, '0')}`;
    setCurrentMonthKey(next);
  }

  const { start, end } = getPeriodRange(currentMonthKey);
  const [y, m] = currentMonthKey.split('_').map(Number);
  const periodLabel = `${y}年${m}月（${start.slice(5).replace('-', '/')}〜${end.slice(5).replace('-', '/')}）`;

  function getDatesInPeriod(): string[] {
    const dates: string[] = [];
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const cur = new Date(startDate);
    while (cur <= endDate) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  const dates = getDatesInPeriod();
  const shiftsByMemberAndDate: Record<string, Record<string, ShiftEntry[]>> = {};
  for (const member of members) {
    shiftsByMemberAndDate[member] = {};
    for (const date of dates) {
      shiftsByMemberAndDate[member][date] = [];
    }
  }
  for (const shift of shifts) {
    if (shiftsByMemberAndDate[shift.name]?.[shift.date] !== undefined) {
      shiftsByMemberAndDate[shift.name][shift.date].push(shift);
    }
  }

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FF' }}>
        <ActivityIndicator size="large" color="#4A86C8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FF' }} edges={['bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#4A86C8' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>{periodLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: '#4A86C8' }}>›</Text>
        </TouchableOpacity>
      </View>

      {isWide ? (
        // PC: table view
        <ScrollView horizontal>
          <ScrollView>
            <View>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 100, padding: 8, backgroundColor: '#4A86C8', borderRightWidth: 1, borderColor: '#eee' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>メンバー</Text>
                </View>
                {dates.map(date => {
                  const d = new Date(date + 'T00:00:00');
                  const dow = d.getDay();
                  const colors = dow === 0 ? '#FFE0E0' : dow === 6 ? '#E3F2FD' : '#4A86C8';
                  const textColor = dow === 0 || dow === 6 ? '#555' : '#fff';
                  return (
                    <View key={date} style={{ width: 64, padding: 4, backgroundColor: colors, borderRightWidth: 1, borderColor: '#eee', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: textColor, fontWeight: '600' }}>{date.slice(5)}</Text>
                      <Text style={{ fontSize: 10, color: textColor }}>{DOW[dow]}</Text>
                    </View>
                  );
                })}
              </View>

              {members.map(member => (
                <View key={member} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ width: 100, padding: 8, backgroundColor: '#f8f8f8', borderRightWidth: 1, borderColor: '#eee', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#333' }}>{member}</Text>
                  </View>
                  {dates.map(date => {
                    const dayShifts = shiftsByMemberAndDate[member]?.[date] || [];
                    return (
                      <View key={date} style={{ width: 64, minHeight: 44, padding: 2, borderRightWidth: 1, borderColor: '#eee' }}>
                        {dayShifts.map((s, si) => (
                          <View
                            key={si}
                            style={{
                              backgroundColor: WORK_TYPE_COLORS[s.workType] || '#eee',
                              borderRadius: 3,
                              padding: 2,
                              marginBottom: 1,
                              borderWidth: s.status === 'pending' ? 1 : 0,
                              borderColor: '#999',
                              borderStyle: 'dashed',
                            }}
                          >
                            <Text style={{ fontSize: 9, color: '#333' }} numberOfLines={1}>
                              {s.workType.replace('申請', '')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : (
        // Mobile: list view
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {members.map(member => {
            const memberShifts = shifts.filter(s => s.name === member);
            if (memberShifts.length === 0) return null;
            return (
              <View key={member} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>{member}</Text>
                {memberShifts
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((shift, i) => {
                    const d = new Date(shift.date + 'T00:00:00');
                    const dow = DOW[d.getDay()];
                    return (
                      <View
                        key={i}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: WORK_TYPE_COLORS[shift.workType] || '#f5f5f5',
                          marginBottom: 4,
                          borderWidth: shift.status === 'pending' ? 1 : 0,
                          borderColor: '#aaa',
                          borderStyle: 'dashed',
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#555', width: 80 }}>{shift.date.slice(5)} ({dow})</Text>
                        <Text style={{ fontSize: 12, color: '#555', flex: 1 }}>{shift.startTime}〜{shift.endTime}</Text>
                        <Text style={{ fontSize: 11, color: '#4A86C8' }}>{shift.workType}</Text>
                      </View>
                    );
                  })}
              </View>
            );
          })}
          {members.every(m => shifts.filter(s => s.name === m).length === 0) && (
            <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>この期間のシフトはありません</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
