"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const SIDEBAR_WIDTH = "20rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open],
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-state={state}
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

const sidebarVariants = cva(
  "fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] duration-200 ease-linear md:flex",
  {
    variants: {
      side: {
        left: "left-0 group-data-[state=collapsed]/sidebar-wrapper:w-[--sidebar-width-icon]",
        right: "right-0 group-data-[state=collapsed]/sidebar-wrapper:w-[--sidebar-width-icon]",
      },
      variant: {
        sidebar: "bg-sidebar text-sidebar-foreground border-sidebar-border",
        floating:
          "p-2 group-data-[state=collapsed]/sidebar-wrapper:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]",
        inset:
          "p-2 group-data-[state=collapsed]/sidebar-wrapper:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]",
      },
      collapsible: {
        offcanvas:
          "group-data-[state=collapsed]/sidebar-wrapper:w-0 group-data-[state=collapsed]/sidebar-wrapper:overflow-hidden",
        icon: "",
        none: "",
      },
    },
    defaultVariants: {
      side: "left",
      variant: "sidebar",
      collapsible: "offcanvas",
    },
  },
)

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof sidebarVariants> & {
    collapsible?: "offcanvas" | "icon" | "none"
  }) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        className={cn("flex h-svh w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground", className)}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={{ ["--sidebar-width" as string]: SIDEBAR_WIDTH } as React.CSSProperties}
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className={cn("group peer hidden text-sidebar-foreground md:block", className)}
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      <div
        className={cn(
          sidebarVariants({ side, variant, collapsible }),
          side === "left"
            ? "group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "flex h-full w-full flex-col bg-sidebar",
            variant === "floating" &&
              "rounded-lg border border-sidebar-border shadow",
            variant === "inset" &&
              "rounded-lg border border-sidebar-border bg-background shadow-sm",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:m-2 peer-data-[variant=inset]:ml-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm",
        "peer-data-[variant=inset]:peer-data-[side=left]:ml-2",
        className,
      )}
      {...props}
    />
  )
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="footer" className={cn("mt-auto flex flex-col gap-2 p-2", className)} {...props} />
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sidebar="content"
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-hidden", className)}
      {...props}
    />
  )
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-sidebar="separator" className={cn("mx-2 w-auto bg-sidebar-border", className)} {...props} />
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
}

export function SidebarGroupLabel({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"
  return (
    <Comp
      data-sidebar="group-label"
      className={cn("mb-1 px-2 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-sidebar="group-content" className={cn("w-full text-sm", className)} {...props} />
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-sidebar="menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-start gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "border border-sidebar-border bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent",
      },
      size: {
        default: "min-h-12",
        sm: "min-h-9 text-xs",
        lg: "min-h-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
