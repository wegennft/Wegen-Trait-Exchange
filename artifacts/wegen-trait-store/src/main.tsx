import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./wallet/appkit-config";
import { startEip6963Discovery } from "./wallet/eip6963";

startEip6963Discovery();

createRoot(document.getElementById("root")!).render(<App />);
