import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@imdanibytes/nexus-ui";
import { App } from "./App.js";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
