import { Bot, CalendarClock, Headphones, MessageCircleMore, PhoneCall, Star } from "lucide-react";

export const automations = [
  { slug: "voice-sms-receptionist", name: "AI Voice & SMS Receptionist", shortName: "Voice Receptionist", price: 499, icon: PhoneCall, badge: "Most popular", description: "Never miss another customer. Answer calls and texts, book appointments, and follow up instantly—24/7.", features: ["Natural voice and SMS conversations", "Live calendar availability and booking", "Instant SMS follow-ups during calls", "Custom call flows and escalation rules"], useCases: ["Dental and medical practices", "Home service companies", "High-volume appointment teams"] },
  { slug: "lead-capture-qualifier", name: "AI Lead Capture & Smart Qualifier", shortName: "Lead Qualifier", price: 299, icon: Bot, badge: "Fastest ROI", description: "Turn more website visitors into qualified opportunities without adding forms or headcount.", features: ["Proactive on-site conversations", "Budget, timeline, and service qualification", "Contact capture and CRM routing", "Hot-lead alerts for your sales team"], useCases: ["Agencies and consultancies", "B2B service providers", "High-intent landing pages"] },
  { slug: "knowledge-base-support", name: "AI Knowledge Base Support Agent", shortName: "Support Agent", price: 349, icon: Headphones, badge: "80% ticket deflection", description: "Deliver instant, accurate answers grounded in your website, FAQs, and internal documentation.", features: ["Custom document and FAQ knowledge", "Cited, context-aware answers", "Human handoff for complex requests", "Support analytics and gap reporting"], useCases: ["SaaS customer support", "Membership organizations", "Product documentation portals"] },
  { slug: "social-dm-assistant", name: "AI Social DM & Messaging Assistant", shortName: "Social DM Assistant", price: 299, icon: MessageCircleMore, badge: "Omnichannel", description: "Capture and qualify buyers across WhatsApp, Instagram, and Messenger while interest is high.", features: ["WhatsApp, Instagram, and Messenger", "Automatic product Q&A", "Lead qualification inside chat", "Contact capture and team handoff"], useCases: ["Ecommerce brands", "Restaurants and hospitality", "Social-first businesses"] },
  { slug: "appointment-recovery", name: "AI Appointment & No-Show Recovery", shortName: "Appointment Recovery", price: 399, icon: CalendarClock, badge: "Revenue recovery", description: "Reduce empty calendar slots with smart reminders, natural rescheduling, and automatic re-engagement.", features: ["SMS and email reminder sequences", "Conversational rescheduling", "Missed-appointment recovery", "Open-slot rebooking campaigns"], useCases: ["Clinics and salons", "Professional services", "Consultation-led businesses"] },
  { slug: "review-collector", name: "AI Reputation & Review Collector", shortName: "Review Collector", price: 199, icon: Star, badge: "Easy win", description: "Generate more public praise while giving unhappy customers a private path to be heard.", features: ["Personalized post-service follow-up", "Google and Trustpilot review routing", "Private negative-feedback capture", "Review performance reporting"], useCases: ["Local businesses", "Multi-location operators", "Service teams"] },
] as const;

export type Automation = (typeof automations)[number];
export const getAutomation = (slug: string) => automations.find((item) => item.slug === slug);

export const demoInstances = [
  { id: "auto-1024", slug: "voice-sms-receptionist", name: "AI Voice & SMS Receptionist", domain: "northstarclinic.com", status: "Paid", expires: "Oct 22, 2026" },
  { id: "auto-2048", slug: "review-collector", name: "AI Reputation & Review Collector", domain: "northstarclinic.com", status: "Pending Payment", expires: "—" },
  { id: "auto-4096", slug: "lead-capture-qualifier", name: "AI Lead Capture & Smart Qualifier", domain: "launchwise.co", status: "Stopped", expires: "Sep 30, 2026" },
];

export const demoPayments = [
  { id: "PAY-4821", client: "Northstar Dental", automation: "Voice Receptionist", amount: "$499", method: "Bank transfer", transaction: "TXN-884192", submitted: "12 min ago" },
  { id: "PAY-4819", client: "Launchwise Studio", automation: "Lead Qualifier", amount: "$299", method: "Wise", transaction: "WISE-29018", submitted: "48 min ago" },
  { id: "PAY-4815", client: "Mira Wellness", automation: "Review Collector", amount: "$199", method: "Bank transfer", transaction: "TRX-740051", submitted: "2 hours ago" },
];