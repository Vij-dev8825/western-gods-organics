import { useLocation } from 'react-router-dom';
import { IconWhatsApp } from './Icons';

const SUPPORT_PHONE = '+918825875607';
const DEFAULT_MESSAGE = "Hi, I'd like to know more about your products.";

/** Site-wide floating WhatsApp enquiry button, fixed to the bottom-left —
 * mirrors ChatWidget's bottom-right chat-fab so the two sit symmetrically
 * without overlapping. The "Need Help?" label reveals on hover/tap, same
 * as the other floating buttons. */
export default function WhatsAppButton() {
  const location = useLocation();
  // Hidden on admin/login (matches ChatWidget/AiAssistant) and on cart/
  // checkout, where it crowds the "Place order" button on mobile.
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login' || location.pathname === '/cart';
  if (hidden) return null;

  const href = `https://wa.me/${SUPPORT_PHONE.replace('+', '')}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-fab"
      aria-label="Chat with us on WhatsApp"
    >
      <span className="fab-label">Need Help? Chat with us</span>
      <IconWhatsApp size={28} />
    </a>
  );
}
