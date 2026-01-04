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
import { Input } from "@/components/ui/input";
import { getCountryFlag } from "@/lib/countryFlags";

export interface CountryCode {
  code: string;
  dial: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  // Priority countries
  { code: "AU", dial: "+61", name: "Australia" },
  { code: "GB", dial: "+44", name: "United Kingdom" },
  { code: "US", dial: "+1", name: "United States" },
  { code: "NZ", dial: "+64", name: "New Zealand" },
  { code: "IN", dial: "+91", name: "India" },
  { code: "PH", dial: "+63", name: "Philippines" },
  { code: "CN", dial: "+86", name: "China" },
  { code: "VN", dial: "+84", name: "Vietnam" },
  // Alphabetically sorted
  { code: "AF", dial: "+93", name: "Afghanistan" },
  { code: "AL", dial: "+355", name: "Albania" },
  { code: "DZ", dial: "+213", name: "Algeria" },
  { code: "AR", dial: "+54", name: "Argentina" },
  { code: "AT", dial: "+43", name: "Austria" },
  { code: "BD", dial: "+880", name: "Bangladesh" },
  { code: "BE", dial: "+32", name: "Belgium" },
  { code: "BR", dial: "+55", name: "Brazil" },
  { code: "KH", dial: "+855", name: "Cambodia" },
  { code: "CA", dial: "+1", name: "Canada" },
  { code: "CL", dial: "+56", name: "Chile" },
  { code: "CO", dial: "+57", name: "Colombia" },
  { code: "HR", dial: "+385", name: "Croatia" },
  { code: "CZ", dial: "+420", name: "Czech Republic" },
  { code: "DK", dial: "+45", name: "Denmark" },
  { code: "EG", dial: "+20", name: "Egypt" },
  { code: "FI", dial: "+358", name: "Finland" },
  { code: "FR", dial: "+33", name: "France" },
  { code: "DE", dial: "+49", name: "Germany" },
  { code: "GR", dial: "+30", name: "Greece" },
  { code: "HK", dial: "+852", name: "Hong Kong" },
  { code: "HU", dial: "+36", name: "Hungary" },
  { code: "ID", dial: "+62", name: "Indonesia" },
  { code: "IR", dial: "+98", name: "Iran" },
  { code: "IQ", dial: "+964", name: "Iraq" },
  { code: "IE", dial: "+353", name: "Ireland" },
  { code: "IL", dial: "+972", name: "Israel" },
  { code: "IT", dial: "+39", name: "Italy" },
  { code: "JP", dial: "+81", name: "Japan" },
  { code: "JO", dial: "+962", name: "Jordan" },
  { code: "KE", dial: "+254", name: "Kenya" },
  { code: "KR", dial: "+82", name: "South Korea" },
  { code: "KW", dial: "+965", name: "Kuwait" },
  { code: "LB", dial: "+961", name: "Lebanon" },
  { code: "MY", dial: "+60", name: "Malaysia" },
  { code: "MX", dial: "+52", name: "Mexico" },
  { code: "MA", dial: "+212", name: "Morocco" },
  { code: "MM", dial: "+95", name: "Myanmar" },
  { code: "NP", dial: "+977", name: "Nepal" },
  { code: "NL", dial: "+31", name: "Netherlands" },
  { code: "NG", dial: "+234", name: "Nigeria" },
  { code: "NO", dial: "+47", name: "Norway" },
  { code: "PK", dial: "+92", name: "Pakistan" },
  { code: "PE", dial: "+51", name: "Peru" },
  { code: "PL", dial: "+48", name: "Poland" },
  { code: "PT", dial: "+351", name: "Portugal" },
  { code: "QA", dial: "+974", name: "Qatar" },
  { code: "RO", dial: "+40", name: "Romania" },
  { code: "RU", dial: "+7", name: "Russia" },
  { code: "SA", dial: "+966", name: "Saudi Arabia" },
  { code: "SG", dial: "+65", name: "Singapore" },
  { code: "ZA", dial: "+27", name: "South Africa" },
  { code: "ES", dial: "+34", name: "Spain" },
  { code: "LK", dial: "+94", name: "Sri Lanka" },
  { code: "SE", dial: "+46", name: "Sweden" },
  { code: "CH", dial: "+41", name: "Switzerland" },
  { code: "TW", dial: "+886", name: "Taiwan" },
  { code: "TH", dial: "+66", name: "Thailand" },
  { code: "TR", dial: "+90", name: "Turkey" },
  { code: "UA", dial: "+380", name: "Ukraine" },
  { code: "AE", dial: "+971", name: "United Arab Emirates" },
  { code: "VE", dial: "+58", name: "Venezuela" },
  { code: "ZW", dial: "+263", name: "Zimbabwe" },
];

// Parse phone string to extract country code and number
export function parsePhoneNumber(phone: string | null): { countryCode: string; phoneNumber: string } {
  if (!phone) return { countryCode: "+61", phoneNumber: "" };
  
  const trimmed = phone.trim();
  
  // Try to find a matching country code
  for (const country of COUNTRY_CODES) {
    if (trimmed.startsWith(country.dial)) {
      const number = trimmed.slice(country.dial.length).trim();
      return { countryCode: country.dial, phoneNumber: number };
    }
  }
  
  // If starts with +, try to extract the code
  if (trimmed.startsWith("+")) {
    const match = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { countryCode: match[1], phoneNumber: match[2] };
    }
  }
  
  // Default to Australia if no code found
  return { countryCode: "+61", phoneNumber: trimmed };
}

// Combine country code and phone number
export function formatPhoneNumber(countryCode: string, phoneNumber: string): string {
  const trimmedNumber = phoneNumber.trim();
  if (!trimmedNumber) return "";
  return `${countryCode} ${trimmedNumber}`;
}

interface PhoneInputProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneNumberChange: (number: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  disabled = false,
  placeholder = "Phone number",
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  
  const selectedCountry = COUNTRY_CODES.find(c => c.dial === countryCode) || COUNTRY_CODES[0];

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[120px] justify-between px-3"
            disabled={disabled}
          >
            <span className="flex items-center gap-1.5 truncate">
              <span>{getCountryFlag(selectedCountry.code)}</span>
              <span className="text-sm">{selectedCountry.dial}</span>
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRY_CODES.map((country) => (
                  <CommandItem
                    key={`${country.code}-${country.dial}`}
                    value={`${country.name} ${country.dial}`}
                    onSelect={() => {
                      onCountryCodeChange(country.dial);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        countryCode === country.dial ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2">{getCountryFlag(country.code)}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-muted-foreground text-sm">{country.dial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Input
        type="tel"
        placeholder={placeholder}
        value={phoneNumber}
        onChange={(e) => onPhoneNumberChange(e.target.value)}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
