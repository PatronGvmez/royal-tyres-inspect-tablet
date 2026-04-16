import { Navigate } from 'react-router-dom';

// Root path is handled by LoginPage in App.tsx routes — this is a safety fallback
const Index = () => <Navigate to="/" replace />;

export default Index;
