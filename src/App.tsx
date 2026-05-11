// Корневой компонент dotConnect — роутинг экранов

import { useUserStore } from './stores/userStore';
import LoginScreen from './components/Connection/LoginScreen';
import ChoiceScreen from './components/Connection/ChoiceScreen';
import HostScreen from './components/Connection/HostScreen';
import JoinScreen from './components/Connection/JoinScreen';
import Sidebar from './components/Layout/Sidebar';
import ChatArea from './components/Layout/ChatArea';
import UserList from './components/Layout/UserList';

export default function App() {
  const { currentScreen } = useUserStore();

  // Экраны подключения
  if (currentScreen === 'login') return <LoginScreen />;
  if (currentScreen === 'choice') return <ChoiceScreen />;
  if (currentScreen === 'host') return <HostScreen />;
  if (currentScreen === 'join') return <JoinScreen />;

  // Основной чат-layout (3 колонки как в Discord)
  return (
    <div className="app-layout">
      <Sidebar />
      <ChatArea />
      <UserList />
    </div>
  );
}
