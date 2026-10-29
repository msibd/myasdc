"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;

export function AlertDialogContent({ className, ...props }: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
  return <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
    <AlertDialogPrimitive.Content {...props} className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-2xl outline-none", className)} />
  </AlertDialogPrimitive.Portal>;
}

export function AlertDialogHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={cn("space-y-2", className)} />;
}

export function AlertDialogFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title {...props} className={cn("text-lg font-bold text-heading", className)} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description {...props} className={cn("text-sm leading-6 text-body", className)} />;
}

export function AlertDialogCancel({ className, ...props }: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel {...props} className={cn("inline-flex min-h-10 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-body transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", className)} />;
}

export function AlertDialogAction({ className, ...props }: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action {...props} className={cn("inline-flex min-h-10 items-center justify-center rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e9785d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2", className)} />;
}
