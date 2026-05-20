import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useAppStore } from '../../store/appStore';

export default function TabsLayout() {
  const { currentUser, isAdmin, logout } = useAppStore();

  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
    }
  }, [currentUser]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4A86C8',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
        headerStyle: { backgroundColor: '#4A86C8' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/'); }}
            style={{ marginRight: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 13 }}>ログアウト</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="input"
        options={{
          title: 'シフト申請',
          tabBarLabel: '申請',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="change"
        options={{
          title: '変更申請',
          tabBarLabel: '変更',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔄</Text>,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '月間スケジュール',
          tabBarLabel: 'スケジュール',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text>,
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="admin"
          options={{
            title: '管理',
            tabBarLabel: '管理',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
          }}
        />
      )}
    </Tabs>
  );
}
