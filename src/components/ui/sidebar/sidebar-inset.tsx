export function SidebarInset({ children, className }: any) {
  return (
    <div className={`flex-1 overflow-auto ${className || ""}`}>
      {children}
    </div>
  )
}
