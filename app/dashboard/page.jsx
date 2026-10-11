import { Suspense } from 'react';
import CommandCenterTab from '../../components/CommandCenterTab';

export default function DashboardPage() {
  return (
    <div className="flex-1 h-full w-full flex flex-col min-h-0 min-w-0">
      <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Dashboard...</div>}>
        <CommandCenterTab />
      </Suspense>
    </div>
  );
}
