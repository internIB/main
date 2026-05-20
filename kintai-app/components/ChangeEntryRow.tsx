import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';

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

interface Props {
  row: ChangeRow;
  index: number;
  onChange: (index: number, field: keyof ChangeRow, value: string) => void;
  onRemove: (index: number) => void;
}

const WORK_TYPES = ['出社', 'リモート', 'PC持参出社'];
const REASONS: Array<'病気' | 'その他'> = ['病気', 'その他'];

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

function DateInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const dateOptions: string[] = [];
  const today = new Date();
  for (let i = -30; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split('T')[0]);
  }

  if (Platform.OS === 'web') {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 13, color: '#333', minWidth: 100 }}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, minWidth: 100 }}
      >
        <Text style={{ fontSize: 13, color: value ? '#333' : '#aaa' }}>{value || placeholder}</Text>
      </TouchableOpacity>
      <PickerModal
        visible={showPicker}
        options={dateOptions}
        selected={value}
        onSelect={onChange}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}

export default function ChangeEntryRow({ row, index, onChange, onRemove }: Props) {
  const [showOldStart, setShowOldStart] = useState(false);
  const [showOldEnd, setShowOldEnd] = useState(false);
  const [showNewStart, setShowNewStart] = useState(false);
  const [showNewEnd, setShowNewEnd] = useState(false);
  const [showType, setShowType] = useState(false);
  const [showReason, setShowReason] = useState(false);

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>変更 {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)} style={{ padding: 4 }}>
          <Text style={{ color: '#FF6F00', fontSize: 20, fontWeight: 'bold' }}>×</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 11, color: '#4A86C8', fontWeight: '700', marginBottom: 4 }}>変更前（任意）</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <DateInput value={row.oldDate} onChange={v => onChange(index, 'oldDate', v)} placeholder="日付" />
        <TouchableOpacity onPress={() => setShowOldStart(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, minWidth: 72 }}>
          <Text style={{ fontSize: 13, color: row.oldStartTime ? '#333' : '#aaa' }}>{row.oldStartTime || '開始'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowOldEnd(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, minWidth: 72 }}>
          <Text style={{ fontSize: 13, color: row.oldEndTime ? '#333' : '#aaa' }}>{row.oldEndTime || '終了'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 11, color: '#4A86C8', fontWeight: '700', marginBottom: 4 }}>変更後（任意）</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <DateInput value={row.newDate} onChange={v => onChange(index, 'newDate', v)} placeholder="日付" />
        <TouchableOpacity onPress={() => setShowNewStart(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, minWidth: 72 }}>
          <Text style={{ fontSize: 13, color: row.newStartTime ? '#333' : '#aaa' }}>{row.newStartTime || '開始'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowNewEnd(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, minWidth: 72 }}>
          <Text style={{ fontSize: 13, color: row.newEndTime ? '#333' : '#aaa' }}>{row.newEndTime || '終了'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>種別</Text>
          <TouchableOpacity onPress={() => setShowType(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 13, color: row.workType ? '#333' : '#aaa' }}>{row.workType || '種別'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>理由</Text>
          <TouchableOpacity onPress={() => setShowReason(true)} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8 }}>
            <Text style={{ fontSize: 13, color: row.changeReason ? '#333' : '#aaa' }}>{row.changeReason || '理由'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {row.changeReason === 'その他' && (
        <TextInput
          value={row.reasonText}
          onChangeText={v => onChange(index, 'reasonText', v)}
          placeholder="詳細を入力（任意）"
          multiline
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 13, minHeight: 60 }}
        />
      )}

      <PickerModal visible={showOldStart} options={TIME_OPTIONS} selected={row.oldStartTime} onSelect={v => onChange(index, 'oldStartTime', v)} onClose={() => setShowOldStart(false)} />
      <PickerModal visible={showOldEnd} options={TIME_OPTIONS} selected={row.oldEndTime} onSelect={v => onChange(index, 'oldEndTime', v)} onClose={() => setShowOldEnd(false)} />
      <PickerModal visible={showNewStart} options={TIME_OPTIONS} selected={row.newStartTime} onSelect={v => onChange(index, 'newStartTime', v)} onClose={() => setShowNewStart(false)} />
      <PickerModal visible={showNewEnd} options={TIME_OPTIONS} selected={row.newEndTime} onSelect={v => onChange(index, 'newEndTime', v)} onClose={() => setShowNewEnd(false)} />
      <PickerModal visible={showType} options={WORK_TYPES} selected={row.workType} onSelect={v => onChange(index, 'workType', v)} onClose={() => setShowType(false)} />
      <PickerModal visible={showReason} options={REASONS} selected={row.changeReason} onSelect={v => onChange(index, 'changeReason', v)} onClose={() => setShowReason(false)} />
    </View>
  );
}
