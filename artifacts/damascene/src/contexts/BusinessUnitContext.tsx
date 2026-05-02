import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useListBusinessUnits,
  setBusinessUnitIdGetter,
  type BusinessUnit,
} from "@workspace/api-client-react";

const STORAGE_KEY = "damascene.activeBusinessUnitId";
const ALL_SENTINEL = "__all__";

type ActiveBuValue = string | null;

interface BusinessUnitContextValue {
  /** All active business units (factories + showrooms). */
  businessUnits: BusinessUnit[];
  /** The currently-selected business unit, or null for admin "all divisions". */
  activeBu: BusinessUnit | null;
  /** ID of the active business unit, or null for "all". */
  activeBuId: ActiveBuValue;
  /** True when the current user can switch divisions. */
  isPrivileged: boolean;
  /** True while we're loading user/me + BU list. */
  isLoading: boolean;
  /** Switch the active business unit. Pass null for "all divisions". */
  setActiveBuId: (id: ActiveBuValue) => void;
}

const BusinessUnitContext = createContext<BusinessUnitContextValue | null>(
  null,
);

function readStoredBuId(): ActiveBuValue {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    if (v === ALL_SENTINEL) return null;
    return v;
  } catch {
    return null;
  }
}

function writeStoredBuId(id: ActiveBuValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id ?? ALL_SENTINEL);
  } catch {
    /* localStorage disabled — ignore */
  }
}

export function BusinessUnitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: units, isLoading: unitsLoading } = useListBusinessUnits();
  const qc = useQueryClient();

  const role = (me?.role ?? null) as string | null;
  const isPrivileged = role === "owner" || role === "admin";

  const activeUnits = useMemo(
    () => (units ?? []).filter((u) => u.isActive),
    [units],
  );

  const [activeBuId, setActiveBuIdState] = useState<ActiveBuValue>(null);
  const initialisedRef = useRef(false);

  // Initialise active BU once we have both `me` and the BU list.
  useEffect(() => {
    if (initialisedRef.current) return;
    if (meLoading || unitsLoading) return;
    if (!me?.isAuthenticated) return;

    if (isPrivileged) {
      const stored = readStoredBuId();
      if (stored && activeUnits.some((u) => u.id === stored)) {
        setActiveBuIdState(stored);
      } else {
        // null = "all divisions" view (no X-Business-Unit-Id header sent).
        setActiveBuIdState(null);
      }
    } else {
      // Non-privileged users are pinned to their assigned business unit.
      const assigned = me.assignedBusinessUnitId ?? null;
      setActiveBuIdState(
        assigned && activeUnits.some((u) => u.id === assigned)
          ? assigned
          : null,
      );
    }
    initialisedRef.current = true;
  }, [
    me,
    meLoading,
    unitsLoading,
    isPrivileged,
    activeUnits,
  ]);

  // Wire the global custom-fetch header injector. We use a ref so the closure
  // always reads the freshest value without re-registering on every render.
  const idRef = useRef<ActiveBuValue>(null);
  idRef.current = activeBuId;

  useEffect(() => {
    setBusinessUnitIdGetter(() => idRef.current);
    return () => {
      setBusinessUnitIdGetter(null);
    };
  }, []);

  const activeBu = useMemo(
    () => activeUnits.find((u) => u.id === activeBuId) ?? null,
    [activeUnits, activeBuId],
  );

  const setActiveBuId = useCallback(
    (id: ActiveBuValue) => {
      // Non-privileged users may not switch.
      if (!isPrivileged) return;
      setActiveBuIdState(id);
      writeStoredBuId(id);
      // Refetch every query so each page re-renders against the new BU scope.
      // We exclude the "me" and "business-units" queries from refetch is not
      // necessary — they're idempotent with respect to the BU header.
      qc.invalidateQueries();
    },
    [isPrivileged, qc],
  );

  const value = useMemo<BusinessUnitContextValue>(
    () => ({
      businessUnits: activeUnits,
      activeBu,
      activeBuId,
      isPrivileged,
      isLoading: meLoading || unitsLoading,
      setActiveBuId,
    }),
    [
      activeUnits,
      activeBu,
      activeBuId,
      isPrivileged,
      meLoading,
      unitsLoading,
      setActiveBuId,
    ],
  );

  return (
    <BusinessUnitContext.Provider value={value}>
      {children}
    </BusinessUnitContext.Provider>
  );
}

export function useBusinessUnit(): BusinessUnitContextValue {
  const ctx = useContext(BusinessUnitContext);
  if (!ctx) {
    throw new Error(
      "useBusinessUnit must be used inside a <BusinessUnitProvider>",
    );
  }
  return ctx;
}
