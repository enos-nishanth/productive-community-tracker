import { Slot } from "@radix-ui/react-slot"

export function SidebarContent({ children }: any) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {children}
    </div>
  )
}
