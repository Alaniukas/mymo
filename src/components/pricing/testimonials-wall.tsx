const reviewsCol1 = [
  {
    source: "Twitter",
    title: "Replaced our entire UGC pipeline",
    body: "We used to spend $2k+ per creator video. Mymo gives us 10x the output at a fraction of the cost. The AI actors are shockingly natural.",
    initials: "SC",
    name: "Sarah Chen",
    handle: "@sarahchen_dtc",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Best tool for Shopify stores",
    body: "We tested 4 different AI video tools. Mymo is the only one where the output actually converts. Our ROAS went up 40% in the first month.",
    initials: "MW",
    name: "Marcus Weil",
    handle: "@marcusweil",
    stars: 5,
  },
  {
    source: "Twitter",
    title: "Game changer for agencies",
    body: "Managing UGC for 12 clients was a nightmare. Now I generate variations in minutes. My clients think I hired a whole production team.",
    initials: "JP",
    name: "Jessica Park",
    handle: "@jesspark_agency",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Incredible time saver",
    body: "What used to take us 2 weeks of back-and-forth with creators now takes 20 minutes. The quality keeps getting better with every update.",
    initials: "TR",
    name: "Tom Rivera",
    handle: "@tom_dtc",
    stars: 4,
  },
];

const reviewsCol2 = [
  {
    source: "Trustpilot",
    title: "Finally, UGC that scales",
    body: "We're a small team running 6 Shopify stores. Mymo lets us produce fresh ad creative for all of them without hiring anyone.",
    initials: "EZ",
    name: "Emily Zhang",
    handle: "@emilyzhang",
    stars: 5,
  },
  {
    source: "Twitter",
    title: "The Canvas feature is amazing",
    body: "Being able to arrange and edit everything visually in the Canvas workspace changed how we plan campaigns. It's like Figma for video ads.",
    initials: "DK",
    name: "David Kim",
    handle: "@davidkim_mkt",
    stars: 5,
  },
  {
    source: "Twitter",
    title: "Our secret weapon",
    body: "We've been using Mymo for 3 months and our competitors keep asking how we produce so much content. Not telling them!",
    initials: "RT",
    name: "Rachel Torres",
    handle: "@racheltorres",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Solid ROI from day one",
    body: "Paid for itself within the first week. We generated 15 video ads and 3 of them became top performers in our Meta campaigns.",
    initials: "AN",
    name: "Alex Novak",
    handle: "@alexnovak_co",
    stars: 4,
  },
];

const reviewsCol3 = [
  {
    source: "Twitter",
    title: "Better than real UGC creators",
    body: "I know that sounds crazy, but the AI actors follow the script perfectly every time. No reshoots, no delays, no ghosting.",
    initials: "LM",
    name: "Lauren Mitchell",
    handle: "@laurenmitch",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Perfect for product launches",
    body: "We launched a new SKU last week and had 8 unique ad creatives ready before the product even shipped. That's never happened before.",
    initials: "CP",
    name: "Chris Patel",
    handle: "@chrispatel_ecom",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "My clients are blown away",
    body: "Showed the output to a client and they couldn't tell it wasn't a real person. We're now offering AI UGC as a premium service.",
    initials: "NK",
    name: "Nina Kowalski",
    handle: "@ninak_agency",
    stars: 5,
  },
  {
    source: "Twitter",
    title: "Impressive language support",
    body: "We sell in 8 markets across Europe. Being able to generate native-language UGC for each one without hiring local creators is huge.",
    initials: "JO",
    name: "James Okafor",
    handle: "@jamesokafor",
    stars: 4,
  },
];

const reviewsCol4 = [
  {
    source: "Twitter",
    title: "Wish I found this sooner",
    body: "Spent months trying to build a creator network. Mymo does in minutes what took me weeks of outreach, negotiations, and revisions.",
    initials: "MS",
    name: "Mia Santos",
    handle: "@miasantos_dtc",
    stars: 5,
  },
  {
    source: "Twitter",
    title: "The future of ad creative",
    body: "This is where the industry is heading. Early adopters are going to have a massive advantage. Get in now.",
    initials: "RB",
    name: "Ryan Brooks",
    handle: "@ryanbrooks_mkt",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Unmatched for testing",
    body: "We run 20+ ad variations per week now. The ability to quickly test hooks, actors, and scripts has completely transformed our creative strategy.",
    initials: "OH",
    name: "Olivia Hart",
    handle: "@oliviahart",
    stars: 5,
  },
  {
    source: "Trustpilot",
    title: "Great support team",
    body: "Had a question about the API and got a response within an hour. The team clearly cares about their customers.",
    initials: "DL",
    name: "Daniel Lee",
    handle: "@daniellee_shop",
    stars: 4,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < count ? "text-amber-400" : "text-neutral-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({
  source,
  title,
  body,
  initials,
  name,
  handle,
  stars,
}: (typeof reviewsCol1)[0]) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <StarRating count={stars} />
        <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-400">
          {source}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-neutral-900 mb-2">{title}</h4>
      <p className="text-[13px] text-neutral-500 leading-relaxed mb-4">{body}</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-semibold text-neutral-600">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900">{name}</p>
          <p className="text-xs text-neutral-400">{handle}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewColumn({
  reviews,
  animationClass,
  hiddenClass = "",
}: {
  reviews: typeof reviewsCol1;
  animationClass: string;
  hiddenClass?: string;
}) {
  const doubled = [...reviews, ...reviews];
  return (
    <div className={`overflow-hidden h-[420px] ${hiddenClass}`}>
      <div className={animationClass}>
        {doubled.map((review, i) => (
          <ReviewCard key={`${review.handle}-${i}`} {...review} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsWall() {
  return (
    <div className="relative overflow-hidden" style={{ height: 420 }}>
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-6 max-w-6xl mx-auto">
        <ReviewColumn reviews={reviewsCol1} animationClass="animate-scroll-up" />
        <ReviewColumn reviews={reviewsCol2} animationClass="animate-scroll-up-slow" />
        <ReviewColumn
          reviews={reviewsCol3}
          animationClass="animate-scroll-up-fast"
          hiddenClass="hidden lg:block"
        />
        <ReviewColumn
          reviews={reviewsCol4}
          animationClass="animate-scroll-up"
          hiddenClass="hidden lg:block"
        />
      </div>
    </div>
  );
}
