import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import LoadingScreen from "./pages/LoadingScreen";
import HomePage from "./pages/HomePage";
import AboutMe from "./pages/AboutMe";
import JenPage from "./pages/JenPage";
import BlogCreate from "./pages/BlogCreate";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* No navbar here */}
        <Route path="/" element={<LoadingScreen />} />

        {/* Everything below has Navbar via AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/aboutme" element={<AboutMe />} />
          <Route path="/jen" element={<JenPage />} />
          <Route path="/jen/create" element={<BlogCreate />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
