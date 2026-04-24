import {
  MessageCircle,
  Moon,
  Sun,
  Settings,
  BarChart3,
  Phone,
  Camera,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { initials } from '@/lib/format';
import type { User } from '@/types';
import ProfileDialog from './ProfileDialog';

export type IconTab = 'chats' | 'analytics' | 'settings';

interface IconSidebarProps {
  activeTab: IconTab;
  onTabChange: (tab: IconTab) => void;
  unreadCount: number;
  userName: string;
  user?: User | null;
  onAvatarUpdate?: (avatarUrl: string) => void;
}

const navItems: { tab: IconTab; icon: typeof MessageCircle; label: string }[] = [
  { tab: 'chats', icon: MessageCircle, label: 'Chats' },
  { tab: 'analytics', icon: BarChart3, label: 'Analytics' },
];

const WA_PHONE = '+44 7463 444194';

export default function IconSidebar({
  activeTab,
  onTabChange,
  unreadCount,
  userName,
  user,
  onAvatarUpdate,
}: IconSidebarProps) {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <>
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
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
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
          <button
            title={isDark ? 'Light mode' : 'Dark mode'}
            onClick={() => setIsDark(!isDark)}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-xl text-wa-icon transition-colors hover:bg-wa-hover"
          >
            {isDark ? <Sun size={22} strokeWidth={1.8} /> : <Moon size={22} strokeWidth={1.8} />}
          </button>

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

          {/* Profile avatar — opens dialog */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              onClick={() => setProfileOpen(true)}
              className="group relative"
              title="Profile & Logo"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={userName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white ring-2 ring-primary/30">
                  {initials(userName)}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={14} className="text-white" />
              </div>
            </button>
            <div className="flex items-center gap-0.5" title={WA_PHONE}>
              <Phone size={8} className="shrink-0 text-primary" />
              <span className="whitespace-nowrap text-[7px] font-medium leading-none text-wa-icon">
                +447463444194
              </span>
            </div>
          </div>
        </div>
      </div>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user ?? null}
        onAvatarUpdate={(url) => onAvatarUpdate?.(url)}
      />
    </>
  );
}
