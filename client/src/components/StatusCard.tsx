import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatusCardProps {
  title: string;
  value: string | number;
  total?: number;
  icon: ReactNode;
  color: string;
  progress?: number;
  secondaryText?: string;
  onClick?: () => void;
}

export default function StatusCard({ 
  title, 
  value, 
  total, 
  icon, 
  color, 
  progress = 0,
  secondaryText,
  onClick
}: StatusCardProps) {
  // Convert color to Tailwind color class
  const getColorClass = (colorName: string) => {
    return colorName.includes("-") ? colorName : `${colorName}`;
  };
  
  const iconColorClass = `text-${getColorClass(color)}`;
  const progressColorClass = `bg-${getColorClass(color)}`;
  
  return (
    <Card 
      className={`care-card border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-medium text-gray-500">{title}</span>
            <div className="font-semibold text-lg">
              {total ? `${value}/${total}` : value}
            </div>
          </div>
          <div className={`w-8 h-8 flex items-center justify-center rounded-full ${iconColorClass}`}>
            {icon}
          </div>
        </div>
        
        {total ? (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`${progressColorClass} h-1.5 rounded-full`} 
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : secondaryText && (
          <div className="mt-2 text-xs text-gray-500">
            {secondaryText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
