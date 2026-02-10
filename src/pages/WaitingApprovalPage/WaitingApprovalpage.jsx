import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from 'lib/supabaseClient';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

export default function WaitingApprovalPage() {
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const initUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                navigate('/login');
                return;
            }
            setUser(user);

            // בדיקה ראשונית של הסטטוס
            const { data: userData } = await supabase
                .from('users')
                .select('status')
                .eq('id', user.id)
                .single();

            if (userData?.status === 'approved') {
                navigate('/home');
                return;
            } else if (userData?.status === 'rejected') {
                navigate('/rejected');
                return;
            }

            // הקשבה לשינויים בזמן אמת
            const channel = supabase
                .channel('user-approval-status')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'users',
                        filter: `id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('Realtime status updated:', payload);
                        const newStatus = payload.new.status;
                        
                        if (newStatus === 'approved') {
                            navigate('/home');
                        } else if (newStatus === 'rejected') {
                            navigate('/rejected');
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        initUser();
    }, [navigate]);

    // בדיקה תקופתית (polling) כל 10 שניות - מאחורי הקלעים
    useEffect(() => {
        if (!user) return;

        const checkApprovalStatus = async () => {
            try {
                console.log('🔍 Checking approval status from database...');
                const { data: userData } = await supabase
                    .from('users')
                    .select('status')
                    .eq('id', user.id)
                    .single();

                if (userData) {
                    console.log('📊 Current status:', userData.status);
                    
                    if (userData.status === 'approved') {
                        console.log('✅ User approved! Redirecting to home...');
                        navigate('/home');
                    } else if (userData.status === 'rejected') {
                        console.log('❌ User rejected! Redirecting...');
                        navigate('/rejected');
                    }
                }
            } catch (error) {
                console.error('❌ Error checking approval status:', error);
            }
        };

        // בדיקה כל 10 שניות
        const intervalId = setInterval(checkApprovalStatus, 10000);

        console.log('🚀 Polling started - checking database every 10 seconds');

        // ניקוי ה-interval כשהקומפוננטה מתפרקת
        return () => {
            console.log('🛑 Polling stopped');
            clearInterval(intervalId);
        };
    }, [user, navigate]);

    const toggleTheme = () => setIsDark(!isDark);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <Box
            className={isDark ? 'dark' : 'light'}
            sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}
            dir="rtl"
        >
            <Box className="background-orbs">
                <Box className="orb orb-1" />
                <Box className="orb orb-2" />
                <Box className="orb orb-3" />
            </Box>
            <Box className="noise-overlay" />

            {/* Theme toggle button - left */}
            <Box
                onClick={toggleTheme}
                sx={{
                    position: 'fixed', top: 24, left: 24, zIndex: 100,
                    width: 48, height: 48, borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'white',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                    color: isDark ? 'white' : '#1f2937',
                    '&:hover': { transform: 'translateY(-2px) scale(1.05)' }
                }}
            >
                {isDark ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                )}
            </Box>

            {/* Logout button - right */}
            <Box
                onClick={handleLogout}
                sx={{
                    position: 'fixed', top: 24, right: 24, zIndex: 100,
                    width: 48, height: 48, borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'white',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                    color: isDark ? 'white' : '#1f2937',
                    '&:hover': { 
                        transform: 'translateY(-2px) scale(1.05)',
                        bgcolor: isDark ? 'rgba(255, 100, 100, 0.2)' : '#fee2e2'
                    }
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            </Box>

            <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 3, py: 8 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Box sx={{ textAlign: 'center' }}>
                        <Box component="img"
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                            alt="מגדלור"
                            sx={{ width: 120, height: 120, mx: 'auto', mb: 4 }}
                        />
                        
                        <CircularProgress 
                            size={60} 
                            sx={{ 
                                color: '#6366f1',
                                mb: 3
                            }} 
                        />

                        <Typography 
                            variant="h3" 
                            sx={{ 
                                fontWeight: 700, 
                                color: isDark ? 'white' : '#1e293b', 
                                mb: 2 
                            }}
                        >
                            הבקשה שלך נשלחה! ⏳
                        </Typography>
                        
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#475569', 
                                mb: 1 
                            }}
                        >
                            ממתין לאישור מנהל
                        </Typography>
                        
                        <Typography 
                            sx={{ 
                                color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b', 
                                fontSize: '14px',
                                maxWidth: '400px',
                                mx: 'auto'
                            }}
                        >
                            תקבל התראה ברגע שהבקשה שלך תאושר. אתה יכול לסגור את הדף - נעדכן אותך!
                        </Typography>

                        
                    </Box>
                </motion.div>
            </Container>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');
                .light { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); }
                .dark { background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%); }
                .background-orbs { position: absolute; width: 100%; height: 100%; overflow: hidden; z-index: 1; }
                .orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: float 20s ease-in-out infinite; }
                .dark .orb { opacity: 0.3; }
                .light .orb { opacity: 0.2; }
                .orb-1 { width: 500px; height: 500px; top: -10%; left: -10%; background: radial-gradient(circle, #6366f1 0%, transparent 70%); }
                .orb-2 { width: 400px; height: 400px; bottom: -10%; right: -5%; animation-delay: -7s; background: radial-gradient(circle, #8b5cf6 0%, transparent 70%); }
                .orb-3 { width: 350px; height: 350px; top: 50%; right: 20%; animation-delay: -14s; background: radial-gradient(circle, #ec4899 0%, transparent 70%); }
                @keyframes float { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(50px, -50px) scale(1.1); } 66% { transform: translate(-30px, 30px) scale(0.9); } }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
                .noise-overlay { position: absolute; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.03; }
                * { font-family: 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
            `}</style>
        </Box>
    );
}