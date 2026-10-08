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
        window.location.href = data.url; 
      } else {
        console.error('Checkout failed');
        setLoadingId(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setLoadingId(null);
    }
  };

  // Define the pricing structure. Update the prices and savings to match your exact mathematical calculations.
  const tiers = [
    { name: 'AI Assistant Basic', price: '£4.99', period: '/mo', savings: null, id: 'price_1UMlmHF5h8YEG0YhIpjH9D49' },
    { name: 'AI Assistant Basic Anuual', price: '£49', period: '/yr', savings: 'Save £10 a year', id: 'price_1UNvx6F5h8YEG0Yh4EDRT2V5' },
    { name: 'AI Assistant Pro', price: '£9.99', period: '/mo', savings: null, id: 'price_1UMmu2F5h8YEG0YhuedRiwTJ' },
    { name: 'AI Assistant Pro Annual', price: '100', period: '/yr', savings: 'Save £20 a year', id: 'price_1UNvxoF5h8YEG0YhMuRLwJir' },
  ];

  // Define the feature list. The boolean array directly maps to the 4 tiers above (Basic, Basic Annual, Pro, Pro Annual)
  const features = [
    { name: 'Core AI Lesson Generation', access: [true, true, true, true] },
    { name: 'Standard Resource Templates', access: [true, true, true, true] },
    { name: 'Automated Marking Assistant', access: [false, false, true, true] },
    { name: 'Custom AI Personas', access: [false, false, true, true] },
    { name: 'Priority Server Processing', access: [false, false, true, true] },
  ];

  const CheckIcon = () => <span className="text-emerald-500 font-bold text-lg">✓</span>;
  const CrossIcon = () => <span className="text-slate-300 text-sm">✕</span>;

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-slate-900 mb-12">
          Select Your Plan
        </h1>
        
        {/* Responsive wrapper to allow horizontal scrolling on small mobile screens without breaking the table */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-6 border-b border-slate-200 bg-slate-50 min-w-[200px]">
                  <span className="sr-only">Features</span>
                </th>
                {tiers.map((tier) => (
                  <th key={tier.name} className="p-6 border-b border-slate-200 border-l text-center min-w-[160px]">
                    <h2 className="text-lg font-semibold text-slate-800">{tier.name}</h2>
                    <div className="mt-2 flex flex-col items-center justify-center h-16">
                      <p className="text-3xl font-bold text-slate-900">
                        {tier.price}<span className="text-sm font-normal text-slate-500">{tier.period}</span>
                      </p>
                      {tier.savings ? (
                        <p className="text-xs font-bold text-emerald-600 mt-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {tier.savings}
                        </p>
                      ) : (
                        <div className="h-5 mt-1"></div> /* Spacer to keep alignment identical */
                      )}
                    </div>
                    <button
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={loadingId === tier.id}
                      className="mt-6 w-full bg-indigo-600 text-white rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {loadingId === tier.id ? 'Loading...' : 'Subscribe'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={feature.name} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-4 pl-6 text-sm font-medium text-slate-700 border-t border-slate-200">
                    {feature.name}
                  </td>
                  {feature.access.map((hasAccess, i) => (
                    <td key={i} className="p-4 text-center border-t border-l border-slate-200">
                      {hasAccess ? <CheckIcon /> : <CrossIcon />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
