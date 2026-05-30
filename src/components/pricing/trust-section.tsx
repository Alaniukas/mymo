import { Clock, RefreshCcw, Shield } from "lucide-react";

const buyingItems = [
  {
    icon: Shield,
    title: "Money-back guarantee",
    description:
      "Try it risk-free. If it's not for you, request a refund within 14 days.",
  },
  {
    icon: RefreshCcw,
    title: "Cancel anytime",
    description:
      "No lock-in contracts. Cancel from your account settings whenever you want.",
  },
  {
    icon: Clock,
    title: "Secure checkout",
    description:
      "256-bit encrypted checkout powered by Stripe. Your data is always safe.",
  },
];

export function TrustSection() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-gambarino font-medium text-neutral-900 text-center mb-10">
          Buying with Mymo
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {buyingItems.map((item) => (
            <div key={item.title} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-4">
                <item.icon className="h-5 w-5 text-neutral-600" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">
                {item.title}
              </h3>
              <p className="text-[13px] text-neutral-500 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-6 text-sm text-neutral-500">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neutral-400" />
          <span>14-day money-back guarantee</span>
        </div>
        <span className="text-neutral-300">·</span>
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-neutral-400" />
          <span>Cancel anytime</span>
        </div>
        <span className="text-neutral-300">·</span>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <span>No lock-in contracts</span>
        </div>
      </div>
    </>
  );
}
