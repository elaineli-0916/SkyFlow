import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const classic = new URLSearchParams(window.location.search).get("view") === "classic";
const Experience = lazy(() => classic ? import("./App.jsx") : import("./city/CityExperience.jsx"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: "3rem", color: "#e4e9e7" }}>Loading SkyFlow…</div>}>
      <Experience />
      {classic && <a href="?view=cities" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 100, color: "#c8edca", fontSize: 12 }}>Explore cities ↗</a>}
    </Suspense>
  </React.StrictMode>
);
