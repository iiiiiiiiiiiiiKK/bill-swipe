import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Logo } from './components/brand/Logo';
import Landing from './pages/Landing';

const Discover = lazy(() => import('./pages/Discover'));
const BillDetailPage = lazy(() => import('./pages/BillDetail'));
const LoginPage = lazy(() => import('./pages/Login'));
const RegisterPage = lazy(() => import('./pages/Register'));
const MyBills = lazy(() => import('./pages/MyBills'));
const NewBill = lazy(() => import('./pages/NewBill'));
const Activity = lazy(() => import('./pages/Activity'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const Community = lazy(() => import('./pages/Community'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Admin = lazy(() => import('./pages/Admin'));
const StaticPage = lazy(() => import('./pages/StaticPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/bills" element={<MyBills />} />
          <Route path="/bills/new" element={<NewBill />} />
          <Route path="/bills/:id" element={<BillDetailPage />} />
          <Route path="/bills/:id/edit" element={<NewBill edit />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/community" element={<Community />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/how-it-works" element={<StaticPage kind="how" />} />
          <Route path="/trust" element={<StaticPage kind="trust" />} />
          <Route path="/payments-info" element={<StaticPage kind="payments" />} />
          <Route path="/faq" element={<StaticPage kind="faq" />} />
          <Route path="/about" element={<StaticPage kind="about" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={40} className="animate-pulse" />
        <p className="text-[13px] font-medium text-muted">Loading…</p>
      </div>
    </div>
  );
}
