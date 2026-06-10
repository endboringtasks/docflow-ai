import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PLATFORM_SETTINGS_GUIDANCE } from "@/lib/platformSettingsGuidance";

interface SettingGuidancePopoverProps {
  settingKey: string;
}

export function SettingGuidancePopover({ settingKey }: SettingGuidancePopoverProps) {
  const guidance = PLATFORM_SETTINGS_GUIDANCE[settingKey];
  if (!guidance) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Guidance for ${settingKey}`}
          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-sm space-y-3">
        <div>
          <p className="font-semibold text-foreground">What it controls</p>
          <p className="text-muted-foreground">{guidance.purpose}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">When to change it</p>
          <p className="text-muted-foreground">{guidance.whenToChange}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">How to tune it</p>
          <p className="text-muted-foreground">{guidance.tuning}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
