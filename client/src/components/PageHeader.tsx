import React from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useLocation } from "wouter";

interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  showHomeButton?: boolean;
}

export default function PageHeader({ title, icon, showHomeButton = true }: PageHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </h1>
      {showHomeButton && (
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-primary flex items-center"
          onClick={() => setLocation("/")}
        >
          <Home className="h-5 w-5 mr-1" />
          <span className="hidden sm:inline">Home</span>
        </Button>
      )}
    </div>
  );
}