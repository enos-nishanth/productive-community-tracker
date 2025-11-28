"use client"

import { Sheet, SheetContent } from "../sheet"
import { useSidebar } from "./sidebar-provider"
import clsx from "clsx"

export function Sidebar({ side = "left", collapsible = "icon", className }: any) {
  const { open, setOpen } = useSidebar()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "hidden md:flex flex-col w-64 border-r bg-card",
          className
        )}
      >
        {/* actual sidebar content injected by SidebarContent */}
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="p-0 w-64">
          {/* injected content */}
        </SheetContent>
      </Sheet>
    </>
  )
}
