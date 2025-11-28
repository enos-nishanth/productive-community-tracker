"use client"

import { Button } from "../button"
import { useSidebar } from "./sidebar-provider"
import { Menu } from "lucide-react"

export function SidebarTrigger({ className }: any) {
  const { open, setOpen } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setOpen(true)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}
