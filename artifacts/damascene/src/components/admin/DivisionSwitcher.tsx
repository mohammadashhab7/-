import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { useBusinessUnit } from "@/contexts/BusinessUnitContext";

const ALL_VALUE = "__all__";

export default function DivisionSwitcher() {
  const { businessUnits, activeBuId, isPrivileged, setActiveBuId } =
    useBusinessUnit();

  const factories = useMemo(
    () => businessUnits.filter((b) => b.kind === "factory"),
    [businessUnits],
  );
  const showrooms = useMemo(
    () => businessUnits.filter((b) => b.kind === "showroom"),
    [businessUnits],
  );

  // Non-privileged users get no switcher — their BU is fixed.
  if (!isPrivileged) return null;
  if (businessUnits.length === 0) return null;

  const value = activeBuId ?? ALL_VALUE;

  return (
    <Select
      value={value}
      onValueChange={(v) => setActiveBuId(v === ALL_VALUE ? null : v)}
    >
      <SelectTrigger
        className="w-[200px] gap-2"
        data-testid="division-switcher-trigger"
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE} data-testid="division-switcher-option-all">
          كل الأقسام
        </SelectItem>
        {factories.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>المصنع</SelectLabel>
              {factories.map((b) => (
                <SelectItem
                  key={b.id}
                  value={b.id}
                  data-testid={`division-switcher-option-${b.slug}`}
                >
                  {b.nameAr}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
        {showrooms.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>المعارض</SelectLabel>
              {showrooms.map((b) => (
                <SelectItem
                  key={b.id}
                  value={b.id}
                  data-testid={`division-switcher-option-${b.slug}`}
                >
                  {b.nameAr}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
