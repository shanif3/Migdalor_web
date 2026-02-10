import {
    Box,
    Button,
    Card,
    Container,
    FormControl,
    MenuItem,
    Select,
    TextField,
    Typography,
    CircularProgress,
    RadioGroup,
    FormControlLabel,
    Radio
} from '@mui/material';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from 'lib/supabaseClient';
import { UserPlus, Users, Shield } from 'lucide-react';

export default function OnboardingPage() {
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(true);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        battalion: '',
        company: '',
        team: '',
        role: 'צוער'
    });

    const [battalions, setBattalions] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [teams, setTeams] = useState([]);
    const [allGroups, setAllGroups] = useState([]);

    // Cache לקבוצות
    const [groupsCache, setGroupsCache] = useState(null);

    useEffect(() => {
        const fetchUserAndData = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) {
                    navigate('/login');
                    return;
                }
                console.log('Authenticated user:', user);
                // בדיקה אם המשתמש כבר שלח בקשה
                const { data: userData } = await supabase
                    .from('users')
                    .select('status')
                    .eq('id', user.id)
                    .single();

                if (userData?.status === 'pending') {
                    navigate('/waiting-approval');
                    return;
                }

                if (userData?.status === 'approved') {
                    navigate('/home');
                    return;
                }

                if (userData?.status === 'rejected') {
                    navigate('/rejected');
                    return;
                }

                // רק אם המשתמש צריך לבצע onboarding - נטען את הנתונים
                setUser(user);

                // שליפת כל הקבוצות פעם אחת (עם cache)
                let groupsData = groupsCache;

                if (!groupsData) {
                    const { data } = await supabase
                        .from('group_node')
                        .select('id, name, group_type_id, parent_id')
                        .order('name');

                    groupsData = data || [];
                    setGroupsCache(groupsData); // שמירה ב-cache
                }

                if (groupsData) {
                    setAllGroups(groupsData);
                    const battalionsData = groupsData.filter(g => g.group_type_id === 2);
                    setBattalions(battalionsData);
                }

                setPageLoading(false); // סיום טעינה
            } catch (error) {
                console.error('Error in fetchUserAndData:', error);
                setPageLoading(false);
                navigate('/login');
            }
        };

        fetchUserAndData();
    }, [navigate]);

    // האזנה לשינויים בסטטוס המשתמש בזמן אמת
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('user-status-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    console.log('Status changed:', payload);
                    const newStatus = payload.new.status;

                    if (newStatus === 'approved') {
                        navigate('/home');
                    } else if (newStatus === 'rejected') {
                        navigate('/rejected');
                    } else if (newStatus === 'pending') {
                        navigate('/waiting-approval');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, navigate]);

    // עדכון פלוגות כשבוחרים גדוד (טעינה lazy)
    useEffect(() => {
        if (formData.battalion && allGroups.length > 0) {
            const companiesData = allGroups.filter(
                g => g.group_type_id === 3 && g.parent_id === parseInt(formData.battalion)
            );
            setCompanies(companiesData);
            setFormData(prev => ({ ...prev, company: '', team: '' }));
            setTeams([]);
        } else {
            setCompanies([]);
            setTeams([]);
        }
    }, [formData.battalion, allGroups]);

    // עדכון צוותים כשבוחרים פלוגה (טעינה lazy)
    useEffect(() => {
        if (formData.company && allGroups.length > 0) {
            const teamsData = allGroups.filter(
                g => g.group_type_id === 4 && g.parent_id === parseInt(formData.company)
            );
            setTeams(teamsData);
            setFormData(prev => ({ ...prev, team: '' }));
        } else {
            setTeams([]);
        }
    }, [formData.company, allGroups]);

    const toggleTheme = () => setIsDark(!isDark);

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleChange = (field) => (event) => {
        let value = event.target.value;

        if (field === 'fullName') {
            value = value.replace(/[^\u0590-\u05FF\s]/g, '');
        }

        if (field === 'phone') {
            value = value.replace(/[^0-9]/g, '');
            if (value.length > 3) {
                value = value.substring(0, 3) + '-' + value.substring(3, 10);
            }
        }

        setFormData({ ...formData, [field]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // המרת role לערך מספרי
            const roleId = formData.role === 'צוער' ? 7 : 6; // לפי הצורך, התאם את המספרים
            // שמירת המשתמש בטבלת users
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email,
                    full_name: formData.fullName,
                    phone: formData.phone,
                    group_id: formData.team, // שומרים רק את ה-ID של הצוות
                    status: 'pending',
                    created_date: new Date().toISOString(),
                    updated_date: new Date().toISOString()
                });

            if (insertError) {
                // אם המשתמש כבר קיים, עדכן אותו
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        full_name: formData.fullName,
                        phone: formData.phone,
                        group_id: formData.team, // שומרים רק את ה-ID של הצוות
                        status: 'pending',
                        updated_date: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (updateError) {
                    throw updateError;
                }
            }

            // שמירת ה-role בטבלת user_roles
            // תחילה נמחק role קודם אם קיים
            await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', user.id);

            // הוספת role חדש
            const { error: roleError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: user.id,
                    role_id: roleId, // ← make sure this matches the correct role (צוער=7, סגל=6)
                    assigned_date: new Date().toISOString()
                });

            if (roleError) {
                throw roleError;
            }

            navigate('/waiting-approval');
        } catch (error) {
            console.error('Error:', error);
            alert('שגיאה בשליחת הבקשה');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = formData.fullName && formData.phone && formData.battalion && formData.company && formData.team && formData.role;

    // מסך טעינה
    if (pageLoading) {
        return (
            <Box
                className={isDark ? 'dark' : 'light'}
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}
                dir="rtl"
            >
                <Box className="background-orbs">
                    <Box className="orb orb-1" />
                    <Box className="orb orb-2" />
                    <Box className="orb orb-3" />
                </Box>
                <Box className="noise-overlay" />

                <Box sx={{ textAlign: 'center', zIndex: 3 }}>
                    <Box
                        component="img"
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                        alt="מגדלור לוגו"
                        sx={{ width: 96, height: 96, objectFit: 'contain', mx: 'auto', mb: 3 }}
                    />
                    <CircularProgress
                        size={50}
                        sx={{ color: '#6366f1', mb: 2 }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            color: isDark ? 'white' : '#1e293b',
                            fontWeight: 600,
                            mb: 1
                        }}
                    >
                        טוען נתונים...
                    </Typography>
                    <Typography
                        sx={{
                            color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b',
                            fontSize: '14px'
                        }}
                    >
                        אנא המתן רגע
                    </Typography>
                </Box>
            </Box>
        );
    }

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
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                )}
            </Box>

            <Box
                onClick={handleLogout}
                sx={{
                    position: 'fixed', top: 24, right: 24, zIndex: 100,
                    width: 48, height: 48, borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'white',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                    color: isDark ? 'white' : '#1f2937',
                    '&:hover': { transform: 'translateY(-2px) scale(1.05)' }
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16,17 21,12 16,7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
            </Box>

            <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 3, py: 8 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Box sx={{ textAlign: 'center', mb: 6 }}>
                        <Box component="img"
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b00a201212578d09f8396/2f970d938_9.png"
                            alt="מגדלור" sx={{ width: 96, height: 96, mx: 'auto', mb: 3 }}
                        />
                        <Typography variant="h3" sx={{ fontWeight: 700, color: isDark ? 'white' : '#1e293b', mb: 1.5 }}>
                            ברוך הבא! 🎉
                        </Typography>
                        <Typography variant="h6" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#475569', mb: 1 }}>
                            בואו נשלים את הפרטים שלך
                        </Typography>
                        <Typography sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b', fontSize: '14px' }}>
                            הבקשה שלך תישלח לאישור מנהל
                        </Typography>
                    </Box>

                    <Card sx={{
                        p: 4, background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                        backdropFilter: 'blur(20px)', borderRadius: '24px',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                    }}>
                        <form onSubmit={handleSubmit}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            שם מלא (בעברית)
                                        </Typography>
                                        <UserPlus size={20} style={{ color: '#6366f1' }} />
                                    </Box>
                                    <TextField fullWidth value={formData.fullName} onChange={handleChange('fullName')}
                                        placeholder="הכנס את שמך המלא" required
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                                color: isDark ? 'white' : '#1f2937', borderRadius: '12px',
                                            },
                                            '& input': { textAlign: 'right' }
                                        }}
                                    />
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            מספר טלפון
                                        </Typography>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                    </Box>
                                    <TextField fullWidth value={formData.phone} onChange={handleChange('phone')}
                                        placeholder="05X-XXXXXXX" required
                                        inputProps={{
                                            pattern: '[0-9]{3}-[0-9]{7}',
                                            inputMode: 'numeric'
                                        }}
                                        onKeyPress={(e) => {
                                            if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                                                e.preventDefault();
                                            }
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                                color: isDark ? 'white' : '#1f2937', borderRadius: '12px',
                                            },
                                            '& input': { textAlign: 'right' }
                                        }}
                                    />
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            תפקיד
                                        </Typography>
                                        <Shield size={20} style={{ color: '#8b5cf6' }} />
                                    </Box>
                                    <RadioGroup
                                        value={formData.role}
                                        onChange={handleChange('role')}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'row',
                                            gap: 2
                                        }}
                                    >
                                        {['צוער', 'סגל'].map((roleType) => (
                                            <Box
                                                key={roleType}
                                                onClick={() => setFormData({ ...formData, role: roleType })}
                                                sx={{
                                                    p: 2,
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    flex: 1,
                                                    border: formData.role === roleType
                                                        ? `2px solid ${roleType === 'צוער' ? '#6366f1' : '#8b5cf6'}`
                                                        : isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                                                    bgcolor: formData.role === roleType
                                                        ? isDark ? `rgba(${roleType === 'צוער' ? '99, 102, 241' : '139, 92, 246'}, 0.1)`
                                                            : `rgba(${roleType === 'צוער' ? '99, 102, 241' : '139, 92, 246'}, 0.05)`
                                                        : 'transparent',
                                                }}
                                            >
                                                <FormControlLabel
                                                    value={roleType}
                                                    control={<Radio sx={{ color: isDark ? 'white' : '#1f2937' }} />}
                                                    label={
                                                        <Box>
                                                            <Typography sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                                                {roleType === 'צוער' ? 'צוער' : 'סגל'}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    sx={{ width: '100%', m: 0 }}
                                                />
                                            </Box>
                                        ))}
                                    </RadioGroup>
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            גדוד
                                        </Typography>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                            <polyline points="9 22 9 12 15 12 15 22" />
                                        </svg>
                                    </Box>
                                    <FormControl fullWidth required>
                                        <Select
                                            value={formData.battalion}
                                            onChange={handleChange('battalion')}
                                            displayEmpty
                                            dir="rtl"
                                            sx={{
                                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                                color: isDark ? 'white' : '#1f2937',
                                                borderRadius: '12px',
                                                textAlign: 'right',
                                                '& .MuiSelect-select': {
                                                    textAlign: 'right'
                                                }
                                            }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        '& .MuiMenuItem-root': {
                                                            direction: 'rtl',
                                                            justifyContent: 'flex-start'
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <MenuItem value="" disabled>בחר גדוד</MenuItem>
                                            {battalions.map((battalion) => (
                                                <MenuItem key={battalion.id} value={battalion.id}>{battalion.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            פלוגה
                                        </Typography>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <line x1="3" y1="9" x2="21" y2="9" />
                                            <line x1="9" y1="21" x2="9" y2="9" />
                                        </svg>
                                    </Box>
                                    <FormControl fullWidth required disabled={!formData.battalion}>
                                        <Select
                                            value={formData.company}
                                            onChange={handleChange('company')}
                                            displayEmpty
                                            dir="rtl"
                                            sx={{
                                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                                color: isDark ? 'white' : '#1f2937',
                                                borderRadius: '12px',
                                                textAlign: 'right',
                                                '& .MuiSelect-select': {
                                                    textAlign: 'right'
                                                }
                                            }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        '& .MuiMenuItem-root': {
                                                            direction: 'rtl',
                                                            justifyContent: 'flex-start'
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <MenuItem value="" disabled>
                                                {formData.battalion ? 'בחר פלוגה' : 'בחר גדוד תחילה'}
                                            </MenuItem>
                                            {companies.map((company) => (
                                                <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? 'white' : '#1f2937' }}>
                                            צוות
                                        </Typography>
                                        <Users size={20} style={{ color: '#f59e0b' }} />
                                    </Box>
                                    <FormControl fullWidth required disabled={!formData.company}>
                                        <Select
                                            value={formData.team}
                                            onChange={handleChange('team')}
                                            displayEmpty
                                            dir="rtl"
                                            sx={{
                                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                                color: isDark ? 'white' : '#1f2937',
                                                borderRadius: '12px',
                                                textAlign: 'right',
                                                '& .MuiSelect-select': {
                                                    textAlign: 'right'
                                                }
                                            }}
                                            MenuProps={{
                                                PaperProps: {
                                                    sx: {
                                                        '& .MuiMenuItem-root': {
                                                            direction: 'rtl',
                                                            justifyContent: 'flex-start'
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            <MenuItem value="" disabled>
                                                {formData.company ? 'בחר צוות' : 'בחר פלוגה תחילה'}
                                            </MenuItem>
                                            {teams.map((team) => (
                                                <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>

                                <Button type="submit" fullWidth disabled={!isFormValid || loading}
                                    sx={{
                                        mt: 2, py: 1.5, bgcolor: '#6366f1', color: 'white',
                                        borderRadius: '12px', fontSize: '16px', fontWeight: 600,
                                        '&:hover': { bgcolor: '#4f46e5' },
                                        '&:disabled': { bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb' }
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'שלח בקשה לאישור ←'}
                                </Button>
                            </Box>
                        </form>
                    </Card>
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
                .noise-overlay { position: absolute; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.03; }
                * { font-family: 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
            `}</style>
        </Box>
    );
}