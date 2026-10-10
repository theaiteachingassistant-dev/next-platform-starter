'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

export default function DashboardLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside 
        className={`bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col shrink-0 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!isSidebarCollapsed && (
            <span className="font-extrabold text-white truncate text-sm tracking-tight">
              Tactical Command
            </span>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors mx-auto"
          >
            {isSidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
          <Link 
            href="/dashboard/morning-briefing" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
              pathname.includes('morning-briefing') ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-800'
            }`}
          >
            <span className="text-xl mx-auto flex-shrink-0">🌅</span>
            {!isSidebarCollapsed && <span className="text-sm font-semibold truncate">Morning Briefing</span>}
          </Link>
          
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
              pathname === '/dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-800'
            }`}
          >
            <span className="text-xl mx-auto flex-shrink-0">🎯</span>
            {!isSidebarCollapsed && <span className="text-sm font-semibold truncate">Command Center</span>}
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800 flex justify-center">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>
      
      {/* Main Content Area - Fluidly expands when sidebar shrinks */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
