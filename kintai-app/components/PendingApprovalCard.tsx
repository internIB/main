import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChangeRequest } from '../types';
import { formatDateJP } from '../lib/utils';

interface Props {
  request: ChangeRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

export default function PendingApprovalCard({ request, onApprove, onReject, loading }: Props) {
  const createdDate = request.createdAt?.toDate
    ? request.createdAt.toDate().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '';

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{request.name}</Text>
        <View style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ fontSize: 12, color: '#FF6F00', fontWeight: '600' }}>{request.reqType}</Text>
        </View>
      </View>

      {request.oldDate && (
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: '#888' }}>変更前</Text>
          <Text style={{ fontSize: 13, color: '#555' }}>
            {formatDateJP(request.oldDate)}
            {request.oldStartTime && ` ${request.oldStartTime}〜${request.oldEndTime}`}
          </Text>
        </View>
      )}

      {request.newDate && (
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: '#888' }}>変更後</Text>
          <Text style={{ fontSize: 13, color: '#555' }}>
            {formatDateJP(request.newDate)}
            {request.newStartTime && ` ${request.newStartTime}〜${request.newEndTime}`}
          </Text>
        </View>
      )}

      <Text style={{ fontSize: 12, color: '#777', marginBottom: 2 }}>種別: {request.workType}</Text>
      <Text style={{ fontSize: 12, color: '#777', marginBottom: 2 }}>理由: {request.changeReason}{request.reasonText ? `（${request.reasonText}）` : ''}</Text>
      {createdDate && <Text style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>申請日時: {createdDate}</Text>}

      {loading ? (
        <ActivityIndicator color="#4A86C8" />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => onApprove(request.id!)}
            style={{ flex: 1, backgroundColor: '#4A86C8', borderRadius: 8, padding: 10, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>承認</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onReject(request.id!)}
            style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' }}
          >
            <Text style={{ color: '#666', fontWeight: '700', fontSize: 14 }}>却下</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
