import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  
  // Read the cryptographic badge applied by the Stripe Webhook
  const isPro = user?.publicMetadata?.isPro === true;

  // If they have not paid, boot them back to the pricing matrix
  if (!isPro) {
    redirect('/pricing');
  }

  // If they have paid, render the dashboard and all its tabs
  return (
    <div className="dashboard-security-wrapper">
      {children}
    </div>
  );
}
