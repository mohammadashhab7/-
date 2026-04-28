import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message?: unknown }).message ?? "")
          : "";
    const stack =
      reason && typeof reason === "object" && "stack" in reason
        ? String((reason as { stack?: unknown }).stack ?? "")
        : "";
    if (
      message.includes("clerk.") ||
      stack.includes("clerk.accounts.dev") ||
      stack.includes("@clerk/clerk-js")
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
