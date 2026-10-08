import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
  const user = await currentUser();
  
  // Read the updated cryptographic badge applied by the Stripe Webhook
  const hasPaid = user?.publicMetadata?.hasPaid === true;

  // If they have not paid for either tier, boot them back to the pricing matrix
  if (!hasPaid) {
    redirect('/pricing');
  }

  // If they have paid, render the dashboard and all its tabs
  return (
    <div className="dashboard-security-wrapper">
      {children}
    </div>
  );
}
