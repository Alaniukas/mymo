export type NavLinkItem = { label: string; href: string };

export type UseCaseCard = {
  label: string;
  href: string;
  image: string;
  rightTitle: string;
  rightLinks: NavLinkItem[];
  review: { quote: string; author: string };
};

export type TemplateChoice = {
  label: string;
  description: string;
  href: string;
};

export const templateChoices: TemplateChoice[] = [
  {
    label: "Podcast",
    description: "Conversation-style reels",
    href: "/templates/podcast-style",
  },
  {
    label: "Street Interviews",
    description: "On-the-street sound bites",
    href: "/templates/street-interview",
  },
  {
    label: "Product Reviews",
    description: "Creators react & recommend",
    href: "/templates/reaction",
  },
];

export const useCaseCards: UseCaseCard[] = [
  {
    label: "E-commerce",
    href: "/use-case/ecommerce",
    image: "/assets/landing/use-cases/0cef4f530bbd24e8a1ab6a46ca92a9d1.jpg",
    rightTitle: "What you'll do",
    rightLinks: [
      { label: "Scale your UGC", href: "/use-case/ecommerce" },
      { label: "Run ads for every SKU", href: "/use-case/ecommerce" },
      { label: "Try new markets easily", href: "/use-case/ecommerce" },
      { label: "Scale one winning hook", href: "/use-case/ecommerce" },
    ],
    review: {
      quote: "doubled our ROAS in 3 weeks 🔥",
      author: "— Mia, DTC founder",
    },
  },
  {
    label: "SaaS",
    href: "/use-case/saas",
    image: "/assets/landing/use-cases/1724ac6a58602d6212a584128269067f.jpg",
    rightTitle: "What you'll do",
    rightLinks: [
      { label: "Find a product market fit", href: "/use-case/saas" },
      { label: "Test new angles", href: "/use-case/saas" },
      { label: "Launch UGC on scale", href: "/use-case/saas" },
    ],
    review: {
      quote: "finally ads that convert cold traffic!!",
      author: "— Tom, growth @ SaaS",
    },
  },
  {
    label: "Agencies",
    href: "/use-case/agencies",
    image: "/assets/landing/use-cases/ddcc1e5c98cf8b45e507a222ab63537c.jpg",
    rightTitle: "What you'll do",
    rightLinks: [
      { label: "Deliver 5× more ads", href: "/use-case/agencies" },
      { label: "Save on UGC creators", href: "/use-case/agencies" },
      { label: "Test Insane amounts of ads", href: "/use-case/agencies" },
      { label: "No angle left untouched", href: "/use-case/agencies" },
    ],
    review: {
      quote: "my team ships 5x faster now ✨",
      author: "— Alex, agency owner",
    },
  },
];

export const resourceLinks = [
  {
    label: "Learn",
    description: "UGC, ROAS, ad playbooks",
    href: "/learn/what-is-ugc",
  },
  {
    label: "Compare",
    description: "Mymo vs Synthesia, Arcads…",
    href: "/compare/synthesia",
  },
  {
    label: "Help Centre",
    description: "Docs & support",
    href: "/help",
  },
];

export const resourceHighlight = {
  eyebrow: "New guides weekly",
  title: "Level up your creator marketing",
  body: "Deep dives, playbooks, and teardowns from our best-performing ads.",
  href: "/learn/what-is-ugc",
  accent: "#E9F5E1",
};

export const resourceTestimonial = {
  quote: "The best UGC resource library on the internet.",
  author: "Jess Park",
  role: "Content Lead",
};

export const HEADER_MENU_VIDEO = "/videos/header-menu-video.mp4";

export type NavMenuKey = "Templates" | "Use Cases" | "Resources";

export const navItems: { label: string; href: string; menu?: NavMenuKey }[] = [
  { label: "Templates", href: "/templates", menu: "Templates" },
  { label: "Use Cases", href: "#use-cases", menu: "Use Cases" },
  { label: "Resources", href: "#resources", menu: "Resources" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
];
