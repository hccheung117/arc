"use client";

import Link from "next/link";
import { Palette, Bot, Info, Layers, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

interface SettingsSidebarProps {
  activeTab: string;
}

export function SettingsSidebar({ activeTab }: SettingsSidebarProps) {
  const menuItems = [
    {
      id: "appearance",
      label: "Appearance",
      icon: Palette,
      href: "/settings?tab=appearance",
    },
    {
      id: "models",
      label: "Models",
      icon: Layers,
      href: "/settings?tab=models",
    },
    {
      id: "ai-behavior",
      label: "AI Behavior",
      icon: Sparkles,
      href: "/settings?tab=ai-behavior",
    },
    {
      id: "providers",
      label: "AI Providers",
      icon: Bot,
      href: "/settings?tab=providers",
    },
    {
      id: "about",
      label: "About",
      icon: Info,
      href: "/settings?tab=about",
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeTab === item.id}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
