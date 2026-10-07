import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInButton, SignUpButton } from '@clerk/nextjs';

export default async function LandingPage() {
  const { userId } = await auth();

  // Instantly bypass the landing page if the teacher is already logged in
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 text-center border-b border-slate-100">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">KS2 Command<span className="text-indigo-600">.</span></h1>
          <p className="text-slate-500">The automated operating system for UK primary teachers.</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-left">
            <h2 className="text-amber-800 font-bold text-sm mb-2">Legal & GDPR Notice</h2>
            <p className="text-xs text-amber-700 leading-relaxed">
              By creating an account, you explicitly confirm that you possess authorization from your school leadership to process pupil performance data using this application. Do not enter sensitive safeguarding or medical information. KS2 Command acts as a data processor; you remain the data controller.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
                Accept & Create Account
              </button>
            </SignUpButton>
            
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="w-full py-3 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-lg transition-colors">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    </div>
  );
}
