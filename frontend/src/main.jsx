import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter as Router } from "react-router-dom";
import UploadFilesContextProvider from "./context/UploadFiles.context.jsx";

const root = createRoot(document.getElementById("root"));

root.render(
  // <StrictMode>
    <UploadFilesContextProvider>
      <Router>
        <App />
      </Router>
    </UploadFilesContextProvider>
  // </StrictMode>
);
