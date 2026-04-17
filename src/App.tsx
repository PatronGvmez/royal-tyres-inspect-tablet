import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "./pages/LoginPage";
import MechanicDashboard from "./pages/MechanicDashboard";
import InspectionView from "./pages/InspectionView";
import InspectionReportView from './pages/InspectionReportView';
import PhotoUploadPage from "./pages/PhotoUploadPage";
import AdminDashboard from "./pages/AdminDashboard";
import UsersManagement from "./pages/UsersManagement";
import InspectionDetail from "./pages/InspectionDetail";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role: 'admin' | 'mechanic' }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return <>{children}</>;
};

/** Route accessible by any authenticated user (admin or mechanic) */
const AnyAuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/mechanic" element={<ProtectedRoute role="mechanic"><MechanicDashboard /></ProtectedRoute>} />
            <Route path="/mechanic/inspect/:id" element={<ProtectedRoute role="mechanic"><InspectionView /></ProtectedRoute>} />
            <Route path="/mechanic/photo-upload/:id" element={<ProtectedRoute role="mechanic"><PhotoUploadPage /></ProtectedRoute>} />
            <Route path="/mechanic/report/:id" element={<ProtectedRoute role="mechanic"><InspectionReportView /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute role="admin"><UsersManagement /></ProtectedRoute>} />
            <Route path="/admin/users/:userId" element={<ProtectedRoute role="admin"><ProfilePage /></ProtectedRoute>} />
            <Route path="/admin/inspection/:id" element={<ProtectedRoute role="admin"><InspectionDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<AnyAuthRoute><ProfilePage /></AnyAuthRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
