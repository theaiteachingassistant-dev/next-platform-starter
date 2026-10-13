import Link from 'next/link';

export default function ReportingHubPage() {
  const reportingModules = [
    {
      id: 'parents-evening',
      title: "Parents' Evening Snapshots",
      description: "Generate dual-timeline overviews (Last 3 Months vs Academic Year) weaving foundational skills into core subjects for parent discussions.",
      icon: "👥",
      color: "bg-purple-100 text-purple-700 border-purple-200",
      hover: "hover:border-purple-400 hover:shadow-purple-100",
      href: "/dashboard/reporting/parents-evening"
    },
    {
      id: 'end-of-year',
      title: "End of Year Reports",
      description: "Compile comprehensive academic year trajectories, celebrating achievements and identifying Key Stage transition readiness.",
      icon: "🎓",
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      hover: "hover:border-emerald-400 hover:shadow-emerald-100",
      href: "/dashboard/reporting/end-of-year"
    },
    {
      id: 'send-plans',
      title: "SEND SMART Plans",
      description: "Generate actionable SMART targets prioritized directly from your SEND notes and current curriculum bottlenecks.",
      icon: "🎯",
      color: "bg-amber-100 text-amber-700 border-amber-200",
      hover: "hover:border-amber-400 hover:shadow-amber-100",
      href: "/dashboard/reporting/send-plans"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0 z-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">Unified Reporting Hub</h1>
            <p className="text-sm text-slate-500 font-medium">Select a reporting module to begin generating AI-assisted pupil assessments.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reportingModules.map((module) => (
              <Link 
                key={module.id} 
                href={module.href}
                className={`group bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col h-full ${module.hover}`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold mb-5 border ${module.color}`}>
                  {module.icon}
                </div>
                
                <h2 className="text-xl font-extrabold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                  {module.title}
                </h2>
                
                <p className="text-sm font-medium text-slate-500 leading-relaxed flex-1">
                  {module.description}
                </p>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <span>Open Workspace</span>
                  <span className="text-lg transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="text-sm font-extrabold text-indigo-900 mb-1">Workflow Tip</h4>
              <p className="text-xs font-semibold text-indigo-700 leading-relaxed">
                All generated reports will automatically be saved to your 7-Day Document Bank. You can also quickly access these modules directly from any pupil's profile drawer while working on the main matrix.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
