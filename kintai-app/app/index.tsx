import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../store/appStore';
import { getMembers, getSettings } from '../firebase/firestore';
import { sha256 } from '../lib/utils';

export default function LoginScreen() {
  const [members, setMembers] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const { currentUser, hydrated, setCurrentUser, setIsAdmin } = useAppStore();

  // hydration完了後にリダイレクト or メンバー読み込み
  useEffect(() => {
    if (!hydrated) return;
    if (currentUser) {
      router.replace('/(tabs)/input');
      return;
    }
    loadMembers();
  }, [hydrated, currentUser]);

  async function loadMembers() {
    setMembersLoading(true);
    try {
      const list = await getMembers();
      setMembers(list);
    } catch {
      // Firebase未設定でも画面は表示する
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }

  function selectMember(name: string) {
    setCurrentUser(name);
    setIsAdmin(false);
    router.replace('/(tabs)/input');
  }

  async function handleAdminLogin() {
    if (!adminPassword.trim()) return;
    setAdminLoading(true);
    try {
      const inputHash = await sha256(adminPassword.trim());
      let expectedHash: string;

      try {
        const settings = await getSettings();
        expectedHash = settings?.adminPasswordHash ?? (await sha256('IB'));
      } catch {
        expectedHash = await sha256('IB');
      }

      if (inputHash === expectedHash) {
        setIsAdmin(true);
        setCurrentUser('管理者');
        setShowAdminModal(false);
        setAdminPassword('');
        router.replace('/(tabs)/input');
      } else {
        Toast.show({ type: 'error', text1: 'パスワードが違います' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'ログインに失敗しました' });
    } finally {
      setAdminLoading(false);
    }
  }

  // ストア未ハイドレート中はスプラッシュ
  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4FF' }}>
        <ActivityIndicator size="large" color="#4A86C8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4FF' }}>
      {/* ヘッダー */}
      <View style={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4A86C8', textAlign: 'center', marginBottom: 6 }}>
          勤怠管理
        </Text>
        <Text style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>
          名前を選択してください
        </Text>
      </View>

      {/* メンバーリスト */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
      >
        {membersLoading ? (
          <ActivityIndicator color="#4A86C8" style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 15, color: '#999', textAlign: 'center', marginBottom: 8 }}>
              メンバーが登録されていません
            </Text>
            <Text style={{ fontSize: 13, color: '#bbb', textAlign: 'center' }}>
              管理者でログインしてメンバーを追加してください
            </Text>
          </View>
        ) : (
          members.map(name => (
            <TouchableOpacity
              key={name}
              onPress={() => selectMember(name)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 18,
                marginBottom: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 17, color: '#333', fontWeight: '600' }}>{name}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 管理者ログインリンク */}
      <View style={{ padding: 24 }}>
        <TouchableOpacity onPress={() => setShowAdminModal(true)}>
          <Text style={{ textAlign: 'center', color: '#7B1FA2', fontSize: 14, textDecorationLine: 'underline' }}>
            管理者でログイン
          </Text>
        </TouchableOpacity>
      </View>

      {/* 管理者パスワードモーダル */}
      <Modal visible={showAdminModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#7B1FA2', marginBottom: 16, textAlign: 'center' }}>
              管理者ログイン
            </Text>
            <TextInput
              value={adminPassword}
              onChangeText={setAdminPassword}
              placeholder="パスワードを入力"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
              }}
              onSubmitEditing={handleAdminLogin}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowAdminModal(false); setAdminPassword(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' }}
              >
                <Text style={{ color: '#666' }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdminLogin}
                disabled={adminLoading}
                style={{ flex: 1, backgroundColor: '#7B1FA2', padding: 12, borderRadius: 10, alignItems: 'center' }}
              >
                {adminLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>ログイン</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
