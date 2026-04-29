import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Refetch when the user returns to the tab so CMS / admin edits made
      // in another window or tab show up on the public site immediately.
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  },
});
