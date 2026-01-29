import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NATIONALITIES, findNationality } from "@/lib/nationalities";
import { getCountryFlag } from "@/lib/countryFlags";

interface NationalitySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function NationalitySelect({
  value,
  onValueChange,
  placeholder = "Select nationality...",
  disabled = false,
  className,
}: NationalitySelectProps) {
  const [open, setOpen] = React.useState(false);

  // Find the selected nationality
  const selectedNationality = value ? findNationality(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-secondary border-border font-normal",
            !selectedNationality && "text-muted-foreground",
            className
          )}
        >
          {selectedNationality ? (
            <span className="flex items-center gap-2">
              <span className="text-base">{getCountryFlag(selectedNationality.code)}</span>
              <span>{selectedNationality.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search nationality..." />
          <CommandList>
            <CommandEmpty>No nationality found.</CommandEmpty>
            <CommandGroup>
              {NATIONALITIES.map((nationality) => (
                <CommandItem
                  key={`${nationality.code}-${nationality.name}`}
                  value={`${nationality.name} ${nationality.country}`}
                  onSelect={() => {
                    onValueChange(nationality.name);
                    setOpen(false);
                  }}
                >
                  <span className="text-base mr-2">{getCountryFlag(nationality.code)}</span>
                  <span>{nationality.name}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      selectedNationality?.code === nationality.code
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
