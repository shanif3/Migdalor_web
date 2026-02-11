import {
    AppBar,
    Box,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from '@mui/material';
import {
    Database,
    Key,
    Lightbulb,
    Notebook,
    Settings,
    LogOut,
    UserCheck,
    Menu as MenuIcon,
    ChevronRight,
    Home as HomeIcon,
    FileText,
    Send
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, Outlet } from 'react-router';
import { supabase } from '../lib/supabaseClient';

// Helper function to get all group IDs
const getAllGroupIds = (mainGroupId) => {
    return [mainGroupId];
};

export default function MainLayout() {
    const [user, setUser] = useState(null);
    const [authUserId, setAuthUserId] = useState(null);
    const [authUserGroupIds, setAuthUserGroupIds] = useState(null);
    const [isDark, setIsDark] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                navigate('/login');
                return;
            }

            setAuthUserId(user.id);

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('full_name, group_id, status')
                .eq('id', user.id)
                .single();

            if (userError || !userData) {
                navigate('/onboarding');
                return;
            }

            if (userData.status === 'pending') {
                navigate('/waiting-approval');
                return;
            } else if (userData.status === 'rejected') {
                navigate('/rejected');
                return;
            } else if (userData.status !== 'approved') {
                navigate('/onboarding');
                return;
            }

            const groupIds = getAllGroupIds(userData.group_id);
            setAuthUserGroupIds(groupIds);

            const { data: userRolesData } = await supabase
                .from('user_roles')
                .select('role_id, roles(name)')
                .eq('user_id', user.id);

            const roles = userRolesData?.map(ur => ur.roles?.name).filter(Boolean) || [];

            setUser({
                full_name: userData.full_name,
                group_id: userData.group_id,
                roles: roles,
            });
        };
        fetchUser();
    }, [navigate]);

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const toggleDrawer = () => {
        setDrawerOpen(!drawerOpen);
    };

    if (user === null) return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
            color: 'white'
        }}>
            <Typography variant="h5">טוען...</Typography>
        </Box>
    );

    // בדיקת תפקידים
    const isAdmin = user?.roles?.includes('מנהל');
    const isStaff = user?.roles?.includes('סגל');
    const isBattalionCommander = user?.roles?.includes('קה״ד גדודי');
    
    const drawerWidth = 280;

    // הגדרת כל התכונות עם דרישות הרשאה
    const allClassroomFeatures = [
        { title: 'ניהול כיתות', icon: Lightbulb, path: '/Dashboard', color: '#6366f1', requiredRoles: [] }, // כולם
        { title: 'הקצאת מפתחות', icon: Key, path: '/AllocateKeys', color: '#10b981', requiredRoles: ['מנהל', 'קה״ד גדודי בהתנסות'] }, // כולם
        { title: 'ניהול מפתחות', icon: Key, path: '/ManageKeys', color: '#f59e0b', requiredRoles: [] }, // כולם
        { title: 'בקשות מפתחות', icon: FileText, path: '/KeyRequests', color: '#8b5cf6', requiredRoles: ['מנהל', 'קה״ד גדודי'] },
        { title: 'שליחת בקשת מפתח', icon: Send, path: '/Submitkeyrequest', color: '#06b6d4', requiredRoles: ['מנהל', 'קה״ד גדודי'] },
        { title: 'לו"ז', icon: Notebook, path: '/Schedule', color: '#ef4444', requiredRoles: [] }, // כולם
    ];

    const allAdminFeatures = [
        { title: 'ניהול בקשות', icon: UserCheck, path: '/MangeRequests', color: '#6366f1', requiredRoles: ['מנהל', 'סגל'] },
        { title: 'ניהול הרשאות', icon: Settings, path: '/ManagePermissions', color: '#8b5cf6', requiredRoles: ['מנהל', 'סגל'] },
        { title: 'ניהול היררכיה', icon: Settings, path: '/ManageHierarchy', color: '#8b5cf6', requiredRoles: ['מנהל', 'סגל'] },
    ];

    // פונקציה לבדיקה אם למשתמש יש הרשאה לפיצ'ר
    const hasAccessToFeature = (feature) => {
        if (!feature.requiredRoles || feature.requiredRoles.length === 0) {
            return true; // אין דרישות הרשאה - כולם יכולים
        }
        return feature.requiredRoles.some(role => user?.roles?.includes(role));
    };

    // סינון התכונות לפי הרשאות
    const classroomFeatures = allClassroomFeatures.filter(hasAccessToFeature);
    const adminFeatures = allAdminFeatures.filter(hasAccessToFeature);

    return (
        <Box
            className={isDark ? 'dark' : 'light'}
            sx={{
                minHeight: '100vh',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                display: 'flex'
            }}
            dir="rtl"
        >
            {/* Background elements */}
            <Box className="background-orbs">
                <Box className="orb orb-1" />
                <Box className="orb orb-2" />
                <Box className="orb orb-3" />
            </Box>
            <Box className="noise-overlay" />

            {/* Sidebar / Drawer */}
            <Drawer
                variant="persistent"
                anchor="right"
                open={drawerOpen}
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        background: isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: 'none',
                        borderLeft: isDark
                            ? '1px solid rgba(255, 255, 255, 0.1)'
                            : '1px solid #e2e8f0',
                        transition: 'all 0.3s',
                    },
                }}
            >
                {/* Logo Section */}
                <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        component="img"
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                        alt="מגדלור לוגו"
                        sx={{ width: 48, height: 48, objectFit: 'contain' }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            color: isDark ? 'white' : '#1e293b',
                            textAlign: 'right',
                        }}
                    >
                        מגדלור
                    </Typography>
                </Box>

                <Divider sx={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }} />

                {/* Navigation Items */}
                <List sx={{ px: 2, py: 2 }}>
                    <ListItem disablePadding sx={{ mb: 1 }}>
                        <ListItemButton
                            component={Link}
                            to="/Home"
                            sx={{
                                borderRadius: '12px',
                                '&:hover': { bgcolor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)' }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <HomeIcon size={20} style={{ color: isDark ? 'white' : '#1e293b' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary="אזור אישי"
                                sx={{ '& .MuiTypography-root': { color: isDark ? 'white' : '#1e293b', fontWeight: 500, textAlign: 'right' } }}
                            />
                        </ListItemButton>
                    </ListItem>

                    {classroomFeatures.length > 0 && (
                        <>
                            <Typography
                                variant="overline"
                                sx={{
                                    px: 2, py: 1, display: 'block',
                                    color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
                                    fontWeight: 600, fontSize: '0.75rem', textAlign: 'right'
                                }}
                            >
                                ניהול כיתות
                            </Typography>

                            {classroomFeatures.map((feature) => (
                                <ListItem key={feature.title} disablePadding sx={{ mb: 1 }}>
                                    <ListItemButton
                                        component={Link}
                                        to={feature.path}
                                        sx={{
                                            borderRadius: '12px',
                                            '&:hover': { bgcolor: isDark ? `${feature.color}20` : `${feature.color}10` }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            <feature.icon size={20} style={{ color: feature.color }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={feature.title}
                                            sx={{ '& .MuiTypography-root': { color: isDark ? 'white' : '#1e293b', fontWeight: 500, textAlign: 'right' } }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </>
                    )}

                    {adminFeatures.length > 0 && (
                        <>
                            <Divider sx={{ my: 2, borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }} />
                            <Typography
                                variant="overline"
                                sx={{
                                    px: 2, py: 1, display: 'block',
                                    color: isDark ? 'rgba(139, 92, 246, 0.8)' : '#8b5cf6',
                                    fontWeight: 600, fontSize: '0.75rem', textAlign: 'right'
                                }}
                            >
                                אזור מורשים
                            </Typography>
                            {adminFeatures.map((feature) => (
                                <ListItem key={feature.title} disablePadding sx={{ mb: 1 }}>
                                    <ListItemButton
                                        component={Link}
                                        to={feature.path}
                                        sx={{
                                            borderRadius: '12px',
                                            bgcolor: isDark ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.02)',
                                            '&:hover': { bgcolor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.08)' }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            <feature.icon size={20} style={{ color: feature.color }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={feature.title}
                                            sx={{ '& .MuiTypography-root': { color: isDark ? 'white' : '#1e293b', fontWeight: 500, textAlign: 'right' } }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </>
                    )}
                </List>

                {/* Bottom Actions */}
                <Box sx={{ mt: 'auto', p: 2 }}>
                    <Divider sx={{ mb: 2, borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0' }} />
                    <Box
                        sx={{
                            p: 2, mb: 2, borderRadius: '12px',
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        }}
                    >
                        <Typography sx={{ color: isDark ? 'white' : '#1e293b', fontWeight: 600, fontSize: '0.875rem', mb: 0.5, textAlign: 'right' }}>
                            {user.full_name}
                        </Typography>
                        <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b', fontSize: '0.75rem', textAlign: 'right' }}>
                            {user.roles?.join(', ') || 'משתמש'}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box
                            onClick={toggleTheme}
                            sx={{
                                flex: 1, height: 44, borderRadius: '10px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)' }
                            }}
                        >
                            {isDark ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            )}
                        </Box>
                        <Box
                            onClick={handleSignOut}
                            sx={{
                                flex: 1, height: 44, borderRadius: '10px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
                                bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                color: '#ef4444',
                                '&:hover': { bgcolor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }
                            }}
                        >
                            <LogOut size={20} />
                        </Box>
                    </Box>
                </Box>
            </Drawer>

            {/* Main Content Area */}
            <Box
                sx={{
                    flexGrow: 1,
                    transition: 'margin 0.3s',
                    marginRight: drawerOpen ? 0 : `-${drawerWidth}px`,
                    position: 'relative',
                    zIndex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%'
                }}
            >
                <AppBar
                    position="sticky"
                    sx={{
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(20px)',
                        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                        boxShadow: 'none',
                    }}
                >
                    <Toolbar sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                                onClick={toggleDrawer}
                                sx={{
                                    width: 40, height: 40, borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
                                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                    color: isDark ? 'white' : '#1f2937',
                                    '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)' }
                                }}
                            >
                                {drawerOpen ? <ChevronRight size={20} /> : <MenuIcon size={20} />}
                            </Box>
                            {!drawerOpen && (
                                <Box
                                    component="img"
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                                    alt="מגדלור לוגו"
                                    sx={{ width: 32, height: 32, objectFit: 'contain', cursor: 'pointer' }}
                                    onClick={() => navigate('/Home')}
                                />
                            )}
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                             <Box
                                onClick={toggleTheme}
                                sx={{
                                    width: 40, height: 40, borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
                                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                    color: isDark ? 'white' : '#1f2937',
                                    '&:hover': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)' }
                                }}
                            >
                                {isDark ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="5" />
                                        <line x1="12" y1="1" x2="12" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="23" />
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                        <line x1="1" y1="12" x2="3" y2="12" />
                                        <line x1="21" y1="12" x2="23" y2="12" />
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                    </svg>
                                )}
                            </Box>

                             <Box
                                onClick={handleSignOut}
                                sx={{
                                    width: 40, height: 40, borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s',
                                    bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                    color: '#ef4444',
                                    '&:hover': { bgcolor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', transform: 'scale(1.05)' }
                                }}
                            >
                                <LogOut size={20} />
                            </Box>
                        </Box>
                    </Toolbar>
                </AppBar>

                <Outlet context={{ user, isDark, authUserGroupIds, authUserId }} />

            </Box>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');

                .light { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); }
                .dark { background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%); }

                .background-orbs {
                    position: fixed;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    z-index: 1;
                }

                .orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    animation: float 20s ease-in-out infinite;
                }

                .dark .orb { opacity: 0.3; }
                .light .orb { opacity: 0.2; }

                .orb-1 {
                    width: 500px; height: 500px; top: -10%; left: -10%;
                }
                .dark .orb-1 { background: radial-gradient(circle, #6366f1 0%, transparent 70%); }
                .light .orb-1 { background: radial-gradient(circle, #818cf8 0%, transparent 70%); }

                .orb-2 {
                    width: 400px; height: 400px; bottom: -10%; right: -5%; animation-delay: -7s;
                }
                .dark .orb-2 { background: radial-gradient(circle, #8b5cf6 0%, transparent 70%); }
                .light .orb-2 { background: radial-gradient(circle, #a78bfa 0%, transparent 70%); }

                .orb-3 {
                    width: 350px; height: 350px; top: 50%; right: 20%; animation-delay: -14s;
                }
                .dark .orb-3 { background: radial-gradient(circle, #ec4899 0%, transparent 70%); }
                .light .orb-3 { background: radial-gradient(circle, #f472b6 0%, transparent 70%); }

                @keyframes float {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(50px, -50px) scale(1.1); }
                    66% { transform: translate(-30px, 30px) scale(0.9); }
                }

                .noise-overlay {
                    position: fixed; width: 100%; height: 100%; z-index: 2;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                    pointer-events: none;
                }
                .dark .noise-overlay { opacity: 0.03; }
                .light .noise-overlay { opacity: 0.02; }

                * { font-family: 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
            `}</style>
        </Box>
    );
}