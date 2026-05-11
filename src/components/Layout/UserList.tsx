// UserList — список онлайн-пользователей (правая колонка)

import { useUserStore } from '../../stores/userStore';

export default function UserList() {
  const { onlineUsers } = useUserStore();

  return (
    <div className="user-list">
      <div className="user-list-title">В сети — {onlineUsers.length}</div>

      {onlineUsers.map((user) => (
        <div key={user.id} className="user-item">
          <div className="user-avatar-small" style={{ background: user.avatar_color }}>
            {user.display_name.charAt(0).toUpperCase()}
            <div className="status-dot" />
          </div>
          <span className="user-name">{user.display_name}</span>
        </div>
      ))}
    </div>
  );
}
