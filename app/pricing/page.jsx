'use client';

import { useState } from 'react';

export default function PricingPage() {
  const [loadingId, setLoadingId] = useState(null);

  const handleSubscribe = async (priceId) => {
    setLoadingId(priceId);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url; // Routes the user securely to Stripe
      } else {
        console.error('Checkout failed');
        setLoadingId(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setLoadingId(null);
    }
  };

  // Replace the 'price_1...' strings below with your exact Stripe API IDs
  const tiers = [
    { name: 'AI Assistant Basic', price: '£5', id: 'price_1UMlmHF5h8YEG0YhIpjH9D49' },
    { name: 'Ai Assistant Basic', price: '£49', id: 'price_1UNvx6F5h8YEG0Yh4EDRT2V5' },
    { name: 'AI Assistant Pro', price: '£10', id: 'price_1UMmu2F5h8YEG0YhuedRiwTJ' },
    { name: 'AI Assistant Pro', price: '£100', id: 'price_1UNvxoF5h8YEG0YhMuRLwJir' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-slate-900 mb-12">
          Select Your Plan
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div key={tier.name} className="border border-slate-200 rounded-xl p-6 shadow-sm bg-white flex flex-col">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">{tier.name}</h2>
              <p className="text-4xl font-bold text-slate-900 mb-6">
                {tier.price}<span className="text-base font-normal text-slate-500">/mo</span>
              </p>
              <button
                onClick={() => handleSubscribe(tier.id)}
                disabled={loadingId === tier.id}
                className="mt-auto bg-indigo-600 text-white rounded-lg py-3 px-4 font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loadingId === tier.id ? 'Loading...' : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
