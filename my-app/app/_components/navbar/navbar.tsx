"use client";

import type { ElementType } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChatIcon, DailyIcon, CalendarIcon, StatisticsIcon, ToDoIcon } from "../icons/icons";

const navItems = [
  { href: "/", Icon: DailyIcon },
  { href: "/todolist", Icon: ToDoIcon },
  { href: "/calendar", Icon: CalendarIcon },
  { href: "/statistics", Icon: StatisticsIcon },
] as const;

const chatItem = { href: "/chat", Icon: ChatIcon };

const baseItemClasses = 
  "relative inline-flex items-center justify-center p-2.5 px-3.5 mx-0.5 rounded-full text-[#D9D9D9] transition-colors duration-300 ease-out z-10";

// Split the classes so we can remove the 'transition-all' from the motion element
const navContainerBase = 
  "fixed bottom-5 border p-1.5 flex items-center rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] z-50 backdrop-blur-md";

export default function Navbar() {
  const pathname = usePathname();
  const isChatActive = pathname === chatItem.href;

  return (
    <>
      {/* Left Pill - Keep transition-all here if you want the border to animate on load */}
      <nav className={`${navContainerBase} left-5 gap-3.5 border-white/10 bg-[rgba(110,110,110,0.20)] transition-all duration-300`}>
        <AnimatePresence initial={false}>
          {navItems.map(({ href, Icon }) => (
            <NavItem 
              key={href} 
              href={href} 
              Icon={Icon} 
              isActive={pathname === href} 
              sharedLayoutId="main-nav-bubble"
            />
          ))}
        </AnimatePresence>
      </nav>

      {/* Right Pill - REMOVED transition-all here so Framer Motion is instant */}
      <motion.div 
        initial={false}
        animate={{ 
          backgroundColor: isChatActive ? "rgba(217, 217, 217, 0.20)" : "rgba(110, 110, 110, 0.20)",
          borderColor: isChatActive ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)"
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30 
        }}
        className={`${navContainerBase} right-5`}
      >
        <NavItem 
            href={chatItem.href} 
            Icon={chatItem.Icon} 
            isActive={isChatActive}
            sharedLayoutId="chat-nav-bubble"
            suppressBubble 
          />
      </motion.div>
    </>
  );
}

interface NavItemProps {
  href: string;
  Icon: ElementType;
  isActive: boolean;
  sharedLayoutId: string;
  suppressBubble?: boolean;
}

function NavItem({ href, Icon, isActive, sharedLayoutId, suppressBubble = false }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={`${baseItemClasses} ${isActive ? "" : "text-[#D9D9D9]/50 hover:text-[#D9D9D9]"}`}
    >
      <AnimatePresence>
        {isActive && !suppressBubble && (
          <motion.div
            layoutId={sharedLayoutId}
            // 3. SELECTED BUBBLE BACKGROUND: Applied to the sliding layout indicator
            className="absolute top-0 bottom-0 -left-1 -right-1 bg-[rgba(217,217,217,0.20)] border border-white/30 rounded-full"
            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              bounce: 0.15,
              duration: 0.6
            }}
          />
        )}
      </AnimatePresence>
      
      <span className="relative z-20">
        <Icon />
      </span>
    </Link>
  );
}
