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
  "relative inline-flex items-center justify-center p-2.5 px-3 mx-0.5 rounded-full text-[#D9D9D9] transition-colors duration-300 ease-out z-10";

const navContainerBase = 
  "fixed bottom-5 p-1 flex items-center rounded-full z-50 backdrop-blur-md";

const pillBackground = "rgba(110, 110, 110, 0.20)";

const directionalBorderShadow = `
  inset 0 0 0 1px rgba(0, 0, 0, 0.6),
  inset 1px 1px 0px 0px rgba(185, 185, 185),
  inset -1px -1px 0px 0px rgb(185, 185, 185)
`;

export default function Navbar() {
  const pathname = usePathname();
  const isChatActive = pathname === chatItem.href;

  return (
    <>
      {/* Left Pill */}
      <nav
        className={`${navContainerBase} left-5 gap-3.5 transition-all duration-300`}
        style={{ boxShadow: directionalBorderShadow, backgroundColor: pillBackground }}
      >
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

      {/* Right Pill */}
      <motion.div 
        initial={false}
        animate={{ 
          backgroundColor: isChatActive ? pillBackground : pillBackground,
        }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30 
        }}
        style={{ boxShadow: directionalBorderShadow }}
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
      className={`${baseItemClasses} ${isActive ? "px-4" : "text-[#D9D9D9]/50 hover:text-[#D9D9D9]"}`}
    >
      <AnimatePresence>
        {isActive && !suppressBubble && (
          <motion.div
            layoutId={sharedLayoutId}
            className="absolute top-1 bottom-0 -left-0 -right-0 bg-[rgba(217,217,217,0.20)]  rounded-full"
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