import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { trackPageView } from './lib/analytics';
import { Footer, GtLayout, PortalBar } from './components/Chrome';
import ScrollToTop from './components/ScrollToTop';
import { configProblems } from './config';
import { usePortal } from './lib/portal-context';
import About from './pages/About';
import Home from './pages/Home';
import Project from './pages/Project';
import Enacted from './pages/Enacted';

export default function App() {
  const { config } = usePortal();
  const { pathname } = useLocation();
  // One page view per page (not per filter: those are events). The page's own effects have set its title by now.
  useEffect(() => { trackPageView(); }, [pathname]);
  const problems = import.meta.env.DEV ? configProblems(config) : [];
  return (
    <GtLayout>
      <ScrollToTop />
      <PortalBar />
      {problems.length > 0 && (
        <div className="page config-warning" role="alert">
          <strong>portal.config.ts needs attention</strong> (shown in development only):
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Offices and their districts are a section of the main page; old links land there. */}
        <Route path="/districts" element={<Navigate to="/#offices" replace />} />
        <Route path="/gaa" element={<Enacted />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects/:dataset/:id" element={<Project />} />
        <Route
          path="*"
          element={
            <main className="page main">
              <p className="state">This page does not exist. <Link to="/">See every project</Link></p>
            </main>
          }
        />
      </Routes>
      <Footer />
    </GtLayout>
  );
}
