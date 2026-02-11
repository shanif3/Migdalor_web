import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage/LoginPage';
import LogoutPage from './pages/LogoutPage/LogoutPage';
import HomePage from './pages/HomePage/HomePage';
import KeysManagerPage from './pages/KeysManagerPage/KeysManagerPage';
import KeysAllocatorPage from './pages/KeysAllocatorPage/KeysAllocatorPage';
import SchedulePage from './pages/SchedulePage/SchedulePage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import OnboardingPage from './pages/OnBoardingPage/OnBoardingPage';
import WaitingApprovalPage from './pages/WaitingApprovalPage/WaitingApprovalpage';
import KeyRequests from './pages/KeyRequests/KeyRequests';
import Submitkeyrequest from './pages/Submitkeyrequest/Submitkeyrequest';
import MainLayout from './components/MainLayout';
import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient'
import AdminRequests from './pages/AdminRequestsPage/AdminRequestsPage';
import ManagePermissions from 'pages/ManagePermissionsPage/ManagePermissionsPage';
import ManageHierarchyPage from 'pages/ManageHierarchyPage/ManageHierarchyPage';



// קומפוננט לבדיקת הרשאות מנהל
function AdminRoute({ children }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    console.log('[AdminRoute] No session');
                    setLoading(false);
                    return;
                }

                // תיקון 1: user_id במקום id
                // תיקון 2: בלי .single() כי יכולים להיות כמה roles
                // תיקון 3: JOIN לטבלת roles כדי לקבל את השם
                const { data: userRolesData, error } = await supabase
                    .from('user_roles')
                    .select('role_id, roles(name)')
                    .eq('user_id', session.user.id);  // ← תוקן מ-id ל-user_id

                if (error) {
                    console.error('[AdminRoute] Error:', error);
                    setLoading(false);
                    return;
                }

                console.log('[AdminRoute] Roles found:', userRolesData);

                // בדיקה אם אחד מה-roles הוא admin (תומך בכמה roles למשתמש)
                const isAdminUser = userRolesData?.some(
                    ur => ur.roles?.name === 'מנהל'
                );

                console.log('[AdminRoute] Is admin:', isAdminUser);
                setIsAdmin(isAdminUser);

            } catch (error) {
                console.error('[AdminRoute] Error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, []);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
                color: 'white',
                fontFamily: 'Heebo, sans-serif'
            }}>
                <h1>טוען...</h1>
            </div>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/Home" replace />;
    }

    return children;
}

function useSession() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return { session, loading };
}

function authenticatedRoute(session, loading, component) {
    if (loading) {
        return <h1>Loading...</h1>
    }

    return session ? component : <Navigate to="/Login" replace />
}

export default () => {
    const { session, loading } = useSession();

    // useEffect(() => {
    //     document.title = 'Migdalor';
    // }, []);

    return (
        <Router basename="/Migdalor_web">            
            <Routes>
                <Route element={<MainLayout />}>

                    <Route path="/Home" element={authenticatedRoute(session, loading, <HomePage />)} />
                    <Route path="/ManageKeys" element={authenticatedRoute(session, loading, <KeysManagerPage />)} />
                    <Route path="/Schedule" element={authenticatedRoute(session, loading, <SchedulePage />)} />
                    <Route path="/Logout" element={<LogoutPage />} />
                    <Route path="/AllocateKeys" element={authenticatedRoute(session, loading, <KeysAllocatorPage />)} />
                    <Route path="/Dashboard" element={authenticatedRoute(session, loading, <DashboardPage />)} />
                    <Route path="/KeyRequests" element={authenticatedRoute(session, loading, <KeyRequests />)} />
                    <Route path="/Submitkeyrequest" element={authenticatedRoute(session, loading, <Submitkeyrequest />)} />
                    <Route path="/ManagePermissions" element={authenticatedRoute(session, loading, <ManagePermissions />)} />
                    <Route path="/ManageHierarchy" element={authenticatedRoute(session, loading, <ManageHierarchyPage />)} />  
                    <Route path='/MangeRequests' element={authenticatedRoute(session, loading, <AdminRequests />)} />
                    {/* <Route path="/admin" element={
                        <AdminRoute>
                            <AdminRequests />
                        </AdminRoute>
                    } /> */}
                </Route>
                <Route path="/" element={<Navigate to="/Login" replace />} />
                <Route path="/Login" element={<LoginPage />} />
                <Route path="/onboarding" element={authenticatedRoute(session, loading, <OnboardingPage />)} />
                <Route path="/waiting-approval" element={authenticatedRoute(session, loading, <WaitingApprovalPage />)} />


            </Routes>
        </Router>
    );
}