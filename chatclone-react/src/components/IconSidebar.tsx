import {
  MessageCircle,
  Phone,
  RefreshCw,
  Radio,
  Users,
  Moon,
  Sun,
  Settings,
  BarChart3,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { initials } from '@/lib/format';

export type IconTab = 'chats' | 'calls' | 'status' | 'channels' | 'communities' | 'analytics' | 'settings';

interface IconSidebarProps {
  activeTab: IconTab;
  onTabChange: (tab: IconTab) => void;
  unreadCount: number;
  userName: string;
}

const navItems: { tab: IconTab; icon: typeof MessageCircle; label: string }[] = [
  { tab: 'chats', icon: MessageCircle, label: 'Chats' },
  { tab: 'calls', icon: Phone, label: 'Calls' },
  { tab: 'status', icon: RefreshCw, label: 'Status' },
  { tab: 'channels', icon: Radio, label: 'Channels' },
  { tab: 'communities', icon: Users, label: 'Communities' },
  { tab: 'analytics', icon: BarChart3, label: 'Analytics' },
];

export default function IconSidebar({
  activeTab,
  onTabChange,
  unreadCount,
  userName,
}: IconSidebarProps) {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <div className="flex h-full w-[68px] shrink-0 flex-col bg-wa-icon-sidebar">
      {/* Top navigation icons */}
      <div className="flex flex-1 flex-col items-center gap-1 pt-3">
        {navItems.map(({ tab, icon: Icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              title={label}
              onClick={() => onTabChange(tab)}
              className={`relative flex h-[44px] w-[44px] items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'bg-wa-active text-primary'
                  : 'text-wa-icon hover:bg-wa-hover'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              {/* Unread badge on chats */}
              {tab === 'chats' && unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-1 pb-3">
        {/* Theme toggle */}
        <button
          title={isDark ? 'Light mode' : 'Dark mode'}
          onClick={() => setIsDark(!isDark)}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-xl text-wa-icon transition-colors hover:bg-wa-hover"
        >
          {isDark ? <Sun size={22} strokeWidth={1.8} /> : <Moon size={22} strokeWidth={1.8} />}
        </button>

        {/* Settings */}
        <button
          title="Settings"
          onClick={() => onTabChange('settings')}
          className={`flex h-[44px] w-[44px] items-center justify-center rounded-xl transition-colors ${
            activeTab === 'settings'
              ? 'bg-wa-active text-primary'
              : 'text-wa-icon hover:bg-wa-hover'
          }`}
        >
          {activeTab === 'settings' && (
            <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-primary" />
          )}
          <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.2 : 1.8} />
        </button>

        {/* Profile avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white"
          title={userName}
        >
          {initials(userName)}
        </div>
      </div>
    </div>
  );
}
