import { Button } from "../button"

export function SidebarMenuButton({ children, isActive, ...props }: any) {
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start gap-2"
      {...props}
    >
      {children}
    </Button>
  )
}
