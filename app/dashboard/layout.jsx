'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

export default function DashboardLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: 'Morning Briefing', icon: '🌅', path: '/dashboard/morning-briefing' },
    { name: 'Command Center', icon: '🎯', path: '/dashboard' },
    { name: 'Resource Engine', icon: '⚙️', path: '/dashboard/resource-engine' },
    { name: 'Curriculum & Settings', icon: '📚', path: '/dashboard/curriculum-settings' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col shrink-0 z-50 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!isSidebarCollapsed && <span className="font-extrabold text-white truncate text-sm tracking-tight">KS2 Command.</span>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors mx-auto">
            {isSidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
          {navItems.map((item) => {
            // Strict active state check
            const isActive = item.path === '/dashboard' ? pathname === '/dashboard' : pathname.includes(item.path);
            return (
              <Link key={item.name} href={item.path} className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-800'}`}>
                <span className="text-xl mx-auto flex-shrink-0">{item.icon}</span>
                {!isSidebarCollapsed && <span className="text-sm font-semibold truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 flex justify-center">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>
      
      {/* 
        This is the critical fix for the floating tabs. 
        h-screen forces this container to exactly match the monitor height.
      */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative bg-slate-50">
        {children}
      </main>
    </div>
  );
}
