import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { WorkType } from '../types';

interface ShiftRow {
  date: string;
  startTime: string;
  endTime: string;
  workType: WorkType;
}

interface Props {
  row: ShiftRow;
  index: number;
  onChange: (index: number, field: keyof ShiftRow, value: string) => void;
  onRemove: (index: number) => void;
}

const WORK_TYPES: WorkType[] = ['出社申請', 'リモート申請', 'PC持参出社申請'];

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${m}`);
  }
}

function PickerModal({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: 320 }}>
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#888' }}>選択してください</Text>
          </View>
          <ScrollView>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => { onSelect(opt); onClose(); }}
                style={{ padding: 16, borderBottomWidth: 1, borderColor: '#f5f5f5', backgroundColor: opt === selected ? '#E3F2FD' : '#fff' }}
              >
                <Text style={{ fontSize: 16, textAlign: 'center', color: '#333' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ShiftEntryRow({ row, index, onChange, onRemove }: Props) {
  const [showDate, setShowDate] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showType, setShowType] = useState(false);

  const dateOptions: string[] = [];
  const today = new Date();
  for (let i = -7; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split('T')[0]);
  }

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>申請 {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)} style={{ padding: 4 }}>
          <Text style={{ color: '#FF6F00', fontSize: 20, fontWeight: 'bold' }}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>日付</Text>
          {Platform.OS === 'web' ? (
            <TextInput
              value={row.date}
              onChangeText={v => onChange(index, 'date', v)}
              placeholder="YYYY-MM-DD"
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, color: '#333' }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => setShowDate(true)}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
            >
              <Text style={{ fontSize: 14, color: row.date ? '#333' : '#aaa' }}>{row.date || '日付を選択'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 90 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>開始</Text>
          <TouchableOpacity
            onPress={() => setShowStart(true)}
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
          >
            <Text style={{ fontSize: 14, color: row.startTime ? '#333' : '#aaa' }}>{row.startTime || '--:--'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, minWidth: 90 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>終了</Text>
          <TouchableOpacity
            onPress={() => setShowEnd(true)}
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
          >
            <Text style={{ fontSize: 14, color: row.endTime ? '#333' : '#aaa' }}>{row.endTime || '--:--'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>種別</Text>
        <TouchableOpacity
          onPress={() => setShowType(true)}
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        >
          <Text style={{ fontSize: 14, color: row.workType ? '#333' : '#aaa' }}>{row.workType || '種別を選択'}</Text>
        </TouchableOpacity>
      </View>

      <PickerModal
        visible={showDate}
        options={dateOptions}
        selected={row.date}
        onSelect={v => onChange(index, 'date', v)}
        onClose={() => setShowDate(false)}
      />
      <PickerModal
        visible={showStart}
        options={TIME_OPTIONS}
        selected={row.startTime}
        onSelect={v => onChange(index, 'startTime', v)}
        onClose={() => setShowStart(false)}
      />
      <PickerModal
        visible={showEnd}
        options={TIME_OPTIONS}
        selected={row.endTime}
        onSelect={v => onChange(index, 'endTime', v)}
        onClose={() => setShowEnd(false)}
      />
      <PickerModal
        visible={showType}
        options={WORK_TYPES}
        selected={row.workType}
        onSelect={v => onChange(index, 'workType', v as WorkType)}
        onClose={() => setShowType(false)}
      />
    </View>
  );
}
